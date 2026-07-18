import { getUserId, usernameToEmail, getPK, doc, collection, getDoc, updateDoc, setDoc, deleteDoc, query, where, limit, orderBy, getDocs, makeTransaction, insertAndGetId, supabase } from './core';

export const authApi = {

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
        stamina: 500,
        max_stamina: 500,
        last_login_at: new Date().toISOString(),
        stamina_updated_at: new Date().toISOString(),
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

    // Stamina Recovery Logic
    const maxStamina = data.max_stamina || 500;
    const currentStamina = data.stamina ?? maxStamina;
    
    if (currentStamina < maxStamina) {
      const lastUpdate = data.stamina_updated_at ? new Date(data.stamina_updated_at).getTime() : now.getTime();
      const timeDiff = now.getTime() - lastUpdate;
      const recovered = Math.floor(timeDiff / (5 * 60 * 1000));
      
      if (recovered > 0) {
        const newStamina = Math.min(maxStamina, currentStamina + recovered);
        const remainder = timeDiff % (5 * 60 * 1000);
        const newUpdateAt = new Date(now.getTime() - remainder).toISOString();
        await updateDoc(userRef, { stamina: newStamina, stamina_updated_at: newUpdateAt });
        data.stamina = newStamina;
        data.stamina_updated_at = newUpdateAt;
      }
    } else if (currentStamina > maxStamina) {
       // Just in case it glitches above max somehow
       await updateDoc(userRef, { stamina: maxStamina, stamina_updated_at: now.toISOString() });
       data.stamina = maxStamina;
       data.stamina_updated_at = now.toISOString();
    } else {
       // If perfectly full, we don't necessarily need to save to DB, but keep data updated in memory
       data.stamina_updated_at = now.toISOString();
    }

    return data;
  },

  
};
