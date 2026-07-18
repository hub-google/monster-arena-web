import { getUserId, usernameToEmail, getPK, doc, collection, getDoc, updateDoc, setDoc, deleteDoc, query, where, limit, orderBy, getDocs, makeTransaction, insertAndGetId, supabase } from './core';

// 野生怪獸數值基準，對齊玩家怪獸各階段基準值（docs/06_怪獸圖鑑與屬性數值.md）
// 加入 ±20% 浮動讓對戰有一點變化，但整體強度與玩家同階段相當
const WILD_STAGE_BASELINES = {
  2: { hp: 10,   atk: 1,   def: 1,   spd: 1   }, // 幼年期
  3: { hp: 100,  atk: 15,  def: 10,  spd: 10  }, // 成長期
  4: { hp: 500,  atk: 70,  def: 50,  spd: 40  }, // 成熟期
  5: { hp: 1500, atk: 200, def: 150, spd: 120 }, // 完全體
  6: { hp: 4000, atk: 500, def: 400, spd: 300 }, // 究極體
};

function wildRng(base) {
  // ±20% 浮動，至少為 1
  const factor = 0.85 + Math.random() * 0.30; // 0.85 ~ 1.15
  return Math.max(1, Math.round(base * factor));
}

export const pveApi = {

  matchmakeMock: async (mode, stage) => {
    const WILD_NAMES = {
      2: ['球球蟲', '嗶嗶獸', '泡泡獸', '點點獸', '毛毛球', '咕嚕獸', '圓滾獸'],
      3: ['病毒蟲', '資料幽靈', '數碼惡魔', '位元狼', '像素龍', '疫苗哨兵', '鐵殼蟲'],
      4: ['熔岩暴君', '影之刺客', '鋼牙騎士', '毒沼怪', '雷電獸', '深海巨獸', '颶風獸'],
      5: ['數位霸主', '毀滅機甲', '黑暗公爵', '終焉巨龍', '深淵惡魔', '鐵壁要塞', '滅世神鳥'],
      6: ['數碼神皇', '混沌破壞者', '終焉霸主', '宇宙毀滅者', '絕對支配者', '永恆惡魔王', '毀滅天使'],
    };
    const namePool = WILD_NAMES[stage] || WILD_NAMES[3];
    const name = namePool[Math.floor(Math.random() * namePool.length)];

    const baseline = WILD_STAGE_BASELINES[stage] || WILD_STAGE_BASELINES[4];
    const baseHp  = wildRng(baseline.hp);
    const baseAtk = wildRng(baseline.atk);
    const baseDef = wildRng(baseline.def);
    const baseSpd = wildRng(baseline.spd);

    return {
      monster_id: `wild_${Date.now()}`,
      name,
      life_stage: stage,
      family: Math.floor(Math.random() * 7) + 1,
      type: Math.floor(Math.random() * 3) + 1,
      combat_hp: baseHp,
      combat_atk: baseAtk,
      combat_def: baseDef,
      combat_spd: baseSpd,
      gene_hp: baseHp,
      gene_atk: baseAtk,
      gene_def: baseDef,
      gene_spd: baseSpd,
      chip_slot_1: null,
      chip_slot_2: null,
      battles: 0,
      wins: 0,
      is_dead: false,
    };
  },

  
};
