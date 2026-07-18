import { getUserId, usernameToEmail, getPK, doc, collection, getDoc, updateDoc, setDoc, deleteDoc, query, where, limit, orderBy, getDocs, makeTransaction, insertAndGetId, supabase } from './core';

export const guildApi = {

  getGuilds: async () => {
    const uid = await getUserId();
    const guildsSnap = await getDocs(collection(null, 'guilds'));
    const guilds = guildsSnap.docs.map(g => ({ guild_id: g.id, ...g.data() }));

    // Fetch leader names
    for (let g of guilds) {
      if (g.leader_id) {
        const uSnap = await getDocs(query(collection(null, 'users'), where('user_id', '==', g.leader_id)));
        if (!uSnap.empty) {
          g.leader_name = uSnap.docs[0].data().username || '未知會長';
        } else {
          g.leader_name = '未知會長';
        }
      }
    }

    const memberQ = query(collection(null, 'guild_members'), where('user_id', '==', uid));
    const memberSnap = await getDocs(memberQ);
    let myGuild = null;
    if (!memberSnap.empty) {
      const memberData = memberSnap.docs[0].data();
      const gObj = guilds.find(g => g.guild_id === memberData.guild_id);
      if (gObj) myGuild = { ...gObj, ...memberData };
    }
    return { guilds, myGuild };
  },

  createGuild: async (guild_name) => {
    const uid = await getUserId();
    const guildId = await insertAndGetId('guilds', {
      guild_name,
      leader_id: uid,
      level: 1,
      created_at: new Date().toISOString(),
    });
    await insertAndGetId('guild_members', {
      guild_id: guildId,
      user_id: uid,
      role: 1, // 會長
      contribution: 0,
    });
    return { message: '創建公會成功！' };
  },

  joinGuild: async (guild_id) => {
    const uid = await getUserId();
    await insertAndGetId('guild_members', { guild_id, user_id: uid, role: 0, contribution: 0 });
    return { message: '成功加入公會！' };
  },

  leaveGuild: async () => {
    const uid = await getUserId();
    const memberQ = query(collection(null, 'guild_members'), where('user_id', '==', uid));
    const memberSnap = await getDocs(memberQ);
    if (!memberSnap.empty) {
      const gId = memberSnap.docs[0].data().guild_id;
      await deleteDoc(memberSnap.docs[0].ref);
      
      const remainSnap = await getDocs(query(collection(null, 'guild_members'), where('guild_id', '==', gId)));
      if (remainSnap.empty) {
        await deleteDoc(doc(null, 'guilds', gId));
      }
    }
    return { message: '離開公會' };
  },

  donateGuild: async (amount) => {
    const uid = await getUserId();
    const userRef = doc(null, 'users', uid);
    const memberQ = query(collection(null, 'guild_members'), where('user_id', '==', uid));
    const memberSnap = await getDocs(memberQ);
    if (memberSnap.empty) throw new Error('你沒有加入任何公會！');
    const memberRef = memberSnap.docs[0].ref;
    const guildId = memberSnap.docs[0].data().guild_id;

    const t = makeTransaction();
    const uDoc = await t.get(userRef);
    if (uDoc.data().gold < amount) throw new Error('金幣不足！');
    await t.update(userRef, { gold: uDoc.data().gold - amount });
    const mDoc = await t.get(memberRef);
    await t.update(memberRef, { contribution: (mDoc.data().contribution || 0) + amount });

    // Also update guild total_contribution
    const guildRef = doc(null, 'guilds', guildId);
    const gDoc = await t.get(guildRef);
    await t.update(guildRef, { total_contribution: (gDoc.data().total_contribution || 0) + amount });

    return { message: `成功捐獻 ${amount} 金幣！獲得 ${amount} 點公會貢獻。` };
  },

  buyGuildShop: async (item_id) => {
    const uid = await getUserId();
    const memberQ = query(collection(null, 'guild_members'), where('user_id', '==', uid));
    const memberSnap = await getDocs(memberQ);
    if (memberSnap.empty) throw new Error('你沒有加入任何公會！');
    const memberRef = memberSnap.docs[0].ref;

    const PRICES = {
      chip_atk: 200, chip_def: 200, chip_spd: 200, chip_hp: 200,
      chip_extractor: 300, breed_catalyst: 150, ultimate_core: 500,
    };
    const cost = PRICES[item_id];
    if (cost === undefined) throw new Error('未知商品！');

    const t = makeTransaction();
    const mDoc = await t.get(memberRef);
    if ((mDoc.data().contribution || 0) < cost) throw new Error('公會貢獻點數不足！');
    await t.update(memberRef, { contribution: mDoc.data().contribution - cost });

    const invQ = query(collection(null, 'user_inventory'), where('user_id', '==', uid), where('item_id', '==', item_id));
    const invSnap = await getDocs(invQ);
    if (invSnap.empty) {
      let type = 6; // chips
      if (item_id === 'chip_extractor') type = 4;
      if (item_id === 'breed_catalyst') type = 3;
      if (item_id === 'ultimate_core') type = 5;
      await insertAndGetId('user_inventory', { user_id: uid, item_id, item_type: type, quantity: 1 });
    } else {
      const invDoc = invSnap.docs[0];
      await t.update(invDoc.ref, { quantity: invDoc.data().quantity + 1 });
    }

    const ITEM_NAMES = {
      chip_atk: '攻擊晶片', chip_def: '防禦晶片', chip_spd: '速度晶片', chip_hp: '生命晶片',
      chip_extractor: '晶片提取器', breed_catalyst: '繁衍催化劑', ultimate_core: '究極進化核心',
    };
    return { message: `成功兌換 ${ITEM_NAMES[item_id] || item_id}！消耗 ${cost} 貢獻。` };
  },

  disbandGuild: async () => {
    const uid = await getUserId();
    const memberQ = query(collection(null, 'guild_members'), where('user_id', '==', uid));
    const memberSnap = await getDocs(memberQ);
    if (memberSnap.empty) throw new Error('你沒有加入任何公會！');
    if (memberSnap.docs[0].data().role !== 1) throw new Error('只有會長可以解散公會！');
    
    const guildId = memberSnap.docs[0].data().guild_id;
    await deleteDoc(doc(null, 'guilds', guildId));
    
    // Delete all members
    const allMembersSnap = await getDocs(query(collection(null, 'guild_members'), where('guild_id', '==', guildId)));
    for (let d of allMembersSnap.docs) {
      await deleteDoc(d.ref);
    }
    return { message: '公會已解散' };
  },

  getGuildMembers: async (guild_id) => {
    const snap = await getDocs(query(collection(null, 'guild_members'), where('guild_id', '==', guild_id)));
    const members = [];
    for (let d of snap.docs) {
      const data = d.data();
      const uSnap = await getDocs(query(collection(null, 'users'), where('user_id', '==', data.user_id)));
      let username = '未知玩家';
      if (!uSnap.empty) username = uSnap.docs[0].data().username || '未知玩家';
      members.push({ id: data.user_id, username, role: data.role, contribution: data.contribution });
    }
    return members.sort((a, b) => (b.role - a.role) || (b.contribution - a.contribution));
  },

  getGuildApplications: async (guild_id) => {
    const snap = await getDocs(query(collection(null, 'guild_members'), where('guild_id', '==', guild_id), where('role', '==', 0)));
    const apps = [];
    for (let d of snap.docs) {
      const data = d.data();
      const uSnap = await getDocs(query(collection(null, 'users'), where('user_id', '==', data.user_id)));
      let username = '未知玩家';
      if (!uSnap.empty) username = uSnap.docs[0].data().username || '未知玩家';
      apps.push({ id: data.user_id, username });
    }
    return apps;
  },

  setGuildRole: async (target_id, role) => {
    const uid = await getUserId();
    const memberQ = query(collection(null, 'guild_members'), where('user_id', '==', uid));
    const memberSnap = await getDocs(memberQ);
    if (memberSnap.empty || memberSnap.docs[0].data().role !== 1) throw new Error('沒有權限！');
    const guildId = memberSnap.docs[0].data().guild_id;

    const tSnap = await getDocs(query(collection(null, 'guild_members'), where('user_id', '==', target_id), where('guild_id', '==', guildId)));
    if (tSnap.empty) throw new Error('目標不是公會成員！');
    await updateDoc(tSnap.docs[0].ref, { role });
    return { message: '職位已更新' };
  },

  kickMember: async (target_id) => {
    const uid = await getUserId();
    const memberQ = query(collection(null, 'guild_members'), where('user_id', '==', uid));
    const memberSnap = await getDocs(memberQ);
    if (memberSnap.empty || memberSnap.docs[0].data().role < 1) throw new Error('沒有權限！');
    const guildId = memberSnap.docs[0].data().guild_id;

    const tSnap = await getDocs(query(collection(null, 'guild_members'), where('user_id', '==', target_id), where('guild_id', '==', guildId)));
    if (tSnap.empty) throw new Error('目標不是公會成員！');
    await deleteDoc(tSnap.docs[0].ref);
    return { message: '已踢除成員' };
  },

  reviewApplication: async (target_id, is_approved) => {
    const uid = await getUserId();
    const memberQ = query(collection(null, 'guild_members'), where('user_id', '==', uid));
    const memberSnap = await getDocs(memberQ);
    if (memberSnap.empty || memberSnap.docs[0].data().role < 1) throw new Error('沒有權限！');
    const guildId = memberSnap.docs[0].data().guild_id;

    const tSnap = await getDocs(query(collection(null, 'guild_members'), where('user_id', '==', target_id), where('guild_id', '==', guildId)));
    if (tSnap.empty) throw new Error('申請不存在！');
    
    if (is_approved) {
      await updateDoc(tSnap.docs[0].ref, { role: 3 }); // 3 is normal member
      return { message: '已批准加入' };
    } else {
      await deleteDoc(tSnap.docs[0].ref);
      return { message: '已拒絕加入' };
    }
  },

  upgradeGuild: async () => {
    const uid = await getUserId();
    const memberQ = query(collection(null, 'guild_members'), where('user_id', '==', uid));
    const memberSnap = await getDocs(memberQ);
    if (memberSnap.empty || memberSnap.docs[0].data().role !== 1) throw new Error('沒有權限！');
    
    const guildId = memberSnap.docs[0].data().guild_id;
    const gSnap = await getDocs(query(collection(null, 'guilds')));
    const gDoc = gSnap.docs.find(d => d.id === guildId);
    if (!gDoc) throw new Error('找不到公會');
    
    const level = gDoc.data().level || 1;
    if (level >= 5) throw new Error('公會已達最高等級');
    
    const totalCont = gDoc.data().total_contribution || 0;
    const upgradeCost = level * 1000;
    if (totalCont < upgradeCost) throw new Error(`總貢獻不足！需要 ${upgradeCost} 點`);
    
    await updateDoc(gDoc.ref, { level: level + 1, total_contribution: totalCont - upgradeCost });
    return { message: '公會升級成功！' };
  },


  
};
