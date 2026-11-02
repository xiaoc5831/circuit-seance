import { expect, type Page } from '@playwright/test';

/** Block (and record) every request that leaves localhost: judge mode must make zero external calls. */
export async function guardNetwork(page: Page): Promise<string[]> {
  const external: string[] = [];
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (/^(https?:\/\/(localhost|127\.0\.0\.1)|data:|blob:)/.test(url)) return route.continue();
    external.push(url);
    return route.abort();
  });
  return external;
}

export async function waitForTrace(page: Page) {
  await expect(page.getByTestId('sim-status')).toHaveAttribute('data-state', 'complete', { timeout: 60_000 });
  await expect(page.getByTestId('scope-canvas')).toHaveAttribute('data-has-trace', 'true');
}
