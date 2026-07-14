import { auth, db } from './firebaseClient';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, deleteDoc, runTransaction, orderBy, limit
} from 'firebase/firestore';

const getUserId = () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
};

const usernameToEmail = (username) => `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@monsterarena.app`;

export const api = {
  // --- Auth ---
  register: async (username, email, password) => {
    const finalEmail = email || usernameToEmail(username);
    const userCredential = await createUserWithEmailAndPassword(auth, finalEmail, password);
    const uid = userCredential.user.uid;

    await setDoc(doc(db, 'users', uid), {
      user_id: uid,
      username: username,
      email: finalEmail,
      gold: 500,
      premium_gems: 0,
      stamina: 100,
      max_stamina: 100
    });

    return { user: userCredential.user };
  },

  login: async (username, password) => {
    const email = username.includes('@') ? username : usernameToEmail(username);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user };
  },

  getMe: async () => {
    const uid = getUserId();
    const docSnap = await getDoc(doc(db, 'users', uid));
    if (!docSnap.exists()) throw new Error('User not found');
    const data = docSnap.data();

    // Daily Login Bonus (100G)
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const lastLoginStr = data.last_login_at ? data.last_login_at.split('T')[0] : '';

    if (todayStr !== lastLoginStr) {
      const newGold = (data.gold || 0) + 100;
      await updateDoc(doc(db, 'users', uid), {
        gold: newGold,
        last_login_at: now.toISOString()
      });
      data.gold = newGold;
    }

    return data;
  },

  // --- Monsters ---
  getMonsters: async () => {
    const uid = getUserId();
    const q = query(collection(db, 'monsters'), where('user_id', '==', uid));
    const querySnapshot = await getDocs(q);
    let monsters = [];
    querySnapshot.forEach((doc) => {
      monsters.push({ monster_id: doc.id, ...doc.data() });
    });

    const now = new Date();
    let updatedMonsters = [];

    for (let m of monsters) {
      if (m.is_dead) {
        updatedMonsters.push(m);
        continue;
      }

      const lastUpdated = new Date(m.last_updated_at);
      const hoursPassed = (now - lastUpdated) / (1000 * 60 * 60);

      if (hoursPassed > 0.005) { // update periodically (~18 seconds)
        m.age_days += hoursPassed / 24;

        // Hunger & Cleanliness deduction
        m.fullness = Math.max(0, m.fullness - Math.floor(hoursPassed * (m.life_stage >= 3 ? 4 : 2)));
        m.cleanliness = Math.max(0, m.cleanliness - Math.floor(hoursPassed * 4));

        // 1. Starving 24h logic
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

        // 2. Sickness 48h logic
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

        // 3. Evolution Matrix
        if (!m.is_dead) {
          // Migrate legacy eggs from stage 0 to 1
          if (m.life_stage === 0) { m.life_stage = 1; }

          // Migrate legacy monsters without family
          if (!m.family) { m.family = Math.floor(Math.random() * 7) + 1; }

          // Egg(1) -> Baby(2): 30 seconds (30/86400 days ≈ 0.00035)
          if (m.life_stage === 1 && m.age_days >= 0.00035) { m.life_stage = 2; }
          // Baby(2) -> Child(3): 12 hours (0.5 days)
          else if (m.life_stage === 2 && m.age_days >= 0.5) { m.life_stage = 3; m.type = Math.floor(Math.random() * 3) + 1; }
          // Child(3) -> Mature(4): 48 hours (2 days)
          else if (m.life_stage === 3 && m.age_days >= 2) {
            if (m.train_count >= 15 && m.neglect_count <= 2) { m.type = 1; m.life_stage = 4; } // Vaccine
            else if (m.train_count >= 5 && m.neglect_count <= 5) { m.type = 2; m.life_stage = 4; } // Data
            else { m.type = 3; m.life_stage = 4; } // Virus
          }
          // Mature(4) -> Perfect(5): 96 hours (4 days)
          else if (m.life_stage === 4 && m.age_days >= 4) {
            const winRate = m.battles > 0 ? m.wins / m.battles : 0;
            if (m.battles >= 30 && winRate >= 0.6) { m.life_stage = 5; }
            else if (m.battles >= 15 && winRate >= 0.4) { m.life_stage = 5; }
            else { m.life_stage = 5; m.type = 3; }
          }
          // Perfect(5) -> Ultimate(6): 168 hours (7 days)
          else if (m.life_stage === 5 && m.age_days >= 7) {
            // Handled in API evolve endpoint (requires item)
          }

          // 4. Aging Decline (30 days peak)
          if (m.life_stage === 5 && m.age_days > 30) {
            const decayDays = Math.floor(m.age_days - 30);
            const decayFactor = Math.pow(0.99, decayDays);
            m.combat_atk = Math.max(m.gene_atk, m.combat_atk * decayFactor);
            m.combat_def = Math.max(m.gene_def, m.combat_def * decayFactor);
            m.combat_spd = Math.max(m.gene_spd, m.combat_spd * decayFactor);
          }
        }

        m.last_updated_at = now.toISOString();

        await updateDoc(doc(db, 'monsters', m.monster_id), {
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
          last_updated_at: m.last_updated_at
        });
      }
      updatedMonsters.push(m);
    }

    return updatedMonsters.sort((a, b) => {
      if (a.is_dead !== b.is_dead) return a.is_dead ? 1 : -1;
      return b.life_stage - a.life_stage;
    });
  },

  hatchEgg: async () => {
    const uid = getUserId();
    const userRef = doc(db, 'users', uid);

    // Check limit
    const q = query(collection(db, 'monsters'), where('user_id', '==', uid));
    const querySnapshot = await getDocs(q);
    const liveMonsters = querySnapshot.docs.filter(d => !d.data().is_dead);
    if (liveMonsters.length >= 50) throw new Error('倉庫已滿 50 隻！');

    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists() || userDoc.data().gold < 100) {
        throw new Error('金幣不足，需要 100G！');
      }
      transaction.update(userRef, { gold: userDoc.data().gold - 100 });

      const newMonsterRef = doc(collection(db, 'monsters'));
      transaction.set(newMonsterRef, {
        user_id: uid,
        name: '數位蛋',
        generation: 1,
        life_stage: 1,
        type: 0,
        family: Math.floor(Math.random() * 7) + 1, // 1 to 7 families
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
        mutation_status: 0,
        chip_slot_1: null,
        chip_slot_1_val: 0,
        chip_slot_2: null,
        chip_slot_2_val: 0,
        battles: 0,
        wins: 0,
        is_locked: false,
        last_updated_at: new Date().toISOString()
      });
    });

    return { message: '成功購買並孵化一顆新數位蛋！' };
  },

  feed: async (monster_id, item_id) => {
    const uid = getUserId();
    const monRef = doc(db, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    if (!monSnap.exists() || monSnap.data().is_dead) throw new Error('怪獸狀態異常！');
    const mon = monSnap.data();

    let newFullness = mon.fullness;
    let newCleanliness = mon.cleanliness;

    if (item_id === 'feed_basic') {
      // 0-cost basic feed
      newFullness = Math.min(100, mon.fullness + 10);
      newCleanliness = Math.max(0, mon.cleanliness - 30); // Side effect
    } else {
      const invQ = query(collection(db, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', item_id));
      const invSnap = await getDocs(invQ);
      if (invSnap.empty || invSnap.docs[0].data().quantity <= 0) throw new Error('沒有足夠的食物！');
      const invDoc = invSnap.docs[0];
      await updateDoc(invDoc.ref, { quantity: invDoc.data().quantity - 1 });

      if (item_id === 'meat_basic') newFullness = Math.min(100, mon.fullness + 20);
      else if (item_id === 'meat_premium') newFullness = Math.min(100, mon.fullness + 60);
      else if (item_id === 'energy_drink') newFullness = Math.min(100, mon.fullness + 30);
    }

    await updateDoc(monRef, { fullness: newFullness, cleanliness: newCleanliness, starve_time_start: null });
    api.trackQuestProgress('feed', 1).catch(e => console.warn(e));
    return { message: '餵食成功！' };
  },

  clean: async (monster_id) => {
    await updateDoc(doc(db, 'monsters', monster_id), { cleanliness: 100 });
    api.trackQuestProgress('clean', 1).catch(e => console.warn(e));
    return { message: '打掃完畢，環境變乾淨了！' };
  },

  heal: async (monster_id, item_id = 'medicine_standard') => {
    const uid = getUserId();
    const monRef = doc(db, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    if (!monSnap.exists() || monSnap.data().is_dead) throw new Error('怪獸狀態異常！');
    const mon = monSnap.data();

    let newHp = mon.combat_hp;

    if (item_id === 'heal_basic') {
      // 0-cost basic heal
      newHp = Math.max(1, mon.combat_hp * 0.8); // Side effect: lose 20% current HP
    } else {
      const invQ = query(collection(db, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', 'medicine_standard'));
      const invSnap = await getDocs(invQ);
      if (invSnap.empty || invSnap.docs[0].data().quantity <= 0) throw new Error('沒有特效藥，請到商店購買！');
      await updateDoc(invSnap.docs[0].ref, { quantity: invSnap.docs[0].data().quantity - 1 });
    }

    await updateDoc(monRef, { is_sick: false, sick_time_start: null, combat_hp: newHp });
    return { message: '注射藥物，怪獸已經康復！' };
  },

  rename: async (monster_id, new_name) => {
    if (!new_name || new_name.trim().length === 0) throw new Error('名字不能為空！');
    if (new_name.length > 20) throw new Error('名字太長了！');
    await updateDoc(doc(db, 'monsters', monster_id), { custom_name: new_name.trim() });
    return { message: `怪獸已改名為 ${new_name.trim()}！` };
  },

  train: async (monster_id) => {
    const uid = getUserId();
    const userRef = doc(db, 'users', uid);
    const monRef = doc(db, 'monsters', monster_id);

    let message = '';
    await runTransaction(db, async (t) => {
      const userDoc = await t.get(userRef);
      if (userDoc.data().stamina < 10) throw new Error('體力不足！訓練需要 10 點體力。');

      const monDoc = await t.get(monRef);
      const mon = monDoc.data();
      if (!mon || mon.is_dead || mon.is_sick || mon.fullness < 20) throw new Error('怪獸生病或太餓無法訓練！');

      t.update(userRef, { stamina: userDoc.data().stamina - 10 });

      const stats = ['combat_hp', 'combat_atk', 'combat_def', 'combat_spd'];
      const boostStat = stats[Math.floor(Math.random() * stats.length)];
      const boostVal = boostStat === 'combat_hp' ? 10 : 2;

      t.update(monRef, {
        [boostStat]: mon[boostStat] + boostVal,
        fullness: mon.fullness - 10,
        train_count: (mon.train_count || 0) + 1
      });
      message = `訓練成功！消耗 10 體力，${boostStat} 提升了！`;
    });
    api.trackQuestProgress('train', 1).catch(e => console.warn(e));
    return { message };
  },

  evolve: async (monster_id) => {
    const uid = getUserId();
    const monRef = doc(db, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    const mon = monSnap.data();

    if (mon.life_stage !== 4 || mon.age_days < 7) throw new Error('尚未達到究極體進化條件');
    const winRate = mon.battles > 0 ? mon.wins / mon.battles : 0;
    if (mon.battles < 50 || winRate < 0.7) throw new Error('戰鬥場次或勝率不達標');

    const invQ = query(collection(db, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', 'ultimate_core'));
    const invSnap = await getDocs(invQ);
    if (invSnap.empty || invSnap.docs[0].data().quantity <= 0) throw new Error('缺少究極進化核心！');

    await updateDoc(invSnap.docs[0].ref, { quantity: invSnap.docs[0].data().quantity - 1 });
    await updateDoc(monRef, { life_stage: 5, combat_hp: mon.combat_hp * 1.5, combat_atk: mon.combat_atk * 1.5 });

    return { message: '🧬 消耗究極進化核心，究極進化成功！戰鬥數值大幅提升！' };
  },

  toggleLock: async (monster_id) => {
    const monRef = doc(db, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    const newLock = !monSnap.data().is_locked;
    await updateDoc(monRef, { is_locked: newLock });
    return { message: newLock ? '已上鎖，免受放生！' : '已解除鎖定！' };
  },

  release: async (monster_id) => {
    const uid = getUserId();
    const monRef = doc(db, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    const monData = monSnap.data();
    if (monData.is_locked) throw new Error('怪獸已鎖定，無法放生！');

    // Release reward: base 50G + generation * 10 + life_stage * 20
    const rewardGold = 50 + (monData.generation * 10) + (monData.life_stage * 20);
    const userRef = doc(db, 'users', uid);

    await runTransaction(db, async (t) => {
      const uDoc = await t.get(userRef);
      t.update(userRef, { gold: (uDoc.data().gold || 0) + rewardGold });
      t.delete(monRef);
    });

    return { message: `怪獸已成功放生，回歸數碼世界。獲得環保補助金 ${rewardGold}G！` };
  },

  equipChip: async (monster_id, chip_id, slot) => {
    const uid = getUserId();
    const monRef = doc(db, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    const mon = monSnap.data();
    if (slot === 1 && mon.life_stage < 3) throw new Error('第一插槽需成熟期才解鎖');
    if (slot === 2 && mon.life_stage < 4) throw new Error('第二插槽需完全體才解鎖');

    const invQ = query(collection(db, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', chip_id));
    const invSnap = await getDocs(invQ);
    if (invSnap.empty || invSnap.docs[0].data().quantity <= 0) throw new Error('沒有此晶片！');

    const chipVal = 5; // simplified
    await updateDoc(invSnap.docs[0].ref, { quantity: invSnap.docs[0].data().quantity - 1 });

    const updateData = slot === 1 ? { chip_slot_1: chip_id, chip_slot_1_val: chipVal, combat_atk: mon.combat_atk + chipVal }
      : { chip_slot_2: chip_id, chip_slot_2_val: chipVal, combat_def: mon.combat_def + chipVal };
    await updateDoc(monRef, updateData);
    return { message: `已成功鑲嵌在插槽 ${slot}` };
  },

  unequipChip: async (monster_id, slot) => {
    const uid = getUserId();
    const invQ = query(collection(db, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', 'chip_extractor'));
    const invSnap = await getDocs(invQ);
    if (invSnap.empty || invSnap.docs[0].data().quantity <= 0) throw new Error('需要晶片提取器！');

    const monRef = doc(db, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    const mon = monSnap.data();

    await updateDoc(invSnap.docs[0].ref, { quantity: invSnap.docs[0].data().quantity - 1 });

    const updateData = slot === 1 ? { chip_slot_1: null, combat_atk: mon.combat_atk - mon.chip_slot_1_val, chip_slot_1_val: 0 }
      : { chip_slot_2: null, combat_def: mon.combat_def - mon.chip_slot_2_val, chip_slot_2_val: 0 };
    await updateDoc(monRef, updateData);
    return { message: `成功拆卸插槽 ${slot} 的晶片` };
  },

  breed: async (m1_id, m2_id) => {
    const uid = getUserId();

    // Check limit
    const q = query(collection(db, 'monsters'), where('user_id', '==', uid));
    const querySnapshot = await getDocs(q);
    const liveMonsters = querySnapshot.docs.filter(d => !d.data().is_dead);
    if (liveMonsters.length >= 50) throw new Error('倉庫已滿 50 隻！');

    const monRef1 = doc(db, 'monsters', m1_id);
    const monRef2 = doc(db, 'monsters', m2_id);
    const m1 = (await getDoc(monRef1)).data();
    const m2 = (await getDoc(monRef2)).data();

    if (m1.life_stage < 3 || m2.life_stage < 3) throw new Error('雙親必須至少為成熟期');

    // Gene inheritance + mutation
    const float = () => (Math.random() * 0.2) - 0.1; // -10% to +10%
    const gBaseHp = ((m1.gene_hp + m2.gene_hp) / 2) * (1 + float());
    const gBaseAtk = ((m1.gene_atk + m2.gene_atk) / 2) * (1 + float());
    const gBaseDef = ((m1.gene_def + m2.gene_def) / 2) * (1 + float());
    const gBaseSpd = ((m1.gene_spd + m2.gene_spd) / 2) * (1 + float());

    // Phenotype mutation
    const r = Math.random();
    let mutMult = 1.0;
    let mutStatus = 0;
    if (r < 0.01) { mutMult = 1.30; mutStatus = 2; }
    else if (r < 0.06) { mutMult = 1.20; mutStatus = 1; }

    const newMonsterRef = doc(collection(db, 'monsters'));
    await setDoc(newMonsterRef, {
      user_id: uid,
      parent_1_id: m1_id,
      parent_2_id: m2_id,
      name: '新生基因蛋',
      generation: Math.max(m1.generation, m2.generation) + 1,
      life_stage: 0,
      type: 0,
      age_days: 0,
      fullness: 100,
      cleanliness: 100,
      is_sick: false,
      is_dead: false,
      gene_hp: gBaseHp,
      gene_atk: gBaseAtk,
      gene_def: gBaseDef,
      gene_spd: gBaseSpd,
      combat_hp: gBaseHp * mutMult,
      combat_atk: gBaseAtk * mutMult,
      combat_def: gBaseDef * mutMult,
      combat_spd: gBaseSpd * mutMult,
      mutation_status: mutStatus,
      chip_slot_1: null,
      chip_slot_2: null,
      battles: 0,
      wins: 0,
      is_locked: false,
      last_updated_at: new Date().toISOString()
    });

    return { message: "繁衍成功！獲得了一顆新生基因蛋！" };
  },

  getInventory: async () => {
    const uid = getUserId();
    const q = query(collection(db, 'user_inventory'), where('user_id', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ inventory_id: d.id, ...d.data() }));
  },

  buyItem: async (item_id, quantity = 1) => {
    const uid = getUserId();
    const userRef = doc(db, 'users', uid);

    const PRICES = {
      'meat_basic': 10,
      'meat_premium': 50,
      'energy_drink': 100,
      'medicine_standard': 200,
      'vitamin': 50,
      'breed_catalyst': 500,
      'ultimate_core': 1000
    };

    const cost = (PRICES[item_id] || 9999) * quantity;

    await runTransaction(db, async (t) => {
      const uDoc = await t.get(userRef);
      if (uDoc.data().gold < cost) throw new Error('金幣不足！');
      t.update(userRef, { gold: uDoc.data().gold - cost });

      const invQ = query(collection(db, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', item_id));
      const invSnap = await getDocs(invQ);
      if (invSnap.empty) {
        const newInvRef = doc(collection(db, 'user_inventory'));
        // item_type: 1=feed, 2=med, 3=breed
        let type = 1;
        if (item_id.includes('medicine') || item_id === 'vitamin') type = 2;
        if (item_id === 'breed_catalyst') type = 3;
        if (item_id === 'ultimate_core') type = 5;
        t.set(newInvRef, { user_id: uid, item_id, item_type: type, quantity });
      } else {
        const invDoc = invSnap.docs[0];
        t.update(invDoc.ref, { quantity: invDoc.data().quantity + quantity });
      }
    });

    return { message: `成功花費 ${cost}G 購買 ${item_id} x${quantity}！` };
  },

  // --- Daily Quests ---
  trackQuestProgress: async (actionType, count = 1) => {
    try {
      const uid = getUserId();
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const questRef = doc(db, 'daily_quests', `${uid}_${dateStr}`);
      const qSnap = await getDoc(questRef);
      if (!qSnap.exists()) {
        await setDoc(questRef, { user_id: uid, date: dateStr, feed_count: 0, train_count: 0, battle_count: 0, claimed: [] });
      }
      await updateDoc(questRef, {
        [`${actionType}_count`]: (qSnap.exists() ? (qSnap.data()[`${actionType}_count`] || 0) : 0) + count
      });
    } catch (e) {
      console.warn('Failed to track quest progress', e);
    }
  },

  getDailyQuests: async () => {
    const uid = getUserId();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const questRef = doc(db, 'daily_quests', `${uid}_${dateStr}`);
    const qSnap = await getDoc(questRef);
    if (!qSnap.exists()) {
      return { feed_count: 0, train_count: 0, battle_count: 0, claimed: [] };
    }
    return qSnap.data();
  },

  claimQuest: async (questId, rewardGold) => {
    const uid = getUserId();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const questRef = doc(db, 'daily_quests', `${uid}_${dateStr}`);
    const userRef = doc(db, 'users', uid);

    await runTransaction(db, async (t) => {
      const qDoc = await t.get(questRef);
      if (!qDoc.exists()) throw new Error('無任務資料');
      const data = qDoc.data();
      if (data.claimed && data.claimed.includes(questId)) throw new Error('已經領取過了！');

      const uDoc = await t.get(userRef);
      t.update(userRef, { gold: (uDoc.data().gold || 0) + rewardGold });
      t.update(questRef, { claimed: [...(data.claimed || []), questId] });
    });
    return { message: `領取成功！獲得 ${rewardGold}G` };
  },

  getFriends: async () => {
    const uid = getUserId();
    const q = query(collection(db, 'friends'), where('user_id', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ friend_id: d.id, ...d.data() }));
  },
  addFriend: async (friend_uuid) => {
    const uid = getUserId();
    if (!friend_uuid || friend_uuid.trim() === '') throw new Error('UUID 不能為空！');
    if (uid === friend_uuid) throw new Error('不能加自己為好友！');

    // Check if friend exists
    const friendSnap = await getDoc(doc(db, 'users', friend_uuid));
    if (!friendSnap.exists()) throw new Error('找不到此 UUID 的玩家！');

    const friendData = friendSnap.data();

    // Check if already friends
    const myFriendRef = doc(db, 'friends', `${uid}_${friend_uuid}`);
    const checkSnap = await getDoc(myFriendRef);
    if (checkSnap.exists()) throw new Error('你們已經是好友了！');

    const mySnap = await getDoc(doc(db, 'users', uid));
    const myData = mySnap.data();

    // Add to my friends
    await setDoc(myFriendRef, {
      user_id: uid,
      friend_uid: friend_uuid,
      friend_name: friendData.username,
      created_at: new Date().toISOString()
    });

    // Add to their friends
    const theirFriendRef = doc(db, 'friends', `${friend_uuid}_${uid}`);
    await setDoc(theirFriendRef, {
      user_id: friend_uuid,
      friend_uid: uid,
      friend_name: myData.username,
      created_at: new Date().toISOString()
    });

    return { message: `成功加入 ${friendData.username} 為好友！` };
  },
  acceptFriend: async () => { return { message: 'ok' }; },
  giftStamina: async () => { return { message: 'ok' }; },

  // Real Guild Implementation
  getGuilds: async () => {
    const uid = getUserId();
    const guildsSnap = await getDocs(collection(db, 'guilds'));
    let guilds = [];
    guildsSnap.forEach(g => guilds.push({ guild_id: g.id, ...g.data() }));

    const memberQ = query(collection(db, 'guild_members'), where('user_id', '==', uid));
    const memberSnap = await getDocs(memberQ);
    let myGuild = null;
    if (!memberSnap.empty) {
      const memberData = memberSnap.docs[0].data();
      const gObj = guilds.find(g => g.guild_id === memberData.guild_id);
      if (gObj) myGuild = { ...gObj, ...memberData };
    }
    return { guilds, myGuild };
  },
  createGuild: async (guild_name) => {
    const uid = getUserId();
    const newGuildRef = doc(collection(db, 'guilds'));
    await setDoc(newGuildRef, { guild_name, leader_id: uid, level: 1, created_at: new Date().toISOString() });

    const newMemRef = doc(collection(db, 'guild_members'));
    await setDoc(newMemRef, { guild_id: newGuildRef.id, user_id: uid, role: 2, contribution: 0 });
    return { message: '創建公會成功！' };
  },
  joinGuild: async (guild_id) => {
    const uid = getUserId();
    const newMemRef = doc(collection(db, 'guild_members'));
    await setDoc(newMemRef, { guild_id, user_id: uid, role: 0, contribution: 0 });
    return { message: '成功加入公會！' };
  },
  leaveGuild: async () => {
    const uid = getUserId();
    const memberQ = query(collection(db, 'guild_members'), where('user_id', '==', uid));
    const memberSnap = await getDocs(memberQ);
    if (!memberSnap.empty) {
      await deleteDoc(memberSnap.docs[0].ref);
    }
    return { message: '離開公會' };
  },
  donateGuild: async (amount) => {
    const uid = getUserId();
    const userRef = doc(db, 'users', uid);
    const memberQ = query(collection(db, 'guild_members'), where('user_id', '==', uid));
    const memberSnap = await getDocs(memberQ);
    if (memberSnap.empty) throw new Error('你沒有加入任何公會！');
    const memberRef = memberSnap.docs[0].ref;

    await runTransaction(db, async (t) => {
      const uDoc = await t.get(userRef);
      if (uDoc.data().gold < amount) throw new Error('金幣不足！');
      t.update(userRef, { gold: uDoc.data().gold - amount });

      const mDoc = await t.get(memberRef);
      t.update(memberRef, { contribution: (mDoc.data().contribution || 0) + amount });
    });
    return { message: `成功捐獻 ${amount} 金幣！獲得 ${amount} 點公會貢獻。` };
  },

  buyGuildShop: async (item_id) => {
    const uid = getUserId();
    const memberQ = query(collection(db, 'guild_members'), where('user_id', '==', uid));
    const memberSnap = await getDocs(memberQ);
    if (memberSnap.empty) throw new Error('你沒有加入任何公會！');
    const memberRef = memberSnap.docs[0].ref;

    const PRICES = { 'chip_extractor': 300, 'breed_catalyst': 150, 'ultimate_core': 500 };
    const cost = PRICES[item_id] || 9999;

    await runTransaction(db, async (t) => {
      const mDoc = await t.get(memberRef);
      if ((mDoc.data().contribution || 0) < cost) throw new Error('公會貢獻點數不足！');
      t.update(memberRef, { contribution: mDoc.data().contribution - cost });

      const invQ = query(collection(db, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', item_id));
      const invSnap = await getDocs(invQ);
      if (invSnap.empty) {
        const newInvRef = doc(collection(db, 'user_inventory'));
        let type = 1;
        if (item_id === 'chip_extractor') type = 4;
        if (item_id === 'breed_catalyst') type = 3;
        if (item_id === 'ultimate_core') type = 5;
        t.set(newInvRef, { user_id: uid, item_id, item_type: type, quantity: 1 });
      } else {
        const invDoc = invSnap.docs[0];
        t.update(invDoc.ref, { quantity: invDoc.data().quantity + 1 });
      }
    });

    return { message: `成功兌換 ${item_id}！消耗 ${cost} 貢獻。` };
  },

  getRaidStatus: async () => {
    const bossRef = doc(db, 'sys_config', 'raid_boss');
    const bSnap = await getDoc(bossRef);
    if (!bSnap.exists()) {
      const defaultBoss = { name: '啟示錄獸', current_hp: 500000, max_hp: 500000, is_active: true };
      await setDoc(bossRef, defaultBoss);
      return defaultBoss;
    }
    return bSnap.data();
  },

  attackRaidBoss: async (monster_id, damage) => {
    const uid = getUserId();
    const userRef = doc(db, 'users', uid);
    const bossRef = doc(db, 'sys_config', 'raid_boss');

    let message = '';
    await runTransaction(db, async (t) => {
      const uDoc = await t.get(userRef);
      if (uDoc.data().stamina < 15) throw new Error('體力不足');
      t.update(userRef, { stamina: uDoc.data().stamina - 15 });

      const bDoc = await t.get(bossRef);
      if (!bDoc.exists() || !bDoc.data().is_active) throw new Error('世界王已被擊殺，請等待下一輪！');

      let newHp = Math.max(0, (bDoc.data().current_hp || 0) - damage);
      let isActive = newHp > 0;
      t.update(bossRef, { current_hp: newHp, is_active: isActive });

      message = isActive ? '持續激戰中！' : '世界王已被擊退！獲得豐厚獎勵！';

      if (!isActive) {
        // Boss killed, reward the killer
        t.update(userRef, { gold: uDoc.data().gold + 5000 });
      }
    });
    return { message };
  },

  // --- Social & Chat ---
  searchPlayers: async (typeFilter) => {
    // Queries up to 20 recent active monsters. If typeFilter is provided, filter by type.
    let q = query(collection(db, 'monsters'), where('is_dead', '==', false), orderBy('created_at', 'desc'), limit(20));
    if (typeFilter) {
      q = query(collection(db, 'monsters'), where('is_dead', '==', false), where('type', '==', parseInt(typeFilter)), orderBy('created_at', 'desc'), limit(20));
    }

    const snap = await getDocs(q);
    let players = [];

    // Group by owner_id and fetch their usernames
    const ownersMap = new Map();
    snap.forEach(doc => {
      const m = { monster_id: doc.id, ...doc.data() };
      if (!ownersMap.has(m.owner_id)) {
        ownersMap.set(m.owner_id, {
          user_id: m.owner_id,
          username: `玩家 ${m.owner_id.substring(0, 5)}`, // Fallback
          monsters: []
        });
      }
      if (ownersMap.get(m.owner_id).monsters.length < 3) {
        ownersMap.get(m.owner_id).monsters.push(m);
      }
    });

    for (let [ownerId, data] of ownersMap) {
      const uSnap = await getDoc(doc(db, 'users', ownerId));
      if (uSnap.exists()) {
        data.username = uSnap.data().username || data.username;
      }
      players.push(data);
    }
    return players;
  },

  sendMessage: async (channel, text) => {
    if (!text || text.trim().length === 0) return;
    const uid = getUserId();

    // Spam check
    const nowStr = new Date().toISOString();
    const q = query(collection(db, 'messages'), where('user_id', '==', uid), orderBy('timestamp', 'desc'), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const lastMsg = snap.docs[0].data();
      const diff = new Date() - new Date(lastMsg.timestamp);
      if (diff < 3000) {
        throw new Error('發言過於頻繁，請等待3秒！');
      }
    }

    const uSnap = await getDoc(doc(db, 'users', uid));
    const username = uSnap.exists() ? uSnap.data().username : 'Unknown';

    const msgRef = doc(collection(db, 'messages'));
    await setDoc(msgRef, {
      channel,
      user_id: uid,
      username,
      text: text.trim(),
      timestamp: nowStr
    });
  },

  subscribeMessages: (channel, callback) => {
    const q = query(collection(db, 'messages'), where('channel', '==', channel), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs = [];
      snap.forEach(d => msgs.push({ id: d.id, ...d.data() }));
      callback(msgs.reverse());
    });
    return unsubscribe;
  },

  // --- Monster Lock ---
  toggleLock: async (monster_id) => {
    const monRef = doc(db, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    if (!monSnap.exists()) throw new Error('找不到怪獸！');
    const current = monSnap.data().is_locked || false;
    await updateDoc(monRef, { is_locked: !current });
    return { message: current ? '已解除鎖定' : '怪獸已鎖定保護！' };
  },

  // --- Friends ---
  addFriend: async (targetUUID) => {
    const uid = getUserId();
    if (uid === targetUUID) throw new Error('不能加自己為好友！');

    // Check target user exists
    const targetSnap = await getDoc(doc(db, 'users', targetUUID));
    if (!targetSnap.exists()) throw new Error('找不到該 UUID 的玩家！');

    // Prevent duplicate
    const friendId = [uid, targetUUID].sort().join('_');
    const friendRef = doc(db, 'friends', friendId);
    const friendSnap = await getDoc(friendRef);
    if (friendSnap.exists()) throw new Error('已經是好友或申請中！');

    await setDoc(friendRef, {
      user_id_1: uid < targetUUID ? uid : targetUUID,
      user_id_2: uid < targetUUID ? targetUUID : uid,
      status: 1, // auto-accept for simplicity
      updated_at: new Date().toISOString()
    });
    return { message: `成功加入好友：${targetSnap.data().username}！` };
  },

  getFriends: async () => {
    const uid = getUserId();
    const q1 = query(collection(db, 'friends'), where('user_id_1', '==', uid), where('status', '==', 1));
    const q2 = query(collection(db, 'friends'), where('user_id_2', '==', uid), where('status', '==', 1));

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const friends = [];

    for (const d of [...snap1.docs, ...snap2.docs]) {
      const data = d.data();
      const friendId = data.user_id_1 === uid ? data.user_id_2 : data.user_id_1;
      const uSnap = await getDoc(doc(db, 'users', friendId));
      if (uSnap.exists()) {
        friends.push({ friend_id: friendId, friend_name: uSnap.data().username || '未知玩家' });
      }
    }
    return friends;
  },

  giftStamina: async (friendId) => {
    const uid = getUserId();
    const today = new Date().toISOString().split('T')[0];
    const giftKey = `gift_${uid}_${friendId}_${today}`;
    const giftRef = doc(db, 'gifts', giftKey);
    const giftSnap = await getDoc(giftRef);
    if (giftSnap.exists()) throw new Error('今天已經贈送過體力了！');

    const friendRef = doc(db, 'users', friendId);
    await runTransaction(db, async (t) => {
      const fDoc = await t.get(friendRef);
      if (!fDoc.exists()) throw new Error('好友不存在！');
      t.update(friendRef, { stamina: Math.min(200, (fDoc.data().stamina || 0) + 20) });
      t.set(giftRef, { sender: uid, receiver: friendId, date: today });
    });
    return { message: '已成功贈送 20 點體力給好友！' };
  },
};

