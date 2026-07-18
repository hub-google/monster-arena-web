import { getUserId, usernameToEmail, getPK, doc, collection, getDoc, updateDoc, setDoc, deleteDoc, query, where, limit, orderBy, getDocs, makeTransaction, insertAndGetId, supabase } from './core';

export const questsApi = {

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

  
};
