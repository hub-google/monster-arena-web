import React, { useState, useEffect, useRef } from 'react';
import MonsterPixelArt from '../components/MonsterPixelArt';
import { api } from '../utils/api';

const STAGE_NAMES = ['蛋', '蛋', '幼年期', '成長期', '成熟期', '完全體', '究極體'];

export default function Arena({ 
  user, 
  monsters, 
  friends, 
  activeMonster, 
  channel, 
  activePlayers, 
  receivedChallenge, 
  setReceivedChallenge, 
  battleState, 
  setBattleState, 
  refreshData, 
  setPage 
}) {
  const [subTab, setSubTab] = useState('chat');
  const [chatMessage, setChatMessage] = useState('');
  const [chatLogs, setChatLogs] = useState([]);
  const [targetUsername, setTargetUsername] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const logsEndRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLogs, battleState?.logs]);

  // Realtime Chat via Firebase messages collection
  useEffect(() => {
    const unsubscribe = api.subscribeMessages('world', (msgs) => {
      setChatLogs(msgs.map(m => ({
        senderName: m.username,
        message: m.text
      })));
    });
    return () => unsubscribe();
  }, []);

  // Battle ATB Engine
  useEffect(() => {
    if (!battleState || battleState.isOver) return;
    
    const interval = setInterval(() => {
      setBattleState(prev => {
        if (!prev || prev.isOver) return prev;
        let next = { ...prev };
        
        // RNG & Base Speed Multiplier
        const speedMultiplier = 0.5;
        const tickRngA = 0.9 + Math.random() * 0.2;
        const tickRngB = 0.9 + Math.random() * 0.2;

        next.mA_ATB = Math.min(100, (next.mA_ATB || 0) + (next.mA.combat_spd * speedMultiplier * tickRngA));
        next.mB_ATB = Math.min(100, (next.mB_ATB || 0) + (next.mB.combat_spd * speedMultiplier * tickRngB));

        let attacker = null;
        let defender = null;
        let attackerStr = '';
        
        if (next.mA_ATB >= 100) { attacker = next.mA; defender = next.mB; attackerStr = 'A'; }
        else if (next.mB_ATB >= 100) { attacker = next.mB; defender = next.mA; attackerStr = 'B'; }

        if (attacker) {
          if (attackerStr === 'A') next.mA_ATB = 0; else next.mB_ATB = 0;
          
          let advantage = 1.0;
          // 1: Vaccine, 2: Data, 3: Virus
          if (attacker.type === 1 && defender.type === 3) advantage = 1.3;
          if (attacker.type === 3 && defender.type === 2) advantage = 1.3;
          if (attacker.type === 2 && defender.type === 1) advantage = 1.3;
          if (attacker.type === 3 && defender.type === 1) advantage = 0.7;
          if (attacker.type === 2 && defender.type === 3) advantage = 0.7;
          if (attacker.type === 1 && defender.type === 2) advantage = 0.7;

          const rng = 0.9 + Math.random() * 0.2;
          const apKey = attackerStr === 'A' ? 'mA_AP' : 'mB_AP';
          next[apKey] = Math.min(30, (next[apKey] || 0) + 10);
          
          let isSkill = false;
          let skillMult = 1.0;
          if (next[apKey] >= 30) {
            isSkill = true;
            skillMult = 1.6;
            next[apKey] = 0;
          }

          let dmg = Math.floor(attacker.combat_atk * advantage * skillMult * rng - (defender.combat_def * 0.5));
          if (dmg < 1) dmg = 1;

          if (attackerStr === 'A') next.mB_HP = Math.max(0, next.mB_HP - dmg);
          else next.mA_HP = Math.max(0, next.mA_HP - dmg);

          const actionStr = isSkill ? `💥 施展必殺技` : `攻擊`;
          const advStr = advantage > 1 ? ` (效果拔群)` : (advantage < 1 ? ` (效果微弱)` : '');
          next.logs.push(`${attacker.name} ${actionStr}${advStr}，造成 ${dmg} 傷害！`);

          if (next.mA_HP === 0 || next.mB_HP === 0) {
            next.isOver = true;
            const winner = next.mA_HP > 0 ? next.mA : next.mB;
            next.winner = next.mA_HP > 0 ? 'A' : 'B';
            next.logs.push(`🏆 戰鬥結束！${winner.name} 獲勝！`);
          }
        }
        return next;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [battleState, setBattleState]);

  const sendWorldChat = () => {
    if (!chatMessage.trim()) return;
    
    // Save to Firebase Database `messages` collection (unified)
    api.sendMessage('world', chatMessage).catch(err => {
      setMessage(err.message);
    });
    
    setChatMessage('');
  };

  const handleChallenge = (targetPlayerId) => {
    const monster = activeMonster || monsters[0];
    if (!monster || monster.is_dead) return setMessage('❌ 請先選擇一隻存活的怪獸出戰！');
    setMessage(`向對手發出挑戰！`);
    
    // Auto-accept local mock for demo purposes if no channel
    handleAcceptChallenge(monster, Object.assign({}, monster, {name: targetPlayerId === 'mock' ? '野生病毒怪獸' : '究極體王怪', combat_hp: monster.combat_hp * 1.2, type: Math.floor(Math.random()*3)+1}));
  };

  const handleAcceptChallenge = (mA, mB) => {
    setReceivedChallenge(null);
    api.trackQuestProgress('battle', 1).catch(e => console.warn(e));
    setBattleState({
      mA, mB,
      mA_HP: mA.combat_hp, mB_HP: mB.combat_hp,
      mA_MaxHP: mA.combat_hp, mB_MaxHP: mB.combat_hp,
      mA_ATB: 0, mB_ATB: 0,
      mA_AP: 0, mB_AP: 0,
      logs: [`⚔️ 戰鬥開始！ ${mA.name} vs ${mB.name}！`],
      isOver: false, winner: null
    });
  };

  const handleSendFriendRequest = async () => {
    if (!targetUsername) return;
    setLoading(true); setMessage('');
    try {
      const data = await api.addFriend(targetUsername);
      setMessage(data.message); setTargetUsername(''); await refreshData();
    } catch (err) { setMessage(`❌ ${err.message}`); }
    finally { setLoading(false); }
  };

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
                <MonsterPixelArt stage={battleState.mA?.life_stage || 4} type={battleState.mA?.type} isDead={battleState.mA_HP <= 0} />
              </div>
              
              <div className="w-full space-y-2">
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
                <MonsterPixelArt stage={battleState.mB?.life_stage || 4} type={battleState.mB?.type} isDead={battleState.mB_HP <= 0} />
              </div>
              
              <div className="w-full space-y-2">
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

        <div className="mt-auto">
          {isBattleOver ? (
            <button onClick={() => { setBattleState(null); refreshData(); }} className="w-full neon-button neon-button-primary py-4 font-bold text-lg">離開戰場</button>
          ) : (
            <button onClick={() => { setBattleState(null); refreshData(); }} className="w-full neon-button neon-button-danger py-4 font-bold">強制脫離戰鬥 (投降)</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in">
      <div className="glass-card p-4 flex justify-between items-center text-sm font-bold">
        <span className="text-cyan-400">大廳玩家: {activePlayers.length}人</span>
        <span className="text-emerald-400">出戰: {activeMonster?.name || monsters[0]?.name || '無'}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => { setSubTab('chat'); setMessage(''); }} className={`py-3 rounded-xl font-bold transition-all ${subTab === 'chat' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.6)]' : 'glass-panel text-slate-400'}`}>世界聊天</button>
        <button onClick={() => { setSubTab('players'); setMessage(''); }} className={`py-3 rounded-xl font-bold transition-all ${subTab === 'players' ? 'bg-rose-600 text-white shadow-[0_0_15px_rgba(225,29,72,0.6)]' : 'glass-panel text-slate-400'}`}>野生挑戰</button>
        <button onClick={() => { setSubTab('friends'); setMessage(''); }} className={`py-3 rounded-xl font-bold transition-all ${subTab === 'friends' ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(5,150,105,0.6)]' : 'glass-panel text-slate-400'}`}>好友名單</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {subTab === 'chat' && (
          <div className="flex flex-col h-full gap-4">
            <div className="flex-1 glass-card p-4 overflow-y-auto text-sm select-text flex flex-col gap-3">
              {chatLogs.length === 0 ? <span className="text-slate-500 text-center italic mt-10">歡迎來到世界頻道！向大家打個招呼吧！</span> : chatLogs.map((chat, idx) => (
                <div key={idx} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 break-words">
                  <span className="font-bold text-cyan-400 mr-2">{chat.senderName}</span> 
                  <span className="text-slate-200">{chat.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
            <div className="flex gap-2">
              <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendWorldChat()} placeholder="輸入訊息..." className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors" />
              <button onClick={sendWorldChat} className="neon-button neon-button-primary px-6 py-3 font-bold">發送</button>
            </div>
          </div>
        )}

        {subTab === 'players' && (
          <div className="flex flex-col gap-3">
             <div className="glass-card p-4 border-rose-500/30 flex justify-between items-center hover:border-rose-500/60 transition-colors">
               <div className="flex items-center gap-3">
                 <span className="text-2xl">🦠</span>
                 <div className="flex flex-col">
                   <span className="font-bold text-rose-400 text-base">野生病毒怪獸</span>
                   <span className="text-xs text-slate-400">等級不定的野怪，練功好對象。</span>
                 </div>
               </div>
               <button onClick={() => handleChallenge('mock')} className="neon-button neon-button-danger px-6 py-2 shadow-rose-500/20">挑戰</button>
             </div>

             <div className="glass-card p-4 border-fuchsia-500/30 flex justify-between items-center hover:border-fuchsia-500/60 transition-colors">
               <div className="flex items-center gap-3">
                 <span className="text-2xl">🐉</span>
                 <div className="flex flex-col">
                   <span className="font-bold text-fuchsia-400 text-base">究極體王怪</span>
                   <span className="text-xs text-slate-400">極度危險！請確保有充分準備。</span>
                 </div>
               </div>
               <button onClick={() => handleChallenge('mock_boss')} className="neon-button neon-button-danger px-6 py-2 shadow-fuchsia-500/20 bg-fuchsia-700 hover:bg-fuchsia-600">挑戰</button>
             </div>
          </div>
        )}

        {subTab === 'friends' && (
          <div className="flex flex-col gap-4">
            <div className="glass-card p-4">
              <h3 className="text-sm font-bold text-emerald-400 mb-3">新增好友</h3>
              <div className="flex gap-2 items-center">
                <input type="text" value={targetUsername} onChange={(e) => setTargetUsername(e.target.value)} placeholder="輸入玩家帳號名稱..." className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 outline-none text-white focus:border-emerald-500 transition-colors" />
                <button onClick={handleSendFriendRequest} disabled={loading || !targetUsername} className="neon-button neon-button-success px-6 py-3 font-bold disabled:opacity-50">發送邀請</button>
              </div>
            </div>
            
            <div className="glass-card p-4 flex flex-col gap-2">
              <h3 className="text-sm font-bold text-slate-300 mb-2 border-b border-slate-700 pb-2">好友列表</h3>
              {friends.length === 0 ? <span className="text-center italic mt-4 text-slate-500">尚無好友。前往世界頻道認識新朋友吧！</span> : friends.map(f => (
                <div key={f.user_id_1 + '-' + f.user_id_2} className="flex justify-between items-center p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                  <span className="font-bold text-white flex items-center gap-2">🤝 {f.friend_username}</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${f.status === 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {f.status === 0 ? '🕒 待確認' : '✅ 已成為好友'}
                    </span>
                    {f.status === 0 && f.friend_id !== user.user_id && (
                      <button onClick={() => api.acceptFriend(f.friend_id).then(refreshData)} className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-md hover:bg-emerald-500 transition">同意</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {message && <div className="glass-card p-3 text-center text-sm font-medium animate-pulse text-indigo-200 border-indigo-500/50 bg-indigo-900/20 mt-auto">{message}</div>}
    </div>
  );
}
