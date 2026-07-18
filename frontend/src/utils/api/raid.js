import { getUserId, usernameToEmail, getPK, doc, collection, getDoc, updateDoc, setDoc, deleteDoc, query, where, limit, orderBy, getDocs, makeTransaction, insertAndGetId, supabase } from './core';

export const raidApi = {

  getRaidStatus: async () => {
    // Use a fixed row in guilds table or just return a static mock if sys_config doesn't exist
    const { data, error } = await supabase
      .from('raid_boss')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return { name: '啟示錄獸', current_hp: 500000, max_hp: 500000, is_active: true };
    }
    return data;
  },

  getFriendMonsters: async (friendId) => {
    const q = query(collection(null, 'monsters'), where('user_id', '==', friendId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => ({ monster_id: d.id, ...d.data() }));
  },

  resolveBattle: async (monsterId, isWin) => {
    try {
      const uid = await getUserId();
      if (!monsterId) throw new Error('無法結算：缺少怪獸 ID');
      const monRef = doc(null, 'monsters', monsterId);
      const mSnap = await getDoc(monRef);
      if (!mSnap.exists() || mSnap.data().user_id !== uid) throw new Error('無法結算：找不到怪獸或非本人擁有');

      const m = mSnap.data();
      const newBattles = (m.battles || 0) + 1;
      const newWins = (m.wins || 0) + (isWin ? 1 : 0);

      await updateDoc(monRef, { battles: newBattles, wins: newWins });

      let message = isWin ? '🏆 戰鬥勝利！' : '💀 戰鬥落敗。';
      if (isWin) {
        const userRef = doc(null, 'users', uid);
        const uSnap = await getDoc(userRef);
        const rewardGold = 15 + Math.floor(Math.random() * 20);
        await updateDoc(userRef, { gold: (Number(uSnap.data().gold) || 0) + rewardGold });
        message += ` 獲得 ${rewardGold} 金幣！`;
      }

      return { success: true, message };
    } catch (e) {
      throw new Error(`結算失敗: ${e.message}`);
    }
  },

  attackRaidBoss: async (monsterId, damage) => {
    const uid = await getUserId();
    const userRef = doc(null, 'users', uid);

    const uSnap = await getDoc(userRef);
    const currentStamina = uSnap.data().stamina || 0;
    const maxStamina = uSnap.data().max_stamina || 500;
    if (currentStamina < 15) throw new Error('體力不足');
    
    const updateData = { stamina: currentStamina - 15 };
    if (currentStamina >= maxStamina) {
      updateData.stamina_updated_at = new Date().toISOString();
    }
    await updateDoc(userRef, updateData);

    const { data: boss, error } = await supabase
      .from('raid_boss')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Auto-spawn a new raid boss if none exists or current is defeated
    if (error || !boss || !boss.is_active) {
      const { data: newBoss, error: spawnErr } = await supabase
        .from('raid_boss')
        .insert({ name: '啟示錄獸', current_hp: 500000, max_hp: 500000, is_active: true, created_at: new Date().toISOString() })
        .select()
        .single();
      if (spawnErr) throw new Error('世界王重生失敗，請稍後再試！');
      const newHp = Math.max(0, 500000 - damage);
      const isActive = newHp > 0;
      await supabase.from('raid_boss').update({ current_hp: newHp, is_active: isActive }).eq('id', newBoss.id);
      return { message: `世界王重生！⚡ 造成 ${damage} 點傷害！`, hp: newHp, maxHp: 500000 };
    }

    const newHp = Math.max(0, (boss.current_hp || 0) - damage);
    const isActive = newHp > 0;
    await supabase.from('raid_boss').update({ current_hp: newHp, is_active: isActive }).eq('id', boss.id);

    let message = isActive ? '持續激戰中！' : '世界王已被擊退！獲得豐厚獎勵！';
    if (!isActive) {
      await updateDoc(userRef, { gold: (uSnap.data().gold || 0) + 5000 });
      // Auto-spawn next boss
      await supabase.from('raid_boss').insert({
        name: '啟示錄獸', current_hp: 500000, max_hp: 500000,
        is_active: true, created_at: new Date().toISOString(),
      });
      message += ' 新的世界王已出現！';
    }
    return { message, hp: newHp, maxHp: boss.max_hp || 500000 };
  },

  matchmakeMock: async (mode, level) => {
    // Generate a mock monster for PVE battles
    const baseStats = level * 100;
    return [{
      monster_id: 'mock_wild_' + Date.now(),
      name: `野生病毒怪獸 LV${level}`,
      life_stage: level,
      combat_hp: baseStats * 2,
      combat_atk: baseStats,
      combat_def: baseStats * 0.8,
      combat_spd: baseStats,
      gene_hp: baseStats * 2,
      gene_atk: baseStats,
      gene_def: baseStats * 0.8,
      gene_spd: baseStats,
      is_dead: false,
    }];
  },

  
};
