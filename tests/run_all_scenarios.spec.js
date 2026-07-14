import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, collection, getDocs, updateDoc, query, where } from 'firebase/firestore';

const firebaseApp = initializeApp({
  apiKey: "AIzaSyAkC3Ra_v7SwyaCgMsKotqYilwLo-55ih4",
  authDomain: "monster-arena-web-app.firebaseapp.com",
  projectId: "monster-arena-web-app",
  storageBucket: "monster-arena-web-app.firebasestorage.app",
  messagingSenderId: "36423258503",
  appId: "1:36423258503:web:61049c5b6c745cd1368322"
});
const db = getFirestore(firebaseApp);
// connectFirestoreEmulator(db, '127.0.0.1', 8080);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORT_DIR = path.join(__dirname, '../../測試報告');

test.describe('Monster Arena - Full 14 Scenarios Test Plan', () => {
  let uniqueId = Date.now();
  let userEmail = `test_${uniqueId}@test.com`;
  let userPass = `password123`;
  let username = `TestUser_${uniqueId}`;

  // 情境一：新戶首次註冊
  test('Scenario 1: Register', async ({ page }) => {
    await page.goto('./');
    await page.click('text=註冊新戶');
    await page.fill('input[placeholder="輸入帳號..."]', username);
    await page.fill('input[placeholder="example@email.com"]', userEmail);
    await page.fill('input[placeholder="••••••••"]', userPass);
    await page.screenshot({ path: path.join(REPORT_DIR, '01_Before_Register.png') });
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=HATCH EGG', { timeout: 15000 });
    await page.screenshot({ path: path.join(REPORT_DIR, '01_Dashboard_After_Register.png') });
  });

  // 情境二：既有帳號登入
  test('Scenario 2: Existing Login', async ({ page }) => {
    await page.goto('./');
    await page.click('button:has-text("登入帳號")');
    await page.fill('input[placeholder="輸入帳號..."]', userEmail);
    await page.fill('input[placeholder="••••••••"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000); // Wait for error
    await page.screenshot({ path: path.join(REPORT_DIR, '02_Login_Error.png') });

    await page.fill('input[placeholder="••••••••"]', userPass);
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=HATCH EGG', { timeout: 10000 });
    await page.screenshot({ path: path.join(REPORT_DIR, '02_Login_Success.png') });
  });

  // 情境三：首抽數位蛋 (Hatch Egg)
  test('Scenario 3: Hatch Egg', async ({ page }) => {
    await page.goto('./');
    await page.fill('input[placeholder="輸入帳號..."]', userEmail);
    await page.fill('input[placeholder="••••••••"]', userPass);
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=HATCH EGG');
    
    await page.click('text=HATCH EGG');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(REPORT_DIR, '03_Hatch_Egg.png') });
  });

  // 情境四 & 五 & 六：餵食、訓練、環境
  test('Scenario 4,5,6: Feed, Train, Clean', async ({ page }) => {
    await page.goto('./');
    await page.fill('input[placeholder="輸入帳號..."]', userEmail);
    await page.fill('input[placeholder="••••••••"]', userPass);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // 取得當前使用者 UID
    const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', userEmail)));
    const uid = userSnap.empty ? null : userSnap.docs[0].id;
    if (uid) {
       // 給予道具
       const invRef = doc(db, 'user_inventory', uid + '_meat_basic');
       await setDoc(invRef, { user_id: uid, item_id: 'meat_basic', quantity: 10 });
       await setDoc(doc(db, 'user_inventory', uid + '_medicine_standard'), { user_id: uid, item_id: 'medicine_standard', quantity: 10 });

       // 修改怪獸狀態
       const q = collection(db, 'monsters');
       const snaps = await getDocs(q);
       for (const d of snaps.docs) {
         if (d.data().user_id === uid) {
           await updateDoc(d.ref, { fullness: 20, cleanliness: 30, is_sick: true, life_stage: 2 });
         }
       }
    }
    
    await page.reload();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(REPORT_DIR, '04_Status_Hungry_Sick.png') });

    // 餵食
    await page.click('text=🍽️ 餵食');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(REPORT_DIR, '04_Feed_Menu.png') });
    await page.click('button:has-text("基本肉")');
    await page.waitForTimeout(1000);

    // 訓練
    await page.click('text=⚔️ 訓練');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(REPORT_DIR, '05_Train_Result.png') });

    // 環境清潔
    await page.click('text=🧹 打掃');
    await page.waitForTimeout(1000);

    // 治療
    await page.click('text=💊 治療');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(REPORT_DIR, '06_Clean_Heal_Result.png') });
  });

  // 情境七、八、九、十：進化、倉庫鎖定、晶片、繁衍
  test('Scenario 7,8,9,10: Evolution, Roster, Breed', async ({ page }) => {
    await page.goto('./');
    await page.fill('input[placeholder="輸入帳號..."]', userEmail);
    await page.fill('input[placeholder="••••••••"]', userPass);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // 注入兩隻滿級怪獸與道具
    const userSnap2 = await getDocs(query(collection(db, 'users'), where('email', '==', userEmail)));
    const uid2 = userSnap2.empty ? null : userSnap2.docs[0].id;
    if (uid2) {
       await setDoc(doc(db, 'monsters', 'test_mon_1'), {
         user_id: uid2, monster_id: 'test_mon_1', name: 'UltimateA',
         life_stage: 5, combat_atk: 50, combat_def: 50, combat_spd: 50, hp: 100, max_hp: 100, combat_hp: 100,
         birth_time: Date.now() - 86400000 * 5, is_dead: false, type: 1, fullness: 100, cleanliness: 100, is_sick: false, battles: 60, wins: 50
       });
       await setDoc(doc(db, 'monsters', 'test_mon_2'), {
         user_id: uid2, monster_id: 'test_mon_2', name: 'UltimateB',
         life_stage: 4, combat_atk: 40, combat_def: 40, combat_spd: 40, hp: 100, max_hp: 100, combat_hp: 100,
         birth_time: Date.now() - 86400000 * 3, is_dead: false, type: 2, fullness: 100, cleanliness: 100, is_sick: false, battles: 10, wins: 5
       });
       
       await setDoc(doc(db, 'user_inventory', uid2 + '_ultimate_core'), { user_id: uid2, item_id: 'ultimate_core', quantity: 5, item_type: 3 });
       await setDoc(doc(db, 'user_inventory', uid2 + '_chip_atk_1'), { user_id: uid2, item_id: 'chip_atk_1', quantity: 2, item_type: 4 });
       await setDoc(doc(db, 'user_inventory', uid2 + '_chip_extractor'), { user_id: uid2, item_id: 'chip_extractor', quantity: 2, item_type: 2 });
       await setDoc(doc(db, 'user_inventory', uid2 + '_breed_catalyst'), { user_id: uid2, item_id: 'breed_catalyst', quantity: 2, item_type: 5 });
       await setDoc(doc(db, 'users', uid2), { gold: 5000, stamina: 100, username: 'TestUser' }, { merge: true });
    }

    await page.reload();
    await page.waitForTimeout(2000);

    // 切換到 test_mon_1
    await page.click('text=切換怪獸');
    await page.waitForTimeout(1000);
    await page.selectOption('select', 'test_mon_1');
    await page.click('button:has-text("養成")');
    await page.waitForTimeout(1000);

    // 7. 究極進化
    await page.screenshot({ path: path.join(REPORT_DIR, '07_Before_Evolution.png') });
    await page.click('text=🧬 究極進化');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(REPORT_DIR, '07_After_Evolution.png') });

    // 8. 倉庫鎖定與 9. 晶片
    await page.click('button:has-text("倉庫")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(REPORT_DIR, '08_Roster_Lock_Release.png') });
    
    // 裝備晶片
    await page.click('button:has-text("裝備晶片")');
    await page.waitForTimeout(1000);
    if (await page.$('text=確認鑲嵌')) {
       await page.screenshot({ path: path.join(REPORT_DIR, '09_Equip_Chip.png') });
    }

    // 10. 繁衍
    await page.click('button:has-text("繁衍")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(REPORT_DIR, '10_Breed_Tab.png') });
  });

  // 情境十一、十二：連線與戰鬥
  test('Scenario 11, 12: Arena PvP', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Player A Login
    await pageA.goto('./');
    await pageA.fill('input[placeholder="輸入帳號..."]', userEmail);
    await pageA.fill('input[placeholder="••••••••"]', userPass);
    await pageA.click('button[type="submit"]');
    await pageA.waitForTimeout(3000);

    // Player B Register & Login
    const bEmail = `test_b_${uniqueId}@test.com`;
    await pageB.goto('./');
    await pageB.click('button:has-text("註冊新戶")');
    await pageB.fill('input[placeholder="輸入帳號..."]', `PlayerB_${uniqueId}`);
    await pageB.fill('input[placeholder="example@email.com"]', bEmail);
    await pageB.fill('input[placeholder="••••••••"]', 'password123');
    await pageB.click('button[type="submit"]');
    await pageB.waitForSelector('text=HATCH EGG', { timeout: 10000 });
    await pageB.click('text=HATCH EGG');
    await pageB.waitForTimeout(2000);

    // Both go to Arena
    await pageA.click('button:has-text("競技")');
    await pageB.click('button:has-text("競技")');
    await pageA.waitForTimeout(2000);
    await pageB.waitForTimeout(2000);

    // 11. World Chat
    await pageA.fill('input[placeholder="輸入訊息..."]', 'Hello World!');
    await pageA.click('text=發送');
    await pageA.waitForTimeout(1000);
    await pageB.screenshot({ path: path.join(REPORT_DIR, '11_World_Chat.png') });

    // 12. PvP Battle (Using Wild mock since local WebSocket isn't active in full setup)
    await pageA.click('button:has-text("野生挑戰")');
    await pageA.waitForTimeout(1000);
    
    const p1Btns = await pageA.$$('button:has-text("挑戰")');
    if (p1Btns.length > 0) {
      await p1Btns[0].click();
      await pageA.waitForTimeout(2000);
      await pageA.screenshot({ path: path.join(REPORT_DIR, '12_PvP_Battle_Screen.png') });
    }
    
    await contextA.close();
    await contextB.close();
  });

  // 情境十三、十四：公會與世界王
  test('Scenario 13, 14: Guild & Raid', async ({ page }) => {
    await page.goto('./');
    await page.fill('input[placeholder="輸入帳號..."]', userEmail);
    await page.fill('input[placeholder="••••••••"]', userPass);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // 13. Guild
    await page.click('button:has-text("公會")');
    await page.waitForTimeout(1000);
    await page.fill('input[placeholder="輸入公會名稱..."]', `TestGuild_${uniqueId}`);
    await page.click('button:has-text("創建公會")');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(REPORT_DIR, '13_Guild_Created.png') });

    // 14. Raid
    await page.click('button:has-text("討伐")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(REPORT_DIR, '14_Raid_Screen.png') });
  });
});
