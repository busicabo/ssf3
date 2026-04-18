import { chromium } from 'playwright';

const BASE = 'http://localhost:8080';

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForChat(page) {
  await page.waitForURL(/\/chat\.html$/, { timeout: 20000 });
  await page.waitForSelector('#userId', { timeout: 10000 });
}

async function waitForKeyReady(page) {
  const deadline = Date.now() + 60000;

  while (Date.now() < deadline) {
    const ready = await page.evaluate(() => {
      const keyState = document.getElementById('keyState');
      if (!keyState) return false;
      const text = (keyState.textContent || '').trim();
      return keyState.classList.contains('good') && text.length > 0;
    });

    if (ready) {
      return;
    }

    await page.waitForTimeout(500);
  }

  const snapshot = await page.evaluate(() => {
    const keyState = document.getElementById('keyState');
    const statuses = Array.from(document.querySelectorAll('#statusList .status-item'))
      .slice(0, 8)
      .map((x) => x.textContent || '');
    return {
      href: window.location.href,
      keyState: keyState?.textContent || null,
      keyStateClass: keyState?.className || null,
      statuses
    };
  });

  throw new Error(`waitForKeyReady timeout: ${JSON.stringify(snapshot)}`);
}

async function register(page, username, password) {
  await page.goto(`${BASE}/auth/reg`, { waitUntil: 'domcontentloaded' });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await waitForChat(page);
}

async function login(page, username, password) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await waitForChat(page);
}

async function getOwnKey(page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/encrypt_key/', { credentials: 'include' });
    if (response.status === 204 || response.status === 404) {
      return { status: response.status, body: null };
    }
    return { status: response.status, body: await response.json() };
  });
}

async function clearFrontendDb(page) {
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase('mescat_frontend_v2');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const username = `ui_keys_edge_${suffix}`;
  const password = 'P@ssword12345';

  console.log('STEP 1: регистрация и первичное создание ключа');
  await register(page, username, password);
  await waitForKeyReady(page);
  const first = await getOwnKey(page);
  expect(first.status === 200 && first.body?.id, 'после регистрации сервер не вернул key.id');
  const firstKeyId = String(first.body.id);
  console.log(`  firstKeyId=${firstKeyId}`);

  console.log('STEP 2: эмуляция потери локальной БД ключей (delete IndexedDB)');
  await clearFrontendDb(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForKeyReady(page);
  const second = await getOwnKey(page);
  expect(second.status === 200 && second.body?.id, 'после потери IndexedDB ключ не восстановился');
  const secondKeyId = String(second.body.id);
  console.log(`  secondKeyId=${secondKeyId}`);

  console.log('STEP 3: logout/login после потери локальной БД');
  await page.click('#logoutBtn');
  await page.waitForURL(/\/auth\/login$/, { timeout: 20000 });
  await login(page, username, password);
  await waitForKeyReady(page);
  const third = await getOwnKey(page);
  expect(third.status === 200 && third.body?.id, 'после повторного входа ключ не готов');
  console.log(`  thirdKeyId=${third.body.id}`);

  console.log('UI KEY EDGE FLOW RESULT: OK');
  await browser.close();
}

run().catch((error) => {
  console.error('UI KEY EDGE FLOW RESULT: FAILED');
  console.error(error?.stack || String(error));
  process.exit(1);
});
