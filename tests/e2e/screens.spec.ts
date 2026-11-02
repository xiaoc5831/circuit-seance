/**
 * Screenshot tour for docs/screenshots (README + Devpost). Run with SCREENS=1 scripts/e2e.sh screens
 */
import { expect, test } from '@playwright/test';
import { guardNetwork, waitForTrace } from './helpers';

const OUT = 'docs/screenshots';
test.skip(!process.env.SCREENS, 'set SCREENS=1 to regenerate screenshots');

test('desktop tour A', async ({ page }) => {
  await guardNetwork(page);
  await page.goto('/');
  await page.waitForTimeout(3600);
  await page.screenshot({ path: `${OUT}/01-intro.png` });
  await expect(page.getByTestId('intro')).toBeHidden({ timeout: 12_000 });
  await waitForTrace(page);
  await page.waitForTimeout(1600);
  await page.mouse.move(1180, 420);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/02-rc-demo.png` });
  await page.getByRole('tab', { name: 'Haunted Classics' }).click();
  await page.screenshot({ path: `${OUT}/03-classics.png` });
  await page.getByTestId('classic-ne555-astable').click();
  await waitForTrace(page);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/04-ne555.png` });
  await page.getByTestId('classic-rc-ladder').click();
  await waitForTrace(page);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/05-bode.png` });
});

test('desktop tour B', async ({ page }) => {
  await guardNetwork(page);
  await page.goto('/?nointro');
  await page.screenshot({ path: `${OUT}/06-empty.png` });
  await page.getByRole('button', { name: 'Switch language to Chinese' }).click();
  await page.getByTestId('sample-rlc-ringing').click();
  await waitForTrace(page);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/07-zh-rlc.png` });
  await page.getByRole('button', { name: '切换为英文' }).click();
  await page.getByRole('tab', { name: 'Bench' }).click();
  await page.getByTestId('bench-rc-lowpass').click();
  await waitForTrace(page);
  const ed = page.getByTestId('netlist-editor');
  await ed.fill((await ed.inputValue()).replace(/C1 out 0 1u/i, 'C1 out 0 2.2u'));
  await ed.press('Control+Enter');
  await waitForTrace(page);
  await page.getByText('Homework check').click();
  await page.getByLabel(/Time constant/).fill('2.2m');
  await page.getByRole('button', { name: 'Check' }).click();
  await page.waitForTimeout(1200);
  await page.locator('.spirit-panel').screenshot({ path: `${OUT}/08-homework.png` });
  await ed.fill('broken\nR1 in 0 1k\nQQ9 x y z nonsense\n.tran 1u 1m\n.end');
  await page.getByTestId('simulate').click();
  await expect(page.getByTestId('sim-status')).toHaveAttribute('data-state', 'error');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/09-error.png` });
  await page.getByTestId('open-settings').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/10-settings.png` });
});

test('mobile', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await guardNetwork(page);
  await page.goto('/?nointro');
  await page.getByTestId('sample-diode-rectifier').click();
  await waitForTrace(page);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/11-mobile.png` });
  await page.screenshot({ path: `${OUT}/12-mobile-full.png`, fullPage: true });
  await ctx.close();
});
