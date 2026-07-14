import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function QuestModal({ user, onClose, refreshData }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [quests, setQuests] = useState(null);

  useEffect(() => {
    loadQuests();
  }, []);

  const loadQuests = async () => {
    try {
      const q = await api.getDailyQuests();
      setQuests(q);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleClaim = async (questId, rewardGold) => {
    setLoading(true);
    setMessage('');
    try {
      const res = await api.claimQuest(questId, rewardGold);
      setMessage(res.message);
      await loadQuests();
      await refreshData();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!quests) return null;

  const QUEST_CONFIG = [
    { id: 'feed_3', title: '飽餐一頓', desc: '餵食怪獸 3 次', target: 3, key: 'feed_count', reward: 100 },
    { id: 'clean_1', title: '保持整潔', desc: '打掃環境 1 次', target: 1, key: 'clean_count', reward: 50 },
    { id: 'train_2', title: '斯巴達訓練', desc: '訓練怪獸 2 次', target: 2, key: 'train_count', reward: 150 },
    { id: 'battle_2', title: '初試啼聲', desc: '參與競技場戰鬥 2 次', target: 2, key: 'battle_count', reward: 150 },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="glass-card w-full max-w-lg p-6 relative border-cyan-500/30 flex flex-col max-h-[90vh]">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl"
        >
          ✕
        </button>

        <h3 className="text-xl font-bold text-cyan-400 mb-6 flex items-center gap-2">
          <span className="text-2xl">📋</span> 每日任務
        </h3>

        <div className="space-y-4 overflow-y-auto pr-2">
          {QUEST_CONFIG.map(q => {
            const current = quests[q.key] || 0;
            const isCompleted = current >= q.target;
            const isClaimed = quests.claimed?.includes(q.id);

            return (
              <div key={q.id} className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex flex-col w-full">
                  <span className="font-bold text-white text-sm">{q.title}</span>
                  <span className="text-xs text-slate-400">{q.desc}</span>
                  <div className="mt-2 w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-cyan-500"
                      style={{ width: `${Math.min(100, (current / q.target) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="text-[10px] text-slate-500 text-right mt-1">
                    {Math.min(current, q.target)} / {q.target}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-center">
                  <span className="text-amber-400 text-xs font-bold mb-1">💰 {q.reward}G</span>
                  {isClaimed ? (
                    <button disabled className="px-4 py-2 bg-slate-800 text-slate-500 text-xs rounded border border-slate-700">已領取</button>
                  ) : isCompleted ? (
                    <button 
                      onClick={() => handleClaim(q.id, q.reward)} 
                      disabled={loading}
                      className="neon-button neon-button-success px-4 py-2 text-xs pulse-glow"
                    >
                      領取獎勵
                    </button>
                  ) : (
                    <button disabled className="px-4 py-2 bg-slate-800 text-slate-500 text-xs rounded border border-slate-700">未完成</button>
                  )}
                </div>
              </div>
            );
          })}
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
