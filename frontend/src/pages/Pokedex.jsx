import React, { useState, useMemo } from 'react';
import MonsterPixelArt from '../components/MonsterPixelArt';
import { MONSTER_SPRITES } from '../utils/monsterSprites';

const STAGE_NAMES = ['蛋', '蛋', '幼年期', '成長期', '成熟期', '完全體', '究極體'];
const TYPE_NAMES = ['無屬性', '疫苗種', '資料種', '病毒種'];
const TYPE_COLORS = ['text-slate-400', 'text-emerald-400', 'text-blue-400', 'text-purple-400'];
const TYPE_BG = ['bg-slate-800 border-slate-700', 'bg-emerald-900/30 border-emerald-500/30', 'bg-blue-900/30 border-blue-500/30', 'bg-purple-900/30 border-purple-500/30'];

const FAMILY_NAMES = ['', '龍族', '獸族', '惡魔族', '機械族', '植物族', '水棲族', '鳥族', '特殊'];

// 完整進化名稱表 (family, stage, type) -> 怪獸名稱
// 來自 docs/06_怪獸圖鑑與屬性數值.md
const EVO_NAMES = {
  // 龍族 (family 1)
  '1_2': { 0: '黑球獸', 1: '黑球獸', 2: '黑球獸', 3: '黑球獸' },  // 幼年期 通用
  '1_3': { 1: '亞古獸', 2: '積木亞古獸', 3: '黑亞古獸' },
  '1_4': { 1: '暴龍獸', 2: '巨龍獸', 3: '黑暴龍獸' },
  '1_5': { 1: '機械暴龍獸', 2: '金屬巨龍獸', 3: '喪屍暴龍獸' },
  '1_6': { 1: '戰鬥暴龍獸', 2: '無限龍獸', 3: '黑暗戰鬥暴龍獸' },
  // 獸族 (family 2)
  '2_2': { 0: '獨角獸', 1: '獨角獸', 2: '獨角獸', 3: '獨角獸' },
  '2_3': { 1: '加布獸', 2: '迷幻獸', 3: '黑加布獸' },
  '2_4': { 1: '加魯魯獸', 2: '獅子獸', 3: '黑加魯魯獸' },
  '2_5': { 1: '獸人加魯魯', 2: '格鬥獅子獸', 3: '影刃加魯魯' },
  '2_6': { 1: '鋼鐵加魯魯獸', 2: '黃金劍獅獸', 3: '終結加魯魯獸' },
  // 惡魔族 (family 3)
  '3_2': { 0: '柏古獸', 1: '柏古獸', 2: '柏古獸', 3: '柏古獸' },
  '3_3': { 1: '小惡魔獸', 2: '使魔獸', 3: '幼魔獸' },
  '3_4': { 1: '惡魔獸', 2: '冰惡魔獸', 3: '邪龍獸' },
  '3_5': { 1: '吸血魔獸', 2: '喪屍撒旦獸', 3: '女惡魔獸' },
  '3_6': { 1: '究極吸血魔獸', 2: '墮天地獄獸', 3: '莉莉絲獸' },
  // 機械族 (family 4)
  '4_2': { 0: '齒輪獸', 1: '齒輪獸', 2: '齒輪獸', 3: '齒輪獸' },
  '4_3': { 1: '守衛獸', 2: '機器裝甲獸', 3: '猛鬼獸' },
  '4_4': { 1: '安杜路獸', 2: '炮彈獸', 3: '垃圾桶獸' },
  '4_5': { 1: '機械載物獸', 2: '鋼鐵豆豆獸', 3: '巨雞獸' },
  '4_6': { 1: '機械邪龍獸', 2: '炮神獸', 3: '死亡獸' },
  // 植物族 (family 5)
  '5_2': { 0: '浮球獸', 1: '浮球獸', 2: '浮球獸', 3: '浮球獸' },
  '5_3': { 1: '巴魯獸', 2: '蘑菇獸', 3: '毒蔓獸' },
  '5_4': { 1: '仙人掌獸', 2: '朽木獸', 3: '曼陀羅獸' },
  '5_5': { 1: '花仙獸', 2: '祖利獸', 3: '暴羅剎獸' },
  '5_6': { 1: '薔薇獸', 2: '木偶獸', 3: '蓮花獸' },
  // 水棲族 (family 6)
  '6_2': { 0: '泡沫獸', 1: '泡沫獸', 2: '泡沫獸', 3: '泡沫獸' },
  '6_3': { 1: '哥瑪獸', 2: '貝殼獸', 3: '企鵝獸' },
  '6_4': { 1: '海獅獸', 2: '海龍獸', 3: '墨魚獸' },
  '6_5': { 1: '祖頓獸', 2: '超海龍獸', 3: '達高獸' },
  '6_6': { 1: '維京獸', 2: '鋼鐵海龍獸', 3: '尼普頓獸' },
  // 鳥族 (family 7)
  '7_2': { 0: '豆苗獸', 1: '豆苗獸', 2: '豆苗獸', 3: '豆苗獸' },
  '7_3': { 1: '比丘獸', 2: '獵鷹獸', 3: '黑比丘獸' },
  '7_4': { 1: '巴多拉獸', 2: '巨鳥獸', 3: '黑暗巨鳥獸' },
  '7_5': { 1: '伽樓達獸', 2: '耀獅獸', 3: '鐵雞獸' },
  '7_6': { 1: '鳳凰獸', 2: '究極巨鳥獸', 3: '死亡火鳥獸' },
};

function getEvoName(family, stage, type) {
  const key = `${family}_${stage}`;
  const row = EVO_NAMES[key];
  if (!row) return null;
  return row[type] || row[0] || null;
}

// 進化條件說明
const EVO_CONDITIONS = {
  2: '（12小時後）時間到隨機決定家族，屬性由天生基因決定',
  3: '（存活48小時後）依養成好壞決定屬性：\n💚 疫苗種：訓練≥15次，失誤≤2次\n📘 資料種：訓練5~14次，失誤≤5次\n💜 病毒種：未達上述條件',
  4: '（存活96小時後）依戰鬥表現決定屬性：\n💚 疫苗種：≥30場，勝率≥60%，失誤≤3次\n📘 資料種：≥15場，勝率≥40%，失誤≤6次\n💜 病毒種：未達上述條件',
  5: '（存活7天後）屬性不再轉換，沿用完全體屬性直線進化：\n需要：戰鬥≥50場，勝率≥70%，且消耗「究極進化核心」',
};

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
    <div className="flex flex-col animate-fade-in relative" style={{height: '100%', maxHeight: '100%'}}>
      {/* Header */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h2 className="text-xl font-bold neon-text">📖 怪獸圖鑑</h2>
        <button 
          onClick={() => setPage('dashboard')}
          className="text-slate-400 hover:text-white transition bg-slate-800 px-3 py-1 rounded text-sm"
        >
          返回養成
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 hide-scrollbar flex-shrink-0">
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
      <div className="overflow-y-auto pb-4 pr-1" style={{flex: '1 1 0', minHeight: 0}}>
        <div className="grid grid-cols-2 gap-3">
          {filteredMonsters.map((monster, index) => {
            const family = monster.family || 1;
            const stage = monster.stage;
            const type = monster.type || 0;
            const familyName = FAMILY_NAMES[family] || '未知族';

            // 上一階段是誰
            const prevName = stage > 2 ? getEvoName(family, stage - 1, stage === 3 ? 0 : type) : null;

            // 下一階段進化資訊
            const nextStage = stage + 1;
            const hasNext = nextStage <= 6;
            const nextVaccine = hasNext ? getEvoName(family, nextStage, 1) : null;
            const nextData    = hasNext ? getEvoName(family, nextStage, 2) : null;
            const nextVirus   = hasNext ? getEvoName(family, nextStage, 3) : null;
            const evoCondition = EVO_CONDITIONS[stage];

            return (
              <div key={`${monster.family}_${monster.stage}_${monster.type}_${index}`} className="glass-card p-3 flex flex-col items-center gap-2 relative">
                <div className="absolute top-2 right-2 text-[9px] font-bold text-slate-600 bg-slate-900/50 px-1.5 rounded">
                  #{monster.id || index + 1}
                </div>
                
                <div className="w-24 h-24 bg-[#e2e8f0] border-2 border-[#94a3b8] rounded-md shadow-[inset_0_2px_5px_rgba(0,0,0,0.1)] flex items-center justify-center p-2 mt-2 overflow-hidden">
                  <div className="scale-75 origin-center flex items-center justify-center">
                    <MonsterPixelArt 
                      family={monster.family}
                      stage={monster.stage}
                      type={monster.type}
                      isStatic={true}
                    />
                  </div>
                </div>
                
                <div className="text-xs font-bold text-cyan-300 text-center truncate w-full px-1">
                  {monster.name.split(' ').pop().replace(/[()]/g, '') || monster.name}
                </div>
                
                {/* Stage + Type badges */}
                <div className="flex gap-1 text-[9px] font-medium w-full justify-center flex-wrap">
                  <span className="bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded border border-slate-600">
                    {familyName}
                  </span>
                  <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                    {STAGE_NAMES[monster.stage]}
                  </span>
                  {type > 0 && (
                    <span className={`px-1.5 py-0.5 rounded border ${TYPE_BG[type]}`}>
                      <span className={TYPE_COLORS[type]}>{TYPE_NAMES[type]}</span>
                    </span>
                  )}
                </div>
                
                {/* Evolution Info */}
                <div className="text-[10px] text-slate-300 mt-1 text-left leading-tight bg-slate-900/80 p-2 rounded w-full space-y-1.5 border border-slate-700/50">
                  
                  {/* 由誰進化而來 */}
                  {prevName && (
                    <div className="flex items-center gap-1 text-slate-400 border-b border-slate-700/50 pb-1 mb-1">
                      <span className="text-slate-500">↑ 由</span>
                      <span className="text-amber-300 font-bold">{prevName}</span>
                      <span className="text-slate-500">進化而來</span>
                    </div>
                  )}
                  {stage === 2 && (
                    <div className="flex items-center gap-1 text-slate-400 border-b border-slate-700/50 pb-1 mb-1">
                      <span className="text-slate-500">↑ 由蛋孵化而來</span>
                    </div>
                  )}

                  {/* 進化去向 */}
                  {hasNext && evoCondition && (
                    <>
                      <div className="text-amber-400 font-bold text-[9px]">
                        ▶ 可進化為 {STAGE_NAMES[nextStage]}：
                      </div>
                      {nextVaccine && (
                        <div className="flex items-center gap-1">
                          <span className="text-emerald-400 font-bold w-12 shrink-0">💚 疫苗</span>
                          <span className="text-white font-bold">{nextVaccine}</span>
                        </div>
                      )}
                      {nextData && (
                        <div className="flex items-center gap-1">
                          <span className="text-blue-400 font-bold w-12 shrink-0">📘 資料</span>
                          <span className="text-white font-bold">{nextData}</span>
                        </div>
                      )}
                      {nextVirus && (
                        <div className="flex items-center gap-1">
                          <span className="text-purple-400 font-bold w-12 shrink-0">💜 病毒</span>
                          <span className="text-white font-bold">{nextVirus}</span>
                        </div>
                      )}
                      <div className="text-slate-500 text-[9px] mt-1 whitespace-pre-line border-t border-slate-700/30 pt-1">
                        {evoCondition}
                      </div>
                    </>
                  )}
                  {stage === 2 && (
                    <>
                      <div className="text-amber-400 font-bold text-[9px]">▶ 可進化為 成長期：</div>
                      <div className="flex items-center gap-1">
                        <span className="text-emerald-400 font-bold w-12 shrink-0">💚 疫苗</span>
                        <span className="text-white font-bold">{getEvoName(family, 3, 1) || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-400 font-bold w-12 shrink-0">📘 資料</span>
                        <span className="text-white font-bold">{getEvoName(family, 3, 2) || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-purple-400 font-bold w-12 shrink-0">💜 病毒</span>
                        <span className="text-white font-bold">{getEvoName(family, 3, 3) || '—'}</span>
                      </div>
                      <div className="text-slate-500 text-[9px] mt-1 whitespace-pre-line border-t border-slate-700/30 pt-1">
                        {EVO_CONDITIONS[2]}
                      </div>
                    </>
                  )}
                  {stage === 6 && (
                    <div className="text-amber-400 font-bold text-center py-1">🏆 究極體，數碼世界頂點</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
