import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, User, Zap } from 'lucide-react';

const MainLayout = () => {
  const { userProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Top Navigation / Status Bar */}
      <header className="glass-panel mx-4 mt-4 p-4 flex justify-between items-center z-10">
        <div className="flex items-center gap-2 text-[#00ffcc] font-mono">
          <Zap size={24} className="animate-pulse" />
          <span className="font-bold tracking-wider text-shadow-neon">MONSTER ARENA</span>
        </div>
        
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <User size={16} className="text-slate-400" />
            <span className="font-bold">{userProfile?.username || 'Tamer'}</span>
          </div>
          <div className="flex items-center gap-1 text-[#ffcc00]">
            <span className="font-mono">G</span>
            <span className="font-bold">{userProfile?.gold || 0}</span>
          </div>
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-1 text-slate-400 hover:text-[#ff3366] transition-colors"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-4 md:p-8 max-w-6xl mx-auto w-full z-10">
        <div className="flex-1 w-full bg-slate-900/40 rounded-3xl border border-slate-700/50 shadow-2xl p-4 md:p-6 backdrop-blur-sm relative overflow-hidden">
          {/* Subtle internal glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#00ffcc]/5 to-transparent pointer-events-none" />
          
          {/* Page Content */}
          <div className="relative h-full">
            <Outlet />
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-500 font-mono z-10">
        v2.0.0 - Supabase Edition - System Online
      </footer>
    </div>
  );
};

export default MainLayout;
