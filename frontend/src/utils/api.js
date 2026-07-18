import { supabase } from './supabaseClient';

// ─── DB Helper Shim (Firebase-style API → Supabase) ───────────────────────────

const getUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

const usernameToEmail = (username) => `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@monsterarena.app`;

// Returns the primary key column name for a given table
const getPK = (table) => {
  const pkMap = {
    users: 'user_id',
    monsters: 'monster_id',
    user_inventory: 'inventory_id',
    guilds: 'guild_id',
    guild_members: 'member_id',
    friends: 'friend_record_id',
    challenges: 'challenge_id',
    daily_quests: 'quest_id',
    messages: 'message_id',
    gifts: 'gift_id',
    raid_boss: 'id',
  };
  return pkMap[table] || 'id';
};

// doc(table, id) → { table, id, pk }
const doc = (_, table, id) => {
  if (!table || typeof table !== 'string') throw new Error(`Invalid table name: "${table}"`);
  return { table, id, pk: getPK(table) };
};

// collection(table) → { table }
const collection = (_, table) => {
  if (!table || typeof table !== 'string') throw new Error(`Invalid table name: "${table}"`);
  return { table };
};

const getDoc = async (ref) => {
  const { data } = await supabase.from(ref.table).select('*').eq(ref.pk, ref.id).single();
  return { exists: () => !!data, data: () => data || {}, ref };
};

const updateDoc = async (ref, data) => {
  const { error } = await supabase.from(ref.table).update(data).eq(ref.pk, ref.id);
  if (error) throw new Error(`[updateDoc ${ref.table}] ${error.message}`);
};

const setDoc = async (ref, data) => {
  if (ref.table === 'users') {
    const { error } = await supabase.from(ref.table).upsert(data, { onConflict: 'user_id' });
    if (error) throw new Error(`[setDoc upsert ${ref.table}] ${error.message}`);
    return;
  }
  const { error } = await supabase.from(ref.table).insert(data);
  if (error) throw new Error(`[setDoc insert ${ref.table}] ${error.message}`);
};

const deleteDoc = async (ref) => {
  const { error } = await supabase.from(ref.table).delete().eq(ref.pk, ref.id);
  if (error) throw new Error(`[deleteDoc ${ref.table}] ${error.message}`);
};

const query = (coll, ...filters) => ({ table: coll.table, filters });
const where = (field, op, val) => ({ field, op, val });
const limit = (l) => ({ type: 'limit', val: l });
const orderBy = (f, d) => ({ type: 'orderBy', field: f, dir: d });

const getDocs = async (q) => {
  let req = supabase.from(q.table).select('*');
  for (const f of q.filters || []) {
    if (f.field && f.type === undefined) {
      if (f.op === '!=') req = req.neq(f.field, f.val);
      else req = req.eq(f.field, f.val);
    }
    if (f.type === 'limit') req = req.limit(f.val);
    if (f.type === 'orderBy') req = req.order(f.field, { ascending: f.dir === 'asc' });
  }
  const { data, error } = await req;
  if (error) throw new Error(`[getDocs ${q.table}] ${error.message}`);
  const pk = getPK(q.table);
  const docs = (data || []).map(d => ({
    id: d[pk] || d.id,
    data: () => d,
    ref: doc(null, q.table, d[pk] || d.id),
  }));
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach: (cb) => docs.forEach(cb),
  };
};

// Supabase doesn't support true ACID transactions; we simulate sequential ops.
const makeTransaction = () => ({
  get: async (ref) => {
    const { data, error } = await supabase.from(ref.table).select('*').eq(ref.pk, ref.id).single();
    if (error && error.code !== 'PGRST116') throw new Error(`[tx.get ${ref.table}] ${error.message}`);
    return { exists: () => !!data, data: () => data || {}, ref };
  },
  update: async (ref, data) => {
    const { error } = await supabase.from(ref.table).update(data).eq(ref.pk, ref.id);
    if (error) throw new Error(`[tx.update ${ref.table}] ${error.message}`);
  },
  set: async (ref, data) => {
    const { error } = await supabase.from(ref.table).insert(data);
    if (error) throw new Error(`[tx.set ${ref.table}] ${error.message}`);
  },
  delete: async (ref) => {
    const { error } = await supabase.from(ref.table).delete().eq(ref.pk, ref.id);
    if (error) throw new Error(`[tx.delete ${ref.table}] ${error.message}`);
  },
});

// Insert a new row and return its generated PK
const insertAndGetId = async (table, data) => {
  const pk = getPK(table);
  const { data: rows, error } = await supabase.from(table).insert(data).select(pk);
  if (error) throw new Error(`[insertAndGetId ${table}] ${error.message}`);
  return rows[0][pk];
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const api = {

  // ─── Auth ─────────────────────────────────────────────────────────────────

  register: async (username, email, password) => {
    const finalEmail = email || usernameToEmail(username);
    const { data: authData, error } = await supabase.auth.signUp({
      email: finalEmail,
      password,
      options: { data: { username } },
    });
    if (error) throw error;
    return { user: authData.user };
  },

  login: async (username, password) => {
    const email = username.includes('@') ? username : usernameToEmail(username);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { user: data.user };
  },

  logout: async () => {
    await supabase.auth.signOut();
  },

  resetPassword: async (username) => {
    const email = username.includes('@') ? username : usernameToEmail(username);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  },

  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  getMe: async () => {
    const uid = await getUserId();
    const userRef = doc(null, 'users', uid);
    const docSnap = await getDoc(userRef);
    let data;

    if (!docSnap.exists()) {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user.email || `${uid}@monsterarena.app`;
      const username = user.user_metadata?.username || email.split('@')[0];

      const { error: upsertError } = await supabase.from('users').upsert({
        user_id: uid,
        username,
        email,
        gold: 500,
        premium_gems: 0,
        stamina: 100,
        max_stamina: 100,
        last_login_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (upsertError) throw new Error(`無法建立玩家資料：${upsertError.message}`);

      const confirmed = await getDoc(userRef);
      if (!confirmed.exists()) throw new Error('玩家資料建立失敗，請重新整理頁面！');
      data = confirmed.data();
    } else {
      data = docSnap.data();
    }

    // Daily Login Bonus (+100G)
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const lastLoginStr = data.last_login_at ? data.last_login_at.split('T')[0] : '';

    if (todayStr !== lastLoginStr) {
      const newGold = (data.gold || 0) + 100;
      await updateDoc(userRef, { gold: newGold, last_login_at: now.toISOString() });
      data.gold = newGold;
    }

    return data;
  },

  // ─── Monsters ─────────────────────────────────────────────────────────────

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

          if (m.life_stage === 1 && m.age_days >= 0.00035) { m.life_stage = 2; }
          else if (m.life_stage === 2 && m.age_days >= 0.5) { m.life_stage = 3; m.type = Math.floor(Math.random() * 3) + 1; }
          else if (m.life_stage === 3 && m.age_days >= 2) {
            if (m.train_count >= 15 && m.neglect_count <= 2) { m.type = 1; m.life_stage = 4; }
            else if (m.train_count >= 5 && m.neglect_count <= 5) { m.type = 2; m.life_stage = 4; }
            else { m.type = 3; m.life_stage = 4; }
          }
          else if (m.life_stage === 4 && m.age_days >= 4) {
            const winRate = m.battles > 0 ? m.wins / m.battles : 0;
            if (m.battles >= 30 && winRate >= 0.6) { m.life_stage = 5; }
            else if (m.battles >= 15 && winRate >= 0.4) { m.life_stage = 5; }
            else { m.life_stage = 5; m.type = 3; }
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
        newFullness = Math.min(100, mon.fullness + 15);
        newCleanliness = Math.max(0, mon.cleanliness - 10);
        // expired milk has 70% chance to cause sickness, increases neglect count
        if (Math.random() < 0.7) {
          await updateDoc(monRef, { is_sick: true, sick_time_start: now.toISOString(), neglect_count: (mon.neglect_count || 0) + 1 });
        }
      }
      else if (item_id === 'sleeping_pill') {
        // Force monster to sleep for 8 hours
        const sleepUntil = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
        await updateDoc(monRef, { sleep_until: sleepUntil });
        return { message: '怪獸服下安眠藥，沉沉睡去了...（強制睡眠 8 小時）' };
      }
      else if (item_id === 'alarm_clock') {
        // Wake up monster from forced sleep
        await updateDoc(monRef, { sleep_until: null });
        return { message: '鬧鐘響起！怪獸從睡夢中驚醒了！' };
      }
    }

    await updateDoc(monRef, { fullness: newFullness, cleanliness: newCleanliness, starve_time_start: null });
    api.trackQuestProgress('feed', 1).catch(e => console.warn(e));
    return { message: '餵食成功！' };
  },

  clean: async (monster_id) => {
    await updateDoc(doc(null, 'monsters', monster_id), { cleanliness: 100 });
    api.trackQuestProgress('clean', 1).catch(e => console.warn(e));
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
    if (userDoc.data().stamina < 10) throw new Error('體力不足！訓練需要 10 點體力。');

    const monDoc = await t.get(monRef);
    const mon = monDoc.data();
    if (!mon || mon.is_dead || mon.is_sick || mon.fullness < 20) throw new Error('怪獸生病或太餓無法訓練！');

    await t.update(userRef, { stamina: userDoc.data().stamina - 10 });

    const stats = ['combat_hp', 'combat_atk', 'combat_def', 'combat_spd'];
    const boostStat = stats[Math.floor(Math.random() * stats.length)];
    const boostVal = boostStat === 'combat_hp' ? 10 : 2;

    await t.update(monRef, {
      [boostStat]: mon[boostStat] + boostVal,
      fullness: mon.fullness - 10,
      train_count: (mon.train_count || 0) + 1,
    });

    api.trackQuestProgress('train', 1).catch(e => console.warn(e));
    return { message: `訓練成功！消耗 10 體力，${boostStat} 提升了！` };
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

  // ─── Inventory ────────────────────────────────────────────────────────────

  getInventory: async () => {
    const uid = await getUserId();
    const q = query(collection(null, 'user_inventory'), where('user_id', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ inventory_id: d.id, ...d.data() }));
  },

  buyItem: async (item_id, quantity = 1) => {
    const uid = await getUserId();
    const userRef = doc(null, 'users', uid);

    const PRICES = {
      meat_basic: 10,
      meat_premium: 50,
      energy_drink: 100,
      medicine_standard: 200,
      vitamin: 50,
      breed_catalyst: 500,
      ultimate_core: 1000,
      expired_milk: 5,
      sleeping_pill: 150,
      alarm_clock: 150,
    };

    const cost = (PRICES[item_id] || 9999) * quantity;

    const t = makeTransaction();
    const uDoc = await t.get(userRef);
    if (uDoc.data().gold < cost) throw new Error('金幣不足！');
    await t.update(userRef, { gold: uDoc.data().gold - cost });

    const invQ = query(collection(null, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', item_id));
    const invSnap = await getDocs(invQ);
    if (invSnap.empty) {
      let type = 1;
      if (item_id.includes('medicine') || item_id === 'vitamin') type = 2;
      if (item_id === 'breed_catalyst') type = 3;
      if (item_id === 'chip_extractor') type = 4;
      if (item_id === 'ultimate_core') type = 5;
      await insertAndGetId('user_inventory', { user_id: uid, item_id, item_type: type, quantity });
    } else {
      const invDoc = invSnap.docs[0];
      await t.update(invDoc.ref, { quantity: invDoc.data().quantity + quantity });
    }

    return { message: `成功花費 ${cost}G 購買 ${item_id} x${quantity}！` };
  },

  // ─── Daily Quests ─────────────────────────────────────────────────────────

  trackQuestProgress: async (actionType, count = 1) => {
    try {
      const uid = await getUserId();
      const dateStr = new Date().toISOString().split('T')[0];
      const questId = `${uid}_${dateStr}`;

      const { data: existing } = await supabase
        .from('daily_quests')
        .select('*')
        .eq('quest_id', questId)
        .single();

      if (!existing) {
        await supabase.from('daily_quests').upsert({
          quest_id: questId,
          user_id: uid,
          date: dateStr,
          feed_count: actionType === 'feed' ? count : 0,
          train_count: actionType === 'train' ? count : 0,
          battle_count: actionType === 'battle' ? count : 0,
          claimed: [],
        }, { onConflict: 'quest_id' });
      } else {
        const field = `${actionType}_count`;
        await supabase.from('daily_quests')
          .update({ [field]: (existing[field] || 0) + count })
          .eq('quest_id', questId);
      }
    } catch (e) {
      console.warn('Failed to track quest progress', e);
    }
  },

  getDailyQuests: async () => {
    const uid = await getUserId();
    const dateStr = new Date().toISOString().split('T')[0];
    const questId = `${uid}_${dateStr}`;
    const { data } = await supabase
      .from('daily_quests')
      .select('*')
      .eq('quest_id', questId)
      .single();
    return data || { feed_count: 0, train_count: 0, battle_count: 0, claimed: [] };
  },

  claimQuest: async (questId, rewardGold) => {
    const uid = await getUserId();
    const dateStr = new Date().toISOString().split('T')[0];
    const compositeId = `${uid}_${dateStr}`;

    const { data: qData } = await supabase
      .from('daily_quests')
      .select('*')
      .eq('quest_id', compositeId)
      .single();

    if (!qData) throw new Error('無任務資料');
    if (qData.claimed && qData.claimed.includes(questId)) throw new Error('已經領取過了！');

    const userRef = doc(null, 'users', uid);
    const uSnap = await getDoc(userRef);
    await updateDoc(userRef, { gold: (uSnap.data().gold || 0) + rewardGold });

    await supabase.from('daily_quests')
      .update({ claimed: [...(qData.claimed || []), questId] })
      .eq('quest_id', compositeId);

    return { message: `領取成功！獲得 ${rewardGold}G` };
  },

  // ─── Friends ──────────────────────────────────────────────────────────────

  addFriend: async (targetUUID) => {
    const uid = await getUserId();
    if (!targetUUID || targetUUID.trim() === '') throw new Error('UUID 不能為空！');
    if (uid === targetUUID) throw new Error('不能加自己為好友！');

    const targetSnap = await getDoc(doc(null, 'users', targetUUID));
    if (!targetSnap.exists()) throw new Error('找不到該 UUID 的玩家！');

    // Prevent duplicate (friends table uses user_id + friend_uid)
    const { data: existing } = await supabase
      .from('friends')
      .select('friend_record_id')
      .eq('user_id', uid)
      .eq('friend_uid', targetUUID)
      .single();
    if (existing) throw new Error('已經是好友或申請中！');

    const { error } = await supabase.from('friends').insert({
      user_id: uid,
      friend_uid: targetUUID,
      friend_name: targetSnap.data().username || '未知玩家',
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    return { message: `成功加入好友：${targetSnap.data().username}！` };
  },

  getFriends: async () => {
    const uid = await getUserId();
    const { data: rows, error } = await supabase
      .from('friends')
      .select('*')
      .eq('user_id', uid);
    if (error) throw new Error(error.message);

    return (rows || []).map(row => ({
      friend_id: row.friend_uid,
      friend_name: row.friend_name || '未知玩家',
    }));
  },

  acceptFriend: async () => ({ message: 'ok' }),

  giftStamina: async (friendId) => {
    const uid = await getUserId();
    const today = new Date().toISOString().split('T')[0];

    // Check if already gifted today
    const { data: existing } = await supabase
      .from('gifts')
      .select('gift_id')
      .eq('sender', uid)
      .eq('receiver', friendId)
      .eq('date', today)
      .single();
    if (existing) throw new Error('今天已經贈送過體力了！');

    const friendRef = doc(null, 'users', friendId);
    const fDoc = await getDoc(friendRef);
    if (!fDoc.exists()) throw new Error('好友不存在！');
    await updateDoc(friendRef, { stamina: Math.min(200, (fDoc.data().stamina || 0) + 20) });

    await supabase.from('gifts').insert({ sender: uid, receiver: friendId, date: today });

    return { message: '已成功贈送 20 點體力給好友！' };
  },

  // ─── Challenges / PvP ─────────────────────────────────────────────────────

  subscribeChallenges: (callback) => {
    let uid = null;
    const pollInterval = setInterval(async () => {
      try {
        if (!uid) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          uid = user.id;
        }
        const { data, error } = await supabase
          .from('challenges')
          .select('*')
          .eq('target_uid', uid)
          .eq('status', 'pending');
        if (!error) callback(data || []);
      } catch (e) { /* ignore */ }
    }, 5000);

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      uid = user.id;
      supabase.from('challenges').select('*').eq('target_uid', uid).eq('status', 'pending')
        .then(({ data }) => callback(data || []));
    });

    return () => clearInterval(pollInterval);
  },

  // ─── Guild ────────────────────────────────────────────────────────────────

  getGuilds: async () => {
    const uid = await getUserId();
    const guildsSnap = await getDocs(collection(null, 'guilds'));
    const guilds = guildsSnap.docs.map(g => ({ guild_id: g.id, ...g.data() }));

    const memberQ = query(collection(null, 'guild_members'), where('user_id', '==', uid));
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
    const uid = await getUserId();
    const guildId = await insertAndGetId('guilds', {
      guild_name,
      leader_id: uid,
      level: 1,
      created_at: new Date().toISOString(),
    });
    await insertAndGetId('guild_members', {
      guild_id: guildId,
      user_id: uid,
      role: 2,
      contribution: 0,
    });
    return { message: '創建公會成功！' };
  },

  joinGuild: async (guild_id) => {
    const uid = await getUserId();
    await insertAndGetId('guild_members', { guild_id, user_id: uid, role: 0, contribution: 0 });
    return { message: '成功加入公會！' };
  },

  leaveGuild: async () => {
    const uid = await getUserId();
    const memberQ = query(collection(null, 'guild_members'), where('user_id', '==', uid));
    const memberSnap = await getDocs(memberQ);
    if (!memberSnap.empty) {
      await deleteDoc(memberSnap.docs[0].ref);
    }
    return { message: '離開公會' };
  },

  donateGuild: async (amount) => {
    const uid = await getUserId();
    const userRef = doc(null, 'users', uid);
    const memberQ = query(collection(null, 'guild_members'), where('user_id', '==', uid));
    const memberSnap = await getDocs(memberQ);
    if (memberSnap.empty) throw new Error('你沒有加入任何公會！');
    const memberRef = memberSnap.docs[0].ref;
    const guildId = memberSnap.docs[0].data().guild_id;

    const t = makeTransaction();
    const uDoc = await t.get(userRef);
    if (uDoc.data().gold < amount) throw new Error('金幣不足！');
    await t.update(userRef, { gold: uDoc.data().gold - amount });
    const mDoc = await t.get(memberRef);
    await t.update(memberRef, { contribution: (mDoc.data().contribution || 0) + amount });

    // Also update guild total_contribution
    const guildRef = doc(null, 'guilds', guildId);
    const gDoc = await t.get(guildRef);
    await t.update(guildRef, { total_contribution: (gDoc.data().total_contribution || 0) + amount });

    return { message: `成功捐獻 ${amount} 金幣！獲得 ${amount} 點公會貢獻。` };
  },

  buyGuildShop: async (item_id) => {
    const uid = await getUserId();
    const memberQ = query(collection(null, 'guild_members'), where('user_id', '==', uid));
    const memberSnap = await getDocs(memberQ);
    if (memberSnap.empty) throw new Error('你沒有加入任何公會！');
    const memberRef = memberSnap.docs[0].ref;

    const PRICES = {
      chip_atk: 200, chip_def: 200, chip_spd: 200, chip_hp: 200,
      chip_extractor: 300, breed_catalyst: 150, ultimate_core: 500,
    };
    const cost = PRICES[item_id];
    if (cost === undefined) throw new Error('未知商品！');

    const t = makeTransaction();
    const mDoc = await t.get(memberRef);
    if ((mDoc.data().contribution || 0) < cost) throw new Error('公會貢獻點數不足！');
    await t.update(memberRef, { contribution: mDoc.data().contribution - cost });

    const invQ = query(collection(null, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', item_id));
    const invSnap = await getDocs(invQ);
    if (invSnap.empty) {
      let type = 6; // chips
      if (item_id === 'chip_extractor') type = 4;
      if (item_id === 'breed_catalyst') type = 3;
      if (item_id === 'ultimate_core') type = 5;
      await insertAndGetId('user_inventory', { user_id: uid, item_id, item_type: type, quantity: 1 });
    } else {
      const invDoc = invSnap.docs[0];
      await t.update(invDoc.ref, { quantity: invDoc.data().quantity + 1 });
    }

    const ITEM_NAMES = {
      chip_atk: '攻擊晶片', chip_def: '防禦晶片', chip_spd: '速度晶片', chip_hp: '生命晶片',
      chip_extractor: '晶片提取器', breed_catalyst: '繁衍催化劑', ultimate_core: '究極進化核心',
    };
    return { message: `成功兌換 ${ITEM_NAMES[item_id] || item_id}！消耗 ${cost} 貢獻。` };
  },

  // ─── Raid Boss ────────────────────────────────────────────────────────────

  getRaidStatus: async () => {
    // Use a fixed row in guilds table or just return a static mock if sys_config doesn't exist
    const { data, error } = await supabase
      .from('raid_boss')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return { name: '啟示錄獸', current_hp: 500000, max_hp: 500000, is_active: true };
    }
    return data;
  },

  attackRaidBoss: async (monster_id, damage) => {
    const uid = await getUserId();
    const userRef = doc(null, 'users', uid);

    const uSnap = await getDoc(userRef);
    if ((uSnap.data().stamina || 0) < 15) throw new Error('體力不足');
    await updateDoc(userRef, { stamina: uSnap.data().stamina - 15 });

    const { data: boss, error } = await supabase
      .from('raid_boss')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Auto-spawn a new raid boss if none exists or current is defeated
    if (error || !boss || !boss.is_active) {
      const { data: newBoss, error: spawnErr } = await supabase
        .from('raid_boss')
        .insert({ name: '啟示錄獸', current_hp: 500000, max_hp: 500000, is_active: true, created_at: new Date().toISOString() })
        .select()
        .single();
      if (spawnErr) throw new Error('世界王重生失敗，請稍後再試！');
      const newHp = Math.max(0, 500000 - damage);
      const isActive = newHp > 0;
      await supabase.from('raid_boss').update({ current_hp: newHp, is_active: isActive }).eq('id', newBoss.id);
      return { message: `世界王重生！⚡ 造成 ${damage} 點傷害！`, hp: newHp, maxHp: 500000 };
    }

    const newHp = Math.max(0, (boss.current_hp || 0) - damage);
    const isActive = newHp > 0;
    await supabase.from('raid_boss').update({ current_hp: newHp, is_active: isActive }).eq('id', boss.id);

    let message = isActive ? '持續激戰中！' : '世界王已被擊退！獲得豐厚獎勵！';
    if (!isActive) {
      await updateDoc(userRef, { gold: (uSnap.data().gold || 0) + 5000 });
      // Auto-spawn next boss
      await supabase.from('raid_boss').insert({
        name: '啟示錄獸', current_hp: 500000, max_hp: 500000,
        is_active: true, created_at: new Date().toISOString(),
      });
      message += ' 新的世界王已出現！';
    }
    return { message, hp: newHp, maxHp: boss.max_hp || 500000 };
  },

  // ─── Social / Chat ────────────────────────────────────────────────────────

  searchPlayers: async (typeFilter) => {
    let req = supabase
      .from('monsters')
      .select('*')
      .eq('is_dead', false)
      .order('last_updated_at', { ascending: false })
      .limit(20);
    if (typeFilter) {
      req = req.eq('type', parseInt(typeFilter));
    }

    const { data: monsterRows, error } = await req;
    if (error) return [];

    const ownersMap = new Map();
    for (const m of (monsterRows || [])) {
      const ownerId = m.user_id; // monsters table uses user_id
      if (!ownersMap.has(ownerId)) {
        ownersMap.set(ownerId, {
          user_id: ownerId,
          username: `玩家 ${ownerId.substring(0, 5)}`,
          monsters: [],
        });
      }
      if (ownersMap.get(ownerId).monsters.length < 3) {
        ownersMap.get(ownerId).monsters.push({ monster_id: m.monster_id, ...m });
      }
    }

    const players = [];
    for (const [ownerId, data] of ownersMap) {
      const uSnap = await getDoc(doc(null, 'users', ownerId));
      if (uSnap.exists()) {
        data.username = uSnap.data().username || data.username;
      }
      players.push(data);
    }
    return players;
  },

  sendMessage: async (channel, text) => {
    if (!text || text.trim().length === 0) return;
    const uid = await getUserId();

    // Spam check
    const { data: lastMsgs } = await supabase
      .from('messages')
      .select('timestamp')
      .eq('user_id', uid)
      .order('timestamp', { ascending: false })
      .limit(1);

    if (lastMsgs && lastMsgs.length > 0) {
      const diff = new Date() - new Date(lastMsgs[0].timestamp);
      if (diff < 3000) throw new Error('發言過於頻繁，請等待3秒！');
    }

    const uSnap = await getDoc(doc(null, 'users', uid));
    const username = uSnap.exists() ? uSnap.data().username : 'Unknown';

    const { error } = await supabase.from('messages').insert({
      channel,
      user_id: uid,
      username,
      text: text.trim(),
      timestamp: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  },

  subscribeMessages: (channel, callback) => {
    let isCancelled = false;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('channel', channel)
        .order('timestamp', { ascending: false })
        .limit(50);
      if (!isCancelled) callback((data || []).reverse());
    };

    fetchMessages();
    const timer = setInterval(fetchMessages, 5000);
    return () => { isCancelled = true; clearInterval(timer); };
  },

  // ─── PVE Mock Matchmaking ─────────────────────────────────────────────────

  matchmakeMock: async (mode, stage) => {
    const WILD_NAMES = ['病毒蟲', '資料幽靈', '數碼惡魔', '位元狼', '像素龍', '疫苗哨兵', '鐵殼蟲'];
    const name = WILD_NAMES[Math.floor(Math.random() * WILD_NAMES.length)];
    const baseAtk = stage * 8 + Math.floor(Math.random() * 10);
    const baseDef = stage * 6 + Math.floor(Math.random() * 8);
    const baseHp  = stage * 60 + Math.floor(Math.random() * 30);
    const baseSpd = stage * 5 + Math.floor(Math.random() * 6);
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

  // ─── User Profile ─────────────────────────────────────────────────────────

  updateNickname: async (newNickname) => {
    if (!newNickname || newNickname.trim().length === 0) throw new Error('暱稱不能為空！');
    if (newNickname.trim().length > 16) throw new Error('暱稱最多 16 字！');
    const uid = await getUserId();
    const userRef = doc(null, 'users', uid);
    await updateDoc(userRef, { username: newNickname.trim() });
    return { message: `暱稱已更新為「${newNickname.trim()}」！` };
  },
};
