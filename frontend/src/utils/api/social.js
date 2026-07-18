import { getUserId, usernameToEmail, getPK, doc, collection, getDoc, updateDoc, setDoc, deleteDoc, query, where, limit, orderBy, getDocs, makeTransaction, insertAndGetId, supabase } from './core';

export const socialApi = {

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

  getUserProfile: async (userId) => {
    const { data: uData, error } = await supabase.from('users').select('*').eq('user_id', userId).single();
    if (error) return null;
    const { data: mData } = await supabase.from('monsters').select('*').eq('user_id', userId).eq('is_active', true);
    return {
       ...uData,
       monsters: mData || []
    };
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
        
      if (!isCancelled) {
        if (data && data.length > 0) {
          const userIds = [...new Set(data.map(m => m.user_id))];
          const { data: usersData } = await supabase.from('users').select('user_id, username').in('user_id', userIds);
          const userMap = {};
          if (usersData) {
             usersData.forEach(u => userMap[u.user_id] = u.username);
          }
          const enriched = data.map(m => ({
             ...m,
             username: userMap[m.user_id] || m.username || 'Unknown'
          }));
          callback(enriched.reverse());
        } else {
          callback([]);
        }
      }
    };

    fetchMessages();
    const timer = setInterval(fetchMessages, 5000);
    return () => { isCancelled = true; clearInterval(timer); };
  },

  
};
