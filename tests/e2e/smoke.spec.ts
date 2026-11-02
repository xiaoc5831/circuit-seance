import { expect, test } from '@playwright/test';
import { guardNetwork, waitForTrace } from './helpers';

test('first visit: séance intro → RC drawing is read, simulated and explained, with no network calls', async ({ page }) => {
  const external = await guardNetwork(page);
  const t0 = Date.now();
  await page.goto('/');
  await expect(page.getByTestId('intro')).toBeVisible();
  // intro ends by itself (≤ 8 s) and auto-summons the RC sample
  await expect(page.getByTestId('intro')).toBeHidden({ timeout: 12_000 });
  await expect(page.getByTestId('tx-drawing')).toBeVisible();
  await expect(page.getByTestId('tx-text')).toContainText('```spice', { timeout: 5_000 });
  await expect(page.getByTestId('netlist-editor')).toHaveValue(/RC low-pass/i);
  await waitForTrace(page);
  console.log(`waveform after ${Date.now() - t0} ms (incl. intro)`);
  await expect(page.getByTestId('spirit-text')).toContainText('τ');
  await expect(page.getByTestId('spirit-text')).toContainText('1 kΩ × 1 µF');
  expect(external).toEqual([]);
});

test('intro is skippable with Esc (no warm-up race) and does not replay on the next visit', async ({ page }) => {
  await guardNetwork(page);
  await page.goto('/');
  await expect(page.getByTestId('intro')).toBeVisible();
  await page.keyboard.press('Escape'); // while the engine is still warming up
  await expect(page.getByTestId('intro')).toBeHidden();
  await waitForTrace(page);
  await page.reload();
  await expect(page.getByTestId('intro')).toHaveCount(0);
});

test('Haunted Classics: resurrect the NE555 and read its frequency', async ({ page }) => {
  await guardNetwork(page);
  await page.goto('/?nointro');
  await page.getByRole('tab', { name: 'Haunted Classics' }).click();
  await page.getByTestId('classic-ne555-astable').click();
  await expect(page.getByTestId('tx-text')).toContainText('SW555', { timeout: 5_000 });
  await waitForTrace(page);
  await expect(page.getByTestId('spirit-text')).toContainText('1/3 and 2/3');
  await expect(page.getByTestId('spirit-text')).toContainText(/kHz/);
});

test('edit the netlist, re-run with Ctrl+Enter, and check homework', async ({ page }) => {
  await guardNetwork(page);
  await page.goto('/?nointro');
  await page.getByRole('tab', { name: 'Bench' }).click();
  await page.getByTestId('bench-rc-lowpass').click();
  await waitForTrace(page);
  const ed = page.getByTestId('netlist-editor');
  const text = await ed.inputValue();
  await ed.fill(text.replace(/C1 out 0 1u/i, 'C1 out 0 2.2u'));
  await ed.press('Control+Enter');
  await waitForTrace(page);
  // edited circuit → rule-based reading, not the canned 1 ms story
  await expect(page.getByTestId('spirit-text')).not.toContainText('1 kΩ × 1 µF');
  await expect(page.getByTestId('spirit-text')).toContainText('τ ≈ 2.2');
  await page.getByText('Homework check').click();
  await page.getByLabel(/Time constant/).fill('2.2m');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.hw-result')).toContainText('Correct');
});

test('broken netlist shows the restless-spirits error, then recovers', async ({ page }) => {
  await guardNetwork(page);
  await page.goto('/?nointro');
  const ed = page.getByTestId('netlist-editor');
  await ed.fill('broken\nR1 in 0 1k\nQQ9 x y z nonsense\n.tran 1u 1m\n.end');
  await page.getByTestId('simulate').click();
  await expect(page.getByTestId('sim-status')).toHaveAttribute('data-state', 'error', { timeout: 60_000 });
  await expect(page.getByRole('alert')).toContainText('restless');
  await page.getByRole('tab', { name: 'Bench' }).click();
  await page.getByTestId('bench-rlc-ringing').click();
  await waitForTrace(page);
});

test('Chinese UI and bilingual spirit', async ({ page }) => {
  await guardNetwork(page);
  await page.goto('/?nointro');
  await page.getByRole('button', { name: 'Switch language to Chinese' }).click();
  await expect(page.getByRole('heading', { name: '招魂台' })).toBeVisible();
  await page.getByTestId('sample-rlc-ringing').click();
  await waitForTrace(page);
  await expect(page.getByTestId('spirit-text')).toContainText('欠阻尼');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
});

test('settings: Qwen-VL is the default and the key lives only in localStorage', async ({ page }) => {
  await guardNetwork(page);
  await page.goto('/?nointro');
  await page.getByTestId('open-settings').click();
  const dlg = page.getByTestId('settings');
  await expect(dlg.getByLabel('Provider')).toHaveValue('qwen-dashscope');
  await expect(dlg.getByLabel('Base URL')).toHaveValue(/dashscope/);
  await dlg.getByLabel('API key').fill('sk-test-not-real');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  await expect(page.getByText(/LIVE · Qwen-VL/)).toBeVisible();
  const stored = await page.evaluate(() => ({
    local: localStorage.getItem('seance.llm') ?? '',
    session: JSON.stringify(sessionStorage),
    cookie: document.cookie,
  }));
  expect(stored.local).toContain('sk-test-not-real');
  expect(stored.session).not.toContain('sk-test');
  expect(stored.cookie).not.toContain('sk-test');
  // forget
  await page.getByTestId('open-settings').click();
  await dlg.getByRole('button', { name: 'Forget key' }).click();
  expect(await page.evaluate(() => localStorage.getItem('seance.llm'))).not.toContain('sk-test');
});

test('keyboard: tabs move with arrow keys; scope knobs respond to keys', async ({ page }) => {
  await guardNetwork(page);
  await page.goto('/?nointro');
  await page.getByRole('tab', { name: 'Drawings' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Haunted Classics' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Haunted Classics' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Bench' }).click();
  await page.getByTestId('bench-rc-lowpass').click();
  await waitForTrace(page);
  const dial = page.locator('.knob').first().locator('.knob-dial');
  const before = await dial.textContent();
  await page.locator('.scope-screen').focus();
  await page.keyboard.press('ArrowUp');
  await expect(dial).not.toHaveText(before ?? '');
});

test('reduced motion: intro shows all lines at once; no horizontal overflow on a phone', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await guardNetwork(page);
  await page.goto('/');
  await expect(page.getByTestId('intro')).toContainText('Summoning the spirits');
  await page.getByRole('button', { name: /Skip intro/ }).click();
  await waitForTrace(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await ctx.close();
});
