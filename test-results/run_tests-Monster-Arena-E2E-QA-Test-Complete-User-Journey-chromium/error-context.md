# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: run_tests.spec.js >> Monster Arena E2E QA Test >> Complete User Journey
- Location: tests\run_tests.spec.js:10:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button:has-text("新戶註冊")')

```

# Page snapshot

```yaml
- generic [ref=e6]:
  - generic [ref=e8]: 👾
  - heading "MONSTER ARENA" [level=1] [ref=e9]
  - paragraph [ref=e10]: 次世代怪獸養成對戰平台
  - generic [ref=e11]:
    - button "登入帳號" [ref=e12]
    - button "註冊新戶" [ref=e13]
  - generic [ref=e14]:
    - generic [ref=e15]:
      - generic [ref=e16]: 使用者名稱 (Username)
      - textbox "輸入帳號..." [ref=e17]
    - generic [ref=e18]:
      - generic [ref=e19]: 密碼 (Password)
      - textbox "••••••••" [ref=e20]
    - button "進入大廳" [ref=e21]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import path from 'path';
  3  | import { fileURLToPath } from 'url';
  4  | 
  5  | const __filename = fileURLToPath(import.meta.url);
  6  | const __dirname = path.dirname(__filename);
  7  | const REPORT_DIR = path.join(__dirname, '../../測試報告');
  8  | 
  9  | test.describe('Monster Arena E2E QA Test', () => {
  10 |   test('Complete User Journey', async ({ page }) => {
  11 |     // Navigate to local dev server
  12 |     await page.goto('/');
  13 |     await page.waitForLoadState('networkidle');
  14 | 
  15 |     // Screenshot 1: 登入首頁
  16 |     await page.screenshot({ path: path.join(REPORT_DIR, '01_Home_Page.png') });
  17 | 
  18 |     // 情境一：新戶首次註冊
> 19 |     await page.click('button:has-text("新戶註冊")');
     |                ^ Error: page.click: Test timeout of 30000ms exceeded.
  20 |     const uniqueId = Date.now();
  21 |     await page.fill('input[placeholder="輸入登入帳號"]', `TestUser_${uniqueId}`);
  22 |     await page.fill('input[placeholder="example@email.com"]', `testuser_${uniqueId}@test.com`);
  23 |     await page.fill('input[placeholder="••••••••"]', 'password123');
  24 |     
  25 |     // 點擊建立帳號並登入
  26 |     await page.click('button[type="submit"]');
  27 | 
  28 |     // 等待跳轉到 Dashboard
  29 |     await page.waitForSelector('text=HATCH EGG', { timeout: 10000 });
  30 |     
  31 |     // Screenshot 2: 註冊後進入 Dashboard，看到目前沒有培育中的怪獸
  32 |     await page.screenshot({ path: path.join(REPORT_DIR, '02_Dashboard_Empty.png') });
  33 | 
  34 |     // 情境三：首抽數位蛋 (Hatch Egg)
  35 |     await page.click('text=HATCH EGG');
  36 |     await page.waitForTimeout(2000); // wait for state update
  37 |     
  38 |     // Screenshot 3: 首抽數位蛋成功
  39 |     await page.screenshot({ path: path.join(REPORT_DIR, '03_Hatch_Egg.png') });
  40 | 
  41 |     // 給一點金幣和道具，這在本地端可能需要從 Firebase console，但我們先呼叫一次購買
  42 |     // 因為這是測試流程，我們先測餵食
  43 |     
  44 |     // 點擊餵食展開選單 (這裡假設 UI 有 "餵食" 按鈕)
  45 |     const feedBtn = await page.$('text=餵食');
  46 |     if (feedBtn) {
  47 |        await feedBtn.click();
  48 |        await page.waitForTimeout(1000);
  49 |        await page.screenshot({ path: path.join(REPORT_DIR, '04_Feed_Menu.png') });
  50 |        // 由於預設背包可能沒有食物，點擊可能會報錯，但有截圖即可
  51 |     }
  52 | 
  53 |     // 點擊訓練
  54 |     const trainBtn = await page.$('text=訓練');
  55 |     if (trainBtn) {
  56 |        await trainBtn.click();
  57 |        await page.waitForTimeout(1000);
  58 |        await page.screenshot({ path: path.join(REPORT_DIR, '05_Train.png') });
  59 |     }
  60 | 
  61 |     // 切換到倉庫與晶片管理 (Roster)
  62 |     // 假設有一個 bottom navigation 或 header，找 Roster 按鈕
  63 |     const rosterTab = await page.$('text=ROSTER');
  64 |     if (rosterTab) {
  65 |        await rosterTab.click();
  66 |        await page.waitForTimeout(1000);
  67 |        await page.screenshot({ path: path.join(REPORT_DIR, '06_Roster_Lock_Release.png') });
  68 |     }
  69 | 
  70 |     // 切換到競技大廳 (Arena)
  71 |     const arenaTab = await page.$('text=ARENA');
  72 |     if (arenaTab) {
  73 |        await arenaTab.click();
  74 |        await page.waitForTimeout(1000);
  75 |        await page.screenshot({ path: path.join(REPORT_DIR, '07_Arena_Chat.png') });
  76 |     }
  77 | 
  78 |     // 切換到公會 (Guild)
  79 |     const guildTab = await page.$('text=GUILD');
  80 |     if (guildTab) {
  81 |        await guildTab.click();
  82 |        await page.waitForTimeout(1000);
  83 |        await page.screenshot({ path: path.join(REPORT_DIR, '08_Guild.png') });
  84 |     }
  85 | 
  86 |     // 切換到世界王 (Raid)
  87 |     const raidTab = await page.$('text=RAID');
  88 |     if (raidTab) {
  89 |        await raidTab.click();
  90 |        await page.waitForTimeout(1000);
  91 |        await page.screenshot({ path: path.join(REPORT_DIR, '09_Raid.png') });
  92 |     }
  93 |   });
  94 | });
  95 | 
```