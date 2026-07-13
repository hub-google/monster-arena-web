import { auth, db } from './firebaseClient';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut
} from 'firebase/auth';
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  query, where, deleteDoc, runTransaction 
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
    return docSnap.data();
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
          else if (m.life_stage === 2 && m.age_days >= 0.5) { m.life_stage = 3; m.type = Math.floor(Math.random()*3)+1; } 
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
    
    return updatedMonsters.sort((a,b) => {
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
    const invQ = query(collection(db, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', item_id));
    const invSnap = await getDocs(invQ);
    if (invSnap.empty || invSnap.docs[0].data().quantity <= 0) throw new Error('沒有足夠的食物！');
    
    const invDoc = invSnap.docs[0];
    const monRef = doc(db, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    if (!monSnap.exists() || monSnap.data().is_dead) throw new Error('怪獸狀態異常！');

    const mon = monSnap.data();
    await updateDoc(invDoc.ref, { quantity: invDoc.data().quantity - 1 });
    
    let newFullness = mon.fullness;
    if (item_id === 'meat_basic') newFullness = Math.min(100, mon.fullness + 20);
    else if (item_id === 'meat_premium') newFullness = Math.min(100, mon.fullness + 60);
    else if (item_id === 'energy_drink') newFullness = Math.min(100, mon.fullness + 30);
    
    await updateDoc(monRef, { fullness: newFullness, starve_time_start: null });
    return { message: '餵食成功！' };
  },

  clean: async (monster_id) => {
    await updateDoc(doc(db, 'monsters', monster_id), { cleanliness: 100 });
    return { message: '打掃完畢，環境變乾淨了！' };
  },

  heal: async (monster_id) => {
    const uid = getUserId();
    const invQ = query(collection(db, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', 'medicine_standard'));
    const invSnap = await getDocs(invQ);
    if (invSnap.empty || invSnap.docs[0].data().quantity <= 0) throw new Error('沒有特效藥，請到商店購買！');
    
    await updateDoc(invSnap.docs[0].ref, { quantity: invSnap.docs[0].data().quantity - 1 });
    await updateDoc(doc(db, 'monsters', monster_id), { is_sick: false, sick_time_start: null });
    return { message: '注射特效藥，怪獸已經康復！' };
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
    const monRef = doc(db, 'monsters', monster_id);
    const monSnap = await getDoc(monRef);
    if (monSnap.data().is_locked) throw new Error('怪獸已鎖定，無法放生！');
    await deleteDoc(monRef);
    return { message: '怪獸已成功放生，回歸數碼世界。' };
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
    await updateDoc(userRef, { gold: 1000 }); // mock buying
    const invRef = doc(collection(db, 'user_inventory'));
    await setDoc(invRef, { user_id: uid, item_id: item_id, quantity: quantity });
    return { message: `成功購買 ${item_id} x${quantity}！` };
  },

  getFriends: async () => { return []; },
  addFriend: async () => { return { message: 'ok' }; },
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
  donateGuild: async () => { return { message: '貢獻成功' }; },
  buyGuildShop: async () => { return { message: '兌換成功' }; },
  
  getRaidStatus: async () => { return { name: '尚無世界王', current_hp: 0, max_hp: 0, is_active: false }; },
  attackRaidBoss: async () => { return { message: 'ok' }; }
};
