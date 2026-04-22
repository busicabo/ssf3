const form = document.getElementById('registerForm');
const message = document.getElementById('message');
async function waitForSessionReady() {
  const started = Date.now();
  const timeoutMs = 15000;
  while (Date.now() - started < timeoutMs) {
    try {
      const check = await fetch('/api/getId', { credentials: 'include' });
      if (check.ok) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}
function setMessage(text, type) {
  message.className = `auth-message ${type || ''}`.trim();
  message.textContent = text || '';
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('', '');
  try {
    const response = await fetch('/auth/reg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: document.getElementById('username').value.trim(), password: document.getElementById('password').value })
    });
    const text = await response.text();
    if (!response.ok) {
      setMessage(text || 'Регистрация не удалась. Попробуйте другой логин.', 'error');
      return;
    }
    const ready = await waitForSessionReady();
    if (!ready) {
      setMessage('Сессия пока не готова. Попробуйте войти еще раз.', 'error');
      return;
    }
    setMessage(text || 'Аккаунт создан. Перехожу в чат...', 'success');
    window.location.href = '/chat.html';
  } catch {
    setMessage('Сервер сейчас недоступен. Попробуйте позже.', 'error');
  }
});