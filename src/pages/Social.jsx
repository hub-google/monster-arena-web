import React, { useState, useEffect, useRef } from 'react';
import MonsterPixelArt from '../components/MonsterPixelArt';
import { api } from '../utils/api';

const STAGE_NAMES = ['蛋', '蛋', '幼年期', '成長期', '成熟期', '完全體', '究極體'];
const TYPE_NAMES = ['無', '疫苗種', '資料種', '病毒種'];

export default function Social({ user }) {
  const [subTab, setSubTab] = useState('plaza'); // 'plaza' or 'chat'
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Plaza State
  const [players, setPlayers] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');

  // Chat State
  const [chatMessage, setChatMessage] = useState('');
  const [chatLogs, setChatLogs] = useState([]);
  const logsEndRef = useRef(null);

  // Friends State
  const [friendUUID, setFriendUUID] = useState('');
  const [friendsList, setFriendsList] = useState([]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLogs]);

  useEffect(() => {
    if (subTab === 'plaza') {
      loadPlayers();
    } else if (subTab === 'chat') {
      const unsubscribe = api.subscribeMessages('world', (msgs) => {
        setChatLogs(msgs);
      });
      return () => unsubscribe();
    } else if (subTab === 'friends') {
      loadFriends();
    }
  }, [subTab, typeFilter]);

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
      setMessage(err.message);
    }
    setLoading(false);
  };

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const results = await api.searchPlayers(typeFilter);
      setPlayers(results);
    } catch (err) {
      setMessage(err.message);
    }
    setLoading(false);
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    try {
      await api.sendMessage('world', chatMessage);
      setChatMessage('');
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in relative">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSubTab('plaza')}
          className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-colors border ${subTab === 'plaza' ? 'bg-cyan-600/30 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'border-slate-700 text-slate-400 bg-slate-800/50'}`}
        >
          🔍 廣場
        </button>
        <button
          onClick={() => setSubTab('friends')}
          className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-colors border ${subTab === 'friends' ? 'bg-cyan-600/30 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'border-slate-700 text-slate-400 bg-slate-800/50'}`}
        >
          👥 好友
        </button>
        <button
          onClick={() => setSubTab('chat')}
          className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-colors border ${subTab === 'chat' ? 'bg-cyan-600/30 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'border-slate-700 text-slate-400 bg-slate-800/50'}`}
        >
          💬 頻道
        </button>
      </div>

      {message && (
        <div className="bg-emerald-900/50 border border-emerald-500/50 text-emerald-300 p-3 rounded-lg mb-4 text-sm text-center font-medium shadow-lg backdrop-blur-sm animate-fade-in">
          {message}
        </div>
      )}

      {subTab === 'plaza' && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex gap-2 mb-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-800/80 border border-slate-700 text-white p-2 rounded-lg text-sm outline-none focus:border-cyan-500 flex-1"
            >
              <option value="">全部屬性 (隨機活躍玩家)</option>
              <option value="1">💉 疫苗種</option>
              <option value="2">💾 資料種</option>
              <option value="3">🦠 病毒種</option>
            </select>
            <button onClick={loadPlayers} disabled={loading} className="neon-button bg-cyan-700 hover:bg-cyan-600 text-white px-4 rounded-lg text-sm">
              重新整理
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pb-10">
            {loading ? (
              <p className="text-center text-slate-400 py-10">搜尋中...</p>
            ) : players.length === 0 ? (
              <p className="text-center text-slate-400 py-10">目前沒有找到符合條件的玩家。</p>
            ) : (
              players.map(p => (
                <div key={p.user_id} className="glass-card p-3 flex flex-col gap-2">
                  <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                    <span className="font-bold text-cyan-300">{p.username}</span>
                  </div>
                  <div className="flex justify-around mt-2">
                    {p.monsters.map((m, idx) => (
                      <div key={idx} className="flex flex-col items-center gap-1">
                        <div className="w-16 h-16 bg-slate-800 rounded flex items-center justify-center overflow-hidden border border-slate-700">
                          <MonsterPixelArt monster={m} size={2} />
                        </div>
                        <span className="text-[10px] text-slate-300 text-center max-w-[60px] truncate">
                          {m.custom_name || m.name}
                        </span>
                        <span className="text-[9px] text-slate-500">{TYPE_NAMES[m.type] || '無'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
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
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 text-xs text-white focus:border-cyan-500 outline-none"
              />
              <button 
                onClick={handleAddFriend}
                disabled={loading || !friendUUID.trim()}
                className="neon-button neon-button-primary px-4 py-2 text-xs"
              >
                加入
              </button>
            </div>
          </div>
          
          <h3 className="text-slate-300 font-bold text-sm">好友列表 ({friendsList.length})</h3>
          <div className="flex-1 overflow-y-auto space-y-3 pb-10">
            {loading ? (
              <p className="text-center text-slate-400 py-10">載入中...</p>
            ) : friendsList.length === 0 ? (
              <p className="text-center text-slate-400 py-10 text-xs">目前還沒有好友，趕快輸入 UUID 加入吧！</p>
            ) : (
              friendsList.map(f => (
                  <div key={f.friend_id} className="glass-card p-3 flex justify-between items-center">
                    <span className="font-bold text-cyan-300">{f.friend_name}</span>
                    <button 
                      onClick={() => api.giftStamina(f.friend_id).then(() => setMessage('已發送體力給 ' + f.friend_name)).catch(e => setMessage(e.message))} 
                      className="text-[10px] bg-slate-700 px-3 py-1.5 rounded hover:bg-slate-600 transition"
                    >
                      贈送體力
                    </button>
                  </div>
              ))
            )}
          </div>
        </div>
      )}

      {subTab === 'chat' && (
        <div className="flex-1 flex flex-col glass-card overflow-hidden">
          <div className="bg-slate-800/80 p-2 text-center text-[10px] text-slate-400 border-b border-slate-700/50">
            全伺服器公共頻道<br/>(防範詐騙不法，您的對話將永久記錄以供稽核)
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
            {chatLogs.map(log => {
              const isMe = log.user_id === user?.uid;
              return (
                <div key={log.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-slate-500 mb-0.5 mx-1">
                    {log.username} • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm shadow-md break-words ${
                    isMe 
                    ? 'bg-cyan-600/50 border border-cyan-500/30 text-white rounded-tr-sm' 
                    : 'bg-slate-700/50 border border-slate-600/30 text-slate-200 rounded-tl-sm'
                  }`}>
                    {log.text}
                  </div>
                </div>
              );
            })}
            <div ref={logsEndRef} />
          </div>
          <div className="p-3 bg-slate-800/80 border-t border-slate-700/50">
            <form onSubmit={handleSendChat} className="flex gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="輸入訊息..."
                className="flex-1 bg-slate-900 border border-slate-600 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                maxLength={100}
              />
              <button 
                type="submit" 
                disabled={!chatMessage.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors disabled:opacity-50"
              >
                ➤
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
