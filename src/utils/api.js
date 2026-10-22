import { auth, db } from './firebaseClient';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, deleteDoc, runTransaction, orderBy, limit, onSnapshot
} from 'firebase/firestore';

const getUserId = () => {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  return user.uid;
};

const usernameToEmail = (username) => `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@monsterarena.app`;

// All client-side mutations must at least check the signed-in owner.
const ownMonster = async (monsterId) => {
  const ref = doc(db, 'monsters', monsterId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().user_id !== getUserId()) {
    throw new Error('找不到您擁有的怪獸！');
  }
  return { ref, monster: snap.data() };
};

const ownedInventoryItem = async (uid, itemId) => {
  const found = await getDocs(query(collection(db, 'user_inventory'),
    where('user_id', '==', uid), where('item_id', '==', itemId)));
  return found.empty ? doc(db, 'user_inventory', `${uid}_${itemId}`) : found.docs[0].ref;
};

export const api = {
  // --- Auth ---
  register: async (username, email, password) => {
    const finalEmail = email || usernameToEmail(username);
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username.trim())) throw new Error('帳號需為 3–24 位英數字或底線');
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

      const lastUpdated = new Date(m.last_updated_at || now);
      const hoursPassed = Number.isFinite(lastUpdated.getTime())
        ? Math.max(0, (now - lastUpdated) / (1000 * 60 * 60)) : 0;

      // Time-based fractional decay works even when the user refreshes frequently.
      if (hoursPassed >= (m.life_stage === 1 ? 1 / 120 : 1 / 12)) {
        const previousAge = Number(m.age_days) || 0;
        m.age_days = previousAge + hoursPassed / 24;

        // Hunger & Cleanliness deduction
        m.fullness = Math.max(0, m.fullness - hoursPassed * (m.life_stage >= 3 ? 4 : 2));
        m.cleanliness = Math.max(0, m.cleanliness - hoursPassed * 4);

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
            const elapsedDecayDays = Math.max(0, Math.floor(m.age_days - 30))
              - Math.max(0, Math.floor(previousAge - 30));
            const decayFactor = Math.pow(0.99, elapsedDecayDays);
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
    const { ref: monRef } = await ownMonster(monster_id);
    const effects = { feed_basic: 10, meat_basic: 20, meat_premium: 60, energy_drink: 30 };
    if (!Object.hasOwn(effects, item_id)) throw new Error('不支援的食物！');
    const invRef = item_id === 'feed_basic' ? null : await ownedInventoryItem(uid, item_id);
    await runTransaction(db, async t => {
      const monSnap = await t.get(monRef);
      const invSnap = invRef ? await t.get(invRef) : null;
      if (!monSnap.exists() || monSnap.data().user_id !== uid || monSnap.data().is_dead) throw new Error('怪獸狀態異常！');
      if (invRef && (!invSnap.exists() || invSnap.data().user_id !== uid || invSnap.data().item_id !== item_id || invSnap.data().quantity < 1)) {
        throw new Error('沒有足夠的食物！');
      }
      const m = monSnap.data();
      t.update(monRef, {
        fullness: Math.min(100, (m.fullness || 0) + effects[item_id]),
        cleanliness: item_id === 'feed_basic' ? Math.max(0, (m.cleanliness || 0) - 30) : m.cleanliness,
        starve_time_start: null
      });
      if (invRef) t.update(invRef, { quantity: invSnap.data().quantity - 1 });
    });
    // Energy drink additionally restores 20 stamina.
    if (item_id === 'energy_drink') {
      const userRef = doc(db, 'users', uid);
      await runTransaction(db, async t => {
        const u = await t.get(userRef);
        if (u.exists()) t.update(userRef, { stamina: Math.min(u.data().max_stamina || 100, (u.data().stamina || 0) + 20) });
      });
    }
    api.trackQuestProgress('feed', 1).catch(console.warn);
    return { message: '餵食成功！' };
  },

  clean: async (monster_id) => {
    const { ref, monster } = await ownMonster(monster_id);
    if (monster.is_dead) throw new Error('無法清理已死亡的怪獸！');
    await updateDoc(ref, { cleanliness: 100 });
    api.trackQuestProgress('clean', 1).catch(e => console.warn(e));
    return { message: '打掃完畢，環境變乾淨了！' };
  },

  heal: async (monster_id, item_id = 'medicine_standard') => {
    const uid = getUserId();
    const { ref: monRef } = await ownMonster(monster_id);
    if (!['heal_basic', 'medicine_standard'].includes(item_id)) throw new Error('不支援的藥物！');
    const invRef = item_id === 'heal_basic' ? null : await ownedInventoryItem(uid, 'medicine_standard');
    await runTransaction(db, async t => {
      const monSnap = await t.get(monRef);
      const invSnap = invRef ? await t.get(invRef) : null;
      if (!monSnap.exists() || monSnap.data().user_id !== uid || monSnap.data().is_dead) throw new Error('怪獸狀態異常！');
      if (!monSnap.data().is_sick) throw new Error('怪獸目前沒有生病！');
      if (invRef && (!invSnap.exists() || invSnap.data().user_id !== uid || invSnap.data().item_id !== 'medicine_standard' || invSnap.data().quantity < 1)) throw new Error('沒有特效藥，請到商店購買！');
      const hp = monSnap.data().combat_hp || 1;
      t.update(monRef, { is_sick: false, sick_time_start: null,
        combat_hp: item_id === 'heal_basic' ? Math.max(1, Math.floor(hp * 0.8)) : hp });
      if (invRef) t.update(invRef, { quantity: invSnap.data().quantity - 1 });
    });
    return { message: '治療成功！' };
  },

  rename: async (monster_id, new_name) => {
    if (!new_name || new_name.trim().length === 0) throw new Error('名字不能為空！');
    if (new_name.length > 20) throw new Error('名字太長了！');
    const { ref } = await ownMonster(monster_id);
    await updateDoc(ref, { custom_name: new_name.trim() });
    return { message: `怪獸已改名為 ${new_name.trim()}！` };
  },

  train: async (monster_id) => {
    const uid = getUserId();
    const userRef = doc(db, 'users', uid);
    const monRef = doc(db, 'monsters', monster_id);

    let message = '';
    await runTransaction(db, async (t) => {
      const userDoc = await t.get(userRef);
      if (!userDoc.exists() || userDoc.data().stamina < 10) throw new Error('體力不足！訓練需要 10 點體力。');

      const monDoc = await t.get(monRef);
      const mon = monDoc.data();
      if (!mon || mon.user_id !== uid || mon.is_dead || mon.is_sick || mon.fullness < 20) throw new Error('怪獸生病或太餓無法訓練！');

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
    const { ref: monRef } = await ownMonster(monster_id);
    const invRef = await ownedInventoryItem(uid, 'ultimate_core');
    await runTransaction(db, async t => {
      const monSnap = await t.get(monRef);
      const invSnap = await t.get(invRef);
      if (!monSnap.exists() || monSnap.data().user_id !== uid) throw new Error('怪獸不屬於您！');
      const mon = monSnap.data();
      if (mon.is_dead || mon.life_stage !== 5 || mon.age_days < 7) throw new Error('尚未達到究極體進化條件');
      if (mon.battles < 50 || mon.wins / mon.battles < 0.7) throw new Error('戰鬥場次或勝率不達標');
      if (!invSnap.exists() || invSnap.data().user_id !== uid || invSnap.data().item_id !== 'ultimate_core' || invSnap.data().quantity < 1) throw new Error('缺少究極進化核心！');
      t.update(invRef, { quantity: invSnap.data().quantity - 1 });
      t.update(monRef, { life_stage: 6, combat_hp: mon.combat_hp * 1.5, combat_atk: mon.combat_atk * 1.5 });
    });
    return { message: '究極進化成功！戰鬥數值大幅提升！' };
  },

  release: async (monster_id) => {
    const uid = getUserId();
    const { ref: monRef, monster: monData } = await ownMonster(monster_id);
    if (monData.is_locked) throw new Error('怪獸已鎖定，無法放生！');

    // Release reward: base 50G + generation * 10 + life_stage * 20
    const rewardGold = 50 + (monData.generation * 10) + (monData.life_stage * 20);
    const userRef = doc(db, 'users', uid);

    await runTransaction(db, async (t) => {
      const uDoc = await t.get(userRef);
      const currentMonster = await t.get(monRef);
      if (!uDoc.exists() || !currentMonster.exists() || currentMonster.data().user_id !== uid || currentMonster.data().is_locked) {
        throw new Error('怪獸已鎖定或不屬於您！');
      }
      t.update(userRef, { gold: (uDoc.data().gold || 0) + rewardGold });
      t.delete(monRef);
    });

    return { message: `怪獸已成功放生，回歸數碼世界。獲得環保補助金 ${rewardGold}G！` };
  },

  equipChip: async (monster_id, chip_id, slot) => {
    const uid = getUserId();
    if (![1, 2].includes(slot)) throw new Error('無效的晶片插槽！');
    const { ref: monRef } = await ownMonster(monster_id);
    const invRef = await ownedInventoryItem(uid, chip_id);
    await runTransaction(db, async t => {
      const monSnap = await t.get(monRef);
      const invSnap = await t.get(invRef);
      if (!monSnap.exists() || monSnap.data().user_id !== uid || monSnap.data().is_dead) throw new Error('怪獸狀態異常！');
      const mon = monSnap.data();
      if (mon.life_stage < (slot === 1 ? 4 : 5)) throw new Error('尚未解鎖此晶片插槽！');
      if (!invSnap.exists() || invSnap.data().user_id !== uid || invSnap.data().item_id !== chip_id ||
          invSnap.data().item_type !== 4 || invSnap.data().quantity < 1 || chip_id === 'chip_extractor') {
        throw new Error('沒有可裝備的晶片！');
      }
      const statKey = slot === 1 ? 'combat_atk' : 'combat_def';
      const oldValue = Number(mon[`chip_slot_${slot}_val`]) || 0;
      const chipValue = 5;
      t.update(monRef, { [`chip_slot_${slot}`]: chip_id, [`chip_slot_${slot}_val`]: chipValue,
        [statKey]: (mon[statKey] || 0) - oldValue + chipValue });
      t.update(invRef, { quantity: invSnap.data().quantity - 1 });
    });
    return { message: `已成功鑲嵌在插槽 ${slot}` };
  },

  unequipChip: async (monster_id, slot) => {
    const uid = getUserId();
    if (![1, 2].includes(slot)) throw new Error('無效的晶片插槽！');
    const { ref: monRef } = await ownMonster(monster_id);
    const invRef = await ownedInventoryItem(uid, 'chip_extractor');
    await runTransaction(db, async t => {
      const monSnap = await t.get(monRef);
      const invSnap = await t.get(invRef);
      if (!monSnap.exists() || monSnap.data().user_id !== uid) throw new Error('怪獸不屬於您！');
      if (!monSnap.data()[`chip_slot_${slot}`]) throw new Error('此插槽沒有晶片！');
      if (!invSnap.exists() || invSnap.data().user_id !== uid || invSnap.data().item_id !== 'chip_extractor' || invSnap.data().quantity < 1) throw new Error('需要晶片提取器！');
      const mon = monSnap.data();
      const statKey = slot === 1 ? 'combat_atk' : 'combat_def';
      t.update(monRef, { [`chip_slot_${slot}`]: null, [`chip_slot_${slot}_val`]: 0,
        [statKey]: Math.max(0, (mon[statKey] || 0) - (mon[`chip_slot_${slot}_val`] || 0)) });
      t.update(invRef, { quantity: invSnap.data().quantity - 1 });
    });
    return { message: `成功拆卸插槽 ${slot} 的晶片` };
  },

  breed: async (m1_id, m2_id, useCatalyst = false) => {
    const uid = getUserId();
    if (!m1_id || !m2_id || m1_id === m2_id) throw new Error('請選擇兩隻不同的親代怪獸！');
    const q = query(collection(db, 'monsters'), where('user_id', '==', uid));
    const owned = await getDocs(q);
    if (owned.size >= 50) throw new Error('倉庫已滿 50 隻！');
    const m1Ref = doc(db, 'monsters', m1_id), m2Ref = doc(db, 'monsters', m2_id);
    const userRef = doc(db, 'users', uid);
    const catalystRef = useCatalyst ? await ownedInventoryItem(uid, 'breed_catalyst') : null;
    await runTransaction(db, async t => {
      const uDoc = await t.get(userRef);
      const m1Doc = await t.get(m1Ref), m2Doc = await t.get(m2Ref);
      const catDoc = catalystRef ? await t.get(catalystRef) : null;
      const m1 = m1Doc.data(), m2 = m2Doc.data();
      if (!uDoc.exists() || uDoc.data().gold < 200) throw new Error('繁衍需要 200G！');
      if (!m1 || !m2 || m1.user_id !== uid || m2.user_id !== uid || m1.is_dead || m2.is_dead ||
          m1.life_stage < 4 || m2.life_stage < 4) throw new Error('雙親必須是自己存活的成熟期以上怪獸！');
      if (catalystRef && (!catDoc.exists() || catDoc.data().user_id !== uid ||
          catDoc.data().item_id !== 'breed_catalyst' || catDoc.data().quantity < 1)) throw new Error('繁衍催化劑不足！');
      const randGene = (a, b) => ((a + b) / 2) * (0.9 + Math.random() * 0.2);
      const genes = {
        gene_hp: randGene(m1.gene_hp, m2.gene_hp), gene_atk: randGene(m1.gene_atk, m2.gene_atk),
        gene_def: randGene(m1.gene_def, m2.gene_def), gene_spd: randGene(m1.gene_spd, m2.gene_spd)
      };
      const roll = Math.random(), factor = useCatalyst ? 2 : 1;
      const mutation_status = roll < 0.01 * factor ? 2 : roll < 0.06 * factor ? 1 : 0;
      const mult = mutation_status === 2 ? 1.3 : mutation_status === 1 ? 1.2 : 1;
      const newMonsterRef = doc(collection(db, 'monsters'));
      t.update(userRef, { gold: uDoc.data().gold - 200 });
      if (catalystRef) t.update(catalystRef, { quantity: catDoc.data().quantity - 1 });
      t.set(newMonsterRef, {
        user_id: uid, parent_1_id: m1_id, parent_2_id: m2_id, name: '新生基因蛋',
        generation: Math.max(m1.generation || 1, m2.generation || 1) + 1,
        life_stage: 1, type: 0, family: Math.random() < 0.5 ? m1.family || 1 : m2.family || 1,
        age_days: 0, fullness: 100, cleanliness: 100, is_sick: false, is_dead: false,
        starve_time_start: null, sick_time_start: null, neglect_count: 0, train_count: 0,
        ...genes,
        combat_hp: genes.gene_hp * mult, combat_atk: genes.gene_atk * mult,
        combat_def: genes.gene_def * mult, combat_spd: genes.gene_spd * mult,
        mutation_status, chip_slot_1: null, chip_slot_1_val: 0, chip_slot_2: null,
        chip_slot_2_val: 0, battles: 0, wins: 0, is_locked: false,
        last_updated_at: new Date().toISOString()
      });
    });
    return { message: '繁衍成功！支付 200G 並獲得一顆新生基因蛋！' };
  },

  getInventory: async () => {
    const uid = getUserId();
    const q = query(collection(db, 'user_inventory'), where('user_id', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ inventory_id: d.id, ...d.data() }));
  },

  buyItem: async (item_id, quantity = 1) => {
    const uid = getUserId();
    const PRICES = {
      meat_basic: 10, meat_premium: 50, energy_drink: 100,
      medicine_standard: 200, vitamin: 50, breed_catalyst: 500,
      ultimate_core: 1000
    };
    if (!Object.hasOwn(PRICES, item_id)) throw new Error('未知商品！');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('購買數量需介於 1～99！');
    const cost = PRICES[item_id] * quantity;
    const userRef = doc(db, 'users', uid);
    const invRef = await ownedInventoryItem(uid, item_id);
    await runTransaction(db, async t => {
      const uDoc = await t.get(userRef);
      const invDoc = await t.get(invRef);
      if (!uDoc.exists() || (uDoc.data().gold || 0) < cost) throw new Error('金幣不足！');
      if (invDoc.exists() && (invDoc.data().user_id !== uid || invDoc.data().item_id !== item_id)) throw new Error('背包資料異常！');
      t.update(userRef, { gold: uDoc.data().gold - cost });
      if (invDoc.exists()) {
        t.update(invRef, { quantity: (invDoc.data().quantity || 0) + quantity });
      } else {
        const type = item_id === 'breed_catalyst' ? 3 : item_id === 'ultimate_core' ? 5
          : ['medicine_standard','vitamin'].includes(item_id) ? 2 : 1;
        t.set(invRef, { user_id: uid, item_id, item_type: type, quantity });
      }
    });
    return { message: `成功花費 ${cost}G 購買 ${item_id} x${quantity}！` };
  },

  // --- Daily Quests ---
  trackQuestProgress: async (actionType, count = 1) => {
    if (!['feed','clean','train','battle'].includes(actionType) || !Number.isInteger(count) || count < 1) return;
    const uid = getUserId();
    const dateStr = new Date().toISOString().slice(0, 10);
    const questRef = doc(db, 'daily_quests', `${uid}_${dateStr}`);
    await runTransaction(db, async t => {
      const snap = await t.get(questRef);
      const current = snap.exists() ? snap.data() : { user_id: uid, date: dateStr, claimed: [] };
      if (current.user_id !== uid) throw new Error('任務狀態無效');
      t.set(questRef, { ...current, [`${actionType}_count`]: (current[`${actionType}_count`] || 0) + count });
    });
  },

  getDailyQuests: async () => {
    const uid = getUserId();
    const dateStr = new Date().toISOString().slice(0, 10);
    const snap = await getDoc(doc(db, 'daily_quests', `${uid}_${dateStr}`));
    return snap.exists() ? snap.data() : { feed_count: 0, clean_count: 0, train_count: 0, battle_count: 0, claimed: [] };
  },

  claimQuest: async (questId) => {
    const uid = getUserId();
    const CONFIG = {
      feed_3: { key: 'feed_count', target: 3, reward: 100 },
      clean_1: { key: 'clean_count', target: 1, reward: 50 },
      train_2: { key: 'train_count', target: 2, reward: 150 },
      battle_2: { key: 'battle_count', target: 2, reward: 150 }
    };
    const quest = CONFIG[questId];
    if (!quest) throw new Error('不存在的任務');
    const dateStr = new Date().toISOString().slice(0, 10);
    const questRef = doc(db, 'daily_quests', `${uid}_${dateStr}`);
    const userRef = doc(db, 'users', uid);
    await runTransaction(db, async t => {
      const qDoc = await t.get(questRef);
      const uDoc = await t.get(userRef);
      if (!qDoc.exists() || qDoc.data().user_id !== uid || (qDoc.data()[quest.key] || 0) < quest.target) throw new Error('任務尚未完成');
      if ((qDoc.data().claimed || []).includes(questId)) throw new Error('已經領取過了！');
      if (!uDoc.exists()) throw new Error('使用者不存在');
      t.update(userRef, { gold: (uDoc.data().gold || 0) + quest.reward });
      t.update(questRef, { claimed: [...(qDoc.data().claimed || []), questId] });
    });
    return { message: `領取成功！獲得 ${quest.reward}G` };
  },

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
    // Older monsters have no created_at field, so ordering by it silently excludes them.
    const snap = await getDocs(query(collection(db, 'monsters'), where('is_dead', '==', false), limit(100)));
    const selectedType = typeFilter ? Number(typeFilter) : null;
    let players = [];

    // Group by owner_id and fetch their usernames
    const ownersMap = new Map();
    snap.forEach(doc => {
      const m = { monster_id: doc.id, ...doc.data() };
      if ((selectedType && m.type !== selectedType) || !m.user_id) return;
      if (!ownersMap.has(m.user_id)) {
        ownersMap.set(m.user_id, {
          user_id: m.user_id,
          username: `玩家 ${m.user_id.substring(0, 5)}`, // Fallback
          monsters: []
        });
      }
      if (ownersMap.get(m.user_id).monsters.length < 3) {
        ownersMap.get(m.user_id).monsters.push(m);
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
    if (text.trim().length > 100) throw new Error('訊息最多 100 字！');
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
    const { ref: monRef, monster } = await ownMonster(monster_id);
    const current = monster.is_locked || false;
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

