import React, { useState } from 'react';
import { api } from '../utils/api';

const STAGE_NAMES = ['蛋', '蛋', '幼年期', '成長期', '成熟期', '完全體', '究極體'];

export default function Roster({ 
  user, 
  monsters, 
  inventory, 
  friends = [],
  refreshData, 
  activeMonster, 
  setActiveMonster, 
  setPage 
}) {
  const [selectedMonsterId, setSelectedMonsterId] = useState(activeMonster?.monster_id || monsters[0]?.monster_id);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Tab within roster: 'list', 'chips', 'breed', 'shop'
  const [subTab, setSubTab] = useState('list');

  // Breeding selections
  const [parent1Source, setParent1Source] = useState('mine');
  const [parent1FriendId, setParent1FriendId] = useState('');
  const [parent1FriendMonsters, setParent1FriendMonsters] = useState([]);
  const [parent1, setParent1] = useState('');

  const [parent2Source, setParent2Source] = useState('mine');
  const [parent2FriendId, setParent2FriendId] = useState('');
  const [parent2FriendMonsters, setParent2FriendMonsters] = useState([]);
  const [parent2, setParent2] = useState('');

  const [useCatalyst, setUseCatalyst] = useState(false);

  const fetchFriendMonsters1 = async (fid) => {
    setParent1FriendId(fid);
    setParent1('');
    if (fid) {
      try {
        const fMonsters = await api.getFriendMonsters(fid);
        setParent1FriendMonsters(fMonsters.filter(m => m.life_stage >= 3));
      } catch (err) { setMessage(`❌ 獲取好友怪獸失敗: ${err.message}`); }
    } else {
      setParent1FriendMonsters([]);
    }
  };

  const fetchFriendMonsters2 = async (fid) => {
    setParent2FriendId(fid);
    setParent2('');
    if (fid) {
      try {
        const fMonsters = await api.getFriendMonsters(fid);
        setParent2FriendMonsters(fMonsters.filter(m => m.life_stage >= 3));
      } catch (err) { setMessage(`❌ 獲取好友怪獸失敗: ${err.message}`); }
    } else {
      setParent2FriendMonsters([]);
    }
  };

  // Chip slot selections
  const [equipSlot, setEquipSlot] = useState(1);
  const [selectedChipId, setSelectedChipId] = useState('');

  const selectedMonster = monsters.find(m => m.monster_id === selectedMonsterId) || monsters[0];

  const handleAction = async (actionFn, ...args) => {
    setLoading(true);
    setMessage('');
    try {
      const data = await actionFn(...args);
      setMessage(data.message || '操作成功！');
      await refreshData();
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleHatch = async () => {
    await handleAction(api.hatchEgg);
  };

  const handleSetSelection = (mId) => {
    setSelectedMonsterId(mId);
    const mon = monsters.find(m => m.monster_id === mId);
    if (mon) setActiveMonster(mon);
  };

  const handleBuy = async (itemId) => {
    await handleAction(api.buyItem, itemId, 1);
  };

  const handleEquip = async () => {
    if (!selectedChipId) return;
    await handleAction(api.equipChip, selectedMonster.monster_id, selectedChipId, equipSlot);
  };

  const handleUnequip = async (slot) => {
    await handleAction(api.unequipChip, selectedMonster.monster_id, slot);
  };

  const handleBreed = async () => {
    if (!parent1 || !parent2) return;
    await handleAction(api.breed, parent1, parent2, useCatalyst);
  };

  const getItemQty = (itemId) => {
    const item = inventory.find(i => i.item_id === itemId);
    return item ? item.quantity : 0;
  };

  const chipsInInventory = inventory.filter(i => i.item_type === 4);

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in">
      {/* Header bar */}
      <div className="glass-card p-4 flex justify-between items-center text-sm font-bold">
        <span className="text-cyan-400">庫存: {monsters.length}/50</span>
        <span className="text-amber-400">💰 {user.gold}G</span>
      </div>

      {/* Sub tabs navigation */}
      <div className="grid grid-cols-4 gap-2">
        <button 
          onClick={() => { setSubTab('list'); setMessage(''); }}
          className={`py-3 rounded-xl font-bold transition-all ${subTab === 'list' ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(8,145,178,0.6)]' : 'glass-panel text-slate-400'}`}
        >
          倉庫
        </button>
        <button 
          onClick={() => { setSubTab('chips'); setMessage(''); }}
          className={`py-3 rounded-xl font-bold transition-all ${subTab === 'chips' ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(8,145,178,0.6)]' : 'glass-panel text-slate-400'}`}
        >
          裝備晶片
        </button>
        <button 
          onClick={() => { setSubTab('breed'); setMessage(''); }}
          className={`py-3 rounded-xl font-bold transition-all ${subTab === 'breed' ? 'bg-fuchsia-600 text-white shadow-[0_0_15px_rgba(192,38,211,0.6)]' : 'glass-panel text-slate-400'}`}
        >
          繁衍
        </button>
      </div>

      {/* Main SubTab Content Area (Scrollable) */}
      <div className="flex-1 overflow-y-auto">
        
        {subTab === 'list' && (
          <div className="flex flex-col gap-4">
            <div className="glass-card p-5 flex flex-col gap-4">
              {monsters.length < 50 && (
                <button
                  onClick={handleHatch}
                  disabled={loading || user.gold < 100}
                  className="w-full neon-button py-3 text-sm flex items-center justify-center gap-2"
                >
                  <span>🥚</span> 孵化新怪獸蛋 (-100G)
                </button>
              )}

              <div>
                <label className="text-xs text-slate-400 mb-2 block">選擇怪獸</label>
                <select 
                  value={selectedMonsterId}
                  onChange={(e) => handleSetSelection(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-cyan-500 transition-colors"
                >
                  {monsters.map(m => (
                    <option key={m.monster_id} value={m.monster_id}>
                      {m.name} (G{m.generation} {STAGE_NAMES[m.life_stage]})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedMonster && (
              <div className="glass-card p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-white">{selectedMonster.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${selectedMonster.is_locked ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {selectedMonster.is_locked ? '🔒 已鎖定' : '🔓 未鎖定'}
                  </span>
                </div>
                
                <div className="flex gap-2 text-sm text-slate-400 mb-6">
                  <span>階段: {STAGE_NAMES[selectedMonster.life_stage]}</span>
                  <span>•</span>
                  <span>屬性: {selectedMonster.type === 1 ? '疫苗' : selectedMonster.type === 2 ? '資料' : selectedMonster.type === 3 ? '病毒' : '無'}</span>
                </div>
                
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div className="bg-slate-900/50 p-2 rounded-lg text-center border border-slate-700/50">
                    <div className="text-xs text-slate-500">HP</div>
                    <div className="font-bold text-rose-400">{Math.round(selectedMonster.combat_hp)}</div>
                  </div>
                  <div className="bg-slate-900/50 p-2 rounded-lg text-center border border-slate-700/50">
                    <div className="text-xs text-slate-500">ATK</div>
                    <div className="font-bold text-amber-400">{Math.round(selectedMonster.combat_atk)}</div>
                  </div>
                  <div className="bg-slate-900/50 p-2 rounded-lg text-center border border-slate-700/50">
                    <div className="text-xs text-slate-500">DEF</div>
                    <div className="font-bold text-blue-400">{Math.round(selectedMonster.combat_def)}</div>
                  </div>
                  <div className="bg-slate-900/50 p-2 rounded-lg text-center border border-slate-700/50">
                    <div className="text-xs text-slate-500">SPD</div>
                    <div className="font-bold text-emerald-400">{Math.round(selectedMonster.combat_spd)}</div>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 mb-6 text-sm">
                  <div className="flex gap-2 items-center">
                    <span className="text-slate-400">IV 潛力:</span>
                    <span className="font-bold text-fuchsia-400">+{Math.round((selectedMonster.iv || 0) * 100)}%</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-slate-400">天賦:</span>
                    <span className="font-bold text-cyan-400">{(selectedMonster.traits && selectedMonster.traits.length > 0) ? selectedMonster.traits.join(', ') : '無'}</span>
                  </div>
                </div>

                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => handleAction(api.toggleLock, selectedMonster.monster_id)}
                    disabled={loading}
                    className="flex-1 neon-button neon-button-primary py-3"
                  >
                    {selectedMonster.is_locked ? '解除鎖定' : '鎖定保護'}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`確定要將 \${selectedMonster.name} 分解為晶片嗎？此動作無法復原！`)) {
                        handleAction(api.extractChip, selectedMonster.monster_id);
                      }
                    }}
                    disabled={loading || selectedMonster.is_locked || selectedMonster.monster_id === activeMonster?.monster_id}
                    className="flex-1 neon-button neon-button-warning py-3"
                  >
                    提取晶片
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`確定要放生 \${selectedMonster.name} 嗎？此動作無法復原！`)) {
                        handleAction(api.release, selectedMonster.monster_id);
                      }
                    }}
                    disabled={loading || selectedMonster.is_locked}
                    className="flex-1 neon-button neon-button-danger py-3"
                  >
                    放生
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {subTab === 'chips' && selectedMonster && (
          <div className="flex flex-col gap-4">
            <div className="glass-card p-5">
              <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
                <span className="text-2xl">🔧</span> 晶片鑲嵌面板
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-between min-h-[120px]">
                  <span className="text-xs text-slate-400">插槽 1 (成熟期)</span>
                  <span className={`font-bold text-center w-full my-2 ${selectedMonster.chip_slot_1 ? 'text-amber-400' : 'text-slate-600'}`}>
                    {selectedMonster.chip_slot_1 || '【空位】'}
                  </span>
                  {selectedMonster.chip_slot_1 && (
                    <button
                      onClick={() => handleUnequip(1)}
                      disabled={loading || getItemQty('chip_extractor') === 0}
                      className="text-xs text-rose-400 hover:text-rose-300 underline disabled:opacity-30 disabled:no-underline"
                    >
                      拆除 (需提取器)
                    </button>
                  )}
                </div>
                <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-between min-h-[120px]">
                  <span className="text-xs text-slate-400">插槽 2 (完全體)</span>
                  <span className={`font-bold text-center w-full my-2 ${selectedMonster.chip_slot_2 ? 'text-amber-400' : 'text-slate-600'}`}>
                    {selectedMonster.chip_slot_2 || '【空位】'}
                  </span>
                  {selectedMonster.chip_slot_2 && (
                    <button
                      onClick={() => handleUnequip(2)}
                      disabled={loading || getItemQty('chip_extractor') === 0}
                      className="text-xs text-rose-400 hover:text-rose-300 underline disabled:opacity-30 disabled:no-underline"
                    >
                      拆除 (需提取器)
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-700/50">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">鑲嵌位置</label>
                  <select value={equipSlot} onChange={(e) => setEquipSlot(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none">
                    <option value={1}>插槽 1</option>
                    <option value={2}>插槽 2</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">選擇晶片</label>
                  <select value={selectedChipId} onChange={(e) => setSelectedChipId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none">
                    <option value="">--請選擇背包內的晶片--</option>
                    {chipsInInventory.map(c => (
                      <option key={c.inventory_id} value={c.item_id}>
                        {c.item_id} (庫存: {c.quantity})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleEquip}
                  disabled={loading || !selectedChipId}
                  className="w-full neon-button neon-button-primary py-3 mt-2"
                >
                  確認鑲嵌 (覆蓋將損毀舊晶片)
                </button>
              </div>
            </div>
          </div>
        )}

        {subTab === 'breed' && (
          <div className="glass-card p-5 border-fuchsia-500/30">
            <h3 className="text-lg font-bold text-fuchsia-400 mb-1 flex items-center gap-2">
              <span className="text-2xl">🧬</span> 基因繁衍實驗室
            </h3>
            <p className="text-xs text-slate-400 mb-6">將兩隻成熟期以上的怪獸基因融合，產生更強大的後代。</p>
            
            <div className="space-y-4">
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                <label className="text-xs text-fuchsia-300 font-bold mb-2 block">父親親代 (P1)</label>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => { setParent1Source('mine'); setParent1(''); }} className={`flex-1 text-xs py-1 rounded ${parent1Source === 'mine' ? 'bg-fuchsia-600 text-white' : 'bg-slate-800 text-slate-400'}`}>我的怪獸</button>
                  <button onClick={() => { setParent1Source('friend'); setParent1(''); }} className={`flex-1 text-xs py-1 rounded ${parent1Source === 'friend' ? 'bg-fuchsia-600 text-white' : 'bg-slate-800 text-slate-400'}`}>好友的怪獸</button>
                </div>
                {parent1Source === 'friend' && (
                  <select value={parent1FriendId} onChange={(e) => fetchFriendMonsters1(e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded-lg p-2 text-white outline-none mb-2 text-xs">
                    <option value="">--選擇好友--</option>
                    {friends.map(f => <option key={f.friend_id} value={f.friend_id}>{f.friend_name}</option>)}
                  </select>
                )}
                <select value={parent1} onChange={(e) => setParent1(e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded-lg p-3 text-white outline-none focus:border-fuchsia-500">
                  <option value="">--請選擇怪獸--</option>
                  {(parent1Source === 'mine' ? monsters.filter(m => m.life_stage >= 3 && !m.is_dead) : parent1FriendMonsters).filter(m => m.monster_id !== parent2).map(m => (
                    <option key={m.monster_id} value={m.monster_id}>{m.name || m.custom_name} (G{m.generation})</option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                <label className="text-xs text-fuchsia-300 font-bold mb-2 block">母親親代 (P2)</label>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => { setParent2Source('mine'); setParent2(''); }} className={`flex-1 text-xs py-1 rounded ${parent2Source === 'mine' ? 'bg-fuchsia-600 text-white' : 'bg-slate-800 text-slate-400'}`}>我的怪獸</button>
                  <button onClick={() => { setParent2Source('friend'); setParent2(''); }} className={`flex-1 text-xs py-1 rounded ${parent2Source === 'friend' ? 'bg-fuchsia-600 text-white' : 'bg-slate-800 text-slate-400'}`}>好友的怪獸</button>
                </div>
                {parent2Source === 'friend' && (
                  <select value={parent2FriendId} onChange={(e) => fetchFriendMonsters2(e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded-lg p-2 text-white outline-none mb-2 text-xs">
                    <option value="">--選擇好友--</option>
                    {friends.map(f => <option key={f.friend_id} value={f.friend_id}>{f.friend_name}</option>)}
                  </select>
                )}
                <select value={parent2} onChange={(e) => setParent2(e.target.value)} className="w-full bg-slate-950 border border-slate-600 rounded-lg p-3 text-white outline-none focus:border-fuchsia-500">
                  <option value="">--請選擇怪獸--</option>
                  {(parent2Source === 'mine' ? monsters.filter(m => m.life_stage >= 3 && !m.is_dead) : parent2FriendMonsters).filter(m => m.monster_id !== parent1).map(m => (
                    <option key={m.monster_id} value={m.monster_id}>{m.name || m.custom_name} (G{m.generation})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 p-4 bg-fuchsia-900/10 border border-fuchsia-500/20 rounded-xl mt-2 cursor-pointer" onClick={() => setUseCatalyst(!useCatalyst)}>
                <div className={`w-6 h-6 rounded flex items-center justify-center border transition-colors ${useCatalyst ? 'bg-fuchsia-500 border-fuchsia-400' : 'bg-slate-800 border-slate-600'}`}>
                  {useCatalyst && <span className="text-white">✓</span>}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">使用繁衍催化劑</span>
                  <span className="text-xs text-fuchsia-300">突變機率翻倍 (庫存: {getItemQty('breed_catalyst')})</span>
                </div>
              </div>

              <button
                onClick={handleBreed}
                disabled={loading || !parent1 || !parent2 || user.gold < 200}
                className="w-full py-4 font-bold rounded-xl text-white mt-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 shadow-lg shadow-fuchsia-500/30 transform active:scale-95 transition-all disabled:opacity-50 disabled:transform-none"
              >
                融合繁衍一代 (-200G)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log message output */}
      {message && (
        <div className="glass-card p-3 text-center text-sm font-medium animate-pulse text-cyan-200 border-cyan-500/50 bg-cyan-900/20 mt-auto">
          {message}
        </div>
      )}
    </div>
  );
}
