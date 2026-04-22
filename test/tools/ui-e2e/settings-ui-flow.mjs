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
      return Boolean(keyState && (keyState.classList.contains('good') || keyState.classList.contains('is-good')));
    });

    if (ready) {
      return;
    }

    await page.waitForTimeout(500);
  }

  throw new Error('Ключи пользователя не перешли в готовое состояние.');
}

async function register(page, username, password) {
  await page.goto(`${BASE}/auth/reg`, { waitUntil: 'domcontentloaded' });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/chat\.html$/, { timeout: 20000, waitUntil: 'domcontentloaded' });
}

async function login(page, username, password) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/chat\.html$/, { timeout: 20000, waitUntil: 'domcontentloaded' });
}

async function openSettings(page) {
  await page.click('#settingsBtn');
  await page.waitForSelector('#settingsModal:not([hidden])');
}

async function waitForSettingsSuccess(page, previousText = '', timeout = 30000) {
  await page.waitForFunction((prev) => {
    const node = document.getElementById('settingsMessage');
    if (!node) return false;
    const text = (node.textContent || '').trim();
    return node.classList.contains('ok') && text.length > 0 && text !== (prev || '').trim();
  }, previousText, { timeout });
}

async function saveProfile(page, username, avatarUrl) {
  const previousText = await page.textContent('#settingsMessage').catch(() => '');
  await page.fill('#settingsUsername', username);
  await page.fill('#settingsAvatarUrl', avatarUrl);
  await page.click('#saveProfileBtn');
  await waitForSettingsSuccess(page, previousText);
}

async function savePreferences(page) {
  const previousText = await page.textContent('#settingsMessage').catch(() => '');
  await page.click('[data-settings-tab="preferences"]');
  await page.uncheck('#allowWritingCheckbox');
  await page.uncheck('#allowAddChatCheckbox');
  await page.fill('#autoDeleteMessageInput', '2030-01-01T10:00');
  await page.click('#savePreferencesBtn');
  await waitForSettingsSuccess(page, previousText);
}

async function changePassword(page, currentPassword, newPassword) {
  await page.click('[data-settings-tab="security"]');
  await page.fill('#currentPassword', currentPassword);
  await page.fill('#newPassword', newPassword);
  await page.fill('#confirmPassword', newPassword);
  await page.click('#changePasswordBtn');
  await page.waitForURL(/\/auth\/login$/, { timeout: 20000 });
}

async function rotateKeys(page) {
  await page.click('[data-settings-tab="security"]');
  const before = await page.textContent('#keyDiagnostics');
  const previousText = await page.textContent('#settingsMessage').catch(() => '');
  await page.click('#rotateKeysBtn');
  await waitForSettingsSuccess(page, previousText, 30000);
  await page.waitForFunction((prev) => {
    const node = document.getElementById('keyDiagnostics');
    return node && (node.textContent || '').trim() !== (prev || '').trim();
  }, before, { timeout: 30000 });
  const after = await page.textContent('#keyDiagnostics');
  return { before, after };
}

async function logoutAll(page) {
  await openSettings(page);
  await page.click('[data-settings-tab="security"]');
  await page.click('#logoutAllBtn');
  await page.waitForURL(/\/auth\/login$/, { timeout: 20000 });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const username = `ui_settings_${suffix}`;
  const renamed = `${username}_x`;
  const password = 'P@ssword12345';
  const newPassword = 'P@ssword54321';
  const avatarUrl = 'https://example.com/ui-avatar.png';

  await register(page, username, password);
  await waitForKeyReady(page);

  await openSettings(page);
  await saveProfile(page, renamed, avatarUrl);
  await savePreferences(page);

  const diagnostics = await page.textContent('#keyDiagnostics');
  expect(diagnostics && diagnostics.includes('userId:'), 'Диагностика ключей не отрисовалась.');
  const rotated = await rotateKeys(page);
  expect(rotated.before !== rotated.after, 'Диагностика после ротации ключей не изменилась.');
  expect(rotated.after && rotated.after.includes('public key:'), 'Диагностика после ротации ключей не обновилась.');

  await changePassword(page, password, newPassword);
  await login(page, renamed, newPassword);
  await waitForKeyReady(page);
  await logoutAll(page);

  console.log('SETTINGS UI FLOW RESULT: OK');
  await browser.close();
}

run().catch((error) => {
  console.error('SETTINGS UI FLOW RESULT: FAILED');
  console.error(error?.stack || String(error));
  process.exit(1);
});
