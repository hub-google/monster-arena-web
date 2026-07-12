import React, { useState } from 'react';
import { api } from '../utils/api';

export default function Guild({ 
  user, 
  guilds, 
  myGuild, 
  refreshData, 
  setPage 
}) {
  const [guildName, setGuildName] = useState('');
  const [donationAmount, setDonationAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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

  const handleCreate = async () => {
    if (!guildName) return;
    await handleAction(api.createGuild, guildName);
    setGuildName('');
  };

  const handleDonate = async () => {
    if (!donationAmount) return;
    await handleAction(api.donateGuild, parseInt(donationAmount));
    setDonationAmount('');
  };

  const handleBuyShop = async (itemId) => {
    await handleAction(api.buyGuildShop, itemId);
  };

  return (
    <div className="h-full flex flex-col justify-between p-1 font-pressstart text-[8px] text-lcd-dark">
      {/* Header bar */}
      <div className="flex justify-between items-center border-b border-lcd-border pb-1 text-[7px]">
        <span>公會大廳</span>
        <span>💰: {user.gold}G</span>
      </div>

      {/* Main Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto py-1 max-h-48">
        
        {myGuild ? (
          /* User is in a guild - Show active guild view */
          <div className="flex flex-col gap-1.5 text-[6.5px]">
            <div className="border border-lcd-border rounded p-1.5 bg-lcd-light/20 flex flex-col gap-1">
              <div className="font-bold text-[9px] truncate border-b border-lcd-border pb-0.5">
                🏰 {myGuild.guild_name}
              </div>
              <div className="flex justify-between">
                <span>等級: LV.{myGuild.level}</span>
                <span>我的貢獻: {myGuild.contribution}分</span>
              </div>
              <button
                onClick={() => handleAction(api.leaveGuild)}
                disabled={loading}
                className="mt-1 self-end text-[5px] text-red-900 underline active:scale-95"
              >
                {myGuild.role === 2 ? '解散公會' : '退出公會'}
              </button>
            </div>

            {/* Gold Donation Form */}
            <div className="border-t border-lcd-border/30 pt-1.5 flex flex-col gap-1">
              <div className="flex gap-1 items-center">
                <span>金幣捐獻:</span>
                <input
                  type="number"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  placeholder="輸入金額"
                  className="flex-1 bg-lcd-bg border border-lcd-border px-1 text-[6px] outline-none font-pressstart text-lcd-dark"
                />
                <button
                  onClick={handleDonate}
                  disabled={loading || !donationAmount || user.gold < parseInt(donationAmount)}
                  className="px-1.5 py-0.5 bg-lcd-dark text-lcd-bg border border-lcd-border font-bold disabled:opacity-40"
                >
                  捐獻
                </button>
              </div>
              <span className="text-[5.5px] text-gray-500">(1金幣 = 1公會貢獻點，貢獻點可用於商店兌換)</span>
            </div>

            {/* Guild Shop items */}
            <div className="border-t border-lcd-border/30 pt-1.5">
              <div className="font-bold text-[7.5px] mb-1">🏰 公會專屬商店</div>
              
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center p-0.5 border border-lcd-border/30 rounded">
                  <span>🧬 晶片提取器 - 300貢獻</span>
                  <button 
                    onClick={() => handleBuyShop('chip_extractor')} 
                    disabled={loading || myGuild.contribution < 300}
                    className="px-1 border border-lcd-border rounded active:scale-95 bg-lcd-light/40 disabled:opacity-30 text-[5.5px]"
                  >
                    兌換
                  </button>
                </div>

                <div className="flex justify-between items-center p-0.5 border border-lcd-border/30 rounded">
                  <span>🧪 繁衍催化劑 - 150貢獻</span>
                  <button 
                    onClick={() => handleBuyShop('breed_catalyst')} 
                    disabled={loading || myGuild.contribution < 150}
                    className="px-1 border border-lcd-border rounded active:scale-95 bg-lcd-light/40 disabled:opacity-30 text-[5.5px]"
                  >
                    兌換
                  </button>
                </div>

                <div className="flex justify-between items-center p-0.5 border border-lcd-border/30 rounded">
                  <span>🧬 究極進化核心 - 500貢獻</span>
                  <button 
                    onClick={() => handleBuyShop('ultimate_core')} 
                    disabled={loading || myGuild.contribution < 500}
                    className="px-1 border border-lcd-border rounded active:scale-95 bg-lcd-light/40 disabled:opacity-30 text-[5.5px]"
                  >
                    兌換
                  </button>
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* User is NOT in a guild - Show list and create forms */
          <div className="flex flex-col gap-2.5">
            {/* Create form */}
            <div className="border border-lcd-border rounded p-1.5 bg-lcd-light/10 flex flex-col gap-1 text-[6.5px]">
              <div className="font-bold mb-0.5">創建新公會 (費用: 500G)</div>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={guildName}
                  onChange={(e) => setGuildName(e.target.value)}
                  placeholder="輸入公會名稱"
                  className="flex-1 bg-lcd-bg border border-lcd-border px-1 text-[6px] outline-none font-pressstart text-lcd-dark"
                />
                <button
                  onClick={handleCreate}
                  disabled={loading || !guildName || user.gold < 500}
                  className="px-1.5 py-0.5 bg-lcd-dark text-lcd-bg border border-lcd-border font-bold disabled:opacity-40"
                >
                  創建
                </button>
              </div>
            </div>

            {/* Guild lists */}
            <div className="flex flex-col gap-1 text-[6.5px]">
              <div className="font-bold border-b border-lcd-border/30 pb-0.5">🔍 公會列表</div>
              {guilds.length === 0 ? (
                <span className="text-center italic mt-2 text-gray-500">目前沒有創立的公會。</span>
              ) : (
                guilds.map(g => (
                  <div key={g.guild_id} className="flex justify-between items-center p-1 border border-lcd-border/20 rounded">
                    <div className="flex flex-col max-w-[100px]">
                      <span className="font-bold truncate">{g.guild_name}</span>
                      <span className="text-[5.5px] text-gray-500">LV.{g.level} | 會長:{g.leader_name}</span>
                    </div>
                    <button
                      onClick={() => handleAction(api.joinGuild, g.guild_id)}
                      disabled={loading}
                      className="px-1 border border-lcd-border rounded active:scale-95 bg-lcd-light/60"
                    >
                      申請加入
                    </button>
                  </div>
                ))
              )}
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
        <button onClick={() => setPage('roster')} className="py-0.5 hover:bg-lcd-light/35 rounded">倉庫</button>
        <button onClick={() => setPage('arena')} className="py-0.5 hover:bg-lcd-light/35 rounded">競技</button>
        <button onClick={() => setPage('guild')} className="py-0.5 bg-lcd-dark text-lcd-bg rounded">公會</button>
        <button onClick={() => setPage('raid')} className="py-0.5 hover:bg-lcd-light/35 rounded">討伐</button>
      </div>
    </div>
  );
}
