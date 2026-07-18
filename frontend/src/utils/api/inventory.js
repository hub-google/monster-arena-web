import { getUserId, usernameToEmail, getPK, doc, collection, getDoc, updateDoc, setDoc, deleteDoc, query, where, limit, orderBy, getDocs, makeTransaction, insertAndGetId, supabase } from './core';

export const inventoryApi = {

  getInventory: async () => {
    const uid = await getUserId();
    const q = query(collection(null, 'user_inventory'), where('user_id', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ inventory_id: d.id, ...d.data() }));
  },

  buyItem: async (item_id, quantity = 1) => {
    const uid = await getUserId();
    const userRef = doc(null, 'users', uid);

    const PRICES = {
      meat_basic: 10,
      meat_premium: 50,
      energy_drink: 100,
      medicine_standard: 200,
      vitamin: 50,
      breed_catalyst: 500,
      ultimate_core: 1000,
      expired_milk: 5,
      sleeping_pill: 150,
      alarm_clock: 150,
    };

    const cost = (PRICES[item_id] || 9999) * quantity;

    const t = makeTransaction();
    const uDoc = await t.get(userRef);
    if (uDoc.data().gold < cost) throw new Error('金幣不足！');
    await t.update(userRef, { gold: uDoc.data().gold - cost });

    const invQ = query(collection(null, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', item_id));
    const invSnap = await getDocs(invQ);
    if (invSnap.empty) {
      let type = 1;
      if (item_id.includes('medicine') || item_id === 'vitamin') type = 2;
      if (item_id === 'breed_catalyst') type = 3;
      if (item_id === 'chip_extractor') type = 4;
      if (item_id === 'ultimate_core') type = 5;
      await insertAndGetId('user_inventory', { user_id: uid, item_id, item_type: type, quantity });
    } else {
      const invDoc = invSnap.docs[0];
      await t.update(invDoc.ref, { quantity: invDoc.data().quantity + quantity });
    }

    const ITEM_NAMES = {
      meat_basic: '普通肉塊', meat_premium: '頂級霜降肉', energy_drink: '能量飲料',
      medicine_standard: '標準特效藥', vitamin: '綜合維他命', breed_catalyst: '繁衍催化劑',
      ultimate_core: '究極進化核心', expired_milk: '過期牛奶', sleeping_pill: '安眠藥',
      alarm_clock: '鬧鐘'
    };
    const itemName = ITEM_NAMES[item_id] || item_id;

    return { message: `成功花費 ${cost}G 購買 ${itemName} x${quantity}！` };
  },

  
};
