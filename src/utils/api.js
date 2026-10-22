import { supabase } from './supabaseClient';

// All economy mutations go through authenticated PostgreSQL transactions.
// Direct client updates are reserved for owner-controlled presentation state.
const getUid = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('User not authenticated');
  return user.id;
};
const usernameEmail = name => `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@monsterarena.app`;
const throwIfError = error => { if (error) throw new Error(error.message); };
const action = async (p_action, p_data = {}) => {
  const { data, error } = await supabase.rpc('game_action', { p_action, p_data });
  throwIfError(error);
  return data ?? { message: '操作成功！' };
};
const dateInTaiwan = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());
const getQuestId = uid => `${uid}_${dateInTaiwan()}`;

const updateAging = async (monster, uid) => {
  if (monster.is_dead || monster.is_frozen) return monster;
  const elapsed = (Date.now() - new Date(monster.last_updated_at || Date.now()).getTime()) / 3600000;
  if (!Number.isFinite(elapsed) || elapsed < 1 / 12) return monster;
  const hours = Math.min(720, Math.max(0, elapsed));
  const prevAge = Number(monster.age_days) || 0;
  const age = prevAge + hours / 24;
  const fullness = Math.max(0, (Number(monster.fullness) || 0) - hours * (monster.life_stage >= 4 ? 4 : 2));
  const cleanliness = Math.max(0, Math.round((Number(monster.cleanliness) || 0) - hours * 4));
  let stage = Number(monster.life_stage) || 1;
  if (stage === 0) stage = 1;
  if (stage === 1 && age >= 0.05) stage = 2;
  if (stage === 2 && age >= 1) stage = 3;
  if (stage === 3 && age >= 3) stage = 4;
  if (stage === 4 && age >= 7) stage = 5;
  let type = monster.type;
  if (stage >= 3 && !type) type = 1 + Math.floor(Math.random() * 3);
  const isSick = Boolean(monster.is_sick) || (cleanliness < 30 && Math.random() < 0.04);
  // Avoid constantly compounding age-related stat decay on every refresh.
  const daysOfDecay = Math.max(0, Math.floor(age - 30)) - Math.max(0, Math.floor(prevAge - 30));
  const decay = Math.pow(0.99, daysOfDecay);
  const patch = {
    age_days: age, fullness, cleanliness, life_stage: stage, type, is_sick: isSick,
    last_updated_at: new Date().toISOString()
  };
  if (daysOfDecay > 0) {
    patch.combat_atk = (monster.combat_atk || 1) * decay;
    patch.combat_def = (monster.combat_def || 1) * decay;
    patch.combat_spd = (monster.combat_spd || 1) * decay;
  }
  const { error } = await supabase.from('monsters').update(patch)
    .eq('monster_id', monster.monster_id).eq('user_id', uid);
  throwIfError(error);
  return { ...monster, ...patch };
};

export const api = {
  register: async (username, email, password) => {
    const trimmed = username.trim();
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(trimmed)) throw new Error('帳號需為 3–24 位英數字或底線');
    const finalEmail = email?.trim() || usernameEmail(trimmed);
    const { data, error } = await supabase.auth.signUp({
      email: finalEmail, password, options: { data: { username: trimmed } }
    });
    throwIfError(error);
    if (data.session) {
      const result = await supabase.rpc('game_ensure_profile');
      throwIfError(result.error);
    }
    return { user: data.user };
  },
  login: async (usernameOrEmail, password) => {
    const input = usernameOrEmail.trim();
    const email = input.includes('@') ? input : usernameEmail(input);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    throwIfError(error);
    return { user: data.user };
  },
  logout: async () => {
    const { error } = await supabase.auth.signOut();
    throwIfError(error);
  },
  getMe: async () => {
    const { data, error } = await supabase.rpc('game_ensure_profile');
    throwIfError(error);
    return data;
  },
  getMonsters: async () => {
    const uid = await getUid();
    const { data, error } = await supabase.from('monsters').select('*').eq('user_id', uid);
    throwIfError(error);
    const result = await Promise.all((data ?? []).map(m => updateAging(m, uid)));
    return result.sort((a,b) => Number(a.is_dead)-Number(b.is_dead) || b.life_stage-a.life_stage);
  },
  hatchEgg: () => action('hatch'),
  feed: (monster_id, item_id) => action('feed', { monster_id, item_id }),
  clean: monster_id => action('clean', { monster_id }),
  heal: (monster_id, item_id = 'medicine_standard') => action('heal', { monster_id, item_id }),
  train: monster_id => action('train', { monster_id }),
  evolve: monster_id => action('evolve', { monster_id }),
  release: monster_id => action('release', { monster_id }),
  toggleLock: monster_id => action('lock', { monster_id }),
  equipChip: (monster_id, item_id, slot) => action('equip', { monster_id, item_id, slot }),
  unequipChip: (monster_id, slot) => action('unequip', { monster_id, slot }),
  breed: (parent1, parent2, useCatalyst=false) => action('breed', { parent1, parent2, useCatalyst }),
  getInventory: async () => {
    const uid = await getUid();
    const { data, error } = await supabase.from('user_inventory').select('*').eq('user_id', uid).order('item_id');
    throwIfError(error);
    return data ?? [];
  },
  buyItem: (item_id, quantity=1) => action('buy', { item_id, quantity }),
  rename: async (monster_id, name) => {
    const uid = await getUid();
    const trimmed = name.trim().slice(0, 30);
    if (!trimmed) throw new Error('請輸入怪獸名稱');
    const { data, error } = await supabase.from('monsters')
      .update({ name: trimmed }).eq('monster_id', monster_id).eq('user_id', uid)
      .select('monster_id').maybeSingle();
    throwIfError(error);
    if (!data) throw new Error('無法修改其他玩家的怪獸');
    return { message: '怪獸名稱已更新' };
  },
  trackQuestProgress: async () => {
    // Counts are updated atomically together with the corresponding game action.
  },
  getDailyQuests: async () => {
    const uid = await getUid();
    const { data, error } = await supabase.from('daily_quests').select('*')
      .eq('quest_id', getQuestId(uid)).maybeSingle();
    throwIfError(error);
    return data ?? { feed_count:0, clean_count:0, train_count:0, battle_count:0, claimed:[] };
  },
  claimQuest: quest_id => action('claim', { quest_id }),
  recordBattleResult: (monster_id, battleId, won) => action('battle', { monster_id, battleId, won }),
  getGuilds: async () => {
    const uid = await getUid();
    const [guildResult, memberResult] = await Promise.all([
      supabase.from('guilds').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('guild_members').select('*,guilds(*)').eq('user_id', uid).maybeSingle()
    ]);
    throwIfError(guildResult.error);throwIfError(memberResult.error);
    const guilds = guildResult.data ?? [];
    const leaderIds = [...new Set(guilds.map(g => g.leader_id).filter(Boolean))];
    let usernames = {};
    if (leaderIds.length) {
      const { data, error } = await supabase.from('users').select('user_id,username').in('user_id', leaderIds);
      throwIfError(error);
      usernames = Object.fromEntries((data ?? []).map(u => [u.user_id,u.username]));
    }
    const membership = memberResult.data;
    const myGuild = membership?.guilds ? { ...membership.guilds,
      role: membership.role, contribution: membership.contribution } : null;
    return { guilds: guilds.map(g=>({...g,leader_name:usernames[g.leader_id]||'會長'})), myGuild };
  },
  createGuild: name => action('guild_create', { name }),
  joinGuild: guild_id => action('guild_join', { guild_id }),
  leaveGuild: () => action('guild_leave'),
  donateGuild: amount => action('guild_donate', { amount }),
  buyGuildShop: item_id => action('guild_buy', { item_id }),
  getRaidStatus: async () => {
    const { data, error } = await supabase.from('raid_boss').select('*')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    throwIfError(error);
    return data ?? { name:'數碼世界王',current_hp:0,max_hp:500000,is_active:false };
  },
  attackRaidBoss: monster_id => action('raid', { monster_id }),
  searchPlayers: async typeFilter => {
    let q = supabase.from('monsters')
      .select('user_id,monster_id,custom_name:name,name,family,type,life_stage,is_dead')
      .eq('is_dead',false).limit(100);
    if (typeFilter) q = q.eq('type',Number(typeFilter));
    const { data, error } = await q;
    throwIfError(error);
    const grouped = new Map();
    (data ?? []).forEach(m => {
      if (!m.user_id) return;
      if (!grouped.has(m.user_id)) grouped.set(m.user_id,{user_id:m.user_id,username:'玩家',monsters:[]});
      const group = grouped.get(m.user_id);
      if(group.monsters.length<3) group.monsters.push(m);
    });
    if (grouped.size) {
      const {data:users,error:ue} = await supabase.from('users').select('user_id,username')
        .in('user_id',[...grouped.keys()]);
      throwIfError(ue);
      (users??[]).forEach(u=>{const p=grouped.get(u.user_id);if(p)p.username=u.username;});
    }
    return [...grouped.values()].slice(0,30);
  },
  getFriends: async () => {
    const uid = await getUid();
    const { data, error } = await supabase.from('friends').select('*')
      .eq('user_id',uid).eq('status',1);
    throwIfError(error);
    return (data??[]).map(f=>({...f,friend_id:f.friend_uid,friend_name:f.friend_name||'好友'}));
  },
  addFriend: async target => {
    const uid = await getUid();
    const name = target.trim();
    if (!name) throw new Error('請輸入好友 UUID 或使用者名稱');
    let lookup = supabase.from('users').select('user_id,username');
    lookup = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(name) ?
      lookup.eq('user_id',name) : lookup.eq('username',name);
    const {data:peer,error} = await lookup.maybeSingle();
    throwIfError(error);
    if(!peer) throw new Error('找不到該玩家');
    if(peer.user_id===uid) throw new Error('不能加自己');
    const {error:insertError} = await supabase.from('friends')
      .upsert({user_id:uid,friend_uid:peer.user_id,friend_name:peer.username,status:1},
        {onConflict:'user_id,friend_uid',ignoreDuplicates:true});
    throwIfError(insertError);
    return { message: '已加入好友' };
  },
  giftStamina: friend_id => action('gift', { friend_id }),
  sendMessage: (channel,text) => {
    if(channel!=='world') throw new Error('不支援的頻道');
    return action('chat', {text});
  },
  subscribeMessages: (channel,callback) => {
    let disposed=false;
    const load=async()=>{
      try {
        const {data,error}=await supabase.from('messages').select('message_id,channel,user_id,username,text,timestamp')
          .eq('channel',channel).order('timestamp',{ascending:false}).limit(50);
        throwIfError(error);
        if(!disposed) callback((data??[]).reverse().map(m=>({...m,id:m.message_id})));
      } catch(e){if(!disposed)console.warn('Chat read error:',e.message);}
    };
    load();
    const realtime=supabase.channel(`game-messages-${channel}-${Math.random()}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},load).subscribe();
    // Polling fallback in case Realtime publication doesn't include this table.
    const interval=setInterval(load,12000);
    return ()=>{disposed=true;clearInterval(interval);supabase.removeChannel(realtime);};
  }
};
