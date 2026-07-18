import { getUserId, usernameToEmail, getPK, doc, collection, getDoc, updateDoc, setDoc, deleteDoc, query, where, limit, orderBy, getDocs, makeTransaction, insertAndGetId, supabase } from './core';

export const pvpApi = {

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

  
};
