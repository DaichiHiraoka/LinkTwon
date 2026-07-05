const state = {
  locale: localStorage.getItem('store-portal-locale') || 'ja',
  code: '',
  password: '',
  payload: null,
  resultById: {},
  errorById: {},
  error: ''
};

const ui = {
  ja: {
    title: '商店ポータル',
    language: 'EN',
    accessCode: '商店ID',
    accessPlaceholder: '商店IDを入力',
    password: 'パスワード',
    passwordPlaceholder: 'パスワードを入力',
    signIn: '商品を表示',
    store: '店舗',
    contact: '連絡先',
    address: '住所',
    requiredPoints: '必要ポイント',
    description: '説明',
    category: 'カテゴリ',
    openMap: 'Google Map',
    scannerTitle: '利用者QR読取',
    scannerHint: '利用者のアプリに表示された本人確認QRを読み取って交換を確定します。',
    cameraScan: 'カメラで読む',
    qrPayload: 'QR内容',
    confirm: '交換する',
    completed: '交換完了',
    user: '利用者',
    usedPoints: '利用ポイント',
    invalidCode: '商店IDまたはパスワードが違います。',
    cameraUnavailable: 'このブラウザではカメラQR読取を利用できません。QR内容を手入力してください。'
  },
  en: {
    title: 'Store Portal',
    language: 'JA',
    accessCode: 'Store ID',
    accessPlaceholder: 'Enter store ID',
    password: 'Password',
    passwordPlaceholder: 'Enter password',
    signIn: 'Open services',
    store: 'Store',
    contact: 'Contact',
    address: 'Address',
    requiredPoints: 'Required points',
    description: 'Description',
    category: 'Category',
    openMap: 'Google Map',
    scannerTitle: 'Customer QR scan',
    scannerHint: 'Scan the identity QR shown in the customer app to complete the exchange.',
    cameraScan: 'Scan with camera',
    qrPayload: 'QR payload',
    confirm: 'Exchange',
    completed: 'Exchange completed',
    user: 'Customer',
    usedPoints: 'Used points',
    invalidCode: 'Check the store ID and password.',
    cameraUnavailable: 'Camera QR scanning is unavailable in this browser. Enter the QR payload manually.'
  }
};

const app = document.getElementById('app');

function t(key) {
  return ui[state.locale][key];
}

function setState(nextState) {
  Object.assign(state, nextState);
  localStorage.setItem('store-portal-locale', state.locale);
  render();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadPortal(event) {
  if (event) {
    event.preventDefault();
  }

  state.error = '';

  try {
    const response = await fetch(
      `/api/bootstrap?code=${encodeURIComponent(state.code)}&password=${encodeURIComponent(state.password)}&locale=${encodeURIComponent(state.locale)}`
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || t('invalidCode'));
    }

    setState({ payload, error: '', resultById: {}, errorById: {} });
  } catch (error) {
    setState({ payload: null, error: error.message || t('invalidCode') });
  }
}

async function readQrWithCamera() {
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
    throw new Error(t('cameraUnavailable'));
  }

  const overlay = document.createElement('div');
  overlay.className = 'camera-overlay';
  overlay.innerHTML = '<div class="camera-box"><video autoplay muted playsinline></video><button type="button">×</button></div>';
  document.body.append(overlay);

  const video = overlay.querySelector('video');
  const closeButton = overlay.querySelector('button');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  const detector = new BarcodeDetector({ formats: ['qr_code'] });
  let active = true;

  function cleanup() {
    active = false;
    stream.getTracks().forEach((track) => track.stop());
    overlay.remove();
  }

  closeButton.addEventListener('click', cleanup, { once: true });
  video.srcObject = stream;
  await video.play();

  return new Promise((resolve, reject) => {
    async function tick() {
      if (!active) {
        reject(new Error(t('cameraUnavailable')));
        return;
      }

      try {
        const codes = await detector.detect(video);
        const qr = codes.find((code) => code.rawValue);

        if (qr) {
          cleanup();
          resolve(qr.rawValue);
          return;
        }
      } catch (error) {
        cleanup();
        reject(error);
        return;
      }

      window.requestAnimationFrame(tick);
    }

    tick();
  });
}

async function submitExchange(serviceId, rawPayload) {
  const payload = rawPayload.trim();

  if (!payload) {
    setState({ errorById: { ...state.errorById, [serviceId]: t('qrPayload') } });
    return;
  }

  try {
    const response = await fetch(`/api/store/exchanges?locale=${encodeURIComponent(state.locale)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: state.code,
        password: state.password,
        service_id: serviceId,
        user_qr_payload: payload
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Scan failed.');
    }

    setState({
      resultById: { ...state.resultById, [serviceId]: result },
      errorById: { ...state.errorById, [serviceId]: '' }
    });
  } catch (error) {
    setState({ errorById: { ...state.errorById, [serviceId]: error.message } });
  }
}

function headerTemplate() {
  return `
    <header class="topbar">
      <div>
        <p class="eyebrow">LinkTwon</p>
        <h1>${escapeHtml(t('title'))}</h1>
      </div>
      <button class="icon-button" type="button" data-action="toggle-locale">${escapeHtml(t('language'))}</button>
    </header>
  `;
}

function loginTemplate() {
  return `
    <section class="toolbar toolbar--single">
      <form class="access-form">
        <label>
          <span>${escapeHtml(t('accessCode'))}</span>
          <input name="code" value="${escapeHtml(state.code)}" placeholder="${escapeHtml(t('accessPlaceholder'))}" autocomplete="off" />
        </label>
        <label>
          <span>${escapeHtml(t('password'))}</span>
          <input name="password" value="${escapeHtml(state.password)}" placeholder="${escapeHtml(t('passwordPlaceholder'))}" type="password" autocomplete="current-password" />
        </label>
        <button class="primary-button" type="submit">${escapeHtml(t('signIn'))}</button>
      </form>
    </section>
    ${state.error ? `<p class="error-message">${escapeHtml(state.error)}</p>` : ''}
  `;
}

function scannerTemplate(service) {
  const result = state.resultById[service.service_id];
  const error = state.errorById[service.service_id];

  return `
    <section class="scan-panel">
      <h3>${escapeHtml(t('scannerTitle'))}</h3>
      <p>${escapeHtml(t('scannerHint'))}</p>
      <button class="secondary-button" type="button" data-action="camera" data-service-id="${escapeHtml(service.service_id)}">${escapeHtml(t('cameraScan'))}</button>
      <form class="scan-form" data-service-id="${escapeHtml(service.service_id)}">
        <label>
          <span>${escapeHtml(t('qrPayload'))}</span>
          <textarea name="user_qr_payload" rows="3"></textarea>
        </label>
        <button class="primary-button" type="submit">${escapeHtml(t('confirm'))}</button>
      </form>
      ${error ? `<p class="error-message">${escapeHtml(error)}</p>` : ''}
      ${
        result
          ? `<div class="scan-result"><strong>${escapeHtml(t('completed'))}</strong><dl><div><dt>${escapeHtml(t('user'))}</dt><dd>${escapeHtml(result.user.name)} (${escapeHtml(result.user.user_id)})</dd></div><div><dt>${escapeHtml(t('usedPoints'))}</dt><dd>${escapeHtml(result.used_points)}pt</dd></div></dl></div>`
          : ''
      }
    </section>
  `;
}

function serviceCardTemplate(service) {
  return `
    <article class="portal-card">
      <div class="card-main">
        <div class="card-heading">
          <span class="status-pill">${escapeHtml(t('scannerTitle'))}</span>
          <h2>${escapeHtml(service.service_name)}</h2>
        </div>
        <dl class="meta-grid">
          <div><dt>${escapeHtml(t('category'))}</dt><dd>${escapeHtml(service.category_name)}</dd></div>
          <div><dt>${escapeHtml(t('requiredPoints'))}</dt><dd>${escapeHtml(service.required_points)}pt</dd></div>
        </dl>
        <section class="text-block">
          <h3>${escapeHtml(t('description'))}</h3>
          <p>${escapeHtml(service.description)}</p>
        </section>
      </div>
      ${scannerTemplate(service)}
    </article>
  `;
}

function accountTemplate(payload) {
  const account = payload.account;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(account.map_query)}`;
  return `
    <section class="account-band">
      <dl>
        <div><dt>${escapeHtml(t('store'))}</dt><dd>${escapeHtml(account.name)}</dd></div>
        <div><dt>${escapeHtml(t('address'))}</dt><dd>${escapeHtml(account.address)}</dd></div>
        <div><dt>${escapeHtml(t('contact'))}</dt><dd>${escapeHtml(account.email)}</dd></div>
      </dl>
      <a class="secondary-link" href="${escapeHtml(mapUrl)}" target="_blank" rel="noreferrer">${escapeHtml(t('openMap'))}</a>
    </section>
  `;
}

function portalTemplate() {
  if (!state.payload) {
    return '';
  }

  return `
    ${accountTemplate(state.payload)}
    <section class="portal-list">
      ${state.payload.services.map(serviceCardTemplate).join('')}
    </section>
  `;
}

function render() {
  document.documentElement.lang = state.locale;
  app.innerHTML = `${headerTemplate()}${loginTemplate()}${portalTemplate()}`;
}

app.addEventListener('click', async (event) => {
  const target = event.target.closest('button');

  if (!target) {
    return;
  }

  if (target.dataset.action === 'toggle-locale') {
    setState({ locale: state.locale === 'ja' ? 'en' : 'ja' });
    if (state.payload) {
      loadPortal();
    }
    return;
  }

  if (target.dataset.action === 'camera') {
    const serviceId = target.dataset.serviceId;

    try {
      const rawPayload = await readQrWithCamera();
      await submitExchange(serviceId, rawPayload);
    } catch (error) {
      setState({ errorById: { ...state.errorById, [serviceId]: error.message } });
    }
  }
});

app.addEventListener('submit', (event) => {
  if (event.target.classList.contains('access-form')) {
    event.preventDefault();
    const form = new FormData(event.target);
    state.code = String(form.get('code') || '').trim();
    state.password = String(form.get('password') || '');

    if (!state.code || !state.password) {
      setState({ error: t('invalidCode'), payload: null });
      return;
    }

    loadPortal(event);
    return;
  }

  if (event.target.classList.contains('scan-form')) {
    event.preventDefault();
    const form = new FormData(event.target);
    submitExchange(event.target.dataset.serviceId, String(form.get('user_qr_payload') || ''));
  }
});

render();
