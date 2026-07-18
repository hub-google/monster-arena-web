import React, { useState } from 'react';
import { api } from '../utils/api';

// Icons for bottom nav
const HomeIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const RosterIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
const ArenaIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const GuildIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const SocialIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;

export default function MobileLayout({ children, page, setPage, user, onLogout, onNicknameUpdate }) {
  const [editingNick, setEditingNick] = useState(false);
  const [nickInput, setNickInput] = useState('');
  const [nickLoading, setNickLoading] = useState(false);

  const tabs = [
    { id: 'dashboard', label: '養成', icon: <HomeIcon /> },
    { id: 'roster', label: '倉庫', icon: <RosterIcon /> },
    { id: 'arena', label: '競技', icon: <ArenaIcon /> },
    { id: 'guild', label: '公會', icon: <GuildIcon /> },
    { id: 'social', label: '社交', icon: <SocialIcon /> },
  ];

  const handleEditNick = () => {
    setNickInput(user?.username || '');
    setEditingNick(true);
  };

  const handleSaveNick = async () => {
    if (!nickInput.trim()) return;
    setNickLoading(true);
    try {
      await api.updateNickname(nickInput.trim());
      if (onNicknameUpdate) onNicknameUpdate(nickInput.trim());
      setEditingNick(false);
    } catch (e) {
      alert('❌ ' + e.message);
    } finally {
      setNickLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[480px] h-[100dvh] mx-auto bg-slate-950 text-slate-200 relative shadow-2xl flex flex-col overflow-hidden sm:rounded-3xl sm:h-[850px] sm:my-4 border-x border-slate-700/30 sm:border-y">
      {/* Top Header */}
      <div className="h-12 w-full glass-panel flex items-center justify-between px-4 z-20 sticky top-0">
        <span className="text-cyan-400 font-bold tracking-widest text-lg neon-text">MONSTER ARENA</span>
        <div className="flex items-center gap-2">
          {user && (
            <span className="text-xs text-slate-400 font-medium truncate max-w-[80px]">
              {user.username}
            </span>
          )}
          {/* Edit nickname button */}
          <button
            onClick={handleEditNick}
            title="編輯暱稱"
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center transition-colors text-slate-300 hover:text-cyan-400"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          {/* Logout button */}
          <button
            onClick={onLogout}
            title="登出"
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-rose-900/60 border border-slate-600 hover:border-rose-500/50 flex items-center justify-center transition-colors text-slate-300 hover:text-rose-400"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Edit Nickname Modal */}
      {editingNick && (
        <div className="absolute inset-0 bg-black/70 z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="glass-card w-full max-w-xs p-6 border-cyan-500/30 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-cyan-400">✏️ 編輯暱稱</h3>
            <input
              autoFocus
              type="text"
              maxLength={16}
              value={nickInput}
              onChange={e => setNickInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveNick()}
              placeholder="輸入新暱稱..."
              className="bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-lg px-4 py-3 text-white outline-none text-sm"
            />
            <p className="text-xs text-slate-500">{nickInput.length}/16 字</p>
            <div className="flex gap-2">
              <button
                onClick={() => setEditingNick(false)}
                className="flex-1 py-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 text-sm transition"
              >
                取消
              </button>
              <button
                onClick={handleSaveNick}
                disabled={nickLoading || !nickInput.trim()}
                className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition disabled:opacity-50"
              >
                {nickLoading ? '儲存中...' : '確認'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth p-4 pb-24">
        {children}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="absolute bottom-0 w-full h-16 glass-panel flex justify-around items-center z-20 pb-safe">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setPage(t.id)}
            className={`bottom-nav-item ${page === t.id ? 'active' : ''}`}
          >
            {t.icon}
            <span className="text-[10px] mt-1 font-medium">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
