// End-to-end smoke test of the production build.
// Usage: node e2e/smoke.mjs <url>          e.g. http://localhost:4200
// Set SHOTS=<dir> to also save the screenshots used in the README.
import { chromium } from 'playwright';

const base = (process.argv[2] ?? 'http://localhost:4200').replace(/\/$/, '');
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin });
const page = await context.newPage();

const consoleErrors = [];
const watch = (p) => {
  p.on('console', (msg) => msg.type() === 'error' && consoleErrors.push(msg.text()));
  p.on('pageerror', (err) => consoleErrors.push(err.message));
};
watch(page);

const cards = () => page.getByTestId('field-card');
const inspector = () => page.locator('fl-inspector');
const step = async (name, fn) => {
  process.stdout.write(`• ${name} … `);
  await fn();
  console.log('ok');
};
const expectCount = (_locator, n) =>
  page.waitForFunction((count) => document.querySelectorAll('[data-testid="field-card"]').length === count, n, {
    timeout: 10000,
  });
const shotsDir = process.env.SHOTS;
const shot = async (name, p = page) => {
  if (!shotsDir) return;
  // Downscale via a scratch page so the image stays small.
  const png = await p.screenshot({ type: 'png' });
  const scratch = await browser.newPage({ viewport: { width: 1280, height: 847 } });
  await scratch.setContent(
    `<body style="margin:0"><img style="width:1280px;display:block" src="data:image/png;base64,${png.toString('base64')}"></body>`,
  );
  await scratch.screenshot({ path: `${shotsDir}/${name}.jpg`, type: 'jpeg', quality: 72 });
  await scratch.close();
};
const setLabel = async (label) => {
  await inspector().getByTestId('prop-label').fill(label);
};

try {
  await step('opens on the designer with the starter template', async () => {
    await page.goto(`${base}/`);
    await page.waitForURL(/\/design$/);
    await page.locator('.title__input').waitFor();
    if ((await page.locator('.title__input').inputValue()) !== 'Job application') throw new Error('Wrong starter form');
    await expectCount(cards(), 11);
    await cards().nth(3).click();
    await shot('1-design');
    await page.getByRole('link', { name: 'Preview' }).click();
    await page.getByTestId('submit').click();
    await page.waitForTimeout(300);
    await shot('2-preview');
    await page.getByRole('link', { name: 'Design' }).click();
  });

  await step('starts a blank form from the templates menu', async () => {
    await page.getByLabel('Start from a template').selectOption('blank');
    await page.getByText('This form is empty.').waitFor();
    await expectCount(cards(), 0);
  });

  await step('adds and configures fields from the palette', async () => {
    await page.getByTestId('add-text').click();
    await setLabel('Full name');
    await inspector().getByTestId('prop-required').check();
    if ((await inspector().getByTestId('prop-key').inputValue()) !== 'fullName') throw new Error('Key did not follow label');

    await page.getByTestId('add-checkbox').click();
    await setLabel('Bringing a guest?');

    await page.getByTestId('add-text').click();
    await setLabel('Guest name');
    await inspector().getByTestId('prop-required').check();
    await inspector().getByTestId('rule-source').selectOption({ label: 'Only when "Bringing a guest?"…' });
    await cards().nth(2).getByText('Shown when "Bringing a guest?" is checked').waitFor();
    await expectCount(cards(), 3);
  });

  await step('drags a field from the palette onto the canvas', async () => {
    const source = page.locator('.palette__list li').filter({ hasText: 'Email' });
    const target = cards().first();
    const from = await source.boundingBox();
    const to = await target.boundingBox();
    await page.mouse.move(from.x + 20, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + from.height / 2 + 10, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + 8, { steps: 20 });
    await page.mouse.up();
    await expectCount(cards(), 4);
    await cards().filter({ hasText: 'Email' }).first().waitFor();
  });

  await step('undo and redo with the keyboard', async () => {
    await page.locator('.canvas').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('Control+z');
    await expectCount(cards(), 3);
    await page.keyboard.press('Control+Shift+z');
    await expectCount(cards(), 4);
  });

  await step('preview enforces validation and conditional fields', async () => {
    await page.getByRole('link', { name: 'Preview' }).click();
    await page.locator('[data-key="fullName"]').waitFor();
    if (await page.locator('[data-key="guestName"]').count()) throw new Error('Guest name should start hidden');

    await page.getByTestId('submit').click();
    await page.getByTestId('error-summary').waitFor();

    await page.locator('[data-key="fullName"] input').fill('Ada Lovelace');
    await page.locator('[data-key="bringingAGuest"] input').check();
    await page.locator('[data-key="guestName"]').waitFor();
    await page.getByTestId('submit').click();
    await page.getByTestId('error-summary').getByText('1 field needs attention').waitFor();

    await page.locator('[data-key="guestName"] input').fill('Charles Babbage');
    await page.getByTestId('submit').click();
    const result = JSON.parse(await page.getByTestId('result').innerText());
    await shot('3-submitted');
    if (result.fullName !== 'Ada Lovelace' || result.guestName !== 'Charles Babbage' || result.bringingAGuest !== true) {
      throw new Error(`Unexpected submission: ${JSON.stringify(result)}`);
    }
  });

  await step('JSON view exports and validates imports', async () => {
    await page.getByRole('link', { name: 'JSON' }).click();
    await page.getByTestId('schema-json').getByText('"key": "guestName"').waitFor();
    await page.getByTestId('import-input').fill('{ "fields": [{ "type": "slider", "key": "x" }] }');
    await page.getByRole('button', { name: 'Import JSON' }).click();
    await page.getByTestId('import-errors').getByText('fields[0].type').waitFor();
  });

  await step('share link opens the same form in a fresh browser', async () => {
    await page.getByRole('button', { name: 'Copy share link' }).click();
    await page.getByText('Share link copied').waitFor();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    if (!link.includes('/preview?form=z.')) throw new Error(`Unexpected link: ${link}`);

    const other = await (await browser.newContext()).newPage();
    watch(other);
    await other.goto(link);
    await other.locator('[data-key="fullName"]').waitFor();
    await other.getByText('Opened "Untitled form" from a share link').waitFor();
    await other.waitForURL((url) => !url.search.includes('form='));
    await other.close();
  });

  await step('work is autosaved across reloads', async () => {
    await page.reload();
    await page.getByRole('link', { name: 'Design' }).click();
    await expectCount(cards(), 4);
  });

  await step('deep links load directly', async () => {
    await page.goto(`${base}/json`);
    await page.getByTestId('schema-json').waitFor();
  });

  const relevant = consoleErrors.filter((e) => !/favicon|status of 404|fonts\.g/.test(e));
  if (relevant.length) throw new Error(`Console errors:\n${relevant.join('\n')}`);
  console.log('\nSmoke test passed.');
} catch (err) {
  console.log('FAILED');
  console.error(err);
  console.error('URL:', page.url());
  console.error('Console errors:', consoleErrors.join('\n') || '(none)');
  console.error('Visible text:', (await page.locator('body').innerText().catch(() => '')).slice(0, 1500));
  process.exitCode = 1;
} finally {
  await browser.close();
}
