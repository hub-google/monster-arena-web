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

  // Realtime Chat Mock (if no channel)
  useEffect(() => {
    if (!channel) return;
    const chatHandler = channel.on('broadcast', { event: 'chat_world' }, ({ payload }) => {
      setChatLogs(prev => [...prev, payload]);
    });
    return () => channel.unsubscribe();
  }, [channel]);

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
    const payload = { type: 'chat_world', senderName: user.username, message: chatMessage };
    if (channel) channel.send({ type: 'broadcast', event: 'chat_world', payload });
    setChatLogs(prev => [...prev, payload]);
    setChatMessage('');
  };

  const handleChallenge = (targetPlayerId) => {
    const monster = activeMonster || monsters[0];
    if (!monster || monster.is_dead) return setMessage('❌ 請先選擇一隻存活的怪獸出戰！');
    setMessage(`向對手發出挑戰！`);
    
    // Auto-accept local mock for demo purposes if no channel
    handleAcceptChallenge(monster, Object.assign({}, monster, {name: '野生強敵', combat_hp: monster.combat_hp * 1.2, type: Math.floor(Math.random()*3)+1}));
  };

  const handleAcceptChallenge = (mA, mB) => {
    setReceivedChallenge(null);
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
      <div className="h-full flex flex-col justify-between p-1 font-pressstart text-[8px] text-lcd-dark">
        <div className="text-center font-bold border-b border-lcd-border pb-1 text-[7px] truncate animate-pulse text-red-950">
          ⚠️ ATB 即時戰鬥中 ⚠️
        </div>
        <div className="flex-1 flex flex-col justify-around py-1">
          <div className="flex justify-between items-center px-2">
            <div className="flex flex-col items-center gap-1 max-w-[80px]">
              <span className="truncate w-full text-center text-[6px]">{battleState.mA?.name}</span>
              <MonsterPixelArt stage={battleState.mA?.life_stage || 4} type={battleState.mA?.type} isDead={battleState.mA_HP <= 0} />
              
              <div className="flex gap-1 w-full text-[5px]">
                <div className="flex-1">
                  HP: {battleState.mA_HP}/{battleState.mA_MaxHP}
                  <div className="h-1 bg-lcd-light border border-lcd-border w-full"><div className="bg-green-700 h-full" style={{width:`${(battleState.mA_HP/battleState.mA_MaxHP)*100}%`}}></div></div>
                </div>
              </div>
              <div className="flex gap-1 w-full text-[5px]">
                <div className="flex-1">ATB<div className="h-0.5 bg-lcd-light border border-lcd-border w-full"><div className="bg-lcd-dark h-full" style={{width:`${battleState.mA_ATB}%`}}></div></div></div>
                <div className="flex-1">AP<div className="h-0.5 bg-lcd-light border border-lcd-border w-full"><div className="bg-yellow-600 h-full" style={{width:`${(battleState.mA_AP/30)*100}%`}}></div></div></div>
              </div>
            </div>

            <span className="text-[12px] font-bold italic text-red-950">VS</span>

            <div className="flex flex-col items-center gap-1 max-w-[80px]">
              <span className="truncate w-full text-center text-[6px]">{battleState.mB?.name}</span>
              <MonsterPixelArt stage={battleState.mB?.life_stage || 4} type={battleState.mB?.type} isDead={battleState.mB_HP <= 0} />
              
              <div className="flex gap-1 w-full text-[5px]">
                <div className="flex-1 text-right">
                  HP: {battleState.mB_HP}/{battleState.mB_MaxHP}
                  <div className="h-1 bg-lcd-light border border-lcd-border w-full"><div className="bg-green-700 h-full" style={{width:`${(battleState.mB_HP/battleState.mB_MaxHP)*100}%`}}></div></div>
                </div>
              </div>
              <div className="flex gap-1 w-full text-[5px]">
                <div className="flex-1">ATB<div className="h-0.5 bg-lcd-light border border-lcd-border w-full"><div className="bg-lcd-dark h-full" style={{width:`${battleState.mB_ATB}%`}}></div></div></div>
                <div className="flex-1">AP<div className="h-0.5 bg-lcd-light border border-lcd-border w-full"><div className="bg-yellow-600 h-full" style={{width:`${(battleState.mB_AP/30)*100}%`}}></div></div></div>
              </div>
            </div>
          </div>
          
          <div className="border border-lcd-border rounded p-1 h-20 overflow-y-auto bg-lcd-light/20 text-[5px] leading-relaxed flex flex-col gap-0.5 select-text">
            {battleState.logs.map((log, idx) => (
              <div key={idx} className="border-b border-lcd-border/20 pb-0.5">{log}</div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
        {isBattleOver ? (
          <div className="border-t border-lcd-border pt-1 flex flex-col items-center gap-1">
            <button onClick={() => { setBattleState(null); refreshData(); }} className="w-full py-1 bg-lcd-dark text-lcd-bg rounded border border-lcd-border font-bold active:scale-95">離開戰場 (Exit)</button>
          </div>
        ) : (
          <div className="border-t border-lcd-border pt-1 flex flex-col items-center gap-1">
            <button onClick={() => { setBattleState(null); refreshData(); }} className="w-full py-1 bg-red-900 text-lcd-bg rounded border border-lcd-border font-bold active:scale-95 text-white">強制脫離戰鬥 (Surrender)</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col justify-between p-1 font-pressstart text-[8px] text-lcd-dark">
      <div className="flex justify-between items-center border-b border-lcd-border pb-1 text-[7px]">
        <span>大廳玩家: {activePlayers.length}人</span>
        <span>出戰: {activeMonster?.name || monsters[0]?.name || '無'}</span>
      </div>
      <div className="grid grid-cols-3 gap-0.5 border-b border-lcd-border py-1 text-[6.5px] text-center font-bold">
        <button onClick={() => { setSubTab('chat'); setMessage(''); }} className={`py-0.5 rounded ${subTab === 'chat' ? 'bg-lcd-dark text-lcd-bg' : 'bg-lcd-light/20'}`}>世界聊天</button>
        <button onClick={() => { setSubTab('players'); setMessage(''); }} className={`py-0.5 rounded ${subTab === 'players' ? 'bg-lcd-dark text-lcd-bg' : 'bg-lcd-light/20'}`}>野生挑戰</button>
        <button onClick={() => { setSubTab('friends'); setMessage(''); }} className={`py-0.5 rounded ${subTab === 'friends' ? 'bg-lcd-dark text-lcd-bg' : 'bg-lcd-light/20'}`}>好友關係</button>
      </div>
      <div className="flex-1 overflow-y-auto py-1 max-h-40">
        {subTab === 'chat' && (
          <div className="flex flex-col h-full justify-between gap-1">
            <div className="flex-1 border border-lcd-border rounded p-1 h-28 overflow-y-auto bg-lcd-light/10 text-[6px] select-text flex flex-col gap-1">
              {chatLogs.length === 0 ? <span className="text-gray-500 text-center italic mt-4">歡迎來到世界頻道！</span> : chatLogs.map((chat, idx) => (
                <div key={idx} className="break-all"><span className="font-bold underline text-lcd-dark/80">{chat.senderName}</span>: <span>{chat.message}</span></div>
              ))}
              <div ref={logsEndRef} />
            </div>
            <div className="flex gap-1">
              <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendWorldChat()} placeholder="輸入訊息..." className="flex-1 bg-lcd-bg border border-lcd-border text-[6.5px] px-1 py-0.5 text-lcd-dark outline-none font-pressstart" />
              <button onClick={sendWorldChat} className="px-1 py-0.5 bg-lcd-dark text-lcd-bg rounded border border-lcd-border text-[6.5px]">發送</button>
            </div>
          </div>
        )}
        {subTab === 'players' && (
          <div className="flex flex-col gap-1 text-[6.5px]">
             <div className="flex justify-between items-center p-1 border border-lcd-border/20 rounded">
               <span>🐾 野生病毒怪獸</span>
               <button onClick={() => handleChallenge('mock')} className="px-1 border border-lcd-border rounded active:scale-95 bg-lcd-light/60 font-bold">⚔️ 挑戰</button>
             </div>
             <div className="flex justify-between items-center p-1 border border-lcd-border/20 rounded">
               <span>🐾 究極體王怪</span>
               <button onClick={() => handleChallenge('mock_boss')} className="px-1 border border-lcd-border rounded active:scale-95 bg-lcd-light/60 font-bold">⚔️ 挑戰</button>
             </div>
          </div>
        )}
        {subTab === 'friends' && (
          <div className="flex flex-col gap-1.5 text-[6.5px]">
            <div className="flex gap-1 items-center pb-1.5 border-b border-lcd-border/30">
              <input type="text" value={targetUsername} onChange={(e) => setTargetUsername(e.target.value)} placeholder="輸入玩家帳號..." className="flex-1 bg-lcd-bg border border-lcd-border text-[6px] px-1 py-0.5 outline-none font-pressstart" />
              <button onClick={handleSendFriendRequest} disabled={loading} className="px-1.5 py-0.5 bg-lcd-dark text-lcd-bg rounded border border-lcd-border font-bold disabled:opacity-40">新增</button>
            </div>
            <div className="flex flex-col gap-1">
              {friends.length === 0 ? <span className="text-center italic mt-2 text-gray-500">尚無好友。</span> : friends.map(f => (
                <div key={f.user_id_1 + '-' + f.user_id_2} className="flex justify-between items-center p-0.5 border border-lcd-border/20 rounded">
                  <span>🤝 {f.friend_username}</span>
                  <span className="text-[5.5px]">{f.status === 0 ? '🕒 待確認' : '✅ 已加'}</span>
                  {f.status === 0 && f.friend_id !== user.user_id && <button onClick={() => api.acceptFriend(f.friend_id).then(refreshData)} className="px-1 bg-green-700 text-lcd-bg border border-lcd-border rounded">確認</button>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {message && <div className="text-[6.5px] bg-lcd-light/50 border border-lcd-border px-1 py-0.5 rounded text-center truncate mb-1">{message}</div>}

      <div className="grid grid-cols-5 gap-0.5 border-t border-lcd-border pt-1 text-[6.5px] font-bold text-center">
        <button onClick={() => setPage('dashboard')} className="py-0.5 hover:bg-lcd-light/35 rounded">養成</button>
        <button onClick={() => setPage('roster')} className="py-0.5 hover:bg-lcd-light/35 rounded">倉庫</button>
        <button onClick={() => setPage('arena')} className="py-0.5 bg-lcd-dark text-lcd-bg rounded">競技</button>
        <button onClick={() => setPage('guild')} className="py-0.5 hover:bg-lcd-light/35 rounded">公會</button>
        <button onClick={() => setPage('raid')} className="py-0.5 hover:bg-lcd-light/35 rounded">討伐</button>
      </div>
    </div>
  );
}
