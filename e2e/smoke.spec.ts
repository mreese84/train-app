import { expect, test, type Page } from '@playwright/test';

async function noHorizontalOverflow(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll, 'page should not scroll sideways').toBeLessThanOrEqual(width);
}

/** Counts checked sets stored in the app's IndexedDB (runs in the page). */
function doneSetCount(): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('train');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction('sets', 'readonly');
      const all = tx.objectStore('sets').getAll();
      all.onsuccess = () => {
        resolve((all.result as { done: boolean }[]).filter((s) => s.done).length);
        req.result.close();
      };
      all.onerror = () => reject(all.error);
    };
  });
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

  // Wait until the checked set is committed to IndexedDB, then reload.
  await expect.poll(() => page.evaluate(doneSetCount)).toBe(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Trap bar deadlift' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Set 1 done/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: 'Set 1 weight in lb' })).toHaveValue('95');

  // Relaunching the app at its start URL resumes the unfinished session.
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Trap bar deadlift' })).toBeVisible();
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

test('warm-up returns to Strength A, and finishing saves to history', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Strength A', exact: true }).click();
  await page.getByRole('button', { name: /Warm-up: Golf mobility/ }).click();
  await expect(page.getByRole('heading', { name: 'Golf mobility' })).toBeVisible();

  // Finish the warm-up early: it should return to Strength A with the step done.
  await page.getByRole('button', { name: 'Finish session' }).click();
  await page.getByRole('button', { name: 'Save & finish' }).click();
  await expect(page.getByRole('heading', { name: 'Strength A' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Warm-up: Golf mobility/ }).getByLabel('Done')).toBeVisible();

  // Finish Strength A with a note.
  await page.getByRole('button', { name: 'Finish session' }).click();
  await page.getByLabel('Session note (optional)').fill('Felt good');
  await page.getByRole('button', { name: 'Save & finish' }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();

  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByRole('button', { name: /^Strength A\b/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Golf mobility \(warm-up\)/ })).toBeVisible();
});

test('works offline after the first load', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  // Wait for the service worker to install and precache the app.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await page.getByRole('button', { name: 'Strength B', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Strength B' })).toBeVisible();
  await context.setOffline(false);
});
