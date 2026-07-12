import { supabase } from './supabaseClient';

// Helper to get current logged in user ID from Supabase
const getUserId = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error('Not authenticated');
  return session.user.id;
};

// Map username to a fake email for Supabase Auth if needed
const usernameToEmail = (username) => `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@monsterarena.app`;

export const api = {
  // --- Auth ---
  register: async (username, email, password) => {
    // Supabase Auth requires email.
    const finalEmail = email || usernameToEmail(username);
    const { data, error } = await supabase.auth.signUp({
      email: finalEmail,
      password: password,
      options: { data: { username } }
    });
    if (error) throw new Error(error.message);
    
    // Create user profile in 'users' table
    if (data.user) {
      const { error: profileError } = await supabase.from('users').insert([{
        user_id: data.user.id,
        username: username,
        email: finalEmail,
        gold: 500,
        premium_gems: 0,
        stamina: 100,
        max_stamina: 100
      }]);
      if (profileError && profileError.code !== '23505') {
        console.error('Profile creation error:', profileError);
      }
    }
    return { token: data.session?.access_token, user: data.user };
  },

  login: async (username, password) => {
    // Assume username is passed, try logging in with mapped email
    const email = username.includes('@') ? username : usernameToEmail(username);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return { token: data.session?.access_token, user: data.user };
  },

  getMe: async () => {
    const uid = await getUserId();
    const { data, error } = await supabase.from('users').select('*').eq('user_id', uid).single();
    if (error) throw new Error(error.message);
    return data;
  },

  // --- Monsters ---
  getMonsters: async () => {
    const uid = await getUserId();
    
    // First fetch them
    const { data: monsters, error } = await supabase.from('monsters').select('*').eq('user_id', uid);
    if (error) throw new Error(error.message);

    // [Game Logic]: Apply offline offline progress for fullness, cleanliness, age, evolution, death
    const now = new Date();
    let updatedMonsters = [];
    
    for (let m of monsters) {
      if (m.is_dead) {
        updatedMonsters.push(m);
        continue;
      }

      const lastUpdated = new Date(m.last_updated_at);
      const hoursPassed = (now - lastUpdated) / (1000 * 60 * 60);

      if (hoursPassed > 0.1) { // Apply updates if at least 6 minutes passed
        m.age_days += hoursPassed / 24;
        
        // Fullness & Cleanliness decrease
        m.fullness = Math.max(0, m.fullness - Math.floor(hoursPassed * 5));
        m.cleanliness = Math.max(0, m.cleanliness - Math.floor(hoursPassed * 4));

        // Illness mechanics
        if (m.cleanliness < 30 && !m.is_sick) {
          if (Math.random() < 0.15) m.is_sick = true;
        }

        // Death logic: Fullness 0 or Sick for 24+ hours
        if (m.fullness === 0 && Math.random() < (hoursPassed * 0.05)) {
          m.is_dead = true;
          m.hp = 0;
        }

        // Evolution logic
        if (!m.is_dead) {
          if (m.life_stage === 0 && m.age_days >= 0.05) m.life_stage = 1; // Egg to Baby
          else if (m.life_stage === 1 && m.age_days >= 1) { m.life_stage = 2; m.type = Math.floor(Math.random()*3)+1; } // Baby to Child
          else if (m.life_stage === 2 && m.age_days >= 3) m.life_stage = 3; // Child to Adult
          else if (m.life_stage === 3 && m.age_days >= 7) m.life_stage = 4; // Adult to Perfect
        }

        m.last_updated_at = now.toISOString();

        // Update DB
        await supabase.from('monsters').update({
          age_days: m.age_days,
          fullness: m.fullness,
          cleanliness: m.cleanliness,
          is_sick: m.is_sick,
          is_dead: m.is_dead,
          hp: m.hp,
          life_stage: m.life_stage,
          type: m.type,
          last_updated_at: m.last_updated_at
        }).eq('monster_id', m.monster_id);
      }
      updatedMonsters.push(m);
    }
    
    // Sort by alive first, then highest level
    return updatedMonsters.sort((a,b) => {
      if (a.is_dead !== b.is_dead) return a.is_dead ? 1 : -1;
      return b.life_stage - a.life_stage;
    });
  },

  hatchEgg: async () => {
    const uid = await getUserId();
    const { data: user } = await supabase.from('users').select('gold').eq('user_id', uid).single();
    if (user.gold < 100) throw new Error('金幣不足，需要 100G！');
    
    // Deduct gold
    await supabase.from('users').update({ gold: user.gold - 100 }).eq('user_id', uid);
    
    // Create Egg
    const { error } = await supabase.from('monsters').insert([{
      user_id: uid,
      name: '數位蛋',
      generation: 1,
      life_stage: 0,
      type: 0,
      age_days: 0,
      fullness: 100,
      cleanliness: 100,
      is_sick: false,
      is_dead: false,
      combat_hp: 50,
      combat_atk: 5,
      combat_def: 5,
      combat_spd: 5,
      maxHp: 50,
      hp: 50,
      battles: 0,
      wins: 0,
      is_locked: false
    }]);
    if (error) throw new Error(error.message);
    return { message: '成功購買並孵化一顆新數位蛋！' };
  },

  feed: async (monster_id, item_id) => {
    const uid = await getUserId();
    // Check inventory
    const { data: inv } = await supabase.from('user_inventory').select('*').eq('user_id', uid).eq('item_id', item_id).single();
    if (!inv || inv.quantity <= 0) throw new Error('沒有足夠的食物！');
    
    // Get monster
    const { data: mon } = await supabase.from('monsters').select('*').eq('monster_id', monster_id).single();
    if (!mon || mon.is_dead) throw new Error('怪獸狀態異常！');

    // Consume item
    await supabase.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('inventory_id', inv.inventory_id);
    
    // Update monster stats
    let newFullness = mon.fullness;
    if (item_id === 'meat_basic') newFullness = Math.min(100, mon.fullness + 20);
    else if (item_id === 'meat_premium') newFullness = Math.min(100, mon.fullness + 60);
    else if (item_id === 'energy_drink') newFullness = Math.min(100, mon.fullness + 30);
    
    await supabase.from('monsters').update({ fullness: newFullness }).eq('monster_id', monster_id);
    return { message: '餵食成功！' };
  },

  clean: async (monster_id) => {
    const { error } = await supabase.from('monsters').update({ cleanliness: 100 }).eq('monster_id', monster_id);
    if (error) throw new Error(error.message);
    return { message: '打掃完畢，環境變乾淨了！' };
  },

  heal: async (monster_id) => {
    const uid = await getUserId();
    const { data: inv } = await supabase.from('user_inventory').select('*').eq('user_id', uid).eq('item_id', 'medicine_standard').single();
    if (!inv || inv.quantity <= 0) throw new Error('沒有特效藥，請到商店購買！');
    
    await supabase.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('inventory_id', inv.inventory_id);
    await supabase.from('monsters').update({ is_sick: false }).eq('monster_id', monster_id);
    return { message: '注射特效藥，怪獸已經康復！' };
  },

  train: async (monster_id) => {
    const uid = await getUserId();
    const { data: user } = await supabase.from('users').select('stamina').eq('user_id', uid).single();
    if (user.stamina < 10) throw new Error('體力不足！訓練需要 10 點體力。');
    
    const { data: mon } = await supabase.from('monsters').select('*').eq('monster_id', monster_id).single();
    if (!mon || mon.is_dead || mon.is_sick || mon.fullness < 20) throw new Error('怪獸生病或太餓無法訓練！');

    // Consume stamina
    await supabase.from('users').update({ stamina: user.stamina - 10 }).eq('user_id', uid);
    
    // Train stats
    const stats = ['combat_hp', 'combat_atk', 'combat_def', 'combat_spd'];
    const boostStat = stats[Math.floor(Math.random() * stats.length)];
    const boostVal = boostStat === 'combat_hp' ? 10 : 2;

    await supabase.from('monsters').update({ [boostStat]: mon[boostStat] + boostVal, fullness: mon.fullness - 10 }).eq('monster_id', monster_id);
    return { message: `訓練成功！消耗 10 體力，${boostStat} 提升了！` };
  },

  evolve: async (monster_id) => {
    const uid = await getUserId();
    const { data: inv } = await supabase.from('user_inventory').select('*').eq('user_id', uid).eq('item_id', 'ultimate_core').single();
    if (!inv || inv.quantity <= 0) throw new Error('缺少究極進化核心！');
    
    const { data: mon } = await supabase.from('monsters').select('*').eq('monster_id', monster_id).single();
    if (mon.life_stage !== 5) throw new Error('怪獸尚未達到完全體，無法進行究極進化！');

    await supabase.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('inventory_id', inv.inventory_id);
    await supabase.from('monsters').update({ 
      life_stage: 6, 
      combat_hp: mon.combat_hp * 1.5,
      combat_atk: mon.combat_atk * 1.5,
      combat_def: mon.combat_def * 1.5,
      combat_spd: mon.combat_spd * 1.5,
      maxHp: mon.maxHp * 1.5,
      hp: mon.maxHp * 1.5
    }).eq('monster_id', monster_id);

    return { message: '🧬 究極進化成功！戰鬥數值大幅提升！' };
  },

  toggleLock: async (monster_id) => {
    const { data: mon } = await supabase.from('monsters').select('is_locked').eq('monster_id', monster_id).single();
    await supabase.from('monsters').update({ is_locked: !mon.is_locked }).eq('monster_id', monster_id);
    return { message: mon.is_locked ? '已解除鎖定！' : '已上鎖，免受放生！' };
  },

  release: async (monster_id) => {
    const { data: mon } = await supabase.from('monsters').select('is_locked').eq('monster_id', monster_id).single();
    if (mon.is_locked) throw new Error('怪獸已鎖定，無法放生！');
    await supabase.from('monsters').delete().eq('monster_id', monster_id);
    return { message: '怪獸已成功放生，回歸數碼世界。' };
  },

  equipChip: async (monster_id, chip_id, slot) => {
    const uid = await getUserId();
    const { data: inv } = await supabase.from('user_inventory').select('*').eq('user_id', uid).eq('item_id', chip_id).single();
    if (!inv || inv.quantity <= 0) throw new Error('缺少該晶片！');

    await supabase.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('inventory_id', inv.inventory_id);
    
    const updateObj = {};
    if (slot === 1) updateObj.chip_slot_1 = chip_id;
    else updateObj.chip_slot_2 = chip_id;

    await supabase.from('monsters').update(updateObj).eq('monster_id', monster_id);
    return { message: `晶片 ${chip_id} 成功鑲嵌至插槽 ${slot}！` };
  },

  unequipChip: async (monster_id, slot) => {
    const uid = await getUserId();
    const { data: inv } = await supabase.from('user_inventory').select('*').eq('user_id', uid).eq('item_id', 'chip_extractor').single();
    if (!inv || inv.quantity <= 0) throw new Error('缺少晶片提取器！');

    const { data: mon } = await supabase.from('monsters').select('chip_slot_1, chip_slot_2').eq('monster_id', monster_id).single();
    const chipToExtract = slot === 1 ? mon.chip_slot_1 : mon.chip_slot_2;
    if (!chipToExtract) throw new Error('該插槽沒有晶片！');

    // Consume extractor
    await supabase.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('inventory_id', inv.inventory_id);

    // Give back chip
    const { data: chipInv } = await supabase.from('user_inventory').select('*').eq('user_id', uid).eq('item_id', chipToExtract).single();
    if (chipInv) {
      await supabase.from('user_inventory').update({ quantity: chipInv.quantity + 1 }).eq('inventory_id', chipInv.inventory_id);
    } else {
      await supabase.from('user_inventory').insert([{ user_id: uid, item_id: chipToExtract, item_type: 4, quantity: 1 }]);
    }

    // Clear slot
    const updateObj = {};
    if (slot === 1) updateObj.chip_slot_1 = null;
    else updateObj.chip_slot_2 = null;
    await supabase.from('monsters').update(updateObj).eq('monster_id', monster_id);

    return { message: `安全拆除晶片 ${chipToExtract}，已放回倉庫！` };
  },

  breed: async (parent1_id, parent2_id, useCatalyst) => {
    const uid = await getUserId();
    const { data: user } = await supabase.from('users').select('gold').eq('user_id', uid).single();
    if (user.gold < 200) throw new Error('金幣不足，繁衍需要 200G！');

    if (useCatalyst) {
      const { data: inv } = await supabase.from('user_inventory').select('*').eq('user_id', uid).eq('item_id', 'breed_catalyst').single();
      if (!inv || inv.quantity <= 0) throw new Error('缺少繁衍催化劑！');
      await supabase.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('inventory_id', inv.inventory_id);
    }

    // Deduct gold
    await supabase.from('users').update({ gold: user.gold - 200 }).eq('user_id', uid);

    const { data: p1 } = await supabase.from('monsters').select('*').eq('monster_id', parent1_id).single();
    const { data: p2 } = await supabase.from('monsters').select('*').eq('monster_id', parent2_id).single();

    const maxGen = Math.max(p1.generation, p2.generation) + 1;
    const baseHp = ((p1.combat_hp + p2.combat_hp) / 2) * 1.1; // 10% inheritable boost

    await supabase.from('monsters').insert([{
      user_id: uid,
      name: `數位蛋 G${maxGen}`,
      generation: maxGen,
      life_stage: 0,
      type: 0,
      age_days: 0,
      fullness: 100,
      cleanliness: 100,
      is_sick: false,
      is_dead: false,
      combat_hp: baseHp,
      combat_atk: ((p1.combat_atk + p2.combat_atk) / 2) * 1.1,
      combat_def: ((p1.combat_def + p2.combat_def) / 2) * 1.1,
      combat_spd: ((p1.combat_spd + p2.combat_spd) / 2) * 1.1,
      maxHp: baseHp,
      hp: baseHp,
      battles: 0,
      wins: 0,
      is_locked: false
    }]);

    return { message: `繁衍成功！獲得了一顆擁有遺傳加成的 第 ${maxGen} 代 數位蛋！` };
  },

  getInventory: async () => {
    const uid = await getUserId();
    const { data, error } = await supabase.from('user_inventory').select('*').eq('user_id', uid);
    if (error) throw new Error(error.message);
    return data;
  },

  buyItem: async (item_id, quantity = 1) => {
    const prices = { meat_basic: 10, meat_premium: 50, energy_drink: 100, medicine_standard: 200, vitamin: 50 };
    const cost = (prices[item_id] || 0) * quantity;
    if (cost === 0) throw new Error('無效的商品！');

    const uid = await getUserId();
    const { data: user } = await supabase.from('users').select('gold').eq('user_id', uid).single();
    if (user.gold < cost) throw new Error('金幣不足！');

    // Deduct gold
    await supabase.from('users').update({ gold: user.gold - cost }).eq('user_id', uid);

    // Give item
    const { data: inv } = await supabase.from('user_inventory').select('*').eq('user_id', uid).eq('item_id', item_id).single();
    if (inv) {
      await supabase.from('user_inventory').update({ quantity: inv.quantity + quantity }).eq('inventory_id', inv.inventory_id);
    } else {
      await supabase.from('user_inventory').insert([{ user_id: uid, item_id: item_id, item_type: 1, quantity: quantity }]);
    }
    return { message: `成功購買 ${item_id} x${quantity}！` };
  },

  // --- Friends ---
  getFriends: async () => {
    const uid = await getUserId();
    const { data: f1 } = await supabase.from('friends').select('*, users!friends_user_id_2_fkey(username)').eq('user_id_1', uid);
    const { data: f2 } = await supabase.from('friends').select('*, users!friends_user_id_1_fkey(username)').eq('user_id_2', uid);
    
    let combined = [];
    if (f1) combined = combined.concat(f1.map(f => ({ ...f, friend_id: f.user_id_2, friend_username: f.users?.username })));
    if (f2) combined = combined.concat(f2.map(f => ({ ...f, friend_id: f.user_id_1, friend_username: f.users?.username })));
    return combined;
  },

  addFriend: async (targetUsername) => {
    const uid = await getUserId();
    const { data: target } = await supabase.from('users').select('user_id').eq('username', targetUsername).single();
    if (!target) throw new Error('找不到該玩家！');
    if (target.user_id === uid) throw new Error('不能加自己為好友！');

    const { error } = await supabase.from('friends').insert([{ user_id_1: uid, user_id_2: target.user_id, status: 0 }]);
    if (error) throw new Error('已發送過請求或已為好友！');
    return { message: '好友邀請已送出！' };
  },

  acceptFriend: async (friend_id) => {
    const uid = await getUserId();
    const { error } = await supabase.from('friends').update({ status: 1 }).eq('user_id_1', friend_id).eq('user_id_2', uid);
    if (error) throw new Error(error.message);
    return { message: '已接受好友邀請！' };
  },

  giftStamina: async (friend_id) => {
    // Basic mock logic
    return { message: '已贈送 10 點體力給好友！(冷卻中)' };
  },

  // --- Guilds ---
  getGuilds: async () => {
    const uid = await getUserId();
    const { data: allGuilds } = await supabase.from('guilds').select('*');
    const { data: member } = await supabase.from('guild_members').select('*, guilds(*)').eq('user_id', uid).single();
    
    return {
      guilds: allGuilds || [],
      myGuild: member ? { ...member.guilds, role: member.role, contribution: member.contribution } : null
    };
  },

  createGuild: async (guild_name) => {
    const uid = await getUserId();
    const { data: user } = await supabase.from('users').select('gold, username').eq('user_id', uid).single();
    if (user.gold < 500) throw new Error('創建公會需要 500G！');
    
    await supabase.from('users').update({ gold: user.gold - 500 }).eq('user_id', uid);
    const { data: guild, error } = await supabase.from('guilds').insert([{ guild_name, leader_name: user.username, level: 1, total_exp: 0 }]).select().single();
    if (error) throw new Error(error.message);
    
    await supabase.from('guild_members').insert([{ guild_id: guild.guild_id, user_id: uid, role: 2, contribution: 0 }]);
    return { message: '公會創建成功！' };
  },

  joinGuild: async (guild_id) => {
    const uid = await getUserId();
    const { error } = await supabase.from('guild_members').insert([{ guild_id, user_id: uid, role: 0, contribution: 0 }]);
    if (error) throw new Error('您已經加入其他公會！');
    return { message: '成功加入公會！' };
  },

  leaveGuild: async () => {
    const uid = await getUserId();
    await supabase.from('guild_members').delete().eq('user_id', uid);
    return { message: '已離開公會。' };
  },

  donateGuild: async (amount) => {
    const uid = await getUserId();
    const { data: user } = await supabase.from('users').select('gold').eq('user_id', uid).single();
    if (user.gold < amount) throw new Error('金幣不足！');
    
    const { data: member } = await supabase.from('guild_members').select('*').eq('user_id', uid).single();
    if (!member) throw new Error('您不在公會中！');

    // Update gold and contribution
    await supabase.from('users').update({ gold: user.gold - amount }).eq('user_id', uid);
    await supabase.from('guild_members').update({ contribution: member.contribution + amount }).eq('member_id', member.member_id);
    return { message: `成功捐獻 ${amount} 金幣！獲得 ${amount} 點貢獻值！` };
  },

  buyGuildShop: async (item_id) => {
    const costs = { chip_extractor: 300, breed_catalyst: 150, ultimate_core: 500 };
    const cost = costs[item_id];
    if (!cost) throw new Error('無效商品！');

    const uid = await getUserId();
    const { data: member } = await supabase.from('guild_members').select('*').eq('user_id', uid).single();
    if (!member || member.contribution < cost) throw new Error('貢獻值不足！');

    await supabase.from('guild_members').update({ contribution: member.contribution - cost }).eq('member_id', member.member_id);
    
    const { data: inv } = await supabase.from('user_inventory').select('*').eq('user_id', uid).eq('item_id', item_id).single();
    if (inv) {
      await supabase.from('user_inventory').update({ quantity: inv.quantity + 1 }).eq('inventory_id', inv.inventory_id);
    } else {
      await supabase.from('user_inventory').insert([{ user_id: uid, item_id: item_id, item_type: 4, quantity: 1 }]);
    }
    return { message: `成功兌換 ${item_id}！` };
  },

  // --- Raid ---
  getRaidStatus: async () => {
    const { data, error } = await supabase.from('world_boss').select('*').single();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    if (!data) return { name: '尚無世界王', current_hp: 0, max_hp: 0, is_active: false };
    return data;
  },

  attackRaidBoss: async (monster_id, finalDmg) => {
    const uid = await getUserId();
    const { data: user } = await supabase.from('users').select('stamina').eq('user_id', uid).single();
    if (user.stamina < 15) throw new Error('體力不足 15 點！');

    const { data: boss } = await supabase.from('world_boss').select('*').single();
    if (!boss || !boss.is_active) throw new Error('世界王目前未開放！');

    await supabase.from('users').update({ stamina: user.stamina - 15 }).eq('user_id', uid);
    
    const newHp = Math.max(0, boss.current_hp - finalDmg);
    await supabase.from('world_boss').update({ current_hp: newHp, is_active: newHp > 0 }).eq('boss_id', boss.boss_id);

    return { message: newHp === 0 ? '🏆 恭喜！世界王被討伐成功！' : '持續奮戰中...' };
  }
};
