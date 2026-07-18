import { getUserId, usernameToEmail, getPK, doc, collection, getDoc, updateDoc, setDoc, deleteDoc, query, where, limit, orderBy, getDocs, makeTransaction, insertAndGetId, supabase } from './core';

export const friendsApi = {

  addFriend: async (targetUUID) => {
    const uid = await getUserId();
    if (!targetUUID || targetUUID.trim() === '') throw new Error('UUID 不能為空！');
    if (uid === targetUUID) throw new Error('不能加自己為好友！');

    const targetSnap = await getDoc(doc(null, 'users', targetUUID));
    if (!targetSnap.exists()) throw new Error('找不到該 UUID 的玩家！');

    // Prevent duplicate
    const { data: existing } = await supabase
      .from('friends')
      .select('friend_record_id')
      .or(`and(user_id.eq.${uid},friend_uid.eq.${targetUUID}),and(user_id.eq.${targetUUID},friend_uid.eq.${uid})`);
      
    if (existing && existing.length > 0) throw new Error('已經是好友或申請中！');

    const { error } = await supabase.from('friends').insert({
      user_id: uid,
      friend_uid: targetUUID,
      status: 0,
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    return { message: `已發送好友申請給 ${targetSnap.data().username}！等待對方同意。` };
  },

  getFriends: async () => {
    const uid = await getUserId();
    const { data: rows, error } = await supabase
      .from('friends')
      .select('*')
      .or(`user_id.eq.${uid},friend_uid.eq.${uid}`);
    if (error) throw new Error(error.message);

    if (!rows || rows.length === 0) return [];

    const userIds = rows.map(r => r.user_id === uid ? r.friend_uid : r.user_id);
    const { data: usersData } = await supabase.from('users').select('user_id, username').in('user_id', userIds);
    const userMap = {};
    if (usersData) {
       usersData.forEach(u => userMap[u.user_id] = u.username);
    }

    return rows.map(row => {
      const isSender = row.user_id === uid;
      const targetId = isSender ? row.friend_uid : row.user_id;
      return {
        friend_id: targetId,
        friend_username: userMap[targetId] || '未知玩家',
        status: row.status || 0, 
        is_request: !isSender && (row.status || 0) === 0,
      };
    });
  },

  acceptFriend: async (targetId) => {
    const uid = await getUserId();
    const { data, error: findErr } = await supabase
      .from('friends')
      .select('*')
      .eq('user_id', targetId)
      .eq('friend_uid', uid)
      .single();
      
    if (findErr || !data) throw new Error('找不到該好友申請！');
    
    const { error } = await supabase
      .from('friends')
      .update({ status: 1 })
      .eq('friend_record_id', data.friend_record_id);
      
    if (error) throw new Error(error.message);
    return { message: '已同意好友申請！' };
  },

  deleteFriend: async (targetId) => {
    const uid = await getUserId();
    const { error } = await supabase
      .from('friends')
      .delete()
      .or(`and(user_id.eq.${uid},friend_uid.eq.${targetId}),and(user_id.eq.${targetId},friend_uid.eq.${uid})`);
      
    if (error) throw new Error(error.message);
    return { message: '已刪除好友/拒絕申請！' };
  },

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
    const friendStamina = fDoc.data().stamina || 0;
    const maxStamina = fDoc.data().max_stamina || 500;
    await updateDoc(friendRef, { stamina: Math.min(maxStamina, friendStamina + 20) });

    await supabase.from('gifts').insert({ sender: uid, receiver: friendId, date: today });

    return { message: '已成功贈送 20 點體力給好友！' };
  },

  
};
