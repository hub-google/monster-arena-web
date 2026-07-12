import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Raid({ 
  user, 
  monsters, 
  activeMonster, 
  refreshData, 
  setPage 
}) {
  const [boss, setBoss] = useState(null);
  const [selectedMonsterId, setSelectedMonsterId] = useState(activeMonster?.monster_id || monsters[0]?.monster_id);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Reload boss stats
  const fetchBossStatus = async () => {
    try {
      const data = await api.getRaidStatus();
      setBoss(data);
    } catch (err) {
      console.error('Failed to load raid boss status:', err);
    }
  };

  useEffect(() => {
    fetchBossStatus();
    // Poll boss stats every 5 seconds to show co-op changes
    const interval = setInterval(fetchBossStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const selectedMonster = monsters.find(m => m.monster_id === selectedMonsterId) || monsters[0];

  const handleAttack = async () => {
    if (!selectedMonster || selectedMonster.is_dead) {
      setMessage('❌ 請選擇一隻存活的怪獸！');
      return;
    }
    if (user.stamina < 15) {
      setMessage('❌ 體力不足！需要 15 點體力。');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      // Calculate client-side attack damage based on combat stats & attribute countering
      // World boss is Vaccine (1). Attacker Virus (3) -> +30% damage. Attacker Data (2) -> -30% damage.
      let typeMultiplier = 1.0;
      if (selectedMonster.type === 3) typeMultiplier = 1.30;
      else if (selectedMonster.type === 2) typeMultiplier = 0.70;

      const baseDmg = selectedMonster.combat_atk * 20;
      const rng = (Math.random() * 0.20) + 0.90; // 0.9 to 1.1 RNG
      const finalDmg = Math.round(baseDmg * typeMultiplier * rng);

      const data = await api.attackRaidBoss(selectedMonster.monster_id, finalDmg);
      setMessage(`💥 造成 ${finalDmg.toLocaleString()} 點傷害！\n${data.message}`);
      await refreshData();
      await fetchBossStatus();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col justify-between p-1 font-pressstart text-[8px] text-lcd-dark">
      {/* Header bar */}
      <div className="flex justify-between items-center border-b border-lcd-border pb-1 text-[7px]">
        <span>世界王共鬥討伐</span>
        <span>🔋: {user.stamina}</span>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-around py-1.5 max-h-48">
        
        {boss ? (
          <div className="border border-lcd-border rounded p-1.5 bg-lcd-light/20 flex flex-col gap-1 text-center select-text">
            {/* Boss Name */}
            <div className="font-bold text-[9px] truncate border-b border-lcd-border pb-0.5 text-red-950">
              👹 {boss.name}
            </div>

            {/* Boss Health Bar */}
            <div className="my-1.5">
              <div className="flex justify-between text-[5px] mb-0.5 font-bold">
                <span>HP: {boss.current_hp.toLocaleString()}</span>
                <span>/ {boss.max_hp.toLocaleString()}</span>
              </div>
              <div className="w-full h-2 border border-lcd-border flex overflow-hidden">
                <div className="bg-red-800 h-full" style={{ width: `${(boss.current_hp / boss.max_hp) * 100}%` }}></div>
              </div>
            </div>

            {/* Status indicators */}
            <span className="text-[6.5px]">
              {boss.is_active ? '🔴 全服共鬥進行中' : '🏆 世界王已遭全服討伐成功！'}
            </span>
          </div>
        ) : (
          <span className="text-center italic mt-4 text-gray-500">正在加載世界王數據...</span>
        )}

        {/* Monster selector & Attack triggers */}
        {boss && boss.is_active && (
          <div className="flex flex-col gap-1 border-t border-lcd-border/30 pt-1.5">
            
            {/* Monster Dropdown */}
            <div className="flex gap-1 items-center text-[6px]">
              <span>出戰:</span>
              <select 
                value={selectedMonsterId}
                onChange={(e) => setSelectedMonsterId(parseInt(e.target.value))}
                className="flex-1 bg-lcd-bg border border-lcd-border text-[6px] px-1 py-0.5 outline-none text-lcd-dark font-pressstart"
              >
                {monsters.filter(m => !m.is_dead).map(m => (
                  <option key={m.monster_id} value={m.monster_id}>
                    {m.name} (ATK: {Math.round(m.combat_atk)})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleAttack}
              disabled={loading || user.stamina < 15 || monsters.filter(m => !m.is_dead).length === 0}
              className="w-full py-1.5 bg-lcd-dark text-lcd-bg border border-lcd-border rounded text-[7.5px] font-bold active:scale-95 disabled:opacity-40"
            >
              💥 發動討伐突襲 (15體力)
            </button>
          </div>
        )}

      </div>

      {/* Log message output */}
      {message && (
        <div className="text-[5.5px] whitespace-pre-line bg-lcd-light/50 border border-lcd-border px-1 py-1 rounded text-center mb-1">
          {message}
        </div>
      )}

      {/* Navigation tabs */}
      <div className="grid grid-cols-5 gap-0.5 border-t border-lcd-border pt-1 text-[6.5px] font-bold text-center">
        <button onClick={() => setPage('dashboard')} className="py-0.5 hover:bg-lcd-light/35 rounded">養成</button>
        <button onClick={() => setPage('roster')} className="py-0.5 hover:bg-lcd-light/35 rounded">倉庫</button>
        <button onClick={() => setPage('arena')} className="py-0.5 hover:bg-lcd-light/35 rounded">競技</button>
        <button onClick={() => setPage('guild')} className="py-0.5 hover:bg-lcd-light/35 rounded">公會</button>
        <button onClick={() => setPage('raid')} className="py-0.5 bg-lcd-dark text-lcd-bg rounded">討伐</button>
      </div>
    </div>
  );
}
