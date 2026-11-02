/**
 * "Possess a component": drag C1 in the RC low-pass and watch τ follow, then release.
 */
import { expect, test } from '@playwright/test';
import { guardNetwork, waitForTrace } from './helpers';

test('possess C1: slider rewrites the netlist, ngspice re-runs, τ follows, release restores', async ({ page }) => {
  const external = await guardNetwork(page);
  await page.goto('/?nointro');
  await page.getByRole('tab', { name: 'Bench' }).click();
  await page.getByTestId('bench-rc-lowpass').click();
  await waitForTrace(page);

  const panel = page.getByTestId('possess-panel');
  await expect(panel).toBeVisible();
  await page.getByTestId('possess-C1').click();
  await expect(page.getByTestId('possess-C1')).toHaveAttribute('aria-pressed', 'true');
  const slider = page.getByTestId('possess-slider');
  await expect(slider).toHaveValue('50');

  // keyboard: 17 steps right = ×10^(17/50) ≈ ×2.19
  await slider.focus();
  for (let i = 0; i < 17; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('possess-value')).toHaveText('2.19 µF');
  await expect(page.getByTestId('netlist-editor')).toHaveValue(/C1 out 0 2\.19u/);
  await expect(page.getByTestId('possess-readout')).toContainText(/2\.1\d ms/, { timeout: 20_000 });
  await expect(page.getByTestId('spirit-text')).toContainText('τ ≈ 2.1');
  // no "summoning" curtain between moves: the trace stays on screen
  await expect(page.locator('.scope-msg.busy')).toHaveCount(0);

  // drag to the far left (÷10)
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 1, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('possess-value')).toHaveText('100 nF');
  await expect(page.getByTestId('possess-readout')).toContainText(/(99|100|101) µs/, { timeout: 20_000 });

  await page.getByTestId('possess-release').click();
  await expect(page.getByTestId('netlist-editor')).toHaveValue(/C1 out 0 1u/);
  await expect(page.getByTestId('possess-slider')).toHaveCount(0);
  await waitForTrace(page);
  await expect(page.getByTestId('spirit-text')).toContainText('1 kΩ × 1 µF');
  expect(external).toEqual([]);
});

test('possess works in Chinese on a Haunted Classic (NE555 RB)', async ({ page }) => {
  await guardNetwork(page);
  await page.goto('/?nointro');
  await page.getByRole('button', { name: 'Switch language to Chinese' }).click();
  await page.getByRole('tab', { name: '闹鬼经典' }).click();
  await page.getByTestId('classic-ne555-astable').click();
  await waitForTrace(page);
  await expect(page.getByRole('heading', { name: '附身元件' })).toBeVisible();
  await page.getByTestId('possess-RB').click();
  const slider = page.getByTestId('possess-slider');
  await slider.focus();
  for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('possess-readout')).toContainText('kHz', { timeout: 20_000 });
  await expect(page.getByTestId('possess-readout')).toContainText('×');
});
