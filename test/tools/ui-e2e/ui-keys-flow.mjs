import { chromium } from 'playwright';

const BASE = 'http://localhost:8080';

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

async function getOwnKey(page) {
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/encrypt_key/', { credentials: 'include' });
    const status = response.status;
    if (status === 204 || status === 404) {
      return { status, body: null };
    }
    const body = await response.json();
    return { status, body };
  });
  return result;
}

async function register(page, username, password) {
  await page.goto(`${BASE}/auth/reg`, { waitUntil: 'domcontentloaded' });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/chat\.html$/, { timeout: 20000 });
}

async function login(page, username, password) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/chat\.html$/, { timeout: 20000 });
}

async function logout(page) {
  await page.click('#logoutBtn');
  await page.waitForURL(/\/auth\/login$/, { timeout: 20000 });
}

async function readDbSnapshot(page) {
  return page.evaluate(async () => {
    const openReq = indexedDB.open('mescat_frontend_v2', 1);
    const db = await new Promise((resolve, reject) => {
      openReq.onsuccess = () => resolve(openReq.result);
      openReq.onerror = () => reject(openReq.error);
    });

    const tx = db.transaction(['user_keys'], 'readonly');
    const store = tx.objectStore('user_keys');
    const all = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    return all;
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const username = `ui_keys_${suffix}`;
  const password = 'P@ssword12345';

  console.log('STEP 1: СЂРµРіРёСЃС‚СЂР°С†РёСЏ С‡РµСЂРµР· UI');
  await register(page, username, password);
  await waitForKeyReady(page);
  const userId1 = (await page.textContent('#userId'))?.trim();
  expect(userId1, 'userId РЅРµ РѕС‚РѕР±СЂР°Р·РёР»СЃСЏ РїРѕСЃР»Рµ СЂРµРіРёСЃС‚СЂР°С†РёРё');

  const key1 = await getOwnKey(page);
  expect(key1.status === 200, `РїСѓР±Р»РёС‡РЅС‹Р№ РєР»СЋС‡ РїРѕСЃР»Рµ СЂРµРіРёСЃС‚СЂР°С†РёРё: status=${key1.status}`);
  expect(key1.body?.id, 'РїРѕСЃР»Рµ СЂРµРіРёСЃС‚СЂР°С†РёРё РЅРµ РїРѕР»СѓС‡РµРЅ key.id');
  const firstKeyId = String(key1.body.id);
  console.log(`  userId=${userId1}, keyId=${firstKeyId}`);

  console.log('STEP 2: logout -> login Рё РїРѕРІС‚РѕСЂРЅР°СЏ РїСЂРѕРІРµСЂРєР° РєР»СЋС‡Р°');
  await logout(page);
  await login(page, username, password);
  await waitForKeyReady(page);

  const userId2 = (await page.textContent('#userId'))?.trim();
  expect(userId1 === userId2, `userId РїРѕСЃР»Рµ РїРѕРІС‚РѕСЂРЅРѕРіРѕ РІС…РѕРґР° РёР·РјРµРЅРёР»СЃСЏ: ${userId1} -> ${userId2}`);

  const key2 = await getOwnKey(page);
  expect(key2.status === 200, `РїСѓР±Р»РёС‡РЅС‹Р№ РєР»СЋС‡ РїРѕСЃР»Рµ РїРѕРІС‚РѕСЂРЅРѕРіРѕ РІС…РѕРґР°: status=${key2.status}`);
  expect(String(key2.body?.id) === firstKeyId, `keyId РїРѕСЃР»Рµ РїРѕРІС‚РѕСЂРЅРѕРіРѕ РІС…РѕРґР° РёР·РјРµРЅРёР»СЃСЏ: ${firstKeyId} -> ${key2.body?.id}`);

  console.log('STEP 3: РїРµСЂРµР·Р°РіСЂСѓР·РєР° СЃС‚СЂР°РЅРёС†С‹ Рё РїСЂРѕРІРµСЂРєР° РєР»СЋС‡Р°');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForKeyReady(page);

  const key3 = await getOwnKey(page);
  expect(key3.status === 200, `РїСѓР±Р»РёС‡РЅС‹Р№ РєР»СЋС‡ РїРѕСЃР»Рµ reload: status=${key3.status}`);
  expect(String(key3.body?.id) === firstKeyId, `keyId РїРѕСЃР»Рµ reload РёР·РјРµРЅРёР»СЃСЏ: ${firstKeyId} -> ${key3.body?.id}`);

  const dbRows = await readDbSnapshot(page);
  expect(Array.isArray(dbRows) && dbRows.length > 0, 'РІ IndexedDB РЅРµ РЅР°Р№РґРµРЅРѕ РЅРё РѕРґРЅРѕРіРѕ user_key');
  const currentRows = dbRows.filter((row) => row.isCurrent);
  expect(currentRows.length === 1, `РѕР¶РёРґР°Р»СЃСЏ 1 С‚РµРєСѓС‰РёР№ РєР»СЋС‡ РІ IndexedDB, РїРѕР»СѓС‡РµРЅРѕ ${currentRows.length}`);

  console.log('STEP 4: СЂРµР·СѓР»СЊС‚Р°С‚');
  console.log(`  username=${username}`);
  console.log(`  userId=${userId1}`);
  console.log(`  keyId=${firstKeyId}`);
  console.log(`  indexedDbKeys=${dbRows.length}`);
  console.log('UI KEY FLOW RESULT: OK');

  await browser.close();
}

run().catch((error) => {
  console.error('UI KEY FLOW RESULT: FAILED');
  console.error(error?.stack || String(error));
  process.exit(1);
});
