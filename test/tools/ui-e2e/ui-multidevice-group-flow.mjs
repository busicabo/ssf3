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
  await page.waitForURL(/\/chat\.html$/, { timeout: 20000 });
  await waitForKeyReady(page);
}

async function login(page, username, password) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/chat\.html$/, { timeout: 20000 });
  await waitForKeyReady(page);
}

async function searchAndCreatePersonalChat(page, username) {
  await page.fill('#searchInput', username);
  await page.click('#searchBtn');
  await page.waitForSelector('#searchResult button', { timeout: 15000 });
  await page.click('#searchResult button');
  await waitForChatInList(page, username, 20000);
  await openChat(page, username);
}

async function createGroupChat(page, title) {
  await page.click('#settingsBtn');
  await page.waitForSelector('#settingsModal:not([hidden])');
  await page.click('[data-settings-tab="actions"]');
  await page.fill('#groupTitleInput', title);
  await page.click('#createGroupBtn');
  await waitForStatus(page, 'Групповой чат создан.', 20000);
  await page.click('#settingsCloseBtn');
  await waitForChatInList(page, title);
  await openChat(page, title);
}

async function waitForChatInList(page, text, timeout = 20000) {
  await page.waitForFunction((value) => {
    return Array.from(document.querySelectorAll('#chatList .chat-item'))
      .some((node) => (node.textContent || '').includes(value));
  }, text, { timeout });
}

async function openChat(page, text) {
  await waitForChatInList(page, text);
  const chatButton = page.locator('#chatList .chat-item', { hasText: text }).first();
  await chatButton.click();
  await page.waitForTimeout(500);
}

async function sendMessage(page, text) {
  await page.fill('#messageInput', text);
  await page.click('#sendBtn');
}

async function waitForMessage(page, text, timeout = 20000) {
  await page.waitForFunction((value) => {
    return Array.from(document.querySelectorAll('#messageList .message'))
      .some((node) => (node.textContent || '').includes(value));
  }, text, { timeout });
}

async function addMember(page, username) {
  await page.click('#chatMenuBtn');
  await page.locator('#chatMenu button', { hasText: 'Добавить участника' }).click();
  await page.fill('#memberInput', username);
  await page.click('#addMemberBtn');
}

async function waitForStatus(page, text, timeout = 20000) {
  await page.waitForFunction((value) => {
    return Array.from(document.querySelectorAll('#statusList .status-item'))
      .some((node) => (node.textContent || '').includes(value));
  }, text, { timeout });
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  const ctxA1 = await browser.newContext();
  const ctxA2 = await browser.newContext();
  const ctxB = await browser.newContext();

  const pageA1 = await ctxA1.newPage();
  const pageA2 = await ctxA2.newPage();
  const pageB = await ctxB.newPage();

  const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const userA = `multi_a_${suffix}`;
  const userB = `multi_b_${suffix}`;
  const password = 'P@ssword12345';
  const groupTitle = `group_${suffix}`;
  const personalMessage = `personal hello ${suffix}`;
  const groupMessage = `group hello ${suffix}`;

  console.log('STEP 1: регистрация userA на устройстве #1');
  await register(pageA1, userA, password);

  console.log('STEP 2: вход userA на устройстве #2');
  await login(pageA2, userA, password);

  console.log('STEP 3: регистрация userB');
  await register(pageB, userB, password);

  console.log('STEP 4: создание личного чата и доставка сообщения на два устройства');
  await searchAndCreatePersonalChat(pageA1, userB);
  await sendMessage(pageA1, personalMessage);

  await waitForChatInList(pageB, userA);
  await openChat(pageB, userA);
  await waitForMessage(pageB, personalMessage);

  await waitForChatInList(pageA2, userB);
  await openChat(pageA2, userB);
  await waitForMessage(pageA2, personalMessage);

  console.log('STEP 5: создание группового чата и добавление userB');
  await createGroupChat(pageA1, groupTitle);
  await addMember(pageA1, userB);
  await waitForStatus(pageA1, 'Действие с участником выполнено: add.');

  await waitForChatInList(pageB, groupTitle);
  await openChat(pageB, groupTitle);

  console.log('STEP 6: сообщение в группе и синхронизация на двух устройствах userA');
  await sendMessage(pageB, groupMessage);
  await waitForMessage(pageA1, groupMessage);

  await openChat(pageA2, groupTitle);
  await waitForMessage(pageA2, groupMessage);

  console.log('UI MULTI-DEVICE FLOW RESULT: OK');
  await browser.close();
}

run().catch((error) => {
  console.error('UI MULTI-DEVICE FLOW RESULT: FAILED');
  console.error(error?.stack || String(error));
  process.exit(1);
});
