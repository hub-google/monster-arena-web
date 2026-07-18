import { getUserId, usernameToEmail, getPK, doc, collection, getDoc, updateDoc, setDoc, deleteDoc, query, where, limit, orderBy, getDocs, makeTransaction, insertAndGetId, supabase } from './core';
import { questsApi } from './quests';

export const monstersApi = {

  getMonsters: async () => {
    const uid = await getUserId();
    const q = query(collection(null, 'monsters'), where('user_id', '==', uid));
    const querySnapshot = await getDocs(q);
    let monsters = querySnapshot.docs.map(d => ({ monster_id: d.id, ...d.data() }));

    const now = new Date();
    const updatedMonsters = [];

    for (let m of monsters) {
      if (m.is_dead) { updatedMonsters.push(m); continue; }

      const lastUpdated = new Date(m.last_updated_at);
      const hoursPassed = (now - lastUpdated) / (1000 * 60 * 60);

      if (hoursPassed > 0.005) {
        m.age_days = (m.age_days || 0) + hoursPassed / 24;

        // Hunger & Cleanliness
        m.fullness = Math.max(0, m.fullness - Math.floor(hoursPassed * (m.life_stage >= 3 ? 4 : 2)));
        m.cleanliness = Math.max(0, m.cleanliness - Math.floor(hoursPassed * 4));

        // Starving 24h logic
        if (m.fullness === 0) {
          if (!m.starve_time_start) {
            m.starve_time_start = now.toISOString();
            m.neglect_count = (m.neglect_count || 0) + 1;
          } else if ((now - new Date(m.starve_time_start)) / (1000 * 60 * 60) >= 24) {
            m.is_dead = true;
            m.death_reason = 'starved';
            m.combat_hp = 0;
          }
        } else {
          m.starve_time_start = null;
        }

        // Sickness 48h logic
        if (m.is_sick) {
          if (!m.sick_time_start) {
            m.sick_time_start = now.toISOString();
            m.neglect_count = (m.neglect_count || 0) + 1;
          } else if ((now - new Date(m.sick_time_start)) / (1000 * 60 * 60) >= 48) {
            m.is_dead = true;
            m.death_reason = 'sick_neglected';
            m.combat_hp = 0;
          }
        } else if (m.cleanliness < 30) {
          if (Math.random() < 0.15) {
            m.is_sick = true;
            m.sick_time_start = now.toISOString();
            m.neglect_count = (m.neglect_count || 0) + 1;
          }
        }

        // Evolution Matrix
        if (!m.is_dead) {
          if (m.life_stage === 0) { m.life_stage = 1; }
          if (!m.family) { m.family = Math.floor(Math.random() * 7) + 1; }

          if (m.life_stage === 1 && m.age_days >= 0.000347) { m.life_stage = 2; } // 30 seconds
          else if (m.life_stage === 2 && m.age_days >= 0.5) { m.life_stage = 3; m.type = Math.floor(Math.random() * 3) + 1; } // 12 hours
          else if (m.life_stage === 3 && m.age_days >= 2) { // 48 hours
            if (m.train_count >= 15 && m.neglect_count <= 2) { m.type = 1; m.life_stage = 4; }
            else if (m.train_count >= 5 && m.neglect_count <= 5) { m.type = 2; m.life_stage = 4; }
            else { m.type = 3; m.life_stage = 4; }
          }
          else if (m.life_stage === 4 && m.age_days >= 4) { // 96 hours
            const winRate = m.battles > 0 ? m.wins / m.battles : 0;
            if (m.battles >= 30 && winRate >= 0.6 && m.neglect_count <= 3) { m.type = 1; m.life_stage = 5; }
            else if (m.battles >= 15 && winRate >= 0.4 && m.neglect_count <= 6) { m.type = 2; m.life_stage = 5; }
            else { m.type = 3; m.life_stage = 5; }
          }

          // Aging Decline (30 days peak)
          if (m.life_stage === 5 && m.age_days > 30) {
            const decayDays = Math.floor(m.age_days - 30);
            const decayFactor = Math.pow(0.99, decayDays);
            m.combat_atk = Math.max(m.gene_atk, m.combat_atk * decayFactor);
            m.combat_def = Math.max(m.gene_def, m.combat_def * decayFactor);
            m.combat_spd = Math.max(m.gene_spd, m.combat_spd * decayFactor);
          }
        }

        m.last_updated_at = now.toISOString();

        const monRef = doc(null, 'monsters', m.monster_id);
        await updateDoc(monRef, {
          age_days: m.age_days,
          fullness: m.fullness,
          cleanliness: m.cleanliness,
          is_sick: m.is_sick,
          sick_time_start: m.sick_time_start || null,
          starve_time_start: m.starve_time_start || null,
          neglect_count: m.neglect_count || 0,
          train_count: m.train_count || 0,
          is_dead: m.is_dead,
          death_reason: m.death_reason || null,
          combat_hp: m.combat_hp,
          combat_atk: m.combat_atk,
          combat_def: m.combat_def,
          combat_spd: m.combat_spd,
          life_stage: m.life_stage,
          type: m.type,
          family: m.family,
          last_updated_at: m.last_updated_at,
        }).catch(e => console.warn('monster update skipped', e));
      }
      updatedMonsters.push(m);
    }

    return updatedMonsters.sort((a, b) => {
      if (a.is_dead !== b.is_dead) return a.is_dead ? 1 : -1;
      return b.life_stage - a.life_stage;
    });
  },

  hatchEgg: async () => {
    const uid = await getUserId();

    // Check monster limit
    const q = query(collection(null, 'monsters'), where('user_id', '==', uid));
    const querySnapshot = await getDocs(q);
    const liveMonsters = querySnapshot.docs.filter(d => !d.data().is_dead);
    if (liveMonsters.length >= 50) throw new Error('倉庫已滿 50 隻！');

    // Check & deduct gold
    const userRef = doc(null, 'users', uid);
    const t = makeTransaction();
    const userDoc = await t.get(userRef);
    if (!userDoc.exists()) throw new Error('找不到玩家資料，請重新整理頁面！');
    if (userDoc.data().gold < 100) throw new Error('金幣不足，需要 100G！');
    await t.update(userRef, { gold: userDoc.data().gold - 100 });

    // Insert new monster
    await insertAndGetId('monsters', {
      user_id: uid,
      name: '數位蛋',
      generation: 1,
      life_stage: 1,
      type: 0,
      family: Math.floor(Math.random() * 7) + 1,
      age_days: 0,
      fullness: 100,
      cleanliness: 100,
      is_sick: false,
      sick_time_start: null,
      starve_time_start: null,
      neglect_count: 0,
      train_count: 0,
      is_dead: false,
      gene_hp: 50,
      gene_atk: 5,
      gene_def: 5,
      gene_spd: 5,
      combat_hp: 50,
      combat_atk: 5,
      combat_def: 5,
      combat_spd: 5,
      chip_slot_1: null,
      chip_slot_1_val: 0,
      chip_slot_2: null,
      chip_slot_2_val: 0,
      battles: 0,
      wins: 0,
      is_locked: false,
      last_updated_at: new Date().toISOString(),
    });

    return { message: '成功購買並孵化一顆新數位蛋！' };
  },

  feed: async (monster_id, item_id) => {
    const uid = await getUserId();
    const monRef = doc(null, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    if (!monSnap.exists() || monSnap.data().is_dead) throw new Error('怪獸狀態異常！');
    const mon = monSnap.data();

    let newFullness = mon.fullness;
    let newCleanliness = mon.cleanliness;
    const now = new Date();

    if (item_id === 'feed_basic') {
      newFullness = Math.min(100, mon.fullness + 10);
      newCleanliness = Math.max(0, mon.cleanliness - 30);
    } else {
      // Check inventory; if empty, auto-buy
      const ITEM_PRICES = {
        meat_basic: 10, meat_premium: 50, energy_drink: 100,
        expired_milk: 5, sleeping_pill: 150, alarm_clock: 150,
      };
      const invQ = query(collection(null, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', item_id));
      const invSnap = await getDocs(invQ);
      if (invSnap.empty || invSnap.docs[0].data().quantity <= 0) {
        // Auto-buy
        const price = ITEM_PRICES[item_id];
        if (!price) throw new Error('沒有足夠的食物！');
        const userRef = doc(null, 'users', uid);
        const uSnap = await getDoc(userRef);
        if (!uSnap.exists() || uSnap.data().gold < price) throw new Error(`金幣不足！需要 ${price}G`);
        await updateDoc(userRef, { gold: uSnap.data().gold - price });
        // Insert inventory
        await insertAndGetId('user_inventory', { user_id: uid, item_id, item_type: 1, quantity: 0 });
        // Re-query
        const newInvSnap = await getDocs(invQ);
        if (!newInvSnap.empty) {
          await updateDoc(newInvSnap.docs[0].ref, { quantity: newInvSnap.docs[0].data().quantity }); // keep at 0, will not consume
        }
      } else {
        await updateDoc(invSnap.docs[0].ref, { quantity: invSnap.docs[0].data().quantity - 1 });
      }

      if (item_id === 'meat_basic') newFullness = Math.min(100, mon.fullness + 20);
      else if (item_id === 'meat_premium') newFullness = Math.min(100, mon.fullness + 60);
      else if (item_id === 'energy_drink') newFullness = Math.min(100, mon.fullness + 30);
      else if (item_id === 'expired_milk') {
        newFullness = Math.min(100, mon.fullness + 10);
        newCleanliness = Math.max(0, mon.cleanliness - 10);
        // expired milk ALWAYS causes sickness - must be treated by player
        await updateDoc(monRef, { is_sick: true, sick_time_start: now.toISOString(), neglect_count: (mon.neglect_count || 0) + 1 });
      }
      else if (item_id === 'sleeping_pill') {
        // Force monster to sleep for 8 hours
        const sleepUntil = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
        await updateDoc(monRef, { sleep_until: sleepUntil });
        return { message: '怪獸服下安眠藥，沉沉睡去了...（強制睡眠 8 小時）' };
      }
      else if (item_id === 'alarm_clock') {
        // Wake up monster from forced sleep and ignore night sleep for 8 hours
        const awakeUntil = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
        await updateDoc(monRef, { sleep_until: null, awake_until: awakeUntil });
        return { message: '鬧鐘響起！怪獸從睡夢中驚醒了！' };
      }
    }

    await updateDoc(monRef, { fullness: newFullness, cleanliness: newCleanliness, starve_time_start: null });
    questsApi.trackQuestProgress('feed', 1).catch(e => console.warn(e));
    return { message: '餵食成功！' };
  },

  clean: async (monster_id) => {
    await updateDoc(doc(null, 'monsters', monster_id), { cleanliness: 100 });
    questsApi.trackQuestProgress('clean', 1).catch(e => console.warn(e));
    return { message: '打掃完畢，環境變乾淨了！' };
  },

  heal: async (monster_id, item_id = 'medicine_standard') => {
    const uid = await getUserId();
    const monRef = doc(null, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    if (!monSnap.exists() || monSnap.data().is_dead) throw new Error('怪獸狀態異常！');
    const mon = monSnap.data();

    if (item_id === 'heal_basic') {
      // Free but side-effect
      await updateDoc(monRef, {
        is_sick: false, sick_time_start: null,
        fullness: Math.max(0, mon.fullness - 30),
        cleanliness: Math.max(0, mon.cleanliness - 30),
      });
    } else {
      const invQ = query(collection(null, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', 'medicine_standard'));
      const invSnap = await getDocs(invQ);
      if (invSnap.empty || invSnap.docs[0].data().quantity <= 0) {
        // Auto-buy
        const userRef = doc(null, 'users', uid);
        const uSnap = await getDoc(userRef);
        if (!uSnap.exists() || uSnap.data().gold < 200) throw new Error('金幣不足！特效藥需要 200G');
        await updateDoc(userRef, { gold: uSnap.data().gold - 200 });
      } else {
        await updateDoc(invSnap.docs[0].ref, { quantity: invSnap.docs[0].data().quantity - 1 });
      }
      await updateDoc(monRef, { is_sick: false, sick_time_start: null, combat_hp: mon.gene_hp });
    }

    return { message: '注射藥物，怪獸已經康復！' };
  },

  rename: async (monster_id, new_name) => {
    if (!new_name || new_name.trim().length === 0) throw new Error('名字不能為空！');
    if (new_name.length > 20) throw new Error('名字太長了！');
    await updateDoc(doc(null, 'monsters', monster_id), { custom_name: new_name.trim() });
    return { message: `怪獸已改名為 ${new_name.trim()}！` };
  },

  train: async (monster_id) => {
    const uid = await getUserId();
    const userRef = doc(null, 'users', uid);
    const monRef = doc(null, 'monsters', monster_id);

    const t = makeTransaction();
    const userDoc = await t.get(userRef);
    const currentStamina = userDoc.data().stamina || 0;
    const maxStamina = userDoc.data().max_stamina || 500;
    if (currentStamina < 10) throw new Error('體力不足！訓練需要 10 點體力。');

    const monDoc = await t.get(monRef);
    const mon = monDoc.data();
    if (!mon || mon.is_dead || mon.is_sick || mon.fullness < 20) throw new Error('怪獸生病或太餓無法訓練！');

    const updateData = { stamina: currentStamina - 10 };
    if (currentStamina >= maxStamina) {
      updateData.stamina_updated_at = new Date().toISOString();
    }
    await t.update(userRef, updateData);

    const stats = ['combat_hp', 'combat_atk', 'combat_def', 'combat_spd'];
    const boostStat = stats[Math.floor(Math.random() * stats.length)];
    const boostVal = boostStat === 'combat_hp' ? 10 : 2;

    await t.update(monRef, {
      [boostStat]: mon[boostStat] + boostVal,
      fullness: mon.fullness - 10,
      train_count: (mon.train_count || 0) + 1,
    });

    questsApi.trackQuestProgress('train', 1).catch(e => console.warn(e));
    
    const statNames = {
      combat_hp: '生命值',
      combat_atk: '攻擊力',
      combat_def: '防禦力',
      combat_spd: '速度'
    };
    const chineseStat = statNames[boostStat] || boostStat;
    return { message: `訓練成功！消耗 10 體力，${chineseStat} 提升了！` };
  },

  evolve: async (monster_id) => {
    const uid = await getUserId();
    const monRef = doc(null, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    const mon = monSnap.data();

    if (mon.life_stage !== 5 || mon.age_days < 7) throw new Error('尚未達到究極體進化條件');
    const winRate = mon.battles > 0 ? mon.wins / mon.battles : 0;
    if (mon.battles < 50 || winRate < 0.7) throw new Error('戰鬥場次或勝率不達標 (需50場+70%勝率)');

    const invQ = query(collection(null, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', 'ultimate_core'));
    const invSnap = await getDocs(invQ);
    if (invSnap.empty || invSnap.docs[0].data().quantity <= 0) throw new Error('缺少究極進化核心！');

    await updateDoc(invSnap.docs[0].ref, { quantity: invSnap.docs[0].data().quantity - 1 });
    await updateDoc(monRef, {
      life_stage: 6,
      combat_hp: Math.round(mon.combat_hp * 1.5),
      combat_atk: Math.round(mon.combat_atk * 1.5),
    });

    return { message: '🧬 消耗究極進化核心，究極進化成功！戰鬥數值大幅提升！' };
  },

  toggleLock: async (monster_id) => {
    const monRef = doc(null, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    if (!monSnap.exists()) throw new Error('找不到怪獸！');
    const current = monSnap.data().is_locked || false;
    await updateDoc(monRef, { is_locked: !current });
    return { message: current ? '已解除鎖定！' : '怪獸已鎖定保護！' };
  },

  release: async (monster_id) => {
    const uid = await getUserId();
    const monRef = doc(null, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    const monData = monSnap.data();
    if (monData.is_locked) throw new Error('怪獸已鎖定，無法放生！');

    const rewardGold = 50 + (monData.generation * 10) + (monData.life_stage * 20);
    const userRef = doc(null, 'users', uid);

    const t = makeTransaction();
    const uDoc = await t.get(userRef);
    await t.update(userRef, { gold: (uDoc.data().gold || 0) + rewardGold });
    await t.delete(monRef);

    return { message: `怪獸已成功放生，回歸數碼世界。獲得環保補助金 ${rewardGold}G！` };
  },

  extractChip: async (monster_id) => {
    const uid = await getUserId();
    const monRef = doc(null, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    const monData = monSnap.data();
    if (monData.is_locked) throw new Error('怪獸已鎖定，無法提取晶片！');

    const chips = ['chip_atk', 'chip_def', 'chip_spd', 'chip_hp'];
    const item_id = chips[Math.floor(Math.random() * chips.length)];

    const invQ = query(collection(null, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', item_id));
    const invSnap = await getDocs(invQ);
    
    const t = makeTransaction();
    if (invSnap.empty) {
      await insertAndGetId('user_inventory', { user_id: uid, item_id, item_type: 6, quantity: 1 });
    } else {
      const invDoc = invSnap.docs[0];
      await t.update(invDoc.ref, { quantity: invDoc.data().quantity + 1 });
    }
    
    await t.delete(monRef);
    
    const ITEM_NAMES = { chip_atk: '攻擊晶片', chip_def: '防禦晶片', chip_spd: '速度晶片', chip_hp: '生命晶片' };
    return { message: `已成功將怪獸轉化為基因晶片！獲得：${ITEM_NAMES[item_id]} x1` };
  },

  // Freeze a dying monster (cost 100G)
  thawMonster: async (monster_id) => {
    const uid = await getUserId();
    const userRef = doc(null, 'users', uid);
    const monRef = doc(null, 'monsters', monster_id);

    const t = makeTransaction();
    const uDoc = await t.get(userRef);
    if ((uDoc.data().gold || 0) < 100) throw new Error('金幣不足！解凍需要 100G');
    await t.update(userRef, { gold: uDoc.data().gold - 100 });
    await t.update(monRef, {
      is_frozen: false,
      is_dead: false,
      combat_hp: 10,
      fullness: 50,
      cleanliness: 50,
      is_sick: false,
      sick_time_start: null,
      starve_time_start: null,
      last_updated_at: new Date().toISOString(),
    });

    return { message: '💧 解凍成功！怪獸已從時光靜止倉甦醒，恢復少量生命！' };
  },

  // Idle missions
  startIdleMission: async (monster_id, hours) => {
    const monRef = doc(null, 'monsters', monster_id);
    const mSnap = await getDoc(monRef);
    if (!mSnap.exists()) throw new Error('找不到怪獸！');
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    await updateDoc(monRef, { idle_until: until, idle_hours: hours });
    return { message: `已派遣怪獸打工 ${hours} 小時！` };
  },

  collectIdleMission: async (monster_id) => {
    const uid = await getUserId();
    const monRef = doc(null, 'monsters', monster_id);
    const mSnap = await getDoc(monRef);
    if (!mSnap.exists()) throw new Error('找不到怪獸！');
    const m = mSnap.data();

    if (!m.idle_until || new Date(m.idle_until) > new Date()) throw new Error('打工尚未完成！');

    const hours = m.idle_hours || 4;
    const goldEarned = Math.floor(hours * 20 + Math.random() * hours * 10);

    const userRef = doc(null, 'users', uid);
    const uSnap = await getDoc(userRef);
    await updateDoc(userRef, { gold: (uSnap.data().gold || 0) + goldEarned });
    await updateDoc(monRef, { idle_until: null, idle_hours: null });

    return { message: `打工完成！怪獸賺回了 ${goldEarned}G！` };
  },

  equipChip: async (monster_id, chip_id, slot) => {
    const uid = await getUserId();
    const monRef = doc(null, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    const mon = monSnap.data();
    // No life_stage restriction — any monster can equip chips

    const invQ = query(collection(null, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', chip_id));
    const invSnap = await getDocs(invQ);
    if (invSnap.empty || invSnap.docs[0].data().quantity <= 0) throw new Error('沒有此晶片！');

    // Determine chip bonus based on chip type
    const CHIP_BONUS = {
      chip_atk: { stat: 'combat_atk', val: 50 },
      chip_def: { stat: 'combat_def', val: 50 },
      chip_spd: { stat: 'combat_spd', val: 50 },
      chip_hp:  { stat: 'combat_hp',  val: 200 },
    };
    const bonus = CHIP_BONUS[chip_id] || { stat: 'combat_atk', val: 50 };
    const chipVal = bonus.val;
    await updateDoc(invSnap.docs[0].ref, { quantity: invSnap.docs[0].data().quantity - 1 });

    const slotKey = slot === 1 ? 'chip_slot_1' : 'chip_slot_2';
    const slotValKey = slot === 1 ? 'chip_slot_1_val' : 'chip_slot_2_val';
    const updateData = {
      [slotKey]: chip_id,
      [slotValKey]: chipVal,
      [bonus.stat]: (mon[bonus.stat] || 0) + chipVal,
    };
    await updateDoc(monRef, updateData);
    return { message: `已成功鑲嵌 ${chip_id} 在插槽 ${slot}，${bonus.stat} +${chipVal}！` };
  },

  unequipChip: async (monster_id, slot) => {
    const uid = await getUserId();
    const invQ = query(collection(null, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', 'chip_extractor'));
    const invSnap = await getDocs(invQ);
    if (invSnap.empty || invSnap.docs[0].data().quantity <= 0) throw new Error('需要晶片提取器！');

    const monRef = doc(null, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    const mon = monSnap.data();

    await updateDoc(invSnap.docs[0].ref, { quantity: invSnap.docs[0].data().quantity - 1 });

    const updateData = slot === 1
      ? { chip_slot_1: null, combat_atk: mon.combat_atk - (mon.chip_slot_1_val || 0), chip_slot_1_val: 0 }
      : { chip_slot_2: null, combat_def: mon.combat_def - (mon.chip_slot_2_val || 0), chip_slot_2_val: 0 };
    await updateDoc(monRef, updateData);
    return { message: `成功拆卸插槽 ${slot} 的晶片` };
  },

  breed: async (m1_id, m2_id) => {
    const uid = await getUserId();

    const q = query(collection(null, 'monsters'), where('user_id', '==', uid));
    const querySnapshot = await getDocs(q);
    const liveMonsters = querySnapshot.docs.filter(d => !d.data().is_dead);
    if (liveMonsters.length >= 50) throw new Error('倉庫已滿 50 隻！');

    const m1 = (await getDoc(doc(null, 'monsters', m1_id))).data();
    const m2 = (await getDoc(doc(null, 'monsters', m2_id))).data();

    if (m1.life_stage < 3 || m2.life_stage < 3) throw new Error('雙親必須至少為成熟期');

    const float = () => (Math.random() * 0.2) - 0.1;
    const gBaseHp = ((m1.gene_hp + m2.gene_hp) / 2) * (1 + float());
    const gBaseAtk = ((m1.gene_atk + m2.gene_atk) / 2) * (1 + float());
    const gBaseDef = ((m1.gene_def + m2.gene_def) / 2) * (1 + float());
    const gBaseSpd = ((m1.gene_spd + m2.gene_spd) / 2) * (1 + float());

    const r = Math.random();
    let mutMult = 1.0;
    let mutStatus = 0;
    if (r < 0.01) { mutMult = 1.30; mutStatus = 2; }
    else if (r < 0.06) { mutMult = 1.20; mutStatus = 1; }

    await insertAndGetId('monsters', {
      user_id: uid,
      parent_1_id: m1_id,
      parent_2_id: m2_id,
      name: '新生基因蛋',
      generation: Math.max(m1.generation, m2.generation) + 1,
      life_stage: 1,
      type: 0,
      family: Math.floor(Math.random() * 7) + 1,
      age_days: 0,
      fullness: 100,
      cleanliness: 100,
      is_sick: false,
      is_dead: false,
      gene_hp: Math.round(gBaseHp),
      gene_atk: Math.round(gBaseAtk),
      gene_def: Math.round(gBaseDef),
      gene_spd: Math.round(gBaseSpd),
      combat_hp: Math.round(gBaseHp * mutMult),
      combat_atk: Math.round(gBaseAtk * mutMult),
      combat_def: Math.round(gBaseDef * mutMult),
      combat_spd: Math.round(gBaseSpd * mutMult),
      chip_slot_1: null,
      chip_slot_1_val: 0,
      chip_slot_2: null,
      chip_slot_2_val: 0,
      battles: 0,
      wins: 0,
      neglect_count: 0,
      train_count: 0,
      is_locked: false,
      last_updated_at: new Date().toISOString(),
    });

    return { message: '繁衍成功！獲得了一顆新生基因蛋！' };
  },

  
};
