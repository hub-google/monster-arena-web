# Monster Arena Web

怪獸養成／競技場。沿用原始的 **Supabase Game 專案**，不再將既有帳號改接 Firebase。

- 正式網站：https://hub-google.github.io/monster-arena-web/
- 修復預覽：https://hub-google.github.io/monster-arena-web/preview/
- 專案：https://github.com/hub-google/monster-arena-web
- GitHub Actions：https://github.com/hub-google/monster-arena-web/actions
- 後端：Supabase project `fanffwnhkxpfhttylntw` (Game)

## 修復的功能

- **登入、註冊**：保持既有 Supabase Auth 帳號／session，修復錯誤轉 Firebase 的問題。未完成 Email 驗證時提供提示。
- **怪獸養成**：時間累計飽食／清潔／年齡（小數值）；避免重新整理讓衰減無效、避免年老衰減重複計算。
- **金幣與物品**：孵化、餵食、治療、訓練、購物等走資料庫交易（`game_action`）；可拒絕負數、無效物品、餘額不足及非本人怪獸。
- **繁衍／晶片／究極進化**：檢查雙親有效、道具及金幣原子扣除、固定插槽需求、避免屬性重複疊加；究極進化檢查 50 戰、70% 勝率。
- **戰鬥與任務**：戰績透過 `battle_records` 去重；任務進度與主操作一起更新、獎勵不可重領。
- **世界王**：伺服器端依本人怪獸數值計算傷害；15 體力及王血量交易式扣除，避免競爭更新遺失。
- **好友、聊天與贈送體力**：支援好友邀請與接受、聊天保留紀錄且節流、體力由收禮者領取。
- **公會**：建立、加入、退出、捐獻、貢獻商店走正確 Supabase 欄位與交易。

## 資料庫遷移

遷移檔案已放在 `supabase/migrations/`：

- `20261022_game_atomic_actions.sql` — 原子交易、每日任務及戰鬥紀錄。
- `20261022_profile_friends_gifts.sql` — 舊帳號暱稱、好友邀請、體力禮物。

對原本 **Game** 專案已套用以上遷移，未更換資料庫專案，也沒有刪除舊玩家帳號。不要對同一個遷移執行手動刪表或清空資料庫。

## 開發與測試

需要 Node.js 22。直接執行：

```bash
npm install
npm run lint
npm run build
npm run dev
```

`master` 更新時經 GitHub Actions 執行 lint、Supabase Auth 健康檢查、Vite build、Playwright Chromium smoke test，通過才部署 `gh-pages`。修復分支 `supabase-stable-fixes` 只部署至 `/preview/`，不覆蓋正式登入頁。

SQL 操作已用 `BEGIN ... ROLLBACK` 的交易測試驗證：孵化、購物、餵食、繁衍、每日任務、戰績去重、公會與好友收禮；測試沒有留下怪獸、戰績或公會。

> `tests/run_tests.spec.js` 和 `tests/run_all_scenarios.spec.js` 是**舊 Firebase 測試**，不得對正式 Supabase 專案執行。它們已被環境變數保護且不在部署 CI 中執行。

## 尚待處理的安全事項

原本 Game 專案的 `guilds`、`guild_members`、`guild_applications`、`friends`、`challenges`、`daily_quests` 六個資料表 **沒有啟用 RLS**；不能直接啟用而不先建立正確的政策，否則可能阻斷現有功能。請參考 `docs/SECURITY.md`，目前不將此項宣稱為完成。

另一個限制：原有瀏覽器直接修改自己金幣／怪獸數值的 RLS 權限，以及客戶端決定勝負的模式，尚不足以防止惡意作弊。這次已將 UI 主要經濟操作改為資料庫原子交易，但正式競技或交易上線前，仍須收緊原有直接寫入政策、補足可信任伺服器端戰鬥判定及授權測試。
