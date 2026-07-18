import { supabase } from '../supabaseClient';


export const getUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
};

export const usernameToEmail = (username) => `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@monsterarena.app`;

// Returns the primary key column name for a given table
export const getPK = (table) => {
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
export const doc = (_, table, id) => {
  if (!table || typeof table !== 'string') throw new Error(`Invalid table name: "${table}"`);
  return { table, id, pk: getPK(table) };
};

// collection(table) → { table }
export const collection = (_, table) => {
  if (!table || typeof table !== 'string') throw new Error(`Invalid table name: "${table}"`);
  return { table };
};

export const getDoc = async (ref) => {
  const { data } = await supabase.from(ref.table).select('*').eq(ref.pk, ref.id).single();
  return { exists: () => !!data, data: () => data || {}, ref };
};

export const updateDoc = async (ref, data) => {
  const { error } = await supabase.from(ref.table).update(data).eq(ref.pk, ref.id);
  if (error) throw new Error(`[updateDoc ${ref.table}] ${error.message}`);
};

export const setDoc = async (ref, data) => {
  if (ref.table === 'users') {
    const { error } = await supabase.from(ref.table).upsert(data, { onConflict: 'user_id' });
    if (error) throw new Error(`[setDoc upsert ${ref.table}] ${error.message}`);
    return;
  }
  const { error } = await supabase.from(ref.table).insert(data);
  if (error) throw new Error(`[setDoc insert ${ref.table}] ${error.message}`);
};

export const deleteDoc = async (ref) => {
  const { error } = await supabase.from(ref.table).delete().eq(ref.pk, ref.id);
  if (error) throw new Error(`[deleteDoc ${ref.table}] ${error.message}`);
};

export const query = (coll, ...filters) => ({ table: coll.table, filters });
export const where = (field, op, val) => ({ field, op, val });
export const limit = (l) => ({ type: 'limit', val: l });
export const orderBy = (f, d) => ({ type: 'orderBy', field: f, dir: d });

export const getDocs = async (q) => {
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
export const makeTransaction = () => ({
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
export const insertAndGetId = async (table, data) => {
  const pk = getPK(table);
  const { data: rows, error } = await supabase.from(table).insert(data).select(pk);
  if (error) throw new Error(`[insertAndGetId ${table}] ${error.message}`);
  return rows[0][pk];
};


export { supabase };
