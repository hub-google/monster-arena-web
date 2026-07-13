const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4000/firestore/default/data/user_inventory');
  await page.waitForTimeout(2000); // Wait for data to load
  await page.screenshot({ path: 'C:\\Users\\ET\\.gemini\\antigravity-ide\\brain\\13c3743b-ab29-490d-bead-10b7e732a4d4\\db_inventory_screenshot.png' });
  
  await page.goto('http://127.0.0.1:4000/firestore/default/data/monsters');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:\\Users\\ET\\.gemini\\antigravity-ide\\brain\\13c3743b-ab29-490d-bead-10b7e732a4d4\\db_monsters_screenshot.png' });
  
  await browser.close();
})();
