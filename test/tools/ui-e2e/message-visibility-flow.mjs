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

async function messageExists(page, text) {
  return page.evaluate((value) => {
    return Array.from(document.querySelectorAll('#messageList .message'))
      .some((node) => (node.textContent || '').includes(value));
  }, text);
}

async function blockPendingMessageKeys(page, attempts) {
  await page.evaluate((limit) => {
    const originalFetch = window.fetch.bind(window);
    window.__mescatFetchOriginal = originalFetch;
    window.__mescatPendingBlockLeft = limit;
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('/api/encrypt_message_key/pending') && window.__mescatPendingBlockLeft > 0) {
        window.__mescatPendingBlockLeft -= 1;
        return new Response('[]', {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return originalFetch(input, init);
    };
  }, attempts);
}

async function restorePendingMessageKeys(page) {
  await page.evaluate(() => {
    if (window.__mescatFetchOriginal) {
      window.fetch = window.__mescatFetchOriginal;
      delete window.__mescatFetchOriginal;
      delete window.__mescatPendingBlockLeft;
    }
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const userA = `visibility_a_${suffix}`;
  const userB = `visibility_b_${suffix}`;
  const password = 'P@ssword12345';
  const messageText = `hidden-until-key ${suffix}`;

  console.log('STEP 1: регистрация двух пользователей');
  await register(pageA, userA, password);
  await register(pageB, userB, password);

  console.log('STEP 2: создание личного чата');
  await searchAndCreatePersonalChat(pageA, userB);
  await waitForChatInList(pageB, userA);
  await openChat(pageA, userB);
  await openChat(pageB, userA);

  console.log('STEP 3: временно блокируем получение pending message keys у получателя');
  await blockPendingMessageKeys(pageA, 4);

  console.log('STEP 4: отправляем сообщение с новым sender key');
  await sendMessage(pageB, messageText);
  await pageA.waitForTimeout(2500);

  const hiddenWhileNoKey = await messageExists(pageA, messageText);
  expect(!hiddenWhileNoKey, 'Сообщение появилось до получения ключа, хотя должно было быть скрыто.');

  console.log('STEP 5: возвращаем получение ключей и выполняем повторную синхронизацию');
  await restorePendingMessageKeys(pageA);
  await pageA.click('#settingsBtn');
  await pageA.waitForSelector('#settingsModal:not([hidden])');
  await pageA.click('[data-settings-tab="actions"]');
  await pageA.click('#bootstrapKeysBtn');
  await pageA.click('#settingsCloseBtn');
  await waitForMessage(pageA, messageText, 20000);

  console.log('MESSAGE VISIBILITY FLOW RESULT: OK');
  await browser.close();
}

run().catch((error) => {
  console.error('MESSAGE VISIBILITY FLOW RESULT: FAILED');
  console.error(error?.stack || String(error));
  process.exit(1);
});
