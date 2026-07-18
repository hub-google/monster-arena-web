import React, { useState, useEffect } from 'react';
import MonsterPixelArt from '../components/MonsterPixelArt';
import { api } from '../utils/api';
import { tickBattle, initBattleState } from '../utils/BattleEngine';

const STAGE_NAMES = ['蛋', '蛋', '幼年期', '成長期', '成熟期', '完全體', '究極體'];

export default function Arena({ 
  user, 
  monsters, 
  activeMonster, 
  receivedChallenge, 
  setReceivedChallenge, 
  battleState, 
  setBattleState, 
  refreshData, 
  setPage 
}) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [wildLevel, setWildLevel] = useState(4);
  const [raidBossState, setRaidBossState] = useState(null);
  
  const [friends, setFriends] = useState([]);
  const [guild, setGuild] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState('');
  const [selectedGuildMember, setSelectedGuildMember] = useState('');
  const [guildMembers, setGuildMembers] = useState([]);

  useEffect(() => {
    api.getFriends().then(setFriends).catch(e => console.warn(e));
    api.getGuilds().then(res => {
      setGuild(res.myGuild);
      if (res.myGuild) {
        api.getGuildMembers(res.myGuild.guild_id).then(setGuildMembers).catch(console.error);
      }
    }).catch(e => console.warn(e));
  }, []);

  // Battle ATB Engine
  useEffect(() => {
    if (!battleState || battleState.isOver) return;
    
    const interval = setInterval(() => {
      setBattleState(prev => {
        if (!prev || prev.isOver) return prev;
        return tickBattle(prev);
      });
    }, 200);

    return () => clearInterval(interval);
  }, [battleState, setBattleState]);

  useEffect(() => {
    if (battleState && battleState.isOver && !battleState.resolved) {
      const isWin = battleState.winner === 'A';
      api.resolveBattle(battleState.mA.monster_id, isWin)
        .then(res => {
          setMessage(res.message);
          setBattleState(prev => ({ ...prev, resolved: true }));
          refreshData();
        })
        .catch(err => setMessage(`❌ ${err.message}`));
    }
  }, [battleState, refreshData]);

  const fastForwardBattle = () => {
    setBattleState(prev => {
      if (!prev || prev.isOver) return prev;
      let next = prev;
      let safetyCounter = 0;
      while (!next.isOver && safetyCounter < 1000) {
        safetyCounter++;
        next = tickBattle(next);
      }
      if (next.isOver) {
        next = { ...next, logs: [...next.logs, `⏭️ 已跳過動畫，瞬間結算完成！`] };
      }
      return next;
    });
  };

  const handleAcceptIncoming = async () => {
    const monster = activeMonster || monsters[0];
    if (!monster || monster.is_dead) return setMessage('❌ 出戰怪獸狀態異常！');
    try {
      await api.respondChallenge(receivedChallenge.id, true, monster);
      handleAcceptChallenge(receivedChallenge.monster_data, monster);
    } catch (e) {
      setMessage(`❌ 接受失敗：${e.message}`);
    }
  };

  const handleDeclineIncoming = async () => {
    try {
      await api.respondChallenge(receivedChallenge.id, false, null);
      setReceivedChallenge(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcceptChallenge = (mA, mB) => {
    setReceivedChallenge(null);
    api.trackQuestProgress('battle', 1).catch(e => console.warn(e));
    setBattleState(initBattleState(mA, mB));
  };

  const handleChallengePlayer = async (targetUserId) => {
    if (!targetUserId) return setMessage('請選擇對手');
    if (!activeMonster || activeMonster.is_dead) return setMessage('你的怪獸無法戰鬥！');
    try {
      const pMonsters = await api.getFriendMonsters(targetUserId);
      const mBTeam = pMonsters.filter(m => !m.is_dead).slice(0, 3);
      if (mBTeam.length === 0) return setMessage('對方沒有可戰鬥的怪獸');
      const myTeam = [activeMonster, ...monsters.filter(m => m.monster_id !== activeMonster.monster_id && !m.is_dead)].slice(0, 3);
      handleAcceptChallenge(myTeam, mBTeam);
    } catch (e) {
      setMessage(e.message);
    }
  };

  const handleWorldBossAttack = async () => {
    if (!activeMonster || activeMonster.is_dead) return setMessage('請選擇存活的怪獸！');
    if (user.stamina < 15) return setMessage('體力不足');
    
    setRaidBossState({ active: true, damage: 0, hp: 500000, maxHp: 500000, message: '', animating: true });

    try {
      const dmg = Math.floor(activeMonster.combat_atk * 20 * (0.9 + Math.random() * 0.2));
      const res = await api.attackRaidBoss(activeMonster.monster_id, dmg);
      
      setTimeout(() => {
        setRaidBossState({ 
          active: true, 
          damage: dmg, 
          hp: res.hp || 0, 
          maxHp: res.maxHp || 500000, 
          message: `💥 造成 ${dmg} 點傷害！\n${res.message}`, 
          animating: false 
        });
        refreshData();
      }, 1000);
    } catch (e) { 
      setRaidBossState(null);
      setMessage(e.message); 
    }
  };

  // Scroll to bottom of logs
  const logsEndRef = React.useRef(null);
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [battleState?.logs]);

  if (raidBossState && raidBossState.active) {
    return (
      <div className="flex flex-col h-full bg-black relative overflow-hidden p-6 text-center items-center justify-center font-serif">
        {/* Particle/Background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/40 via-black to-black z-0"></div>
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] animate-[pulse_4s_ease-in-out_infinite] z-0"></div>
        <div className="absolute top-0 left-0 w-full h-full border-[10px] border-red-900/30 z-10 pointer-events-none mix-blend-overlay"></div>
        
        {/* Title */}
        <div className="z-20 mb-12 relative w-full flex flex-col items-center">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent -z-10"></div>
          <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-rose-400 via-red-600 to-red-900 drop-shadow-[0_0_20px_rgba(255,0,0,1)] tracking-[0.5em] uppercase">
            啟示錄獸
          </h2>
          <span className="text-red-500/80 text-xs tracking-[1em] mt-2 uppercase font-mono">Apocalymon</span>
        </div>
        
        {/* Boss Character & HP Bar */}
        <div className="relative z-20 w-full max-w-md mx-auto mb-16 flex flex-col items-center">
           {/* Boss Image/Sprite Wrapper */}
           <div className={`relative mb-12 flex justify-center items-center w-48 h-48 rounded-full border-4 border-red-900/50 shadow-[0_0_50px_rgba(220,38,38,0.3)] bg-slate-950 transition-transform duration-75 ${raidBossState.animating ? 'scale-110 -translate-y-2 drop-shadow-[0_0_80px_rgba(255,0,0,0.8)]' : 'scale-100 hover:scale-105'} animate-[float_4s_ease-in-out_infinite]`}>
             <div className="absolute inset-0 rounded-full border-2 border-red-500/30 animate-[spin_10s_linear_infinite] border-dashed"></div>
             <span className="text-7xl drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">👿</span>
           </div>
           
           {/* HP Bar */}
           <div className="w-full px-4">
               <div className="flex justify-between items-end text-xs mb-2 px-1">
                   <div className="flex flex-col items-start">
                     <span className="text-red-400 font-bold tracking-widest text-[10px]">WORLD BOSS</span>
                     <span className="text-white font-mono text-sm">HP</span>
                   </div>
                   <span className="text-white font-mono font-bold text-lg drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]">
                     {Math.round(raidBossState.hp).toLocaleString()} <span className="text-red-500/70 text-sm">/ {Math.round(raidBossState.maxHp).toLocaleString()}</span>
                   </span>
               </div>
               
               <div className="relative h-6 bg-slate-950 rounded-sm border-2 border-slate-800 overflow-hidden shadow-[0_0_15px_rgba(220,38,38,0.2)]">
                   {/* Background track */}
                   <div className="absolute inset-0 bg-red-950/30"></div>
                   
                   {/* HP Fill */}
                   <div 
                     className="relative h-full bg-gradient-to-r from-red-800 via-red-500 to-amber-400 transition-all duration-[1500ms] ease-out" 
                     style={{ width: `${Math.max(0, (raidBossState.hp / raidBossState.maxHp) * 100)}%` }}
                   >
                     {/* Gloss effect */}
                     <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20"></div>
                   </div>
               </div>
           </div>
        </div>

        {/* Damage Result Popover */}
        <div className={`absolute inset-x-0 bottom-12 flex justify-center transition-all duration-700 z-30 ${raidBossState.animating ? 'opacity-0 translate-y-16' : 'opacity-100 translate-y-0'}`}>
             <div className="glass-card bg-slate-900/90 border-red-500/40 p-8 shadow-[0_0_50px_rgba(220,38,38,0.5)] min-w-[320px] backdrop-blur-xl rounded-xl">
                 
                 <div className="flex flex-col items-center mb-6">
                   <span className="text-slate-400 text-xs tracking-[0.3em] uppercase mb-2">Total Damage</span>
                   <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-red-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] font-mono">
                    {!raidBossState.animating && (
                      <span className="animate-[bounce_0.5s_ease-out]">
                          {raidBossState.damage.toLocaleString()}
                      </span>
                    )}
                   </div>
                 </div>
                 
                 {!raidBossState.animating && (
                   <div className="flex flex-col gap-4">
                       <p className="text-amber-400 font-bold text-sm bg-amber-950/50 py-3 px-4 rounded border border-amber-900/50 shadow-inner whitespace-pre-line">
                         {raidBossState.message}
                       </p>
                       <button 
                         onClick={() => setRaidBossState(null)} 
                         className="group relative w-full py-4 bg-slate-800 hover:bg-red-900 border border-slate-600 hover:border-red-500 transition-all duration-300 rounded uppercase tracking-widest font-bold text-slate-300 hover:text-white overflow-hidden"
                       >
                         <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                         返回競技場
                       </button>
                   </div>
                 )}
             </div>
        </div>
      </div>
    );
  }

  if (battleState) {
    const isBattleOver = battleState.isOver;
    return (
      <div className="h-full flex flex-col gap-4 animate-fade-in relative z-10">
        <div className="absolute inset-0 bg-red-900/10 pointer-events-none animate-pulse rounded-2xl"></div>
        
        <div className="glass-card p-4 text-center border-red-500/30">
          <h2 className="text-xl font-bold text-red-500 animate-pulse tracking-widest">ATB 即時戰鬥中</h2>
        </div>

        <div className="glass-card p-6 flex flex-col gap-6">
          <div className="flex justify-between items-center px-2">
            
            {/* Player A */}
            <div className="flex flex-col items-center gap-2 w-1/3">
              <span className="truncate w-full text-center text-sm font-bold text-cyan-400">{battleState.mA?.name}</span>
              <div className="scale-125 my-4">
                <MonsterPixelArt family={battleState.mA?.family} stage={battleState.mA?.life_stage || 4} type={battleState.mA?.type} isDead={battleState.mA_HP <= 0} isStatic={true} />
              </div>
              
              {battleState.teamA && battleState.teamA.length > 1 && (
                <div className="flex gap-1 mb-2">
                  {battleState.teamA.map((m, idx) => (
                    <div key={idx} className={`w-3 h-3 rounded-full border border-slate-700 ${idx === battleState.mA_Index ? 'bg-cyan-500 shadow-[0_0_5px_#06b6d4]' : idx < battleState.mA_Index ? 'bg-slate-800' : 'bg-slate-500'}`} title={m.name}></div>
                  ))}
                </div>
              )}
              
              <div className="w-full space-y-2">
                <div className="flex gap-1 flex-wrap min-h-[16px]">
                  {battleState.mA_Statuses?.map((s, i) => (
                    <span key={i} className="px-1 text-[8px] bg-slate-800 text-slate-300 border border-slate-600 rounded">
                      {s.type} {s.stacks > 1 ? `x${s.stacks}` : ''}
                    </span>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-emerald-400 font-bold">HP</span>
                    <span className="text-white">{Math.round(battleState.mA_HP)}/{Math.round(battleState.mA_MaxHP)}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                    <div className="h-full bg-emerald-500 shadow-[0_0_8px_#10b981] transition-all" style={{width:`${(battleState.mA_HP/battleState.mA_MaxHP)*100}%`}}></div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="text-[8px] text-slate-400 mb-0.5">ATB</div>
                    <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-cyan-500 transition-all" style={{width:`${battleState.mA_ATB}%`}}></div></div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[8px] text-slate-400 mb-0.5">AP</div>
                    <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-amber-500 transition-all" style={{width:`${(battleState.mA_AP/30)*100}%`}}></div></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-br from-red-500 to-amber-500">VS</div>

            {/* Player B */}
            <div className="flex flex-col items-center gap-2 w-1/3">
              <span className="truncate w-full text-center text-sm font-bold text-rose-400">{battleState.mB?.name}</span>
              <div className="scale-125 my-4">
                <MonsterPixelArt family={battleState.mB?.family} stage={battleState.mB?.life_stage || 4} type={battleState.mB?.type} isDead={battleState.mB_HP <= 0} isStatic={true} />
              </div>

              {battleState.teamB && battleState.teamB.length > 1 && (
                <div className="flex gap-1 mb-2">
                  {battleState.teamB.map((m, idx) => (
                    <div key={idx} className={`w-3 h-3 rounded-full border border-slate-700 ${idx === battleState.mB_Index ? 'bg-rose-500 shadow-[0_0_5px_#f43f5e]' : idx < battleState.mB_Index ? 'bg-slate-800' : 'bg-slate-500'}`} title={m.name}></div>
                  ))}
                </div>
              )}
              
              <div className="w-full space-y-2">
                <div className="flex gap-1 flex-wrap min-h-[16px]">
                  {battleState.mB_Statuses?.map((s, i) => (
                    <span key={i} className="px-1 text-[8px] bg-slate-800 text-slate-300 border border-slate-600 rounded">
                      {s.type} {s.stacks > 1 ? `x${s.stacks}` : ''}
                    </span>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-emerald-400 font-bold">HP</span>
                    <span className="text-white">{Math.round(battleState.mB_HP)}/{Math.round(battleState.mB_MaxHP)}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                    <div className="h-full bg-rose-500 shadow-[0_0_8px_#f43f5e] transition-all" style={{width:`${(battleState.mB_HP/battleState.mB_MaxHP)*100}%`}}></div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="text-[8px] text-slate-400 mb-0.5">ATB</div>
                    <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-cyan-500 transition-all" style={{width:`${battleState.mB_ATB}%`}}></div></div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[8px] text-slate-400 mb-0.5">AP</div>
                    <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-amber-500 transition-all" style={{width:`${(battleState.mB_AP/30)*100}%`}}></div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-950/80 border border-slate-700 rounded-xl p-3 h-48 overflow-y-auto text-xs leading-relaxed flex flex-col gap-2 select-text shadow-inner">
            {battleState.logs.map((log, idx) => (
              <div key={idx} className="border-b border-slate-800 pb-1 text-slate-300">
                {log.includes('獲勝') ? <span className="text-yellow-400 font-bold text-sm">{log}</span> : log.includes('傷害') ? <span className="text-rose-300">{log}</span> : log}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>

        <div className="mt-auto flex gap-2">
          {isBattleOver ? (
            <button onClick={() => { setBattleState(null); refreshData(); }} className="w-full neon-button neon-button-primary py-4 font-bold text-lg">離開戰場</button>
          ) : (
            <>
              <button onClick={fastForwardBattle} className="w-1/2 neon-button bg-slate-700 py-4 font-bold text-white hover:bg-slate-600">⏭️ 跳過動畫瞬間結算</button>
              <button onClick={() => { setBattleState(null); refreshData(); }} className="w-1/2 neon-button neon-button-danger py-4 font-bold">強制脫離戰鬥 (投降)</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in relative overflow-y-auto pb-4">
      {receivedChallenge && !battleState && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 rounded-3xl">
           <div className="glass-card p-6 flex flex-col gap-4 w-full max-w-sm text-center animate-bounce-slight border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
             <span className="text-4xl">⚔️</span>
             <h3 className="text-xl font-bold text-rose-400">收到來自 {receivedChallenge.challenger_name} 的邀請</h3>
             <p className="text-slate-300 text-sm">對方派出了 {receivedChallenge.monster_data.name}</p>
             <div className="flex gap-3 mt-2">
               <button onClick={handleDeclineIncoming} className="flex-1 neon-button bg-slate-700 py-3">拒絕</button>
               <button onClick={handleAcceptIncoming} className="flex-1 neon-button neon-button-danger py-3 font-bold">接受挑戰！</button>
             </div>
           </div>
        </div>
      )}

      <div className="glass-card p-4 flex justify-between items-center text-sm font-bold">
        <span className="text-emerald-400">目前出戰怪獸: {activeMonster?.name || monsters[0]?.name || '無'}</span>
      </div>

      <div className="flex flex-col gap-4 flex-1">
        
        {/* PVE Modes */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card p-4 border-rose-500/30 flex flex-col items-center text-center gap-2 hover:border-rose-500/60 transition-colors">
            <span className="text-3xl mb-1">👾</span>
            <h3 className="font-bold text-rose-400 text-md">野生病毒怪獸</h3>
            <p className="text-xs text-slate-400 mb-2">數據平原的野生怪獸</p>
            <select 
              value={wildLevel} 
              onChange={e => setWildLevel(parseInt(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white outline-none mb-2"
            >
              <option value={2}>LV1 幼年期</option>
              <option value={3}>LV2 成長期</option>
              <option value={4}>LV3 成熟期</option>
              <option value={5}>LV4 完全體</option>
              <option value={6}>LV5 究極體</option>
            </select>
            <button 
              onClick={async () => {
                const myMonster = activeMonster || monsters[0];
                if (!myMonster || myMonster.is_dead) {
                  setMessage('❌ 請先選擇一隻存活的怪獸作為出戰怪獸！');
                  return;
                }
                try {
                  const mB = await api.matchmakeMock('mock', wildLevel);
                  handleAcceptChallenge(myMonster, mB);
                } catch (e) { setMessage(e.message); }
              }} 
              className="w-full mt-auto neon-button neon-button-danger py-2 text-sm font-bold"
            >
              挑戰
            </button>
          </div>
          
          <div className="glass-card p-4 border-amber-500/30 flex flex-col items-center text-center gap-2 hover:border-amber-500/60 transition-colors">
            <span className="text-3xl mb-1">👑</span>
            <h3 className="font-bold text-amber-400 text-md">世界王討伐</h3>
            <p className="text-xs text-slate-400 mb-2">全服共鬥 (-15體力)</p>
            <div className="text-[10px] text-slate-400 text-left bg-slate-900/50 p-2 rounded w-full mb-2">
               <div className="font-bold text-amber-500 mb-1">🏆 每週結算獎勵</div>
               <li>前 10 名: 500G + 5 寶石</li>
               <li>前 30%: 250G + 2 寶石</li>
               <li>參與獎: 100G</li>
               <div className="mt-1 font-bold text-emerald-400">🛡️ 本週護盾: [資料] (受傷害減免)</div>
            </div>
            <button 
              onClick={handleWorldBossAttack} 
              className="w-full mt-auto neon-button neon-button-warning py-2 text-sm font-bold"
            >
              發動攻擊
            </button>
          </div>
        </div>

        {/* PvP Modes - Friends & Guild */}
        <div className="glass-card p-5 border-cyan-500/30">
          <h3 className="font-bold text-cyan-400 text-md mb-4 border-b border-slate-700 pb-2">⚔️ 模擬對戰 (非同步)</h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">好友挑戰</label>
              <div className="flex gap-2">
                <select 
                  value={selectedFriend}
                  onChange={(e) => setSelectedFriend(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white outline-none focus:border-cyan-500"
                >
                  <option value="">選擇一位好友...</option>
                  {friends.filter(f => f.status === 1).map(f => (
                    <option key={f.friend_id} value={f.friend_id}>{f.friend_username || f.friend_name}</option>
                  ))}
                </select>
                <button onClick={() => handleChallengePlayer(selectedFriend)} className="neon-button neon-button-primary px-4 py-2 text-sm font-bold">對戰</button>
              </div>
            </div>

            {guild && (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">公會成員挑戰</label>
                <div className="flex gap-2">
                  <select 
                    value={selectedGuildMember}
                    onChange={(e) => setSelectedGuildMember(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white outline-none focus:border-cyan-500"
                  >
                    <option value="">選擇一位成員...</option>
                    {guildMembers.filter(m => m.user_id !== user.uid).map(m => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.role === 1 ? '👑 ' : m.role === 2 ? '🛡️ ' : ''}{m.username}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => handleChallengePlayer(selectedGuildMember)} className="neon-button neon-button-primary px-4 py-2 text-sm font-bold">對戰</button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {message && <div className="glass-card p-3 text-center text-sm font-medium animate-pulse text-indigo-200 border-indigo-500/50 bg-indigo-900/20 mt-auto whitespace-pre-line">{message}</div>}
    </div>
  );
}
