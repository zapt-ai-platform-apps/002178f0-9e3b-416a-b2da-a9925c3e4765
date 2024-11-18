import { createSignal, onMount, For, Show, createEffect } from 'solid-js';

function App() {
  const [apiKey, setApiKey] = createSignal(localStorage.getItem('apiKey') || '');
  const [walletAddress, setWalletAddress] = createSignal(localStorage.getItem('walletAddress') || '');
  const [tasks, setTasks] = createSignal([]);
  const [balance, setBalance] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [withdrawAmount, setWithdrawAmount] = createSignal('');
  const [currentPage, setCurrentPage] = createSignal(apiKey() ? 'homePage' : 'login');
  const [lastClaimTime, setLastClaimTime] = createSignal(null);
  const [canClaimFaucet, setCanClaimFaucet] = createSignal(false);
  const [timeUntilNextClaim, setTimeUntilNextClaim] = createSignal('');

  onMount(() => {
    if (apiKey()) {
      fetchWalletAddress();
      fetchTasks();
      fetchBalance();

      const timer = setInterval(() => {
        updateFaucetStatus();
      }, 1000);

      return () => clearInterval(timer);
    }
  });

  const handleLogin = async () => {
    if (apiKey()) {
      setLoading(true);
      try {
        // Fetch wallet address using the API key
        const params = {
          api_key: apiKey(),
          nonce: Date.now(),
        };

        const formBody = new URLSearchParams(params).toString();

        const response = await fetch('https://faucetpay.io/api/v1/balance', {
          method: 'POST',
          body: formBody,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
          }
        });

        const data = await response.json();

        if (data.status === 200) {
          const address = data.data.address;
          setWalletAddress(address);
          localStorage.setItem('apiKey', apiKey());
          localStorage.setItem('walletAddress', address);
          setCurrentPage('homePage');
          fetchTasks();
          fetchBalance();

          const timer = setInterval(() => {
            updateFaucetStatus();
          }, 1000);

          return () => clearInterval(timer);
        } else {
          alert('مفتاح API غير صالح. يرجى التحقق والمحاولة مرة أخرى.');
        }
      } catch (error) {
        console.error('Error fetching wallet address:', error);
        alert('حدث خطأ أثناء التحقق من مفتاح API.');
      } finally {
        setLoading(false);
      }
    } else {
      alert('يرجى إدخال مفتاح API الخاص بك');
    }
  };

  const fetchWalletAddress = async () => {
    if (!apiKey()) return;
    try {
      const params = {
        api_key: apiKey(),
        nonce: Date.now(),
      };

      const formBody = new URLSearchParams(params).toString();

      const response = await fetch('https://faucetpay.io/api/v1/balance', {
        method: 'POST',
        body: formBody,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        }
      });

      const data = await response.json();

      if (data.status === 200) {
        setWalletAddress(data.data.address);
        localStorage.setItem('walletAddress', data.data.address);
      } else {
        alert('فشل في جلب عنوان المحفظة. يرجى تسجيل الدخول مرة أخرى.');
        handleLogout();
      }
    } catch (error) {
      console.error('Error fetching wallet address:', error);
      alert('حدث خطأ أثناء جلب عنوان المحفظة.');
      handleLogout();
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/getTasks', {
        method: 'GET',
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      } else {
        console.error('Error fetching tasks:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const response = await fetch('/api/getBalance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: walletAddress() }),
      });
      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance);
        if (data.lastClaimTime) {
          setLastClaimTime(new Date(data.lastClaimTime));
        } else {
          setLastClaimTime(null);
        }
        updateFaucetStatus();
      } else {
        console.error('Error fetching balance:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const updateFaucetStatus = () => {
    if (lastClaimTime()) {
      const now = new Date();
      const nextClaimTime = new Date(lastClaimTime());
      nextClaimTime.setHours(nextClaimTime.getHours() + 24);

      if (now >= nextClaimTime) {
        setCanClaimFaucet(true);
        setTimeUntilNextClaim('');
      } else {
        setCanClaimFaucet(false);
        const diff = nextClaimTime - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeUntilNextClaim(`${hours} ساعات ${minutes} دقائق ${seconds} ثواني`);
      }
    } else {
      setCanClaimFaucet(true);
      setTimeUntilNextClaim('');
    }
  };

  const completeTask = async (taskId) => {
    setLoading(true);
    try {
      const response = await fetch('/api/completeTask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: walletAddress(), taskId }),
      });
      if (response.ok) {
        alert('تم إكمال المهمة بنجاح!');
        fetchTasks();
        fetchBalance();
      } else {
        const errorData = await response.json();
        alert(`خطأ: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error completing task:', error);
    } finally {
      setLoading(false);
    }
  };

  const claimFaucet = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/claimFaucet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: walletAddress() }),
      });
      if (response.ok) {
        alert('تم جمع المكافأة من الصنبور بنجاح!');
        fetchBalance();
      } else {
        const errorData = await response.json();
        alert(`خطأ: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error claiming faucet:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestWithdrawal = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/requestWithdrawal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: walletAddress(),
          apiKey: apiKey(),
          amount: parseFloat(withdrawAmount()),
          walletAddress: walletAddress(),
        }),
      });
      if (response.ok) {
        alert('تم تقديم طلب السحب!');
        setWithdrawAmount('');
        fetchBalance();
      } else {
        const errorData = await response.json();
        alert(`خطأ: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('apiKey');
    localStorage.removeItem('walletAddress');
    setApiKey('');
    setWalletAddress('');
    setCurrentPage('login');
  };

  return (
    <div class="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100 p-4 text-gray-800">
      <Show
        when={currentPage() === 'homePage'}
        fallback={
          <div class="flex items-center justify-center min-h-screen">
            <div class="w-full max-w-md p-8 bg-white rounded-xl shadow-lg">
              <h2 class="text-3xl font-bold mb-6 text-center text-purple-600">تسجيل الدخول باستخدام مفتاح API لمحفظة FaucetPay</h2>
              <input
                type="text"
                placeholder="أدخل مفتاح API الخاص بك"
                value={apiKey()}
                onInput={(e) => setApiKey(e.target.value)}
                class="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent box-border"
              />
              <button
                class={`w-full px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer ${
                  loading() ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={handleLogin}
                disabled={loading()}
              >
                {loading() ? 'جارٍ التحقق...' : 'تسجيل الدخول'}
              </button>
            </div>
          </div>
        }
      >
        <div class="max-w-6xl mx-auto h-full">
          <div class="flex justify-between items-center mb-8">
            <h1 class="text-4xl font-bold text-purple-600">التطبيق الجديد</h1>
            <div class="flex items-center space-x-4">
              <p class="text-lg font-semibold text-gray-700">الرصيد: {balance()} عملات</p>
              <button
                class="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-red-400 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer"
                onClick={handleLogout}
              >
                تسجيل الخروج
              </button>
            </div>
          </div>

          <div class="my-4">
            <h2 class="text-2xl font-bold mb-4 text-purple-600">صنبور العملات الرقمية</h2>
            <button
              class={`px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer ${
                !canClaimFaucet() || loading() ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={claimFaucet}
              disabled={!canClaimFaucet() || loading()}
            >
              {loading() ? 'جارٍ المعالجة...' : 'جمع من الصنبور'}
            </button>
            <Show when={!canClaimFaucet() && timeUntilNextClaim()}>
              <p class="mt-2 text-gray-700">يمكنك جمع من الصنبور بعد: {timeUntilNextClaim()}</p>
            </Show>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
            <div>
              <h2 class="text-2xl font-bold mb-4 text-purple-600">المهام المتاحة</h2>
              <Show when={!loading()} fallback={<p>جارٍ تحميل المهام...</p>}>
                <div class="space-y-4">
                  <For each={tasks()}>
                    {(task) => (
                      <div class="bg-white p-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105">
                        <p class="font-semibold text-lg text-purple-600 mb-2">{task.description}</p>
                        <p class="text-gray-700 mb-2">نوع المهمة: {task.type}</p>
                        <p class="text-gray-700 mb-4">المكافأة: {task.reward} عملات</p>
                        <button
                          class="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-green-400 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer"
                          onClick={() => completeTask(task.id)}
                          disabled={loading()}
                        >
                          أكمل المهمة
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            <div>
              <h2 class="text-2xl font-bold mb-4 text-purple-600">سحب الأرباح</h2>
              <div class="bg-white p-6 rounded-lg shadow-md h-full flex flex-col justify-between">
                <div class="space-y-4">
                  <input
                    type="number"
                    placeholder="المبلغ المراد سحبه"
                    value={withdrawAmount()}
                    onInput={(e) => setWithdrawAmount(e.target.value)}
                    class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent box-border"
                  />
                  <p class="text-gray-700">سيتم السحب إلى محفظتك: {walletAddress()}</p>
                </div>
                <button
                  class={`w-full mt-4 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer ${
                    loading() ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  onClick={requestWithdrawal}
                  disabled={loading()}
                >
                  {loading() ? 'جارٍ المعالجة...' : 'طلب سحب'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default App;