// BattleEngine.js
// ATB 戰鬥模擬引擎 (包含家族戰術與異常狀態)

const STAGE_CHANCE = { 1: 0, 2: 0, 3: 0.15, 4: 0.30, 5: 0.40, 6: 0.50 };

export function initBattleState(mA_input, mB_input) {
  const teamA = Array.isArray(mA_input) ? mA_input : [mA_input];
  const teamB = Array.isArray(mB_input) ? mB_input : [mB_input];
  
  const mA = teamA[0];
  const mB = teamB[0];
  
  return {
    teamA, teamB,
    mA_Index: 0, mB_Index: 0,
    mA, mB,
    mA_HP: mA.combat_hp, mB_HP: mB.combat_hp,
    mA_MaxHP: mA.combat_hp, mB_MaxHP: mB.combat_hp,
    mA_ATB: 0, mB_ATB: 0,
    mA_AP: 0, mB_AP: 0,
    mA_Statuses: [], 
    mB_Statuses: [],
    logs: [`⚔️ 戰鬥開始！ ${mA.name} vs ${mB.name}！`],
    isOver: false,
    winner: null,
    tickCount: 0
  };
}

function getFamily(m) {
  return m.family || 1; // Default to Dragon
}

function getStatusChance(m) {
  return STAGE_CHANCE[m.life_stage] || 0.15;
}

function applyStatus(targetStatuses, type, maxDuration = 2) {
  const existing = targetStatuses.find(s => s.type === type);
  if (existing) {
    existing.duration = Math.max(existing.duration, maxDuration);
    if (type === 'poison') {
      existing.stacks = Math.min(3, (existing.stacks || 1) + 1);
    }
  } else {
    targetStatuses.push({ type, duration: maxDuration, stacks: 1 });
  }
}

export function tickBattle(prev) {
  if (prev.isOver) return prev;

  // Deep clone state to avoid React mutation bugs
  let state = {
    ...prev,
    mA_Statuses: prev.mA_Statuses.map(s => ({...s})),
    mB_Statuses: prev.mB_Statuses.map(s => ({...s})),
    logs: [...prev.logs]
  };
  
  state.tickCount++;

  // ATB Step
  const speedMult = 0.5;
  const tickRngA = 0.9 + Math.random() * 0.2;
  const tickRngB = 0.9 + Math.random() * 0.2;

  state.mA_ATB = Math.min(100, (state.mA_ATB || 0) + (state.mA.combat_spd * speedMult * tickRngA));
  state.mB_ATB = Math.min(100, (state.mB_ATB || 0) + (state.mB.combat_spd * speedMult * tickRngB));

  let attackerObj = null;
  let defenderObj = null;
  let attackerStr = '';

  if (state.mA_ATB >= 100) { attackerObj = state.mA; defenderObj = state.mB; attackerStr = 'A'; }
  else if (state.mB_ATB >= 100) { attackerObj = state.mB; defenderObj = state.mA; attackerStr = 'B'; }

  if (attackerObj) {
    if (attackerStr === 'A') state.mA_ATB = 0; else state.mB_ATB = 0;

    let atkStatuses = attackerStr === 'A' ? state.mA_Statuses : state.mB_Statuses;
    let defStatuses = attackerStr === 'A' ? state.mB_Statuses : state.mA_Statuses;
    
    const atkKey = attackerStr === 'A' ? 'mA' : 'mB';
    const defKey = attackerStr === 'A' ? 'mB' : 'mA';

    // 1. Process "Start of Turn" DoT for Attacker
    let burnStatus = atkStatuses.find(s => s.type === 'burn');
    if (burnStatus) {
      const burnDmg = Math.max(1, Math.floor(state[`${atkKey}_MaxHP`] * 0.03));
      state[`${atkKey}_HP`] = Math.max(0, state[`${atkKey}_HP`] - burnDmg);
      state.logs.push(`🔥 ${attackerObj.name} 受到燃燒傷害 ${burnDmg}！`);
    }

    let poisonStatus = atkStatuses.find(s => s.type === 'poison');
    if (poisonStatus) {
      const psnDmg = Math.max(1, Math.floor(state[`${atkKey}_MaxHP`] * 0.02 * poisonStatus.stacks));
      state[`${atkKey}_HP`] = Math.max(0, state[`${atkKey}_HP`] - psnDmg);
      state.logs.push(`☠️ ${attackerObj.name} 受到中毒傷害 ${psnDmg}！`);
    }

    // Check Death from DoT
    if (state[`${atkKey}_HP`] <= 0) {
      const deadKey = atkKey;
      const deadObj = attackerObj;
      const teamKey = deadKey === 'mA' ? 'teamA' : 'teamB';
      
      state[`${deadKey}_Index`]++;
      if (state[`${deadKey}_Index`] >= state[teamKey].length) {
        state.isOver = true;
        state.winner = deadKey === 'mA' ? 'B' : 'A';
        state.logs.push(`🏆 戰鬥結束！${defenderObj.name} 獲勝！`);
        return state;
      } else {
        const nextM = state[teamKey][state[`${deadKey}_Index`]];
        state[deadKey] = nextM;
        state[`${deadKey}_HP`] = nextM.combat_hp;
        state[`${deadKey}_MaxHP`] = nextM.combat_hp;
        state[`${deadKey}_ATB`] = 0;
        state[`${deadKey}_AP`] = 0;
        state.logs.push(`🔄 ${deadObj.name} 倒下！${nextM.name} 接力上場！`);
        return state;
      }
    }

    // 2. Decrement Duration
    atkStatuses.forEach(s => s.duration--);
    // Remove expired
    if (attackerStr === 'A') {
      state.mA_Statuses = atkStatuses.filter(s => s.duration > 0 || s.type === 'poison'); // Poison stays until cleansed/consumed
      atkStatuses = state.mA_Statuses;
    } else {
      state.mB_Statuses = atkStatuses.filter(s => s.duration > 0 || s.type === 'poison');
      atkStatuses = state.mB_Statuses;
    }

    // 3. Resolve Attack
    let isSkill = false;
    state[`${atkKey}_AP`] = Math.min(30, (state[`${atkKey}_AP`] || 0) + 10);
    
    if (state[`${atkKey}_AP`] >= 30) {
      isSkill = true;
      state[`${atkKey}_AP`] = 0;
    }

    // Blind Check
    if (atkStatuses.find(s => s.type === 'blind') && Math.random() < 0.2) {
      state.logs.push(`💨 ${attackerObj.name} 因為致盲，攻擊未命中！`);
      return state;
    }

    // Base Multipliers
    let advantage = 1.0;
    if ((attackerObj.type === 1 && defenderObj.type === 3) || 
        (attackerObj.type === 3 && defenderObj.type === 2) || 
        (attackerObj.type === 2 && defenderObj.type === 1)) {
      advantage = 1.3;
    } else if ((attackerObj.type === 3 && defenderObj.type === 1) || 
               (attackerObj.type === 2 && defenderObj.type === 3) || 
               (attackerObj.type === 1 && defenderObj.type === 2)) {
      advantage = 0.7;
    }

    let atkStat = attackerObj.combat_atk;
    let defStat = Math.max(1, defenderObj.combat_def);

    // Intimidate / Wet Modifiers
    if (atkStatuses.find(s => s.type === 'intimidate')) atkStat *= 0.8;
    if (defStatuses.find(s => s.type === 'intimidate')) defStat *= 0.8;
    if (defStatuses.find(s => s.type === 'wet')) defStat *= 0.9;

    let skillMult = isSkill ? 1.6 : 1.0;
    const rng = 0.9 + Math.random() * 0.2;
    
    // Synergies & Signature Effects
    let family = getFamily(attackerObj);
    let trueDamage = 0;
    let lifesteal = 0;

    if (isSkill) {
      if (family === 1 && defStatuses.find(s => s.type === 'burn')) {
        // Dragon Synergy: Consume burn for +90%
        skillMult += 0.9;
        const targetStatusesList = attackerStr === 'A' ? state.mB_Statuses : state.mA_Statuses;
        const burnIdx = targetStatusesList.findIndex(s => s.type === 'burn');
        if(burnIdx > -1) targetStatusesList.splice(burnIdx, 1);
        state.logs.push(`🔥 爆炎引爆！消耗目標燃燒狀態，造成毀滅傷害！`);
      }
      else if (family === 6 && defStatuses.find(s => s.type === 'wet')) {
        // Aquatic Synergy: Wet -> ATB -30%
        state[`${defKey}_ATB`] = Math.max(0, state[`${defKey}_ATB`] - 30);
        state.logs.push(`🌊 冰水牽制！使目標行動大幅退後！`);
      }
      else if (family === 5) {
        // Plant Synergy: 3x Poison -> 15% Max HP true dmg
        let psn = defStatuses.find(s => s.type === 'poison');
        if (psn && psn.stacks === 3) {
          trueDamage = Math.floor(state[`${defKey}_MaxHP`] * 0.15);
          state.logs.push(`🌿 猛毒吞噬！爆發劇毒！`);
          // Consume poison
          const targetStatusesList = attackerStr === 'A' ? state.mB_Statuses : state.mA_Statuses;
          targetStatusesList.splice(targetStatusesList.findIndex(s => s.type === 'poison'), 1);
        }
      }
      else if (family === 4 && defStatuses.find(s => s.type === 'electric')) {
        // Machine Synergy: Electric -> Paralyze (Skip next turn)
        applyStatus(attackerStr === 'A' ? state.mB_Statuses : state.mA_Statuses, 'paralyze', 1);
        state.logs.push(`🤖 導電麻痺！目標觸電麻痺了！`);
      }
      else if (family === 3) {
        // Demon Synergy: Ignore Defense
        defStat = 1; // Near zero def
        state.logs.push(`🦇 影之刺殺！無視防禦！`);
      }
      else if (family === 7 && defStatuses.find(s => s.type === 'blind')) {
        // Bird Synergy: Clear buffs / multi hit
        skillMult += 0.4;
        state.logs.push(`🦅 旋風撕裂！`);
      }
      else if (family === 2 && defStatuses.find(s => s.type === 'bleed')) {
        // Beast Synergy: Lifesteal
        lifesteal = 0.5;
        state.logs.push(`🐺 狂野撕咬！`);
      }
      else if (family === 8 && defStatuses.find(s => s.type === 'intimidate')) {
        // Special Synergy: Wipe ATB + 200% base
        skillMult = 2.0;
        state[`${defKey}_ATB`] = 0;
        state.logs.push(`✨ 終焉制裁！行動條歸零！`);
      }
    }

    let baseDmg = Math.max(1, atkStat * advantage * skillMult * rng * (atkStat / Math.max(1, atkStat + defStat)));
    let dmg = Math.floor(baseDmg) + trueDamage;

    // Bleed additional damage
    if (defStatuses.find(s => s.type === 'bleed')) {
      let bleedDmg = Math.max(1, Math.floor(atkStat * 0.15));
      dmg += bleedDmg;
    }

    if (dmg < 1) dmg = 1;

    state[`${defKey}_HP`] = Math.max(0, state[`${defKey}_HP`] - dmg);
    
    // Paralyze skip
    const parIdx = defStatuses.findIndex(s => s.type === 'paralyze');
    if (parIdx > -1) {
      defStatuses[parIdx].duration--;
      state[`${defKey}_ATB`] = 0; // Keep at 0
      if(defStatuses[parIdx].duration <= 0) defStatuses.splice(parIdx, 1);
    }

    // Electric interrupt chance
    if (defStatuses.find(s => s.type === 'electric') && Math.random() < 0.2) {
       state[`${defKey}_ATB`] = 0;
       state.logs.push(`⚡ 觸電導致 ${defenderObj.name} 動作中斷！`);
    }

    // Apply Status on Normal Attack
    let statusApplied = '';
    if (!isSkill && Math.random() < getStatusChance(attackerObj)) {
      const targetList = attackerStr === 'A' ? state.mB_Statuses : state.mA_Statuses;
      if (family === 1) { applyStatus(targetList, 'burn', 2); statusApplied = '[燃燒]'; }
      if (family === 6) { applyStatus(targetList, 'wet', 2); statusApplied = '[潮濕]'; }
      if (family === 5) { applyStatus(targetList, 'poison', 99); statusApplied = '[中毒]'; } // Poison is permanent until 3 stacks consume
      if (family === 4) { applyStatus(targetList, 'electric', 2); statusApplied = '[帶電]'; }
      if (family === 3) { applyStatus(targetList, 'curse', 2); statusApplied = '[詛咒]'; }
      if (family === 7) { applyStatus(targetList, 'blind', 2); statusApplied = '[致盲]'; }
      if (family === 2) { applyStatus(targetList, 'bleed', 2); statusApplied = '[流血]'; }
      if (family === 8) { applyStatus(targetList, 'intimidate', 2); statusApplied = '[威壓]'; }
    }

    // Lifesteal
    if (lifesteal > 0) {
      const heal = Math.floor(dmg * lifesteal);
      // Curse reversal
      if (atkStatuses.find(s => s.type === 'curse')) {
        state[`${atkKey}_HP`] = Math.max(0, state[`${atkKey}_HP`] - heal);
        state.logs.push(`💀 詛咒發作！吸血轉為 ${heal} 傷害！`);
      } else {
        state[`${atkKey}_HP`] = Math.min(state[`${atkKey}_MaxHP`], state[`${atkKey}_HP`] + heal);
        state.logs.push(`💚 吸血回復了 ${heal} HP！`);
      }
    }

    const actionStr = isSkill ? `💥 施展必殺技` : `攻擊`;
    const advStr = advantage > 1 ? ` (效果拔群)` : (advantage < 1 ? ` (效果微弱)` : '');
    const statusStr = statusApplied ? ` 並附加了 ${statusApplied}` : '';
    
    state.logs.push(`${attackerObj.name} ${actionStr}${advStr}，造成 ${dmg} 傷害！${statusStr}`);

    if (state.mA_HP === 0 || state.mB_HP === 0) {
      const deadKey = state.mA_HP === 0 ? 'mA' : 'mB';
      const deadObj = state.mA_HP === 0 ? state.mA : state.mB;
      const teamKey = deadKey === 'mA' ? 'teamA' : 'teamB';
      
      state[`${deadKey}_Index`]++;
      if (state[`${deadKey}_Index`] >= state[teamKey].length) {
        state.isOver = true;
        const winnerObj = state.mA_HP > 0 ? state.mA : state.mB;
        state.winner = state.mA_HP > 0 ? 'A' : 'B';
        state.logs.push(`🏆 戰鬥結束！${winnerObj.name} 獲勝！`);
      } else {
        const nextM = state[teamKey][state[`${deadKey}_Index`]];
        state[deadKey] = nextM;
        state[`${deadKey}_HP`] = nextM.combat_hp;
        state[`${deadKey}_MaxHP`] = nextM.combat_hp;
        state[`${deadKey}_ATB`] = 0;
        state[`${deadKey}_AP`] = 0;
        state.logs.push(`🔄 ${deadObj.name} 倒下！${nextM.name} 接力上場！`);
      }
    }
  }
  return state;
}
