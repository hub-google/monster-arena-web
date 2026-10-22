import { test, expect } from '@playwright/test';

test('production build boots to login and registration without runtime exceptions', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'MONSTER ARENA' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: '登入帳號' })).toBeVisible();
  await expect(page.getByRole('button', { name: '註冊新戶' })).toBeVisible();

  await page.getByRole('button', { name: '註冊新戶' }).click();
  await expect(page.getByPlaceholder('example@email.com')).toBeVisible();

  await page.getByRole('button', { name: '登入帳號' }).click();
  await expect(page.getByPlaceholder('example@email.com')).toHaveCount(0);
  expect(errors).toEqual([]);
});
