const puppeteer = require('puppeteer');
const fs = require('fs');

async function delay(time) {
  return new Promise(function(resolve) { 
      setTimeout(resolve, time)
  });
}

(async () => {
  if (!fs.existsSync('screenshots')){
    fs.mkdirSync('screenshots');
  }

  console.log("Launching browser...");
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  // Set viewport to mobile size since it's MobileLayout
  await page.setViewport({ width: 480, height: 850 });

  console.log("Navigating to GitPages...");
  try {
    await page.goto('https://hub-google.github.io/monster-arena-web/', { waitUntil: 'networkidle2', timeout: 30000 });
  } catch (e) {
    console.log("Navigation timeout, proceeding anyway...");
  }

  await delay(2000);
  console.log("Taking screenshot of initial load...");
  await page.screenshot({ path: 'screenshots/01_initial_load.png' });

  // Scenario 1: Switch to Register
  try {
    console.log("Switching to Register tab...");
    const tabs = await page.$$('button');
    for (let btn of tabs) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('註冊新戶')) {
        await btn.click();
        break;
      }
    }
    await delay(1000);
    await page.screenshot({ path: 'screenshots/02_register_tab.png' });
    
    // Fill in register form
    const inputs = await page.$$('input');
    if (inputs.length >= 3) {
      // Username, Email, Password
      await inputs[0].type(`TestUser_${Date.now()}`);
      await inputs[1].type(`test${Date.now()}@example.com`);
      await inputs[2].type('password123');
      
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) {
        await submitBtn.click();
        console.log("Registration submitted. Waiting for load...");
        await delay(5000); // wait for data load
        await page.screenshot({ path: 'screenshots/03_dashboard_after_register.png' });
      }
    }
  } catch (err) {
    console.error("Error during register scenario:", err);
  }

  // Navigate through tabs if we are on Dashboard
  try {
    const bottomNavButtons = await page.$$('.bottom-nav-item');
    if (bottomNavButtons.length > 0) {
      for (let i = 0; i < bottomNavButtons.length; i++) {
        const text = await page.evaluate(el => el.textContent, bottomNavButtons[i]);
        console.log(`Clicking tab: ${text}`);
        await bottomNavButtons[i].click();
        await delay(2000);
        await page.screenshot({ path: `screenshots/04_tab_${i}_${text}.png` });
      }
    } else {
      console.log("Could not find bottom navigation buttons.");
    }
  } catch (err) {
    console.error("Error navigating tabs:", err);
  }

  await browser.close();
  console.log("Tests completed. Screenshots saved to /screenshots directory.");
})();
