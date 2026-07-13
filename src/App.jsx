import React, { useState, useEffect } from 'react';
import MobileLayout from './components/MobileLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Roster from './pages/Roster';
import Arena from './pages/Arena';
import Guild from './pages/Guild';
import Raid from './pages/Raid';
import { api } from './utils/api';
import { db, auth } from './utils/firebaseClient';
import { onAuthStateChanged, signOut } from 'firebase/auth';

if (typeof window !== 'undefined') {
  window.api = api;
  window.db = db;
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

  // WebSocket / Realtime mocked for Firebase tests
  const isConnected = true;
  const worldChannel = null;
  const activePlayers = [];
  const [receivedChallenge, setReceivedChallenge] = useState(null);
  const [battleState, setBattleState] = useState(null);

  // Initial load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        loadUserData();
      } else {
        handleLogout();
        setLoading(false);
      }
    });
    return () => unsubscribe();
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
             const updated = monList.find(m => m.id === prev.id);
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
      if (err.message === 'User not authenticated') {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh interval
  useEffect(() => {
    let intervalId;
    if (user) {
      intervalId = setInterval(() => {
        loadUserData();
      }, 10000); // Poll every 10 seconds
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user]);

  const handleLoginSuccess = () => {
    // onAuthStateChanged handles loading data
  };

  const handleLogout = async () => {
    if (auth.currentUser) await signOut(auth);
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 p-4">
      <MobileLayout isConnected={isConnected} page={page} setPage={setPage}>
        {page === 'dashboard' && <Dashboard user={user} monsters={monsters} inventory={inventory} refreshData={loadUserData} activeMonster={activeMonster} setActiveMonster={setActiveMonster} setPage={setPage} />}
        {page === 'roster' && <Roster user={user} monsters={monsters} inventory={inventory} refreshData={loadUserData} activeMonster={activeMonster} setActiveMonster={setActiveMonster} setPage={setPage} />}
        {page === 'arena' && <Arena user={user} monsters={monsters} friends={friends} activeMonster={activeMonster} channel={worldChannel} activePlayers={activePlayers} receivedChallenge={receivedChallenge} setReceivedChallenge={setReceivedChallenge} battleState={battleState} setBattleState={setBattleState} refreshData={loadUserData} setPage={setPage} />}
        {page === 'guild' && <Guild user={user} guilds={guilds} myGuild={myGuild} refreshData={loadUserData} setPage={setPage} />}
        {page === 'raid' && <Raid user={user} monsters={monsters} activeMonster={activeMonster} refreshData={loadUserData} setPage={setPage} />}
      </MobileLayout>
      <div className="mt-4 flex gap-4 text-xs">
        <button onClick={loadUserData} className="text-slate-400 hover:text-white transition">🔄 重新整理</button>
        <span className="text-slate-600">|</span>
        <button onClick={handleLogout} className="text-rose-500 hover:text-rose-400 transition">🚪 安全登出 ({user.username})</button>
      </div>
    </div>
  );
}
