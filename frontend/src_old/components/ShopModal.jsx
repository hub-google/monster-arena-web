import React, { useState } from 'react';
import { api } from '../utils/api';

export default function ShopModal({ user, onClose, refreshData }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleBuy = async (itemId) => {
    setLoading(true);
    setMessage('');
    try {
      const res = await api.buyItem(itemId, 1);
      setMessage(res.message);
      await refreshData();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="glass-card w-full max-w-lg p-6 relative border-amber-500/30 flex flex-col max-h-[90vh]">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl"
        >
          ✕
        </button>

        <h3 className="text-xl font-bold text-amber-400 mb-2 flex items-center gap-2">
          <span className="text-2xl">🏪</span> 道具補給站
        </h3>
        
        <div className="flex justify-between items-center mb-4 text-sm font-bold bg-slate-900/50 p-3 rounded-lg border border-slate-700">
          <span className="text-slate-300">目前持有金幣</span>
          <span className="text-amber-400">💰 {user?.gold || 0}G</span>
        </div>

        <div className="space-y-3 overflow-y-auto pr-2">
          <div className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-xl flex justify-between items-center hover:border-amber-500/30 transition-colors">
            <div className="flex flex-col">
              <span className="font-bold text-white text-sm">🧪 維他命</span>
              <span className="text-xs text-slate-400">+10% 訓練成功率</span>
            </div>
            <button onClick={() => handleBuy('vitamin')} disabled={loading || user.gold < 50} className="neon-button bg-cyan-600 text-white px-4 py-2 text-sm shadow-cyan-500/20">50G 購買</button>
          </div>
          
          <div className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-xl flex justify-between items-center hover:border-amber-500/30 transition-colors">
            <div className="flex flex-col">
              <span className="font-bold text-white text-sm">🧪 繁衍催化劑</span>
              <span className="text-xs text-slate-400">突變機率翻倍</span>
            </div>
            <button onClick={() => handleBuy('breed_catalyst')} disabled={loading || user.gold < 500} className="neon-button bg-fuchsia-600 text-white px-4 py-2 text-sm shadow-fuchsia-500/20">500G 購買</button>
          </div>

          <div className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-xl flex justify-between items-center hover:border-amber-500/30 transition-colors">
            <div className="flex flex-col">
              <span className="font-bold text-white text-sm">🧬 究極進化核心</span>
              <span className="text-xs text-slate-400">進化究極體必備</span>
            </div>
            <button onClick={() => handleBuy('ultimate_core')} disabled={loading || user.gold < 1000} className="neon-button bg-gradient-to-r from-yellow-500 to-amber-600 text-white px-4 py-2 text-sm shadow-[0_0_10px_rgba(245,158,11,0.5)]">1000G 購買</button>
          </div>
        </div>

        {message && (
          <div className="mt-4 p-3 text-center text-sm font-medium animate-pulse text-cyan-200 border border-cyan-500/50 bg-cyan-900/20 rounded">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
