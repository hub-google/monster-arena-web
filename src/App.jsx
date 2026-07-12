import React, { useState, useEffect } from 'react';
import HandheldBezel from './components/HandheldBezel';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Roster from './pages/Roster';
import Arena from './pages/Arena';
import Guild from './pages/Guild';
import Raid from './pages/Raid';
import { api } from './utils/api';
import { supabase } from './utils/supabaseClient';

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

  // WebSocket (Supabase Realtime) states
  const [worldChannel, setWorldChannel] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activePlayers, setActivePlayers] = useState([]);
  const [receivedChallenge, setReceivedChallenge] = useState(null);
  const [battleState, setBattleState] = useState(null);

  // Initial load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadUserData(session.user);
      else setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) loadUserData(session.user);
      else handleLogout();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Supabase Realtime
  useEffect(() => {
    if (!user) {
      if (worldChannel) {
        supabase.removeChannel(worldChannel);
        setWorldChannel(null);
      }
      setIsConnected(false);
      return;
    }

    const channel = supabase.channel('world_room', {
      config: {
        presence: { key: user.user_id },
        broadcast: { self: true }
      }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const players = Object.keys(state).map(k => state[k][0]?.user).filter(Boolean);
        setActivePlayers(players);
      })
      .on('broadcast', { event: 'challenge' }, ({ payload }) => {
        if (payload.targetUserId === user.user_id) {
          setReceivedChallenge(payload);
          setPage('arena');
        }
      })
      .on('broadcast', { event: 'battle_start' }, ({ payload }) => {
        if (payload.roomId === user.user_id || payload.targetUserId === user.user_id) {
          setBattleState({
            roomId: payload.roomId,
            mA: payload.mA,
            mB: payload.mB,
            logs: ['💥 戰鬥開始！'],
            isOver: false,
            winner: null
          });
          setPage('arena');
        }
      })
      .on('broadcast', { event: 'battle_end' }, ({ payload }) => {
        if (battleState && payload.roomId === battleState.roomId) {
          setBattleState(prev => prev ? { ...prev, isOver: true, winner: payload.winner, logs: [...prev.logs, payload.log] } : null);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          channel.track({ user: { user_id: user.user_id, username: user.username } });
        }
      });

    setWorldChannel(channel);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadUserData = async () => {
    try {
      const userProfile = await api.getMe();
      setUser(userProfile);

      const monList = await api.getMonsters();
      setMonsters(monList);

      if (monList.length > 0) {
        const alive = monList.find(m => !m.is_dead);
        if (alive && !activeMonster) setActiveMonster(alive);
      }

      const invList = await api.getInventory();
      setInventory(invList);

      const friendList = await api.getFriends();
      setFriends(friendList);

      const guildData = await api.getGuilds();
      setGuilds(guildData.guilds);
      setMyGuild(guildData.myGuild);

    } catch (err) {
      console.error('Data load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    // onAuthStateChange handles loading data
  };

  const handleLogout = () => {
    supabase.auth.signOut();
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
      <HandheldBezel isConnected={isConnected}>
        {page === 'dashboard' && <Dashboard user={user} monsters={monsters} inventory={inventory} refreshData={loadUserData} activeMonster={activeMonster} setActiveMonster={setActiveMonster} setPage={setPage} />}
        {page === 'roster' && <Roster user={user} monsters={monsters} inventory={inventory} refreshData={loadUserData} activeMonster={activeMonster} setActiveMonster={setActiveMonster} setPage={setPage} />}
        {page === 'arena' && <Arena user={user} monsters={monsters} friends={friends} activeMonster={activeMonster} channel={worldChannel} activePlayers={activePlayers} receivedChallenge={receivedChallenge} setReceivedChallenge={setReceivedChallenge} battleState={battleState} setBattleState={setBattleState} refreshData={loadUserData} setPage={setPage} />}
        {page === 'guild' && <Guild user={user} guilds={guilds} myGuild={myGuild} refreshData={loadUserData} setPage={setPage} />}
        {page === 'raid' && <Raid user={user} monsters={monsters} activeMonster={activeMonster} refreshData={loadUserData} setPage={setPage} />}
      </HandheldBezel>
      <div className="mt-4 flex gap-4 text-xs">
        <button onClick={loadUserData} className="text-slate-400 hover:text-white transition">🔄 重新整理</button>
        <span className="text-slate-600">|</span>
        <button onClick={handleLogout} className="text-rose-500 hover:text-rose-400 transition">🚪 安全登出 ({user.username})</button>
      </div>
    </div>
  );
}
