import React, { useState } from 'react';
import MonsterPixelArt from '../components/MonsterPixelArt';
import { api } from '../utils/api';

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

  const monster = activeMonster || monsters[0];

  const handleAction = async (actionFn, ...args) => {
    setLoading(true);
    setMessage('');
    try {
      const data = await actionFn(...args);
      setMessage(data.message || '操作成功！');
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
      <div className="h-full flex flex-col justify-between p-1 font-pressstart text-[8px] text-lcd-dark">
        <div className="text-center font-bold border-b border-lcd-border pb-1">
          💰:{user.gold}G | 🔋:{user.stamina}
        </div>
        
        <div className="flex flex-col items-center justify-center gap-4 my-auto">
          <span className="text-center">目前沒有培育中的怪獸</span>
          <button
            type="button"
            onClick={handleHatch}
            disabled={loading}
            className="px-3 py-1.5 bg-lcd-dark text-lcd-bg rounded border border-lcd-border active:scale-95 disabled:opacity-50"
          >
            HATCH EGG (-100G)
          </button>
        </div>

        {message && <div className="text-center text-[7px] border-t border-lcd-border pt-1 truncate">{message}</div>}
      </div>
    );
  }

  if (!monster) return null;

  // Make sure we have inventory counts
  const getItemQty = (itemId) => {
    const item = inventory.find(i => i.item_id === itemId);
    return item ? item.quantity : 0;
  };

  return (
    <div className="h-full flex flex-col justify-between p-1 font-pressstart text-[8px] text-lcd-dark">
      {/* Top Header stats */}
      <div className="flex justify-between items-center border-b border-lcd-border pb-1 text-[7px]">
        <span>💰:{user.gold}G</span>
        <span>🔋:{user.stamina}</span>
        <button 
          onClick={() => setPage('roster')}
          className="underline text-[6px]"
        >
          倉庫({monsters.length}/50)
        </button>
      </div>

      {/* Screen Body */}
      <div className="flex-1 flex flex-col justify-around py-1.5">
        
        {/* Monster Display Row */}
        <div className="flex justify-around items-center gap-2">
          {/* Sprite and Status Overlay */}
          <div className="relative">
            <MonsterPixelArt 
              stage={monster.life_stage} 
              type={monster.type} 
              isDead={monster.is_dead} 
              isSick={monster.is_sick} 
              isPoop={monster.cleanliness < 40}
            />
          </div>

          {/* Core Info & Progress Bars */}
          <div className="flex-1 flex flex-col gap-1.5 max-w-[160px] text-[7px]">
            <div className="font-bold text-[9px] truncate border-b border-lcd-border pb-0.5">{monster.name}</div>
            <div>世代: G{monster.generation} ({STAGE_NAMES[monster.life_stage]})</div>
            <div>屬性: {TYPE_NAMES[monster.type] || '無'}</div>
            
            {/* Fullness Bar */}
            <div>
              飢餓: {monster.fullness}%
              <div className="w-full h-1.5 border border-lcd-border flex">
                <div className="bg-lcd-dark" style={{ width: `${monster.fullness}%` }}></div>
              </div>
            </div>

            {/* Cleanliness Bar */}
            <div>
              清潔: {monster.cleanliness}%
              <div className="w-full h-1.5 border border-lcd-border flex">
                <div className="bg-lcd-dark" style={{ width: `${monster.cleanliness}%` }}></div>
              </div>
            </div>

            {/* Age display */}
            <div>存活: {Math.floor(monster.age_days * 10) / 10} 天</div>
          </div>
        </div>

        {/* Combat Stats summary */}
        <div className="border border-lcd-border rounded p-1 text-[6.5px] bg-lcd-light/30 flex justify-between">
          <span>HP:{Math.round(monster.combat_hp)}</span>
          <span>ATK:{Math.round(monster.combat_atk)}</span>
          <span>DEF:{Math.round(monster.combat_def)}</span>
          <span>SPD:{Math.round(monster.combat_spd)}</span>
        </div>

      </div>

      {/* Dynamic Actions Menu */}
      <div className="border-t border-lcd-border pt-1">
        {showFeedMenu ? (
          /* Food selection overlay */
          <div className="flex justify-around items-center py-1">
            <button
              onClick={() => { handleAction(api.feed, monster.monster_id, 'meat_basic'); setShowFeedMenu(false); }}
              disabled={getItemQty('meat_basic') === 0 || loading}
              className="px-1 py-0.5 border border-lcd-border rounded disabled:opacity-30"
            >
              基本肉 ({getItemQty('meat_basic')})
            </button>
            <button
              onClick={() => { handleAction(api.feed, monster.monster_id, 'meat_premium'); setShowFeedMenu(false); }}
              disabled={getItemQty('meat_premium') === 0 || loading}
              className="px-1 py-0.5 border border-lcd-border rounded disabled:opacity-30"
            >
              頂級肉 ({getItemQty('meat_premium')})
            </button>
            <button
              onClick={() => { handleAction(api.feed, monster.monster_id, 'energy_drink'); setShowFeedMenu(false); }}
              disabled={getItemQty('energy_drink') === 0 || loading}
              className="px-1 py-0.5 border border-lcd-border rounded disabled:opacity-30"
            >
              能量飲 ({getItemQty('energy_drink')})
            </button>
            <button 
              onClick={() => setShowFeedMenu(false)}
              className="text-red-800 text-[6px]"
            >
              返回
            </button>
          </div>
        ) : (
          /* Standard Action bar */
          <div className="grid grid-cols-4 gap-1 text-[7px] text-center mb-1">
            <button
              onClick={() => setShowFeedMenu(true)}
              disabled={loading || monster.life_stage === 1}
              className="py-1 bg-lcd-light/40 border border-lcd-border rounded active:bg-lcd-dark active:text-lcd-bg disabled:opacity-40"
            >
              餵食
            </button>
            <button
              onClick={() => handleAction(api.clean, monster.monster_id)}
              disabled={loading || monster.life_stage === 1}
              className="py-1 bg-lcd-light/40 border border-lcd-border rounded active:bg-lcd-dark active:text-lcd-bg disabled:opacity-40"
            >
              打掃
            </button>
            <button
              onClick={() => handleAction(api.heal, monster.monster_id)}
              disabled={loading || !monster.is_sick}
              className="py-1 bg-lcd-light/40 border border-lcd-border rounded active:bg-lcd-dark active:text-lcd-bg disabled:opacity-40"
            >
              治療
            </button>
            <button
              onClick={() => handleAction(api.train, monster.monster_id)}
              disabled={loading || monster.life_stage === 1}
              className="py-1 bg-lcd-light/40 border border-lcd-border rounded active:bg-lcd-dark active:text-lcd-bg disabled:opacity-40"
            >
              訓練
            </button>
          </div>
        )}

        {/* Evolve action if Perfect and ready */}
        {monster.life_stage === 5 && (
          <div className="w-full mb-1">
            <button
              onClick={() => handleAction(api.evolve, monster.monster_id)}
              disabled={loading || getItemQty('ultimate_core') === 0 || monster.battles < 50}
              className="w-full py-1 bg-yellow-600 text-lcd-bg border border-lcd-border rounded text-[7px] font-bold blink"
            >
              🧬 究極進化 (需核心+50戰+70%勝率)
            </button>
          </div>
        )}

        {/* Status / Log text */}
        {message && (
          <div className="text-[6.5px] bg-lcd-light/50 border border-lcd-border px-1 py-0.5 rounded text-center truncate mb-1">
            {message}
          </div>
        )}

        {/* System Navigation Tabs */}
        <div className="grid grid-cols-5 gap-0.5 border-t border-lcd-border pt-1 text-[6px] font-bold text-center">
          <button onClick={() => setPage('dashboard')} className="py-0.5 bg-lcd-dark text-lcd-bg rounded">養成</button>
          <button onClick={() => setPage('roster')} className="py-0.5 hover:bg-lcd-light/35 rounded">倉庫</button>
          <button onClick={() => setPage('arena')} className="py-0.5 hover:bg-lcd-light/35 rounded">競技</button>
          <button onClick={() => setPage('guild')} className="py-0.5 hover:bg-lcd-light/35 rounded">公會</button>
          <button onClick={() => setPage('raid')} className="py-0.5 hover:bg-lcd-light/35 rounded">討伐</button>
        </div>
      </div>
    </div>
  );
}
