import React, { useState } from 'react';
import MonsterPixelArt from '../components/MonsterPixelArt';
import { api } from '../utils/api';
import { MONSTER_SPRITES } from '../utils/monsterSprites';

const STAGE_NAMES = ['蛋', '蛋', '幼年期', '成長期', '成熟期', '完全體', '究極體'];
const TYPE_NAMES = ['', '疫苗種 (Vaccine)', '資料種 (Data)', '病毒種 (Virus)'];

export default function Dashboard({ 
  user, 
  monsters, 
  inventory, 
  refreshData, 
  activeMonster, 
  setActiveMonster, 
  setPage 
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showFeedMenu, setShowFeedMenu] = useState(false);
  const [actionEmote, setActionEmote] = useState(null);

  const monster = activeMonster || monsters[0];

  const handleAction = async (actionFn, ...args) => {
    setLoading(true);
    setMessage('');
    try {
      const data = await actionFn(...args);
      setMessage(data.message || '操作成功！');
      
      // Trigger Happy Emote on successful train/feed
      if (actionFn === api.train || actionFn === api.feed) {
        setActionEmote('happy');
        setTimeout(() => setActionEmote(null), 3000);
      }

      await refreshData();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleHatch = async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await api.hatchEgg();
      setMessage(data.message);
      await refreshData();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Render Egg / Hatch state if user has no monsters
  if (monsters.length === 0) {
    return (
      <div className="h-full flex flex-col justify-center items-center">
        <div className="glass-card w-full max-w-sm p-8 flex flex-col items-center gap-8 text-center animate-fade-in">
          <div className="text-6xl animate-bounce">🥚</div>
          <div>
            <h2 className="text-xl font-bold neon-text mb-2">尚未擁有怪獸</h2>
            <p className="text-slate-400 text-sm">你需要孵化一顆數位蛋來開始你的冒險。</p>
          </div>
          
          <div className="flex justify-center gap-6 w-full text-sm font-bold text-slate-300">
            <span className="flex items-center gap-1">💰 {user.gold}G</span>
            <span className="flex items-center gap-1">🔋 {user.stamina}</span>
          </div>

          <button
            type="button"
            onClick={handleHatch}
            disabled={loading}
            className="neon-button neon-button-primary w-full py-4 text-lg mt-4"
          >
            HATCH EGG (-100G)
          </button>
          
          {message && <div className="text-rose-400 text-sm mt-2">{message}</div>}
        </div>
      </div>
    );
  }

  if (!monster) return null;

  const getItemQty = (itemId) => {
    const item = inventory.find(i => i.item_id === itemId);
    return item ? item.quantity : 0;
  };

  let displayName = monster.name;
  if (monster.custom_name) {
    displayName = monster.custom_name;
  } else if (monster.life_stage >= 3) {
    const spriteKey = `${monster.family || 1}_${monster.life_stage}_${monster.type || 0}`;
    if (MONSTER_SPRITES[spriteKey]) {
      displayName = MONSTER_SPRITES[spriteKey].name;
    }
  }

  const handleRename = async () => {
    const newName = prompt('請輸入新的怪獸名稱（最多20字）：', displayName);
    if (newName !== null && newName.trim() !== '') {
      await handleAction(api.rename, monster.id, newName);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in">
      {/* Top Header stats */}
      <div className="glass-card p-4 flex justify-between items-center text-sm font-bold">
        <div className="flex gap-4">
          <span className="text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]">💰 {user.gold}G</span>
          <span className="text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">🔋 {user.stamina}</span>
        </div>
        <button 
          onClick={() => setPage('roster')}
          className="text-cyan-400 hover:text-cyan-300 transition underline text-xs"
        >
          切換怪獸 ({monsters.length}/50)
        </button>
      </div>

      {/* Monster Display Area */}
      <div className="glass-card p-6 flex flex-col items-center relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/20 to-transparent pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center gap-2 z-10 mb-1">
          <h2 className="text-2xl font-bold neon-text">{displayName}</h2>
          <button 
            onClick={handleRename}
            className="text-slate-400 hover:text-white transition cursor-pointer"
            title="改名"
          >
            ✏️
          </button>
        </div>
        <div className="flex gap-2 text-xs font-medium text-slate-400 z-10 mb-6 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700">
          <span>G{monster.generation} {STAGE_NAMES[monster.life_stage]}</span>
          <span>•</span>
          <span>{TYPE_NAMES[monster.type] || '無屬性'}</span>
        </div>

        <div className="relative z-10 scale-150 my-8">
          <MonsterPixelArt 
            family={monster.family}
            stage={monster.life_stage} 
            type={monster.type} 
            isDead={monster.is_dead} 
            isSick={monster.is_sick} 
            isPoop={monster.cleanliness < 40}
            isHappy={actionEmote === 'happy'}
            isHungry={monster.fullness < 30}
          />
        </div>

        {/* Status Bars */}
        <div className="w-full space-y-4 z-10 mt-6">
          <div>
            <div className="flex justify-between text-xs mb-1 font-medium text-slate-300">
              <span>飽食度</span>
              <span>{monster.fullness}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
              <div 
                className={`h-full transition-all duration-500 ${monster.fullness < 30 ? 'bg-rose-500 shadow-[0_0_10px_red]' : 'bg-emerald-500 shadow-[0_0_10px_#10b981]'}`}
                style={{ width: `${monster.fullness}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1 font-medium text-slate-300">
              <span>環境清潔</span>
              <span>{monster.cleanliness}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
              <div 
                className={`h-full transition-all duration-500 ${monster.cleanliness < 40 ? 'bg-amber-500 shadow-[0_0_10px_orange]' : 'bg-cyan-500 shadow-[0_0_10px_cyan]'}`}
                style={{ width: `${monster.cleanliness}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Combat Stats summary */}
      <div className="grid grid-cols-4 gap-2">
        <div className="glass-card py-2 flex flex-col items-center">
          <span className="text-[10px] text-slate-400">HP</span>
          <span className="font-bold text-rose-400">{Math.round(monster.combat_hp)}</span>
        </div>
        <div className="glass-card py-2 flex flex-col items-center">
          <span className="text-[10px] text-slate-400">ATK</span>
          <span className="font-bold text-amber-400">{Math.round(monster.combat_atk)}</span>
        </div>
        <div className="glass-card py-2 flex flex-col items-center">
          <span className="text-[10px] text-slate-400">DEF</span>
          <span className="font-bold text-blue-400">{Math.round(monster.combat_def)}</span>
        </div>
        <div className="glass-card py-2 flex flex-col items-center">
          <span className="text-[10px] text-slate-400">SPD</span>
          <span className="font-bold text-emerald-400">{Math.round(monster.combat_spd)}</span>
        </div>
      </div>

      {/* Dynamic Actions Menu */}
      <div className="glass-card p-4">
        {showFeedMenu ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { handleAction(api.feed, monster.monster_id, 'meat_basic'); setShowFeedMenu(false); }}
              disabled={getItemQty('meat_basic') === 0 || loading}
              className="neon-button neon-button-primary py-3 text-sm flex flex-col"
            >
              <span>基本肉</span>
              <span className="text-[10px] opacity-70 font-normal">庫存: {getItemQty('meat_basic')}</span>
            </button>
            <button
              onClick={() => { handleAction(api.feed, monster.monster_id, 'meat_premium'); setShowFeedMenu(false); }}
              disabled={getItemQty('meat_premium') === 0 || loading}
              className="neon-button neon-button-primary py-3 text-sm flex flex-col"
            >
              <span>頂級肉</span>
              <span className="text-[10px] opacity-70 font-normal">庫存: {getItemQty('meat_premium')}</span>
            </button>
            <button
              onClick={() => { handleAction(api.feed, monster.monster_id, 'energy_drink'); setShowFeedMenu(false); }}
              disabled={getItemQty('energy_drink') === 0 || loading}
              className="neon-button neon-button-success py-3 text-sm flex flex-col"
            >
              <span>能量飲</span>
              <span className="text-[10px] opacity-70 font-normal">庫存: {getItemQty('energy_drink')}</span>
            </button>
            <button 
              onClick={() => setShowFeedMenu(false)}
              className="neon-button bg-slate-700 text-white hover:bg-slate-600 py-3 text-sm"
            >
              取消返回
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => setShowFeedMenu(true)}
              disabled={loading || monster.life_stage === 1}
              className="neon-button neon-button-primary py-3 text-sm"
            >
              🍽️ 餵食
            </button>
            <button
              onClick={() => handleAction(api.clean, monster.monster_id)}
              disabled={loading || monster.life_stage === 1}
              className="neon-button bg-cyan-700 text-white hover:bg-cyan-600 shadow-lg shadow-cyan-900/50 py-3 text-sm"
            >
              🧹 打掃
            </button>
            <button
              onClick={() => handleAction(api.heal, monster.monster_id)}
              disabled={loading || !monster.is_sick}
              className="neon-button neon-button-success py-3 text-sm"
            >
              💊 治療
            </button>
            <button
              onClick={() => handleAction(api.train, monster.monster_id)}
              disabled={loading || monster.life_stage === 1}
              className="neon-button neon-button-danger py-3 text-sm"
            >
              ⚔️ 訓練
            </button>
          </div>
        )}

        {/* Evolve action if Perfect and ready */}
        {monster.life_stage === 5 && (
          <div className="mt-4">
            <button
              onClick={() => handleAction(api.evolve, monster.monster_id)}
              disabled={loading || getItemQty('ultimate_core') === 0 || monster.battles < 50}
              className="neon-button bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-[0_0_20px_rgba(245,158,11,0.5)] w-full py-4 text-sm pulse-glow"
            >
              🧬 究極進化 (需核心+50戰+70%勝率)
            </button>
          </div>
        )}
      </div>

      {/* Status / Log text */}
      {message && (
        <div className="glass-card p-3 text-center text-sm font-medium animate-pulse text-cyan-200 border-cyan-500/50 bg-cyan-900/20">
          {message}
        </div>
      )}
      
      {/* Age display subtle */}
      <div className="text-center text-xs text-slate-500 mt-2">
        存活時間: {Math.floor(monster.age_days * 10) / 10} 天
      </div>
    </div>
  );
}
