// Visual check for the editor: saves screenshots to the folder given as argv[2].
// Needs the dev server running. Set PW_CHANNEL=chrome to use an installed browser.
import { chromium } from '@playwright/test';

const out = process.argv[2];
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));

await page.goto('http://127.0.0.1:5173/');
await page.getByTestId('canvas').waitFor();
const box = await page.locator('.ed-page').boundingBox();
const at = (x, y) => [box.x + x, box.y + y];
const drag = async (a, b) => { await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { steps: 3 }); await page.mouse.move(...b, { steps: 3 }); await page.mouse.up(); };

await page.keyboard.press('s'); await drag(at(40, 40), at(160, 160));
await page.keyboard.press('y'); await drag(at(190, 40), at(300, 150));
await page.keyboard.press('Shift+L'); await drag(at(40, 200), at(300, 240));
await page.keyboard.press('p');
for (const p of [at(360, 60), at(480, 60), at(520, 160)]) await page.mouse.click(...p);
await drag(at(420, 230), at(380, 250));
await page.mouse.click(...at(360, 60));
await page.keyboard.press('Shift+P');
await page.mouse.move(...at(60, 300)); await page.mouse.down();
for (let i = 1; i <= 30; i++) await page.mouse.move(...at(60 + i * 14, 300 + Math.sin(i / 3) * 28));
await page.mouse.up();
await page.getByRole('button', { name: 'Shape tools' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/20-vector-tools.png` });

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
