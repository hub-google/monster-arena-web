import React, { useState } from 'react';
import MonsterPixelArt from '../components/MonsterPixelArt';
import { api } from '../utils/api';
import { MONSTER_SPRITES } from '../utils/monsterSprites';
import ShopModal from '../components/ShopModal';
import QuestModal from '../components/QuestModal';

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
  const [showHealMenu, setShowHealMenu] = useState(false);
  const [actionEmote, setActionEmote] = useState(null);
  const [showShop, setShowShop] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const monster = activeMonster || monsters[0];
  // Sleep: forced by item (sleep_until > now) OR by night time (22:00-07:00)
  const now = new Date();
  const hour = now.getHours();
  const isNightTime = hour >= 22 || hour < 6; // 22:00 ~ 06:00 per docs
  const isForcedSleep = monster?.sleep_until && new Date(monster.sleep_until) > now;
  const [localSleeping, setLocalSleeping] = useState(false);
  const isSleeping = isForcedSleep || isNightTime || localSleeping;

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

  let speciesName = '數位蛋';
  if (monster.life_stage >= 3) {
    const spriteKey = `${monster.family || 1}_${monster.life_stage}_${monster.type || 0}`;
    if (MONSTER_SPRITES[spriteKey]) {
      speciesName = MONSTER_SPRITES[spriteKey].name;
    } else {
      speciesName = '未知變種';
    }
  } else if (monster.life_stage === 2) {
    speciesName = '幼年期怪獸';
  }

  const handleRename = async () => {
    const newName = prompt('請輸入新的怪獸名稱（最多20字）：', displayName);
    if (newName !== null && newName.trim() !== '') {
      setLoading(true);
      setMessage('');
      try {
        const data = await api.rename(monster.monster_id, newName.trim());
        setMessage(data.message || '改名成功！');
        const updated = await api.getMonsters();
        const updatedMonster = updated.find(m => m.monster_id === monster.monster_id);
        if (updatedMonster) setActiveMonster(updatedMonster);
      } catch (err) {
        setMessage(`❌ ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-10">
      {/* Top Header stats */}
      <div className="glass-card p-4 flex justify-between items-center text-sm font-bold">
        <div className="flex gap-4">
          <span className="text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]">💰 {user.gold}G</span>
          <span className="text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">🔋 {user.stamina}</span>
        </div>
        <div className="flex gap-2 sm:gap-3 items-center">
          <button 
            onClick={() => setShowShop(true)}
            className="text-amber-400 hover:text-amber-300 transition font-bold text-xs flex items-center gap-1"
          >
            🏪 商城
          </button>
          <span className="text-slate-600">|</span>
          <button 
            onClick={() => setShowQuests(true)}
            className="text-cyan-400 hover:text-cyan-300 transition font-bold text-xs flex items-center gap-1"
          >
            📋 任務
          </button>
          <span className="text-slate-600">|</span>
          <button 
            onClick={() => setPage('roster')}
            className="text-cyan-400 hover:text-cyan-300 transition underline text-xs"
          >
            切換怪獸 ({monsters.length}/50)
          </button>
          <span className="text-slate-600">|</span>
          <button 
            onClick={() => setPage('pokedex')}
            className="text-amber-400 hover:text-amber-300 transition font-bold text-xs flex items-center gap-1"
          >
            📖 圖鑑
          </button>
        </div>
      </div>

      {/* Monster Display Area */}
      <div className={`glass-card p-6 flex flex-col items-center relative overflow-hidden transition-colors duration-1000 ${isSleeping ? 'bg-slate-950 border-slate-800' : ''}`}>

        <button 
          onClick={() => setLocalSleeping(!localSleeping)}
          className={`absolute top-4 right-4 flex flex-col items-center justify-center gap-1 z-20`}
        >
          <div className={`w-14 h-7 rounded-full flex items-center p-1 transition-colors duration-300 ${localSleeping ? 'bg-slate-700' : 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]'}`}>
            <div className={`w-5 h-5 rounded-full bg-white transition-transform duration-300 ${localSleeping ? 'translate-x-0' : 'translate-x-7'} flex items-center justify-center text-xs`}>
              {localSleeping ? '🌑' : '☀️'}
            </div>
          </div>
          <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap bg-slate-950/80 px-2 py-0.5 rounded-full border border-slate-700/50">
            💡 開關燈
          </span>
        </button>

        <div className={`flex flex-col items-center gap-1 z-10 mb-4 transition-opacity duration-1000 ${isSleeping ? 'opacity-30' : 'opacity-100'}`}>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white">{displayName}</h2>
            <button 
              onClick={handleRename}
              className="text-slate-400 hover:text-slate-700 transition cursor-pointer"
              title="改名"
            >
              ✏️
            </button>
          </div>
          {monster.custom_name && (
            <div className="text-xs text-slate-500">
              種族：{speciesName}
            </div>
          )}
        </div>
        
        <div className="flex gap-2 text-xs font-medium text-slate-300 z-10 mb-6 bg-slate-800 px-3 py-1 rounded-full border border-slate-600">
          <span>G{monster.generation} {STAGE_NAMES[monster.life_stage]}</span>
          <span>•</span>
          <span>{TYPE_NAMES[monster.type] || '無屬性'}</span>
        </div>

        {/* LCD Screen for Pet */}
        <div className={`relative z-10 my-8 w-full max-w-[360px] h-[200px] bg-slate-900 border-4 ${monster.is_frozen ? 'border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.6)]' : 'border-slate-700'} rounded-xl flex items-center justify-center overflow-hidden shadow-inner shadow-slate-950/50 transition-colors duration-1000 ${isSleeping ? 'brightness-[0.3]' : ''}`}>
          {monster.is_frozen ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-cyan-950/80 backdrop-blur-[2px]">
              <span className="text-6xl animate-pulse drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">❄️</span>
              <span className="text-cyan-300 font-bold mt-2 tracking-widest text-lg drop-shadow-md">時光靜止倉</span>
              <span className="text-cyan-100/70 text-xs mt-1">怪獸生命垂危，已進入絕對低溫保護</span>
            </div>
          ) : null}
          <div className={`scale-[1.2] ${monster.is_frozen ? 'grayscale brightness-50 opacity-50 blur-[1px]' : ''}`}>
            <MonsterPixelArt 
              family={monster.family}
              stage={monster.life_stage} 
              type={monster.type} 
              isDead={monster.is_dead} 
              isSick={monster.is_sick} 
              isPoop={monster.cleanliness < 40}
              isHappy={actionEmote === 'happy'}
              isHungry={monster.fullness < 30}
              isSleeping={isSleeping}
            />
          </div>
        </div>

        {/* Status Bars */}
        <div className={`w-full space-y-4 z-10 mt-6 transition-opacity duration-1000 ${isSleeping ? 'opacity-30' : 'opacity-100'}`}>
          <div>
            <div className="flex justify-between text-xs mb-1 font-medium text-slate-300">
              <span>飽食度</span>
              <span>{Math.round(monster.fullness)}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
              <div 
                className={`h-full transition-all duration-500 ${monster.fullness < 30 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                style={{ width: `${monster.fullness}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1 font-medium text-slate-300">
              <span>環境清潔</span>
              <span>{Math.round(monster.cleanliness)}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
              <div 
                className={`h-full transition-all duration-500 ${monster.cleanliness < 40 ? 'bg-amber-500' : 'bg-cyan-500'}`}
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
        {monster.is_frozen ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => handleAction(api.thawMonster, monster.monster_id)}
              disabled={loading}
              className="neon-button bg-cyan-900 border-cyan-400 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.5)] hover:bg-cyan-800 py-4 font-bold text-lg w-full flex items-center justify-center gap-2"
            >
              <span>解凍復甦</span>
              <span className="text-amber-400 text-sm">(-100G)</span>
            </button>
            <p className="text-xs text-center text-slate-400">花費 100 金幣將怪獸從時光靜止倉中喚醒。</p>
          </div>
        ) : showFeedMenu ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { handleAction(api.feed, monster.monster_id, 'feed_basic'); setShowFeedMenu(false); }}
              disabled={loading}
              className="neon-button bg-slate-600 text-white hover:bg-slate-500 py-3 text-sm flex flex-col"
            >
              <span>基礎飼料 (免費)</span>
              <span className="text-[10px] opacity-70 font-normal">無限供應 (大便量增加)</span>
            </button>
            <button
              onClick={() => { handleAction(api.feed, monster.monster_id, 'meat_basic'); setShowFeedMenu(false); }}
              disabled={loading || (getItemQty('meat_basic') === 0 && user.gold < 10)}
              className="neon-button neon-button-primary py-3 text-sm flex flex-col"
            >
              <span>基本肉</span>
              <span className="text-[10px] opacity-70 font-normal">庫存: {getItemQty('meat_basic')} {getItemQty('meat_basic') === 0 ? '(自動花費 10G)' : ''}</span>
            </button>
            <button
              onClick={() => { handleAction(api.feed, monster.monster_id, 'meat_premium'); setShowFeedMenu(false); }}
              disabled={loading || (getItemQty('meat_premium') === 0 && user.gold < 50)}
              className="neon-button neon-button-primary py-3 text-sm flex flex-col"
            >
              <span>頂級肉</span>
              <span className="text-[10px] opacity-70 font-normal">庫存: {getItemQty('meat_premium')} {getItemQty('meat_premium') === 0 ? '(自動花費 50G)' : ''}</span>
            </button>
            <button
              onClick={() => { handleAction(api.feed, monster.monster_id, 'energy_drink'); setShowFeedMenu(false); }}
              disabled={loading || (getItemQty('energy_drink') === 0 && user.gold < 100)}
              className="neon-button neon-button-success py-3 text-sm flex flex-col"
            >
              <span>能量飲</span>
              <span className="text-[10px] opacity-70 font-normal">庫存: {getItemQty('energy_drink')} {getItemQty('energy_drink') === 0 ? '(自動花費 100G)' : ''}</span>
            </button>
            <button
              onClick={() => { handleAction(api.feed, monster.monster_id, 'expired_milk'); setShowFeedMenu(false); }}
              disabled={loading || (getItemQty('expired_milk') === 0 && user.gold < 5)}
              className="neon-button bg-lime-700 text-white hover:bg-lime-600 py-3 text-sm flex flex-col"
            >
              <span>過期的牛奶</span>
              <span className="text-[10px] opacity-70 font-normal">庫存: {getItemQty('expired_milk')} {getItemQty('expired_milk') === 0 ? '(自動花費 5G)' : ''}</span>
            </button>
            <button
              onClick={() => { handleAction(api.feed, monster.monster_id, 'sleeping_pill'); setShowFeedMenu(false); }}
              disabled={loading || (getItemQty('sleeping_pill') === 0 && user.gold < 150)}
              className="neon-button bg-indigo-700 text-white hover:bg-indigo-600 py-3 text-sm flex flex-col"
            >
              <span>安眠藥</span>
              <span className="text-[10px] opacity-70 font-normal">庫存: {getItemQty('sleeping_pill')} {getItemQty('sleeping_pill') === 0 ? '(自動花費 150G)' : ''}</span>
            </button>
            <button
              onClick={() => { handleAction(api.feed, monster.monster_id, 'alarm_clock'); setShowFeedMenu(false); }}
              disabled={loading || (getItemQty('alarm_clock') === 0 && user.gold < 150)}
              className="neon-button bg-rose-700 text-white hover:bg-rose-600 py-3 text-sm flex flex-col"
            >
              <span>鬧鐘</span>
              <span className="text-[10px] opacity-70 font-normal">庫存: {getItemQty('alarm_clock')} {getItemQty('alarm_clock') === 0 ? '(自動花費 150G)' : ''}</span>
            </button>
            <button 
              onClick={() => setShowFeedMenu(false)}
              className="neon-button bg-slate-700 text-white hover:bg-slate-600 py-3 text-sm col-span-2"
            >
              取消返回
            </button>
          </div>
        ) : showHealMenu ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { handleAction(api.heal, monster.monster_id, 'heal_basic'); setShowHealMenu(false); }}
              disabled={loading || !monster.is_sick}
              className="neon-button bg-slate-600 text-white hover:bg-slate-500 py-3 text-sm flex flex-col"
            >
              <span>急救草藥 (免費)</span>
              <span className="text-[10px] opacity-70 font-normal">無限供應 (降30飽食與清潔)</span>
            </button>
            <button
              onClick={() => { handleAction(api.heal, monster.monster_id, 'medicine_standard'); setShowHealMenu(false); }}
              disabled={loading || !monster.is_sick || (getItemQty('medicine_standard') === 0 && user.gold < 200)}
              className="neon-button neon-button-success py-3 text-sm flex flex-col"
            >
              <span>基礎特效藥</span>
              <span className="text-[10px] opacity-70 font-normal">庫存: {getItemQty('medicine_standard')} {getItemQty('medicine_standard') === 0 ? '(自動花費 200G)' : ''}</span>
            </button>
            <button 
              onClick={() => setShowHealMenu(false)}
              className="neon-button bg-slate-700 text-white hover:bg-slate-600 py-3 text-sm col-span-2"
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
              onClick={() => setShowHealMenu(true)}
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


      {/* Idle Missions Section */}
      <div className="glass-card p-5 mt-2">
        <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2">
          <span className="text-xl">🛠️</span> 派遣打工 (閒置賺取金幣)
        </h3>
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
          {monsters.filter(m => !m.is_dead && m.monster_id !== activeMonster?.monster_id && m.life_stage >= 3).length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-4">沒有符合條件的閒置怪獸 (需成熟期以上且非出戰中)</div>
          ) : (
            monsters.filter(m => !m.is_dead && m.monster_id !== activeMonster?.monster_id && m.life_stage >= 3).map(m => {
              const isWorking = m.idle_until && new Date(m.idle_until) > new Date();
              const isFinished = m.idle_until && new Date(m.idle_until) <= new Date();
              
              return (
                <div key={m.monster_id} className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <div className="text-sm font-bold text-white">{m.name}</div>
                    <div className="text-xs text-slate-400">
                      {isWorking ? `打工中 (到期: ${new Date(m.idle_until).toLocaleTimeString()})` : isFinished ? '打工完成！' : '閒置中'}
                    </div>
                  </div>
                  <div>
                    {isFinished ? (
                      <button 
                        onClick={() => handleAction(api.collectIdleMission, m.monster_id)}
                        disabled={loading}
                        className="neon-button neon-button-warning px-4 py-2 text-xs font-bold"
                      >
                        領取薪水
                      </button>
                    ) : isWorking ? (
                      <button disabled className="neon-button bg-slate-800 text-slate-500 px-4 py-2 text-xs font-bold">
                        進行中...
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleAction(api.startIdleMission, m.monster_id, 4)}
                          disabled={loading}
                          className="neon-button neon-button-primary px-3 py-2 text-[10px] font-bold"
                        >
                          4小時
                        </button>
                        <button 
                          onClick={() => handleAction(api.startIdleMission, m.monster_id, 12)}
                          disabled={loading}
                          className="neon-button neon-button-primary px-3 py-2 text-[10px] font-bold"
                        >
                          12小時
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
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

      {showShop && <ShopModal user={user} onClose={() => setShowShop(false)} refreshData={refreshData} />}
      {showQuests && <QuestModal user={user} onClose={() => setShowQuests(false)} refreshData={refreshData} />}
    </div>
  );
}
