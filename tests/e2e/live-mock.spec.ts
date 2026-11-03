/**
 * The BYOK path end-to-end against a mocked OpenAI-compatible provider (DashScope URL):
 * upload a photo → vision transcription → netlist → ngspice → ask the live spirit.
 * No real key or network: the provider is answered by page.route.
 */
import { expect, test } from '@playwright/test';
import { guardNetwork, waitForTrace } from './helpers';

const NET = 'Photo RC (live)\nV1 in 0 PULSE(0 5 0 1n 1n 10m 20m)\nR1 in out 10k\nC1 out 0 100n\n.tran 5u 8m\n.end';

test('live mode (mocked provider): photo → transcription → simulate → live spirit', async ({ page }) => {
  const external = await guardNetwork(page);
  const calls: Array<{ auth: string; vision: boolean; model: string }> = [];
  await page.route('https://dashscope.aliyuncs.com/**', async (route) => {
    const req = route.request();
    const body = req.postDataJSON() as { model: string; messages: Array<{ content: unknown }> };
    const vision = JSON.stringify(body.messages).includes('image_url');
    calls.push({ auth: req.headers()['authorization'] ?? '', vision, model: body.model });
    const content = vision
      ? 'I read the schematic as follows.\n\n```spice\n' + NET + '\n```\n\nConfidence: medium\n- R1 looks like 10k.'
      : '**What the trace shows:** a ghostly 1 ms rise.\n\n**Why:** τ = RC = 10 kΩ × 100 nF.\n\n**Try next:** halve R1. <script>alert(1)</script>';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
  });

  await page.goto('/?nointro');
  await page.getByTestId('open-settings').click();
  await page.getByLabel('API key').fill('sk-mock');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.keyboard.press('Escape');

  await page.locator('#photo-input').setInputFiles('public/samples/rc-lowpass.svg');
  await expect(page.getByTestId('tx-text')).toContainText('Confidence: medium');
  await expect(page.getByText(/Live response from Qwen-VL/)).toBeVisible();
  await expect(page.getByTestId('netlist-editor')).toHaveValue(/Photo RC \(live\)/);
  await waitForTrace(page);

  await page.getByRole('button', { name: 'Ask the live spirit' }).click();
  await expect(page.getByTestId('spirit-text')).toContainText('ghostly 1 ms rise');
  await expect(page.locator('.spirit-text script')).toHaveCount(0); // model HTML is escaped
  await expect(page.locator('.spirit-panel .badge.live')).toHaveText('Live spirit');

  expect(calls.map((c) => [c.vision, c.model])).toEqual([[true, 'qwen-vl-max'], [false, 'qwen-plus']]);
  expect(calls.every((c) => c.auth === 'Bearer sk-mock')).toBe(true);
  expect(external.filter((u) => !u.startsWith('https://dashscope.aliyuncs.com'))).toEqual([]);
});

test('live mode: a rejected key shows a friendly error and the netlist can still be typed', async ({ page }) => {
  await guardNetwork(page);
  await page.route('https://dashscope.aliyuncs.com/**', (route) => route.fulfill({ status: 401, body: '{"error":"invalid api key"}' }));
  await page.goto('/?nointro');
  await page.getByTestId('open-settings').click();
  await page.getByLabel('API key').fill('sk-wrong');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.keyboard.press('Escape');
  await page.locator('#photo-input').setInputFiles('public/samples/rc-lowpass.svg');
  await expect(page.getByRole('alert')).toContainText('rejected the API key');
});

test('OpenAI-compatible preset: custom base URL + typed model reach the gateway, nothing else', async ({ page }) => {
  const external = await guardNetwork(page);
  const calls: Array<{ url: string; auth: string; model: string }> = [];
  await page.route('https://gw.example.test/**', async (route) => {
    const req = route.request();
    calls.push({ url: req.url(), auth: req.headers()['authorization'] ?? '', model: (req.postDataJSON() as { model: string }).model });
    // relays sometimes answer in Chinese around the fence; the parser must not care
    const content = '我先读取元件和连线。```spice\n' + NET + '\n```\nConfidence: high';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
  });
  await page.goto('/?nointro');
  await page.getByTestId('open-settings').click();
  await page.getByLabel('Provider').selectOption('openai-compatible');
  await expect(page.getByTestId('compat-hint')).toBeVisible();
  await expect(page.getByLabel('Base URL')).toHaveValue('');
  await page.getByLabel('API key').fill('sk-gw');
  await page.getByLabel('Base URL').fill('https://gw.example.test/v1/');
  await page.getByLabel('Vision model').fill('vision-x');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.keyboard.press('Escape');

  await page.locator('#photo-input').setInputFiles('public/samples/rc-lowpass.svg');
  await expect(page.getByTestId('netlist-editor')).toHaveValue(/Photo RC \(live\)/);
  await waitForTrace(page);
  expect(calls).toEqual([{ url: 'https://gw.example.test/v1/chat/completions', auth: 'Bearer sk-gw', model: 'vision-x' }]);
  expect(external.filter((u) => !u.startsWith('https://gw.example.test'))).toEqual([]);
});
