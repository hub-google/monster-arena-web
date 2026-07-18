import React, { useState, useEffect, useRef } from 'react';
import MonsterPixelArt from '../components/MonsterPixelArt';
import { api } from '../utils/api';

const TYPE_NAMES = ['無', '疫苗種', '資料種', '病毒種'];

export default function Social({ user, activePlayers, refreshData, setPage }) {
  const [subTab, setSubTab] = useState('plaza'); // 'plaza' or 'chat' or 'friends'
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Plaza State
  const [typeFilter, setTypeFilter] = useState('');

  // Chat State
  const [chatMessage, setChatMessage] = useState('');
  const [chatLogs, setChatLogs] = useState([]);
  const logsEndRef = useRef(null);

  // Friends State
  const [friendUUID, setFriendUUID] = useState('');
  const [friendsList, setFriendsList] = useState([]);

  // Popover State
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Private Chat State
  const [privateChatTarget, setPrivateChatTarget] = useState(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLogs]);

  useEffect(() => {
    if (subTab === 'chat' && !privateChatTarget) {
      const unsubscribe = api.subscribeMessages('world', (msgs) => {
        setChatLogs(msgs.map(m => ({
          senderName: m.username,
          message: m.text,
          user_id: m.user_id,
          timestamp: m.timestamp
        })));
      });
      return () => unsubscribe();
    } else if (subTab === 'chat' && privateChatTarget) {
      // Private channel format: private_UID1_UID2 (sorted)
      const uids = [user.user_id, privateChatTarget.friend_id].sort();
      const channelName = `private_${uids[0]}_${uids[1]}`;
      const unsubscribe = api.subscribeMessages(channelName, (msgs) => {
        setChatLogs(msgs.map(m => ({
          senderName: m.username,
          message: m.text,
          user_id: m.user_id,
          timestamp: m.timestamp
        })));
      });
      return () => unsubscribe();
    } else if (subTab === 'friends') {
      loadFriends();
    }
  }, [subTab, privateChatTarget]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const list = await api.getFriends();
      setFriendsList(list);
    } catch (err) {
      setMessage(err.message);
    }
    setLoading(false);
  };

  const handleAddFriend = async () => {
    if (!friendUUID.trim()) return;
    setLoading(true);
    try {
      const res = await api.addFriend(friendUUID.trim());
      setMessage(res.message);
      setFriendUUID('');
      await loadFriends();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    }
    setLoading(false);
  };

  const handleSendChat = async () => {
    if (!chatMessage.trim()) return;
    try {
      let channel = 'world';
      if (privateChatTarget) {
        const uids = [user.user_id, privateChatTarget.friend_id].sort();
        channel = `private_${uids[0]}_${uids[1]}`;
      }
      await api.sendMessage(channel, chatMessage);
      setChatMessage('');
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in relative gap-4">
      <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
        <button 
          onClick={() => { setSubTab('plaza'); setMessage(''); }} 
          className={`py-2 sm:py-3 rounded-xl font-bold transition-all ${subTab === 'plaza' ? 'bg-rose-600 text-white shadow-[0_0_15px_rgba(225,29,72,0.6)]' : 'glass-panel text-slate-400'}`}
        >
          在線玩家
        </button>
        <button 
          onClick={() => { setSubTab('friends'); setMessage(''); }} 
          className={`py-2 sm:py-3 rounded-xl font-bold transition-all ${subTab === 'friends' ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(5,150,105,0.6)]' : 'glass-panel text-slate-400'}`}
        >
          好友名單
        </button>
        <button 
          onClick={() => { setSubTab('chat'); setPrivateChatTarget(null); setMessage(''); }} 
          className={`py-2 sm:py-3 rounded-xl font-bold transition-all ${subTab === 'chat' && !privateChatTarget ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.6)]' : 'glass-panel text-slate-400'}`}
        >
          世界聊天
        </button>
      </div>

      {message && (
        <div className="bg-emerald-900/50 border border-emerald-500/50 text-emerald-300 p-3 rounded-lg text-sm text-center font-medium shadow-lg backdrop-blur-sm animate-fade-in break-words">
          {message}
        </div>
      )}

      {subTab === 'plaza' && (
        <div className="flex-1 flex flex-col gap-3">
          <div className="glass-card p-4 flex justify-between items-center text-sm font-bold">
            <span className="text-cyan-400">大廳在線玩家: {(activePlayers?.length || 0) + (activePlayers?.find(p => p.user_id === user.user_id) ? 0 : 1)}人</span>
          </div>
          <div className="flex-1 overflow-y-auto pb-10 space-y-3">
            {[
              ...(activePlayers?.find(p => p.user_id === user.user_id) ? [] : [{...user, username: `${user.username} (你)`}]),
              ...(activePlayers || [])
            ].map(p => (
              <div key={p.user_id} className="glass-card p-4 border-rose-500/30 flex justify-between items-center hover:border-rose-500/60 transition-colors">
                <div 
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => p.user_id !== user.user_id ? loadUserProfile(p.user_id) : null}
                >
                  <span className="text-2xl">👤</span>
                  <div className="flex flex-col">
                    <span className="font-bold text-rose-400 text-base hover:underline">{p.username}</span>
                    <span className="text-xs text-slate-400">培育怪獸：{p.monsters?.map(m => m.name).join(', ') || '無'}</span>
                  </div>
                </div>
                {p.user_id !== user.user_id && (
                  <button 
                    onClick={() => handleAddFriendAction(p.user_id)}
                    className="text-xs bg-emerald-900/50 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 px-3 py-1.5 rounded transition-all"
                  >
                    ➕ 加好友
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'friends' && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="glass-card p-4 flex flex-col gap-2">
            <h3 className="text-cyan-300 font-bold text-sm">我的 UUID (點擊複製)</h3>
            <div 
              className="bg-slate-900 border border-slate-700 p-2 rounded text-[10px] text-slate-400 cursor-pointer hover:bg-slate-800 break-all select-all"
              onClick={() => {
                navigator.clipboard.writeText(user.user_id);
                setMessage('已複製 UUID 到剪貼簿！');
              }}
            >
              {user.user_id}
            </div>
            
            <h3 className="text-cyan-300 font-bold text-sm mt-2">新增好友</h3>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="請輸入好友的 UUID" 
                value={friendUUID}
                onChange={e => setFriendUUID(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 text-sm text-white focus:border-cyan-500 outline-none transition-colors"
              />
              <button 
                onClick={handleAddFriend}
                disabled={loading || !friendUUID.trim()}
                className="neon-button neon-button-success px-6 py-3 font-bold disabled:opacity-50"
              >
                加入
              </button>
            </div>
          </div>
          
          <div className="glass-card p-4 flex flex-col gap-2 flex-1">
            <h3 className="text-slate-300 font-bold text-sm mb-2 border-b border-slate-700 pb-2">好友列表 ({friendsList.length})</h3>
            <div className="flex-1 overflow-y-auto space-y-3 pb-4">
              {loading ? (
                <p className="text-center text-slate-400 py-10">載入中...</p>
              ) : friendsList.length === 0 ? (
                <span className="text-center italic mt-4 text-slate-500 block">尚無好友。前往世界頻道認識新朋友吧！</span>
              ) : (
                friendsList.map(f => (
                  <div key={f.friend_id} className="flex justify-between items-center p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                    <span className="font-bold text-white flex items-center gap-2">🤝 {f.friend_username || f.friend_name}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${f.status === 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {f.status === 0 ? '🕒 待確認' : '✅ 已成為好友'}
                      </span>
                      {f.is_request && (
                        <button onClick={() => api.acceptFriend(f.friend_id).then(loadFriends)} className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-md hover:bg-emerald-500 transition">同意</button>
                      )}
                      {f.status === 1 && (
                        <button 
                          onClick={() => {
                             setPrivateChatTarget(f);
                             setSubTab('chat');
                             setChatMessage('');
                          }}
                          className="text-[10px] bg-indigo-700 px-3 py-1.5 rounded hover:bg-indigo-600 transition text-white"
                        >
                          私聊
                        </button>
                      )}
                      <button 
                        onClick={() => api.giftStamina(f.friend_id).then(() => setMessage('已發送體力給 ' + (f.friend_username || f.friend_name))).catch(e => setMessage(e.message))} 
                        className="text-[10px] bg-slate-700 px-3 py-1.5 rounded hover:bg-slate-600 transition text-white"
                      >
                        送體力
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === 'chat' && (
        <div className="flex flex-col h-full gap-4">
          <div className="flex-1 glass-card p-4 overflow-y-auto text-sm select-text flex flex-col gap-3">
            <div className={`bg-slate-800/80 p-2 rounded mb-2 text-center border text-[10px] ${privateChatTarget ? 'text-indigo-400 border-indigo-500/50' : 'text-slate-400 border-slate-700/50'}`}>
              {privateChatTarget ? `與 ${privateChatTarget.friend_username} 的私人對話` : '全伺服器公共頻道'}
            </div>
            {chatLogs.length === 0 ? <span className="text-slate-500 text-center italic mt-10 block">沒有訊息。打個招呼吧！</span> : chatLogs.map((chat, idx) => (
              <div key={idx} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 break-words flex flex-col">
                <span className="font-bold text-cyan-400 mr-2 text-xs mb-1 cursor-pointer hover:underline" onClick={() => chat.user_id !== user.user_id ? loadUserProfile(chat.user_id) : null}>
                  {chat.senderName} 
                  <span className="text-[9px] text-slate-500 font-normal ml-2">{chat.timestamp ? new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </span> 
                <span className="text-slate-200 text-sm">{chat.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={chatMessage} 
              onChange={(e) => setChatMessage(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()} 
              placeholder="輸入訊息..." 
              className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors" 
              maxLength={100}
            />
            <button 
              onClick={handleSendChat} 
              disabled={!chatMessage.trim()}
              className="neon-button neon-button-primary px-6 py-3 font-bold disabled:opacity-50"
            >
              發送
            </button>
          </div>
        </div>
      )}
      {showProfileModal && selectedProfile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass-card bg-slate-900 border-cyan-500/30 p-6 max-w-sm w-full relative">
            <button onClick={() => setShowProfileModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center text-4xl border border-cyan-500/50 mb-4 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                👤
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">{selectedProfile.username}</h2>
              <span className="text-xs text-slate-500 mb-6">加入時間: {new Date(selectedProfile.created_at).toLocaleDateString()}</span>
              
              <div className="w-full bg-slate-800/50 p-3 rounded-lg border border-slate-700 mb-6">
                <h3 className="text-cyan-400 text-xs font-bold mb-2 text-center">出戰怪獸</h3>
                {selectedProfile.monsters && selectedProfile.monsters.length > 0 ? (
                  <div className="flex justify-center gap-2">
                    {selectedProfile.monsters.map(m => (
                       <div key={m.monster_id} className="text-center">
                         <div className="scale-75"><MonsterPixelArt family={m.family} stage={m.life_stage} type={m.type} isStatic={true} /></div>
                         <div className="text-[10px] text-slate-300 mt-1">{m.name}</div>
                       </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-500 text-xs py-2">沒有設定出戰怪獸</div>
                )}
              </div>
              
              {selectedProfile.user_id !== user.user_id && (
                <button 
                  onClick={() => { handleAddFriendAction(selectedProfile.user_id); setShowProfileModal(false); }}
                  className="w-full neon-button neon-button-success py-3 font-bold flex items-center justify-center gap-2"
                >
                  <span>➕</span> 發送好友申請
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
