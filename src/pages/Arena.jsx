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

  useEffect(() => {
    if (!channel) return;

    const chatHandler = channel.on('broadcast', { event: 'chat_world' }, ({ payload }) => {
      setChatLogs(prev => [...prev, payload]);
    });

    return () => {
      channel.unsubscribe();
    };
  }, [channel]);

  const sendWorldChat = () => {
    if (!chatMessage.trim() || !channel) return;
    
    const payload = {
      type: 'chat_world',
      senderName: user.username,
      message: chatMessage
    };
    
    channel.send({
      type: 'broadcast',
      event: 'chat_world',
      payload: payload
    });
    
    setChatLogs(prev => [...prev, payload]);
    setChatMessage('');
  };

  const handleChallenge = (targetPlayerId) => {
    if (!channel) return;
    const monster = activeMonster || monsters[0];
    if (!monster || monster.is_dead) {
      setMessage('❌ 請先選擇一隻存活的怪獸做為出戰怪獸！');
      return;
    }

    setMessage(`已向該玩家發出切磋邀請...`);
    channel.send({
      type: 'broadcast',
      event: 'challenge',
      payload: {
        targetUserId: targetPlayerId,
        challengerId: user.user_id,
        challengerName: user.username,
        challengerMonsterId: monster.monster_id
      }
    });
  };

  const handleAcceptChallenge = () => {
    if (!channel || !receivedChallenge) return;
    const monster = activeMonster || monsters[0];
    if (!monster || monster.is_dead) {
      setMessage('❌ 請先選擇一隻存活的怪獸出戰！');
      return;
    }

    // Since we're serverless, we'll let client A compute the battle or just show a mock animation for now
    channel.send({
      type: 'broadcast',
      event: 'battle_start',
      payload: {
        roomId: user.user_id,
        targetUserId: receivedChallenge.challengerId,
        mA: monster,
        mB: monster // Mocking opponent for pure frontend demo
      }
    });

    setReceivedChallenge(null);
  };

  const handleSendFriendRequest = async () => {
    if (!targetUsername) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await api.addFriend(targetUsername);
      setMessage(data.message);
      setTargetUsername('');
      await refreshData();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (battleState) {
    const isWinnerMe = battleState.winner === user.user_id;
    const isBattleOver = battleState.isOver;

    return (
      <div className="h-full flex flex-col justify-between p-1 font-pressstart text-[8px] text-lcd-dark">
        <div className="text-center font-bold border-b border-lcd-border pb-1 text-[7px] truncate animate-pulse text-red-950">
          ⚠️ 聯機對打切磋中 ⚠️
        </div>
        <div className="flex-1 flex flex-col justify-around py-1">
          <div className="flex justify-between items-center px-2">
            <div className="flex flex-col items-center gap-1 max-w-[80px]">
              <span className="truncate w-full text-center text-[6px]">{battleState.mA?.name}</span>
              <MonsterPixelArt stage={battleState.mA?.life_stage || 4} type={battleState.mA?.type} isDead={false} />
              <div className="w-16 h-1 bg-lcd-light border border-lcd-border relative overflow-hidden">
                <div className="bg-lcd-dark h-full" style={{ width: `100%` }}></div>
              </div>
            </div>
            <span className="text-[12px] font-bold italic text-red-950">VS</span>
            <div className="flex flex-col items-center gap-1 max-w-[80px]">
              <span className="truncate w-full text-center text-[6px]">{battleState.mB?.name}</span>
              <MonsterPixelArt stage={battleState.mB?.life_stage || 4} type={battleState.mB?.type} isDead={false} />
              <div className="w-16 h-1 bg-lcd-light border border-lcd-border relative overflow-hidden">
                <div className="bg-lcd-dark h-full" style={{ width: `100%` }}></div>
              </div>
            </div>
          </div>
          <div className="border border-lcd-border rounded p-1 h-14 overflow-y-auto bg-lcd-light/20 text-[5px] leading-relaxed flex flex-col gap-0.5 select-text">
            {battleState.logs.map((log, idx) => (
              <div key={idx} className="border-b border-lcd-border/20 pb-0.5">{log}</div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
        {isBattleOver ? (
          <div className="border-t border-lcd-border pt-1.5 flex flex-col items-center gap-1">
            <button onClick={() => { setBattleState(null); refreshData(); }} className="w-full py-1 bg-lcd-dark text-lcd-bg rounded border border-lcd-border font-bold active:scale-95">離開戰場 (Exit)</button>
          </div>
        ) : (
          <div className="border-t border-lcd-border pt-1.5 flex flex-col items-center gap-1">
            <button onClick={() => { setBattleState(null); refreshData(); }} className="w-full py-1 bg-red-900 text-lcd-bg rounded border border-lcd-border font-bold active:scale-95">強制脫離戰鬥 (Demo Mode)</button>
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
        <button onClick={() => { setSubTab('players'); setMessage(''); }} className={`py-0.5 rounded ${subTab === 'players' ? 'bg-lcd-dark text-lcd-bg' : 'bg-lcd-light/20'}`}>在線玩家</button>
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
            {activePlayers.filter(p => p.user_id !== user.user_id).length === 0 ? (
              <span className="text-center italic mt-4 text-gray-500">目前沒有其他玩家在線。</span>
            ) : (
              activePlayers.filter(p => p.user_id !== user.user_id).map(p => (
                <div key={p.user_id} className="flex justify-between items-center p-1 border border-lcd-border/20 rounded">
                  <span>👤 {p.username}</span>
                  <button onClick={() => handleChallenge(p.user_id)} className="px-1 border border-lcd-border rounded active:scale-95 bg-lcd-light/60 font-bold">⚔️ 切磋</button>
                </div>
              ))
            )}
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

      {receivedChallenge && (
        <div className="bg-red-100 border border-red-500 rounded p-1 text-[6.5px] flex flex-col items-center gap-1 my-1">
          <span className="font-bold">⚠️ 收到來自 {receivedChallenge.challengerName} 的邀請！</span>
          <div className="flex gap-2 w-full justify-around mt-0.5">
            <button onClick={handleAcceptChallenge} className="px-1.5 py-0.5 bg-lcd-dark text-lcd-bg rounded border border-lcd-border font-bold">接受 A</button>
            <button onClick={() => setReceivedChallenge(null)} className="px-1.5 py-0.5 border border-lcd-border rounded bg-lcd-light/30">拒絕 B</button>
          </div>
        </div>
      )}

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
