import React, { useState, useMemo } from 'react';
import MonsterPixelArt from '../components/MonsterPixelArt';
import { MONSTER_SPRITES } from '../utils/monsterSprites';

const STAGE_NAMES = ['蛋', '蛋', '幼年期', '成長期', '成熟期', '完全體', '究極體'];
const TYPE_NAMES = ['無屬性', '疫苗種', '資料種', '病毒種'];

export default function Pokedex({ setPage }) {
  const [filterStage, setFilterStage] = useState('all');

  const monstersList = useMemo(() => {
    return Object.values(MONSTER_SPRITES).sort((a, b) => {
      if (a.stage !== b.stage) return a.stage - b.stage;
      if (a.family !== b.family) return a.family - b.family;
      return a.type - b.type;
    });
  }, []);

  const filteredMonsters = useMemo(() => {
    if (filterStage === 'all') return monstersList;
    return monstersList.filter(m => m.stage === parseInt(filterStage));
  }, [monstersList, filterStage]);

  return (
    <div className="flex flex-col h-full animate-fade-in relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold neon-text">📖 怪獸圖鑑</h2>
        <button 
          onClick={() => setPage('dashboard')}
          className="text-slate-400 hover:text-white transition bg-slate-800 px-3 py-1 rounded text-sm"
        >
          返回養成
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 hide-scrollbar">
        <button 
          onClick={() => setFilterStage('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${filterStage === 'all' ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'}`}
        >
          全部
        </button>
        {[2, 3, 4, 5, 6].map(stage => (
          <button 
            key={stage}
            onClick={() => setFilterStage(stage.toString())}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${filterStage === stage.toString() ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'}`}
          >
            {STAGE_NAMES[stage]}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto pb-10 pr-1">
        <div className="grid grid-cols-2 gap-3">
          {filteredMonsters.map((monster, index) => (
            <div key={`${monster.family}_${monster.stage}_${monster.type}_${index}`} className="glass-card p-3 flex flex-col items-center gap-2 relative">
              <div className="absolute top-2 right-2 text-[9px] font-bold text-slate-600 bg-slate-900/50 px-1.5 rounded">
                #{monster.id || index + 1}
              </div>
              
              <div className="w-16 h-16 bg-[#e2e8f0] border-2 border-[#94a3b8] rounded-md shadow-[inset_0_2px_5px_rgba(0,0,0,0.1)] flex items-center justify-center p-2 mt-2">
                <MonsterPixelArt 
                  family={monster.family}
                  stage={monster.stage}
                  type={monster.type}
                  className="scale-75"
                />
              </div>
              
              <div className="text-xs font-bold text-cyan-300 text-center truncate w-full px-1">
                {monster.name.split(' ').pop().replace(/[()]/g, '') || monster.name}
              </div>
              
              <div className="flex gap-1 text-[9px] font-medium w-full justify-center">
                <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                  {STAGE_NAMES[monster.stage]}
                </span>
                {monster.type > 0 && (
                  <span className={`px-1.5 py-0.5 rounded border ${monster.type === 1 ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30' : monster.type === 2 ? 'bg-blue-900/30 text-blue-400 border-blue-500/30' : monster.type === 3 ? 'bg-purple-900/30 text-purple-400 border-purple-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {TYPE_NAMES[monster.type]}
                  </span>
                )}
              </div>
              
              {/* Evolution Hint */}
              <div className="text-[9px] text-slate-400 mt-1 text-center leading-tight bg-slate-900/50 p-1.5 rounded w-full">
                {monster.stage === 2 && '12小時後隨機進化'}
                {monster.stage === 3 && '訓練次數與照顧度影響分歧'}
                {monster.stage === 4 && '需15~30場戰鬥與勝率要求'}
                {monster.stage === 5 && '需50戰+70%勝率+進化核心'}
                {monster.stage === 6 && '數碼世界的巔峰存在'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
