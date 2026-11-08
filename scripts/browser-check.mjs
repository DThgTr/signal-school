import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
await mkdir('.runtime/screenshots', { recursive: true });
const cloud = process.argv.includes('--cloud');
const hostedUrl = process.argv.find(arg => arg.startsWith('--url='))?.slice(6);
let bearer;
if (process.argv.includes('--auth-stdin')) {
  process.stdin.setRawMode?.(true);
  console.log('Ready for hidden authentication JSON on stdin.');
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.includes('\u0003')) process.exit(130);
    if (input.includes('\n') || input.includes('\r')) break;
  }
  process.stdin.setRawMode?.(false);
  bearer = JSON.parse(input).bearer;
}
async function serveBuild(page) {
  await page.route('https://preview.test/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const base = resolve('dist');
    const file = resolve(base, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(base + sep)) return route.abort();
    const contentType = ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' })[extname(file)] || 'application/octet-stream';
    await route.fulfill({ status: 200, contentType, body: await readFile(file) });
  });
}
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (cloud && !hostedUrl) await serveBuild(page);
  if (hostedUrl && bearer) await page.route(new URL(hostedUrl).origin + '/**', route => route.continue({ headers: { ...route.request().headers(), 'OAI-Sites-Authorization': `Bearer ${bearer}` } }));
  await page.goto(hostedUrl || (cloud ? 'https://preview.test/' : 'http://127.0.0.1:5173/'));
  await page.getByText('Progress saved to SpacetimeDB', { exact: true }).waitFor();
  await page.screenshot({ path: '.runtime/screenshots/home-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Start training', exact: true }).click();
  await page.getByRole('heading', { name: 'The account alert', exact: true }).waitFor();
  await page.getByRole('button', { name: /Ask for more details/ }).click();
  await page.getByText('Decision 2 of up to 2').waitFor();
  await page.reload();
  await page.getByText('Decision 2 of up to 2').waitFor();
  await page.getByRole('button', { name: /Accept their explanation/ }).click();
  await page.getByRole('heading', { name: 'A useful moment to pause.' }).waitFor();
  await page.getByText('LIVE NEMOTRON', { exact: true }).waitFor({ timeout: 90000 });
  await page.screenshot({ path: '.runtime/screenshots/result-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Try next adapted exercise' }).click();
  await page.getByRole('heading', { name: 'The account alert', exact: true }).waitFor();
  await page.getByRole('button', { name: /End this chat and contact/ }).click();
  await page.getByRole('heading', { name: 'A thoughtful next step.' }).waitFor();
  await page.getByRole('button', { name: 'Back to practice' }).click();
  await page.getByRole('button', { name: /Try a legitimate request/ }).click();
  await page.getByRole('button', { name: /Check my existing invoice/ }).click();
  await page.getByText('No strong signals', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Back to practice' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.runtime/screenshots/home-mobile.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No mobile horizontal overflow');
  await page.getByRole('button', { name: 'Reset practice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset practice', exact: true }).click();
  await page.getByText('0 exercises completed').waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: desktop/mobile UI, two-turn flow, refresh, real AI coaching, adaptation, legitimate control, reset, no page errors');
  const preview = await browser.newPage();
  await serveBuild(preview);
  await preview.routeWebSocket('**/v1/database/**', socket => socket.close());
  await preview.goto('https://preview.test/');
  await preview.getByRole('heading', { name: 'Training server unavailable' }).waitFor();
  assert.equal(await preview.getByRole('button', { name: 'Start training', exact: true }).count(), 0);
  assert.equal(await preview.getByRole('button', { name: 'Browser practice' }).count(), 0);
  await preview.evaluate(() => localStorage.setItem('signal-school-practice-v1', JSON.stringify({version:1,scores:{authority:100,urgency:100,verification:100},history:[],trace:[]})));
  await preview.reload();
  await preview.getByRole('heading', { name: 'Training server unavailable' }).waitFor();
  console.log('PASS: disconnected production site cannot train or load legacy browser-only progress');
  await page.routeWebSocket('**/v1/database/**', socket => socket.close());
  await page.reload();
  await page.getByRole('heading', { name: 'Training server unavailable' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Browser practice' }).count(), 0);
  await page.unrouteAll();
  console.log('PASS: failed server connection offers no local simulation');
} finally { await browser.close(); }
