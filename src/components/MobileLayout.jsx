import React from 'react';

// Icons for bottom nav
const HomeIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const RosterIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
const ArenaIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const GuildIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const RaidIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

export default function MobileLayout({ children, page, setPage, isConnected }) {
  const tabs = [
    { id: 'dashboard', label: '養成', icon: <HomeIcon /> },
    { id: 'roster', label: '倉庫', icon: <RosterIcon /> },
    { id: 'arena', label: '競技', icon: <ArenaIcon /> },
    { id: 'guild', label: '公會', icon: <GuildIcon /> },
    { id: 'raid', label: '討伐', icon: <RaidIcon /> },
  ];

  return (
    <div className="w-full max-w-[480px] h-[100dvh] mx-auto bg-slate-900/40 relative shadow-2xl flex flex-col overflow-hidden sm:rounded-3xl sm:h-[850px] sm:my-4 border-x border-slate-700/30 sm:border-y">
      {/* Top Header / Status Bar */}
      <div className="h-12 w-full glass-panel flex items-center justify-between px-4 z-20 sticky top-0">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-bold tracking-widest text-lg neon-text">MONSTER ARENA</span>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              連線中
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-rose-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              斷線
            </span>
          )}
        </div>
      </div>

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
