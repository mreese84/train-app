import { expect, test, type Page } from '@playwright/test';

async function noHorizontalOverflow(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll, 'page should not scroll sideways').toBeLessThanOrEqual(width);
}

test('Today → Strength A → check a set → reload → still checked', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await noHorizontalOverflow(page);

  // Open Strength A manually (works whatever day the test runs).
  await page.getByRole('button', { name: 'Strength A', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Strength A' })).toBeVisible();
  await noHorizontalOverflow(page);

  await page.getByRole('button', { name: /^(Start|Continue)$/ }).click();
  await expect(page.getByRole('heading', { name: 'Trap bar deadlift' })).toBeVisible();
  await expect(page.getByRole('img', { name: /trap bar/i })).toBeVisible();
  await noHorizontalOverflow(page);

  await page.getByRole('textbox', { name: 'Set 1 weight in lb' }).fill('95');
  const check = page.getByRole('button', { name: 'Mark set 1 done' });
  await check.click();
  const done = page.getByRole('button', { name: /Set 1 done/ });
  await expect(done).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('timer')).toBeVisible(); // rest timer bar

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Trap bar deadlift' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Set 1 done/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: 'Set 1 weight in lb' })).toHaveValue('95');
});

test('other screens fit 390px without sideways scroll', async ({ page }) => {
  for (const path of ['#/', '#/history', '#/history/exercises', '#/settings', '#/cardio']) {
    await page.goto(`./${path}`);
    await page.waitForTimeout(300);
    await noHorizontalOverflow(page);
  }
  // A mobility session with a timed hold.
  await page.goto('./');
  await page.getByRole('button', { name: 'Golf mobility', exact: true }).click();
  await page.getByRole('button', { name: /Half-kneeling hip flexor stretch/ }).click();
  await expect(page.getByRole('button', { name: /Start timer/ })).toBeVisible();
  await noHorizontalOverflow(page);
});
