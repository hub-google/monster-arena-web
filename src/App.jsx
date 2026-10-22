import React, { useState, useEffect } from 'react';
import MobileLayout from './components/MobileLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Roster from './pages/Roster';
import Arena from './pages/Arena';
import Guild from './pages/Guild';
import Raid from './pages/Raid';
import Social from './pages/Social';
import Pokedex from './pages/Pokedex';
import { api } from './utils/api';
import { supabase } from './utils/supabaseClient';

export default function App() {
  const [user,setUser]=useState(null);
  const [monsters,setMonsters]=useState([]);
  const [inventory,setInventory]=useState([]);
  const [friends,setFriends]=useState([]);
  const [guilds,setGuilds]=useState([]);
  const [myGuild,setMyGuild]=useState(null);
  const [activeMonster,setActiveMonster]=useState(null);
  const [page,setPage]=useState('dashboard');
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [receivedChallenge,setReceivedChallenge]=useState(null);
  const [battleState,setBattleState]=useState(null);
  const [isOnline,setIsOnline]=useState(typeof navigator==='undefined' || navigator.onLine);

  const clearUser=()=>{
    setUser(null);setMonsters([]);setInventory([]);setFriends([]);
    setGuilds([]);setMyGuild(null);setActiveMonster(null);
    setBattleState(null);setReceivedChallenge(null);setLoadError('');
  };

  const loadUserData=async()=>{
    setLoadError('');
    try {
      const profile=await api.getMe();
      const [ownedMonsters,ownedInventory,friendsList,guildInfo] = await Promise.all([
        api.getMonsters(),api.getInventory(),api.getFriends(),api.getGuilds()
      ]);
      setUser(profile);
      setMonsters(ownedMonsters);
      setInventory(ownedInventory);
      setFriends(friendsList);
      setGuilds(guildInfo.guilds);
      setMyGuild(guildInfo.myGuild);
      setActiveMonster(previous=>{
        const live=ownedMonsters.find(m=>!m.is_dead);
        return ownedMonsters.find(m=>m.monster_id===previous?.monster_id)||live||null;
      });
    } catch(err) {
      console.error('Game data load failed:',err);
      setLoadError(err.message||'資料載入失敗');
    } finally {setLoading(false);}
  };

  useEffect(()=>{
    let ready=true;
    let previousAuthId=null;
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(!ready)return;
      const nextUid=session?.user?.id??null;
      if(!nextUid){previousAuthId=null;clearUser();setLoading(false);return;}
      if(previousAuthId===nextUid)return;
      previousAuthId=nextUid;
      setLoading(true);
      // Auth callbacks must not synchronously await Supabase database operations.
      setTimeout(()=>{if(ready)loadUserData();},0);
    });
    return ()=>{ready=false;subscription.unsubscribe();};
  },[]);

  useEffect(()=>{
    const online=()=>setIsOnline(navigator.onLine);
    window.addEventListener('online',online);window.addEventListener('offline',online);
    return ()=>{window.removeEventListener('online',online);window.removeEventListener('offline',online);};
  },[]);

  useEffect(()=>{
    if(!user)return;
    const id=setInterval(()=>{
      if(document.visibilityState==='visible')loadUserData();
    },300000);
    return ()=>clearInterval(id);
  },[user?.user_id]);

  const handleLogout=async()=>{
    try {await api.logout();}catch(err){console.warn('Logout failed:',err);}
    clearUser();setLoading(false);
  };

  if(loading)return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-cyan-400">
    <span className="text-4xl">👾</span><span className="mt-4">載入遊戲數據中...</span>
  </div>;

  if(loadError)return <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 text-white p-6 text-center">
    <h2 className="text-xl font-bold">遊戲資料讀取失敗</h2>
    <p className="text-rose-400 max-w-md break-words">{loadError}</p>
    <button onClick={loadUserData} className="neon-button neon-button-primary px-6 py-3">重試載入</button>
    <button onClick={handleLogout} className="text-sm text-slate-400 underline">登出重新登入</button>
  </div>;

  if(!user)return <Login onLoginSuccess={()=>{setLoading(true);loadUserData();}} />;

  const activePlayers=[];
  return <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
    <MobileLayout isConnected={isOnline} page={page} setPage={setPage}>
      {page==='dashboard'&&<Dashboard user={user} monsters={monsters} inventory={inventory} refreshData={loadUserData}
        activeMonster={activeMonster} setActiveMonster={setActiveMonster} setPage={setPage}/>}
      {page==='roster'&&<Roster user={user} monsters={monsters} inventory={inventory} refreshData={loadUserData}
        activeMonster={activeMonster} setActiveMonster={setActiveMonster} setPage={setPage}/>}
      {page==='arena'&&<Arena user={user} monsters={monsters} friends={friends} activeMonster={activeMonster}
        channel={null} activePlayers={activePlayers} receivedChallenge={receivedChallenge}
        setReceivedChallenge={setReceivedChallenge} battleState={battleState}
        setBattleState={setBattleState} refreshData={loadUserData} setPage={setPage}/>}
      {page==='raid'&&<Raid user={user} monsters={monsters} activeMonster={activeMonster}
        refreshData={loadUserData} setPage={setPage}/>}
      {page==='guild'&&<Guild user={user} guilds={guilds} myGuild={myGuild}
        refreshData={loadUserData} setPage={setPage}/>}
      {page==='social'&&<Social user={user}/>}
      {page==='pokedex'&&<Pokedex setPage={setPage}/>}
    </MobileLayout>
    <div className="mt-4 flex gap-4 text-xs">
      <button onClick={loadUserData} className="text-slate-400 hover:text-cyan-600">重新整理</button>
      <span className="text-slate-600">|</span>
      <button onClick={handleLogout} className="text-rose-500 hover:text-rose-400">安全登出 ({user.username})</button>
    </div>
  </div>;
}
