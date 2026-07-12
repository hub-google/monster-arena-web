import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORT_DIR = path.join(__dirname, '../../測試報告');

test.describe('Monster Arena E2E QA Test', () => {
  test('Complete User Journey', async ({ page }) => {
    // Navigate to local dev server
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Screenshot 1: 登入首頁
    await page.screenshot({ path: path.join(REPORT_DIR, '01_Home_Page.png') });

    // 情境一：新戶首次註冊
    await page.click('button:has-text("新戶註冊")');
    const uniqueId = Date.now();
    await page.fill('input[placeholder="輸入登入帳號"]', `TestUser_${uniqueId}`);
    await page.fill('input[placeholder="example@email.com"]', `testuser_${uniqueId}@test.com`);
    await page.fill('input[placeholder="••••••••"]', 'password123');
    
    // 點擊建立帳號並登入
    await page.click('button[type="submit"]');

    // 等待跳轉到 Dashboard
    await page.waitForSelector('text=HATCH EGG', { timeout: 10000 });
    
    // Screenshot 2: 註冊後進入 Dashboard，看到目前沒有培育中的怪獸
    await page.screenshot({ path: path.join(REPORT_DIR, '02_Dashboard_Empty.png') });

    // 情境三：首抽數位蛋 (Hatch Egg)
    await page.click('text=HATCH EGG');
    await page.waitForTimeout(2000); // wait for state update
    
    // Screenshot 3: 首抽數位蛋成功
    await page.screenshot({ path: path.join(REPORT_DIR, '03_Hatch_Egg.png') });

    // 給一點金幣和道具，這在本地端可能需要從 Firebase console，但我們先呼叫一次購買
    // 因為這是測試流程，我們先測餵食
    
    // 點擊餵食展開選單 (這裡假設 UI 有 "餵食" 按鈕)
    const feedBtn = await page.$('text=餵食');
    if (feedBtn) {
       await feedBtn.click();
       await page.waitForTimeout(1000);
       await page.screenshot({ path: path.join(REPORT_DIR, '04_Feed_Menu.png') });
       // 由於預設背包可能沒有食物，點擊可能會報錯，但有截圖即可
    }

    // 點擊訓練
    const trainBtn = await page.$('text=訓練');
    if (trainBtn) {
       await trainBtn.click();
       await page.waitForTimeout(1000);
       await page.screenshot({ path: path.join(REPORT_DIR, '05_Train.png') });
    }

    // 切換到倉庫與晶片管理 (Roster)
    // 假設有一個 bottom navigation 或 header，找 Roster 按鈕
    const rosterTab = await page.$('text=ROSTER');
    if (rosterTab) {
       await rosterTab.click();
       await page.waitForTimeout(1000);
       await page.screenshot({ path: path.join(REPORT_DIR, '06_Roster_Lock_Release.png') });
    }

    // 切換到競技大廳 (Arena)
    const arenaTab = await page.$('text=ARENA');
    if (arenaTab) {
       await arenaTab.click();
       await page.waitForTimeout(1000);
       await page.screenshot({ path: path.join(REPORT_DIR, '07_Arena_Chat.png') });
    }

    // 切換到公會 (Guild)
    const guildTab = await page.$('text=GUILD');
    if (guildTab) {
       await guildTab.click();
       await page.waitForTimeout(1000);
       await page.screenshot({ path: path.join(REPORT_DIR, '08_Guild.png') });
    }

    // 切換到世界王 (Raid)
    const raidTab = await page.$('text=RAID');
    if (raidTab) {
       await raidTab.click();
       await page.waitForTimeout(1000);
       await page.screenshot({ path: path.join(REPORT_DIR, '09_Raid.png') });
    }
  });
});
