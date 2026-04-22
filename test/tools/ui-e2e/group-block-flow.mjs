import { chromium } from 'playwright';

const BASE = 'http://localhost:8080';

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForKeyReady(page) {
  await page.waitForFunction(() => {
    const keyState = document.getElementById('keyState');
    return Boolean(keyState && (keyState.classList.contains('good') || keyState.classList.contains('is-good')));
  }, { timeout: 60000 });
}

async function register(page, username, password) {
  await page.goto(`${BASE}/auth/reg`, { waitUntil: 'domcontentloaded' });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/chat\.html$/, { timeout: 20000, waitUntil: 'domcontentloaded' });
  await waitForKeyReady(page);
}

async function waitForChatInList(page, text, timeout = 20000) {
  await page.waitForFunction((value) => {
    return Array.from(document.querySelectorAll('#chatList .chat-item'))
      .some((node) => (node.textContent || '').includes(value));
  }, text, { timeout });
}

async function openChat(page, text) {
  await waitForChatInList(page, text);
  await page.locator('#chatList .chat-item', { hasText: text }).first().click();
  await page.waitForTimeout(500);
}

async function waitForStatusContains(page, part, timeout = 20000) {
  await page.waitForFunction((value) => {
    return Array.from(document.querySelectorAll('#statusList .status-item'))
      .some((node) => (node.textContent || '').includes(value));
  }, part, { timeout });
}

async function createGroup(page, title) {
  await page.click('#settingsBtn');
  await page.waitForSelector('#settingsModal:not([hidden])');
  await page.click('[data-settings-tab="actions"]');
  await page.fill('#groupTitleInput', title);
  await page.click('#createGroupBtn');
  await waitForStatusContains(page, 'Групповой чат создан.', 20000);
  await page.click('#settingsCloseBtn');
  await waitForChatInList(page, title);
  await openChat(page, title);
}

async function addMember(page, username) {
  await page.click('#chatMenuBtn');
  await page.locator('#chatMenu button', { hasText: 'Добавить участника' }).click();
  await page.fill('#memberInput', username);
  await page.click('#addMemberBtn');
  await waitForStatusContains(page, 'add');
}

async function blockMember(page, username) {
  await page.click('#chatMenuBtn');
  await page.locator('#chatMenu button', { hasText: 'Заблокировать участника' }).click();
  await page.fill('#memberInput', username);
  await page.click('#blockMemberBtn');
  await waitForStatusContains(page, 'block');
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const pageA = await browser.newPage();
  const pageB = await browser.newPage();

  const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const userA = `block_a_${suffix}`;
  const userB = `block_b_${suffix}`;
  const password = 'P@ssword12345';
  const groupTitle = `block_group_${suffix}`;

  console.log('STEP 1: регистрация двух пользователей');
  await register(pageA, userA, password);
  await register(pageB, userB, password);

  console.log('STEP 2: создание группы и добавление участника');
  await createGroup(pageA, groupTitle);
  await addMember(pageA, userB);

  await waitForChatInList(pageB, groupTitle);
  await openChat(pageB, groupTitle);

  console.log('STEP 3: блокировка участника в группе');
  await openChat(pageA, groupTitle);
  await blockMember(pageA, userB);

  console.log('STEP 4: попытка отправки сообщения заблокированным пользователем');
  const sendResponsePromise = pageB.waitForResponse((response) => {
    const url = response.url();
    const blockedUrl = url.includes('/api/encrypt_message_key/send') || url.includes('/api/sendMessage');
    return blockedUrl && response.status() === 403;
  }, { timeout: 20000 });
  await pageB.fill('#messageInput', `blocked hello ${suffix}`);
  await pageB.click('#sendBtn');
  const sendResponse = await sendResponsePromise;
  expect(sendResponse.status() === 403, `Ожидался 403 при отправке заблокированным пользователем, получено ${sendResponse.status()}`);

  console.log('GROUP BLOCK FLOW RESULT: OK');
  await browser.close();
}

run().catch((error) => {
  console.error('GROUP BLOCK FLOW RESULT: FAILED');
  console.error(error?.stack || String(error));
  process.exit(1);
});
