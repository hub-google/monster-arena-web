import React, { useState, useEffect } from 'react';
import MobileLayout from './components/MobileLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Roster from './pages/Roster';
import Arena from './pages/Arena';
import Guild from './pages/Guild';
import Social from './pages/Social';
import Pokedex from './pages/Pokedex';
import { api } from './utils/api';
import { supabase, auth } from './utils/supabaseClient';

if (typeof window !== 'undefined') {
  window.api = api;
  window.supabase = supabase;
  window.auth = auth;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [monsters, setMonsters] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [friends, setFriends] = useState([]);
  const [guilds, setGuilds] = useState([]);
  const [myGuild, setMyGuild] = useState(null);
  
  const [activeMonster, setActiveMonster] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);

  // Realtime & PvP states
  const [activePlayers, setActivePlayers] = useState([]);
  const [receivedChallenge, setReceivedChallenge] = useState(null);
  const [battleState, setBattleState] = useState(null);
  const isConnected = true;
  const worldChannel = null;

  // Initial load
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveringPassword(true);
      }
      if (session?.user) {
        loadUserData();
      } else {
        handleLogout();
        setLoading(false);
      }
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loadUserData = async () => {
    try {
      const userProfile = await api.getMe();
      setUser(userProfile);

      const monList = await api.getMonsters();
      setMonsters(monList);

      if (monList.length > 0) {
        const alive = monList.find(m => !m.is_dead);
        setActiveMonster(prev => {
          if (!prev && alive) return alive;
          if (prev) {
             const updated = monList.find(m => m.monster_id === prev.monster_id);
             return updated || prev;
          }
          return prev;
        });
      }

      const invList = await api.getInventory();
      setInventory(invList);

      const friendList = await api.getFriends();
      setFriends(friendList);

      const guildData = await api.getGuilds();
      setGuilds(guildData.guilds);
      setMyGuild(guildData.myGuild);

    } catch (err) {
      console.error(err);
      alert("❌ 載入玩家資料失敗：" + err.message);
      if (err.message === 'User not authenticated') {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMonsterData = async () => {
    try {
      const monList = await api.getMonsters();
      setMonsters(monList);

      if (monList.length > 0) {
        const alive = monList.find(m => !m.is_dead);
        setActiveMonster(prev => {
          if (!prev && alive) return alive;
          if (prev) {
             const updated = monList.find(m => m.monster_id === prev.monster_id);
             return updated || prev;
          }
          return prev;
        });
      }
      
      const players = await api.searchPlayers();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setActivePlayers(players.filter(p => p.user_id !== currentUser?.id));
    } catch (err) {
      console.error("Error polling data:", err);
    }
  };

  // Auto-refresh interval and Challenge listener
  useEffect(() => {
    let intervalId;
    let unsubChallenges;
    if (user) {
      intervalId = setInterval(() => {
        loadMonsterData();
      }, 10000); // Poll every 10 seconds
      
      loadMonsterData();

      unsubChallenges = api.subscribeChallenges((challenges) => {
        if (challenges.length > 0) {
          setReceivedChallenge(challenges[0]);
        } else {
          setReceivedChallenge(null);
        }
      });
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (unsubChallenges) unsubChallenges();
    };
  }, [user]);

  const handleLoginSuccess = () => {
    // onAuthStateChanged handles loading data
  };

  const handleLogout = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await supabase.auth.signOut();
    setUser(null);
    setMonsters([]);
    setInventory([]);
    setFriends([]);
    setGuilds([]);
    setMyGuild(null);
    setActiveMonster(null);
    setBattleState(null);
    setReceivedChallenge(null);
  };

  if (isRecoveringPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-6 font-sans">
        <div className="bg-slate-800 p-8 rounded-xl border border-cyan-500/30 max-w-sm w-full shadow-[0_0_15px_rgba(8,145,178,0.3)]">
          <h2 className="text-2xl font-bold text-cyan-400 mb-6 text-center">設定新密碼</h2>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const newPassword = e.target.newPassword.value;
            try {
              await api.updatePassword(newPassword);
              alert("✅ 密碼更新成功！請記住您的新密碼。");
              setIsRecoveringPassword(false);
            } catch (err) {
              alert("更新失敗：" + err.message);
            }
          }}>
            <label className="block text-xs font-bold text-cyan-500 mb-2">輸入新密碼</label>
            <input 
              name="newPassword" 
              type="password" 
              required 
              minLength="6"
              className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-lg px-4 py-3 text-white mb-6" 
              placeholder="••••••••" 
            />
            <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg transition">
              確認更改
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-purple-400 font-sans">
        <span className="text-4xl animate-bounce">👾</span>
        <span className="mt-4 font-semibold tracking-wide">載入遊戲數據中...</span>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }



  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
      <MobileLayout isConnected={isConnected} page={page} setPage={setPage}>
        {page === 'dashboard' && <Dashboard user={user} monsters={monsters} inventory={inventory} refreshData={loadUserData} activeMonster={activeMonster} setActiveMonster={setActiveMonster} setPage={setPage} />}
        {page === 'roster' && <Roster user={user} monsters={monsters} inventory={inventory} friends={friends} refreshData={loadUserData} activeMonster={activeMonster} setActiveMonster={setActiveMonster} setPage={setPage} />}
        {page === 'arena' && <Arena user={user} monsters={monsters} friends={friends} activeMonster={activeMonster} channel={worldChannel} activePlayers={activePlayers} receivedChallenge={receivedChallenge} setReceivedChallenge={setReceivedChallenge} battleState={battleState} setBattleState={setBattleState} refreshData={loadUserData} setPage={setPage} />}
        {page === 'guild' && <Guild user={user} guilds={guilds} myGuild={myGuild} refreshData={loadUserData} setPage={setPage} />}
        {page === 'social' && <Social user={user} activePlayers={activePlayers} monsters={monsters} refreshData={loadUserData} setPage={setPage} />}
        {page === 'pokedex' && <Pokedex setPage={setPage} />}
      </MobileLayout>
      <div className="mt-4 flex gap-4 text-xs">
        <button onClick={loadUserData} className="text-slate-400 hover:text-white transition">🔄 重新整理</button>
        <span className="text-slate-600">|</span>
        <button onClick={handleLogout} className="text-rose-500 hover:text-rose-400 transition">🚪 安全登出 ({user.username})</button>
      </div>
    </div>
  );
}
