import React, { useState } from 'react';
import { api } from '../utils/api';

const STAGE_NAMES = ['蛋', '蛋', '幼年期', '成長期', '成熟期', '完全體', '究極體'];

export default function Roster({ 
  user, 
  monsters, 
  inventory, 
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
  const [parent1, setParent1] = useState('');
  const [parent2, setParent2] = useState('');
  const [useCatalyst, setUseCatalyst] = useState(false);

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
    <div className="h-full flex flex-col justify-between p-1 font-pressstart text-[8px] text-lcd-dark">
      {/* Header bar */}
      <div className="flex justify-between items-center border-b border-lcd-border pb-1 text-[7px]">
        <span>庫存: {monsters.length}/50</span>
        <span>💰: {user.gold}G</span>
      </div>

      {/* Sub tabs navigation */}
      <div className="grid grid-cols-4 gap-0.5 border-b border-lcd-border py-1 text-[6.5px] text-center font-bold">
        <button 
          onClick={() => { setSubTab('list'); setMessage(''); }}
          className={`py-0.5 rounded ${subTab === 'list' ? 'bg-lcd-dark text-lcd-bg' : 'bg-lcd-light/20'}`}
        >
          列表
        </button>
        <button 
          onClick={() => { setSubTab('chips'); setMessage(''); }}
          className={`py-0.5 rounded ${subTab === 'chips' ? 'bg-lcd-dark text-lcd-bg' : 'bg-lcd-light/20'}`}
        >
          晶片
        </button>
        <button 
          onClick={() => { setSubTab('breed'); setMessage(''); }}
          className={`py-0.5 rounded ${subTab === 'breed' ? 'bg-lcd-dark text-lcd-bg' : 'bg-lcd-light/20'}`}
        >
          繁衍
        </button>
        <button 
          onClick={() => { setSubTab('shop'); setMessage(''); }}
          className={`py-0.5 rounded ${subTab === 'shop' ? 'bg-lcd-dark text-lcd-bg' : 'bg-lcd-light/20'}`}
        >
          商店
        </button>
      </div>

      {/* Main SubTab Content Area (Scrollable) */}
      <div className="flex-1 overflow-y-auto py-1 text-[7px] max-h-48">
        
        {subTab === 'list' && (
          <div className="flex flex-col gap-1.5">
            {/* Monster list dropdown */}
            <div className="flex gap-1 items-center">
              <span>選擇:</span>
              <select 
                value={selectedMonsterId}
                onChange={(e) => handleSetSelection(parseInt(e.target.value))}
                className="flex-1 bg-lcd-bg border border-lcd-border text-[7px] py-0.5 px-1 outline-none text-lcd-dark font-bold font-pressstart"
              >
                {monsters.map(m => (
                  <option key={m.monster_id} value={m.monster_id}>
                    {m.name} (G{m.generation} {STAGE_NAMES[m.life_stage]})
                  </option>
                ))}
              </select>
            </div>

            {selectedMonster && (
              <div className="border border-lcd-border rounded p-1 flex flex-col gap-1 bg-lcd-light/20">
                <div className="flex justify-between font-bold">
                  <span className="truncate">{selectedMonster.name}</span>
                  <span>{selectedMonster.is_locked ? '🔒已鎖定' : '🔓未鎖定'}</span>
                </div>
                <div>階段: {STAGE_NAMES[selectedMonster.life_stage]} (屬性:{selectedMonster.type === 1 ? '疫苗' : selectedMonster.type === 2 ? '資料' : '病毒'})</div>
                <div className="grid grid-cols-2 gap-1 text-[6.5px]">
                  <span>HP: {Math.round(selectedMonster.combat_hp)}</span>
                  <span>ATK: {Math.round(selectedMonster.combat_atk)}</span>
                  <span>DEF: {Math.round(selectedMonster.combat_def)}</span>
                  <span>SPD: {Math.round(selectedMonster.combat_spd)}</span>
                </div>
                <div className="border-t border-lcd-border/50 pt-1 flex justify-around gap-1 mt-1">
                  <button
                    onClick={() => handleAction(api.toggleLock, selectedMonster.monster_id)}
                    disabled={loading}
                    className="flex-1 py-0.5 border border-lcd-border rounded active:scale-95 bg-lcd-light/50"
                  >
                    {selectedMonster.is_locked ? '解鎖' : '鎖定'}
                  </button>
                  <button
                    onClick={() => handleAction(api.release, selectedMonster.monster_id)}
                    disabled={loading || selectedMonster.is_locked}
                    className="flex-1 py-0.5 border border-lcd-border rounded active:scale-95 text-red-900 bg-lcd-light/50 disabled:opacity-40"
                  >
                    放生
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {subTab === 'chips' && selectedMonster && (
          <div className="flex flex-col gap-1.5">
            <div className="font-bold border-b border-lcd-border/50 pb-0.5">晶片鑲嵌 - {selectedMonster.name}</div>
            
            {/* Slot indicators */}
            <div className="grid grid-cols-2 gap-1 mb-1">
              <div className="border border-lcd-border p-1 rounded flex flex-col items-center">
                <span>插槽 1 (成熟期)</span>
                <span className="font-bold my-1 text-center truncate w-full text-[6px]">
                  {selectedMonster.chip_slot_1 || '【無】'}
                </span>
                {selectedMonster.chip_slot_1 && (
                  <button
                    onClick={() => handleUnequip(1)}
                    disabled={loading || getItemQty('chip_extractor') === 0}
                    className="mt-1 text-[6px] underline disabled:opacity-30"
                  >
                    拆除 (需提取器)
                  </button>
                )}
              </div>
              <div className="border border-lcd-border p-1 rounded flex flex-col items-center">
                <span>插槽 2 (完全體)</span>
                <span className="font-bold my-1 text-center truncate w-full text-[6px]">
                  {selectedMonster.chip_slot_2 || '【無】'}
                </span>
                {selectedMonster.chip_slot_2 && (
                  <button
                    onClick={() => handleUnequip(2)}
                    disabled={loading || getItemQty('chip_extractor') === 0}
                    className="mt-1 text-[6px] underline disabled:opacity-30"
                  >
                    拆除 (需提取器)
                  </button>
                )}
              </div>
            </div>

            {/* Equip tool */}
            <div className="border-t border-lcd-border/50 pt-1.5 flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[6px]">
                <span>鑲嵌到:</span>
                <select value={equipSlot} onChange={(e) => setEquipSlot(parseInt(e.target.value))} className="bg-lcd-bg border border-lcd-border text-[6px] px-1 outline-none text-lcd-dark">
                  <option value={1}>插槽 1</option>
                  <option value={2}>插槽 2</option>
                </select>
              </div>

              <div className="flex justify-between items-center text-[6px]">
                <span>選擇晶片:</span>
                <select value={selectedChipId} onChange={(e) => setSelectedChipId(e.target.value)} className="flex-1 max-w-[100px] bg-lcd-bg border border-lcd-border text-[6px] px-1 outline-none text-lcd-dark">
                  <option value="">--請選擇--</option>
                  {chipsInInventory.map(c => (
                    <option key={c.inventory_id} value={c.item_id}>
                      {c.item_id} (剩 {c.quantity})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleEquip}
                disabled={loading || !selectedChipId}
                className="w-full py-1 bg-lcd-dark text-lcd-bg rounded border border-lcd-border active:scale-95 disabled:opacity-50"
              >
                確認鑲嵌 (覆蓋將損毀舊晶片)
              </button>
            </div>
          </div>
        )}

        {subTab === 'breed' && (
          <div className="flex flex-col gap-1.5 text-[6.5px]">
            <div className="font-bold border-b border-lcd-border/50 pb-0.5 text-[8px]">基因繁衍 (費用: 200G)</div>
            
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span>父親親代 (P1):</span>
                <select value={parent1} onChange={(e) => setParent1(e.target.value)} className="bg-lcd-bg border border-lcd-border px-0.5 py-0.5 text-[6px] text-lcd-dark outline-none">
                  <option value="">--選擇--</option>
                  {monsters.filter(m => m.life_stage >= 4 && !m.is_dead).map(m => (
                    <option key={m.monster_id} value={m.monster_id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-between items-center">
                <span>母親親代 (P2):</span>
                <select value={parent2} onChange={(e) => setParent2(e.target.value)} className="bg-lcd-bg border border-lcd-border px-0.5 py-0.5 text-[6px] text-lcd-dark outline-none">
                  <option value="">--選擇--</option>
                  {monsters.filter(m => m.life_stage >= 4 && !m.is_dead).map(m => (
                    <option key={m.monster_id} value={m.monster_id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 mt-0.5">
                <input 
                  type="checkbox" 
                  checked={useCatalyst} 
                  onChange={(e) => setUseCatalyst(e.target.checked)} 
                  className="accent-lcd-dark border-lcd-border"
                />
                <span>使用繁衍催化劑 (突變率翻倍, 剩: {getItemQty('breed_catalyst')})</span>
              </div>
            </div>

            <button
              onClick={handleBreed}
              disabled={loading || !parent1 || !parent2 || user.gold < 200}
              className="w-full py-1.5 bg-lcd-dark text-lcd-bg rounded border border-lcd-border active:scale-95 disabled:opacity-50 mt-1"
            >
              融合繁衍一代 (Hatch Breed)
            </button>
          </div>
        )}

        {subTab === 'shop' && (
          <div className="flex flex-col gap-1.5">
            <div className="font-bold border-b border-lcd-border/50 pb-0.5 text-[8px]">基礎肉品與醫療道具店</div>
            
            <div className="flex flex-col gap-1 text-[6.5px]">
              <div className="flex justify-between items-center p-0.5 border border-lcd-border/30 rounded">
                <span>🍖 基本肉 (20飽食) - 10G</span>
                <button onClick={() => handleBuy('meat_basic')} disabled={loading || user.gold < 10} className="px-1 border border-lcd-border rounded active:scale-95 bg-lcd-light/40 disabled:opacity-30">購買</button>
              </div>

              <div className="flex justify-between items-center p-0.5 border border-lcd-border/30 rounded">
                <span>🥩 頂級肉 (60飽食) - 50G</span>
                <button onClick={() => handleBuy('meat_premium')} disabled={loading || user.gold < 50} className="px-1 border border-lcd-border rounded active:scale-95 bg-lcd-light/40 disabled:opacity-30">購買</button>
              </div>

              <div className="flex justify-between items-center p-0.5 border border-lcd-border/30 rounded">
                <span>🥤 能量飲 (30飽食+20體) - 100G</span>
                <button onClick={() => handleBuy('energy_drink')} disabled={loading || user.gold < 100} className="px-1 border border-lcd-border rounded active:scale-95 bg-lcd-light/40 disabled:opacity-30">購買</button>
              </div>

              <div className="flex justify-between items-center p-0.5 border border-lcd-border/30 rounded">
                <span>💊 特效藥 (治生病) - 200G</span>
                <button onClick={() => handleBuy('medicine_standard')} disabled={loading || user.gold < 200} className="px-1 border border-lcd-border rounded active:scale-95 bg-lcd-light/40 disabled:opacity-30">購買</button>
              </div>

              <div className="flex justify-between items-center p-0.5 border border-lcd-border/30 rounded">
                <span>🧪 維他命 (+10%訓練) - 50G</span>
                <button onClick={() => handleBuy('vitamin')} disabled={loading || user.gold < 50} className="px-1 border border-lcd-border rounded active:scale-95 bg-lcd-light/40 disabled:opacity-30">購買</button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Log message output */}
      {message && (
        <div className="text-[6.5px] bg-lcd-light/50 border border-lcd-border px-1 py-0.5 rounded text-center truncate mb-1">
          {message}
        </div>
      )}

      {/* Navigation tabs */}
      <div className="grid grid-cols-5 gap-0.5 border-t border-lcd-border pt-1 text-[6.5px] font-bold text-center">
        <button onClick={() => setPage('dashboard')} className="py-0.5 hover:bg-lcd-light/35 rounded">養成</button>
        <button onClick={() => setPage('roster')} className="py-0.5 bg-lcd-dark text-lcd-bg rounded">倉庫</button>
        <button onClick={() => setPage('arena')} className="py-0.5 hover:bg-lcd-light/35 rounded">競技</button>
        <button onClick={() => setPage('guild')} className="py-0.5 hover:bg-lcd-light/35 rounded">公會</button>
        <button onClick={() => setPage('raid')} className="py-0.5 hover:bg-lcd-light/35 rounded">討伐</button>
      </div>
    </div>
  );
}
