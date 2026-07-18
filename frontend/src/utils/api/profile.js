import { getUserId, usernameToEmail, getPK, doc, collection, getDoc, updateDoc, setDoc, deleteDoc, query, where, limit, orderBy, getDocs, makeTransaction, insertAndGetId, supabase } from './core';

export const profileApi = {

  updateNickname: async (newNickname) => {
    if (!newNickname || newNickname.trim().length === 0) throw new Error('暱稱不能為空！');
    if (newNickname.trim().length > 16) throw new Error('暱稱最多 16 字！');
    const uid = await getUserId();
    const userRef = doc(null, 'users', uid);
    await updateDoc(userRef, { username: newNickname.trim() });
    return { message: `暱稱已更新為「${newNickname.trim()}」！` };
  },

};
