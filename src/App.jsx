import { createSignal, onMount, createEffect, For, Show } from 'solid-js';
import { supabase } from './supabaseClient';
import { Auth } from '@supabase/auth-ui-solid';
import { ThemeSupa } from '@supabase/auth-ui-shared';

function App() {
  const [user, setUser] = createSignal(null);
  const [currentPage, setCurrentPage] = createSignal('login');
  const [tasks, setTasks] = createSignal([]);
  const [balance, setBalance] = createSignal(0);
  const [loading, setLoading] = createSignal(false);

  const checkUserSignedIn = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      setCurrentPage('dashboard');
    }
  };

  onMount(checkUserSignedIn);

  createEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        setUser(session.user);
        setCurrentPage('dashboard');
      } else {
        setUser(null);
        setCurrentPage('login');
      }
    });

    return () => {
      authListener.unsubscribe();
    };
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCurrentPage('login');
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/getTasks', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
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
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/getBalance', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance);
      } else {
        console.error('Error fetching balance:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  createEffect(() => {
    if (user()) {
      fetchTasks();
      fetchBalance();
    }
  });

  const completeTask = async (taskId) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/completeTask', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId }),
      });
      if (response.ok) {
        alert('Task completed successfully!');
        fetchTasks();
        fetchBalance();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error completing task:', error);
    } finally {
      setLoading(false);
    }
  };

  const [withdrawAmount, setWithdrawAmount] = createSignal('');
  const [walletAddress, setWalletAddress] = createSignal('');

  const requestWithdrawal = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/requestWithdrawal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(withdrawAmount()),
          walletAddress: walletAddress(),
        }),
      });
      if (response.ok) {
        alert('Withdrawal request submitted!');
        setWithdrawAmount('');
        setWalletAddress('');
        fetchBalance();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100 p-4">
      <Show
        when={currentPage() === 'dashboard'}
        fallback={
          <div class="flex items-center justify-center min-h-screen">
            <div class="w-full max-w-md p-8 bg-white rounded-xl shadow-lg">
              <h2 class="text-3xl font-bold mb-6 text-center text-purple-600">Sign in with ZAPT</h2>
              <a
                href="https://www.zapt.ai"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-500 hover:underline mb-6 block text-center"
              >
                Learn more about ZAPT
              </a>
              <Auth
                supabaseClient={supabase}
                appearance={{ theme: ThemeSupa }}
                providers={['google', 'facebook', 'apple']}
                magicLink={true}
                view="magic_link"
                showLinks={false}
                authView="magic_link"
              />
            </div>
          </div>
        }
      >
        <div class="max-w-6xl mx-auto">
          <div class="flex justify-between items-center mb-8">
            <h1 class="text-4xl font-bold text-purple-600">New App</h1>
            <div class="flex items-center space-x-4">
              <p class="text-lg font-semibold text-gray-700">Balance: {balance()} coins</p>
              <button
                class="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6 rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-red-400 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer"
                onClick={handleSignOut}
              >
                Sign Out
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 class="text-2xl font-bold mb-4 text-purple-600">Available Tasks</h2>
              <Show when={!loading()} fallback={<p>Loading tasks...</p>}>
                <div class="space-y-4">
                  <For each={tasks()}>
                    {(task) => (
                      <div class="bg-white p-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105">
                        <p class="font-semibold text-lg text-purple-600 mb-2">{task.description}</p>
                        <p class="text-gray-700 mb-2">Type: {task.type}</p>
                        <p class="text-gray-700 mb-4">Reward: {task.reward} coins</p>
                        <button
                          class="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-green-400 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer"
                          onClick={() => completeTask(task.id)}
                        >
                          Complete Task
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            <div>
              <h2 class="text-2xl font-bold mb-4 text-purple-600">Withdraw Earnings</h2>
              <div class="bg-white p-6 rounded-lg shadow-md">
                <div class="space-y-4">
                  <input
                    type="number"
                    placeholder="Amount to withdraw"
                    value={withdrawAmount()}
                    onInput={(e) => setWithdrawAmount(e.target.value)}
                    class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent box-border"
                  />
                  <input
                    type="text"
                    placeholder="Faucetpay Wallet Address"
                    value={walletAddress()}
                    onInput={(e) => setWalletAddress(e.target.value)}
                    class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent box-border"
                  />
                  <button
                    class={`w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer ${loading() ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={requestWithdrawal}
                    disabled={loading()}
                  >
                    {loading() ? 'Processing...' : 'Request Withdrawal'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default App;