const SESSION_KEY = 'linktown-store-portal-session';

function readPortalSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    return session?.code && session?.password ? session : null;
  } catch (error) {
    return null;
  }
}

const savedSession = readPortalSession();

const state = {
  locale: localStorage.getItem('store-portal-locale') || 'ja',
  code: savedSession?.code || '',
  password: savedSession?.password || '',
  payload: null,
  screen: 'access',
  selectedServiceId: '',
  manualPayload: '',
  pendingPayload: '',
  pendingUser: null,
  latestResult: null,
  error: '',
  errorKind: 'invalid'
};

const ui = {
  ja: {
    product: 'Link Town',
    title: '店舗用',
    language: 'EN',
    logout: 'ログアウト',
    accessCode: '店舗ID',
    accessPlaceholder: '店舗IDを入力',
    password: 'パスワード',
    passwordPlaceholder: 'パスワードを入力',
    signIn: 'ログイン',
    forgotCode: 'パスワードを忘れた方',
    invalidCode: '店舗IDまたはパスワードが違います',
    selectTitle: '交換する商品を選択',
    requiredPoints: '必要ポイント',
    exchange: 'この商品と交換する',
    scanTitle: 'QRコードを読み取る',
    scanPrompt: 'お客様のQRコードを枠内にかざしてください',
    manualEntry: 'QRコードを手入力する',
    manualTitle: 'QRコードを手入力',
    manualPlaceholder: 'お客様のアプリに表示されたQR内容を貼り付けてください',
    customer: 'お客様',
    camera: 'カメラに戻る',
    confirm: '内容を確認する',
    analyzing: 'QRコードを確認しています',
    confirmTitle: 'この内容で交換しますか？',
    cancel: 'キャンセル',
    usePoints: '利用ポイント',
    execute: '交換を確定する',
    processing: '交換処理中です',
    processingHint: '画面を閉じずにお待ちください',
    completed: '交換が完了しました',
    remainingPoints: '交換後のポイント',
    nextExchange: '続けて交換する',
    chooseAnother: '商品を選び直す',
    retry: 'もう一度読み取る',
    qrRequired: 'QR内容を入力してください',
    invalidQr: 'QRコードを確認できませんでした',
    duplicateQr: 'このQRコードはすでに使用されています',
    expiredQr: 'QRコードの有効期限が切れています',
    futureQr: 'QRコードの時刻を確認してください',
    userNotFound: 'QRコードの利用者が見つかりません',
    insufficientPoints: 'ポイントが不足しています',
    serverError: 'サーバー処理に失敗しました',
    cameraUnavailable: 'カメラを利用できません',
    communicationError: '通信に失敗しました',
    errorHint: 'お客様の画面を確認して、もう一度お試しください'
  },
  en: {
    product: 'Link Town',
    title: 'Store',
    language: 'JA',
    logout: 'Log out',
    accessCode: 'Store ID',
    accessPlaceholder: 'Enter store ID',
    password: 'Password',
    passwordPlaceholder: 'Enter password',
    signIn: 'Log in',
    forgotCode: 'Forgot password',
    invalidCode: 'Check the store ID and password',
    selectTitle: 'Select an item to exchange',
    requiredPoints: 'Required points',
    exchange: 'Exchange for this item',
    scanTitle: 'Scan customer QR',
    scanPrompt: 'Hold the customer QR code inside the frame',
    manualEntry: 'Enter QR payload manually',
    manualTitle: 'Enter QR payload',
    manualPlaceholder: 'Paste the QR payload shown in the customer app',
    customer: 'Customer',
    camera: 'Back to camera',
    confirm: 'Review exchange',
    analyzing: 'Checking QR code',
    confirmTitle: 'Complete this exchange?',
    cancel: 'Cancel',
    usePoints: 'Points to use',
    execute: 'Confirm exchange',
    processing: 'Processing exchange',
    processingHint: 'Keep this screen open',
    completed: 'Exchange completed',
    remainingPoints: 'Remaining points',
    nextExchange: 'Exchange another',
    chooseAnother: 'Choose another item',
    retry: 'Scan again',
    qrRequired: 'Enter the QR payload',
    invalidQr: 'The QR code could not be verified',
    duplicateQr: 'This QR code has already been used',
    expiredQr: 'This QR code has expired',
    futureQr: 'Check the QR code time',
    userNotFound: 'The customer for this QR code was not found',
    insufficientPoints: 'The customer does not have enough points',
    serverError: 'The server could not complete the request',
    cameraUnavailable: 'The camera is unavailable',
    communicationError: 'Connection failed',
    errorHint: 'Check the customer screen and try again'
  }
};

const app = document.getElementById('app');
let cameraStream = null;
let scannerActive = false;

function t(key) {
  return ui[state.locale][key];
}

function stopCamera() {
  scannerActive = false;
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
}

function setState(nextState) {
  if (nextState.screen && nextState.screen !== 'scanner') {
    stopCamera();
  }

  Object.assign(state, nextState);
  localStorage.setItem('store-portal-locale', state.locale);
  render();
}

function savePortalSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code: state.code, password: state.password }));
  } catch (error) {
    // The portal still works without reload persistence when storage is unavailable.
  }
}

function clearPortalSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (error) {
    // Ignore storage restrictions and clear the in-memory state below.
  }
}

function logout() {
  clearPortalSession();
  setState({
    code: '',
    password: '',
    payload: null,
    screen: 'access',
    selectedServiceId: '',
    manualPayload: '',
    pendingPayload: '',
    pendingUser: null,
    latestResult: null,
    error: '',
    errorKind: 'invalid'
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function selectedService() {
  return state.payload?.services.find((service) => service.service_id === state.selectedServiceId) || null;
}

function parseUserPreview(rawPayload) {
  const trimmed = String(rawPayload || '').trim();

  if (!trimmed) {
    throw new Error(t('qrRequired'));
  }

  try {
    const payload = trimmed.startsWith('{') ? JSON.parse(trimmed) : Object.fromEntries(new URL(trimmed).searchParams.entries());
    const user = {
      user_id: String(payload.user_id || '').trim(),
      name: String(payload.name || '').trim(),
      nonce: String(payload.nonce || '').trim()
    };

    if (!user.user_id || !user.nonce) {
      throw new Error(t('invalidQr'));
    }

    return { ...user, name: user.name || `User ${user.user_id}` };
  } catch (error) {
    throw new Error(error.message === t('qrRequired') ? error.message : t('invalidQr'));
  }
}

function classifyExchangeError(error) {
  const code = error?.code || '';
  const message = error?.message || error;
  const value = String(message || '').toLowerCase();

  if (code === 'QR_ALREADY_USED') {
    return { kind: 'duplicate', message: t('duplicateQr') };
  }
  if (code === 'POINTS_INSUFFICIENT') {
    return { kind: 'points', message: t('insufficientPoints') };
  }
  if (code === 'QR_EXPIRED') {
    return { kind: 'expired', message: t('expiredQr') };
  }
  if (code === 'QR_NOT_YET_VALID') {
    return { kind: 'time', message: t('futureQr') };
  }
  if (code === 'QR_USER_NOT_FOUND') {
    return { kind: 'user', message: t('userNotFound') };
  }
  if (code === 'SERVER_ERROR') {
    return { kind: 'server', message: t('serverError') };
  }

  if (value.includes('already been used') || value.includes('duplicate')) {
    return { kind: 'duplicate', message: t('duplicateQr') };
  }
  if (value.includes('not enough points')) {
    return { kind: 'points', message: t('insufficientPoints') };
  }
  if (value.includes('expired')) {
    return { kind: 'expired', message: t('expiredQr') };
  }
  if (value.includes('not valid yet') || value.includes('future')) {
    return { kind: 'time', message: t('futureQr') };
  }
  if (value.includes('camera') || value.includes('barcode')) {
    return { kind: 'camera', message: t('cameraUnavailable') };
  }
  if (value.includes('fetch') || value.includes('network') || value.includes('connection')) {
    return { kind: 'network', message: t('communicationError') };
  }

  return { kind: 'invalid', message: message || t('invalidQr') };
}

function showError(error) {
  const classified = classifyExchangeError(error);
  setState({ screen: 'error', error: classified.message, errorKind: classified.kind });
}

async function readExchangeResponse(response) {
  try {
    return await response.json();
  } catch (cause) {
    const error = new Error(t('serverError'));
    error.code = 'SERVER_ERROR';
    throw error;
  }
}

async function loadPortal(event) {
  event?.preventDefault();

  try {
    const response = await fetch(
      `/api/bootstrap?code=${encodeURIComponent(state.code)}&password=${encodeURIComponent(state.password)}&locale=${encodeURIComponent(state.locale)}`
    );
    const payload = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        clearPortalSession();
      }
      throw new Error(t('invalidCode'));
    }

    savePortalSession();

    setState({
      payload,
      screen: 'products',
      selectedServiceId: '',
      manualPayload: '',
      pendingPayload: '',
      pendingUser: null,
      latestResult: null,
      error: ''
    });
  } catch (error) {
    setState({ payload: null, screen: 'access', error: error.message || t('invalidCode') });
  }
}

async function startCameraScanner() {
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
    showError(t('cameraUnavailable'));
    return;
  }

  const video = document.getElementById('qr-camera');

  if (!video) {
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    scannerActive = true;
    video.srcObject = cameraStream;
    await video.play();

    async function tick() {
      if (!scannerActive) {
        return;
      }

      try {
        const codes = await detector.detect(video);
        const qr = codes.find((code) => code.rawValue);

        if (qr) {
          prepareConfirmation(qr.rawValue);
          return;
        }
      } catch (error) {
        showError(error);
        return;
      }

      window.requestAnimationFrame(tick);
    }

    tick();
  } catch (error) {
    showError(error);
  }
}

function openScanner(serviceId = state.selectedServiceId) {
  setState({
    screen: 'scanner',
    selectedServiceId: serviceId,
    manualPayload: '',
    pendingPayload: '',
    pendingUser: null,
    error: ''
  });
  startCameraScanner();
}

function prepareConfirmation(rawPayload) {
  try {
    const pendingPayload = String(rawPayload || '').trim();
    const pendingUser = parseUserPreview(pendingPayload);
    setState({ screen: 'analyzing', pendingPayload, pendingUser, error: '' });
    window.setTimeout(() => {
      if (state.screen === 'analyzing') {
        setState({ screen: 'confirm' });
      }
    }, 360);
  } catch (error) {
    showError(error);
  }
}

async function submitExchange() {
  const service = selectedService();

  if (!service || !state.pendingPayload) {
    showError(t('invalidQr'));
    return;
  }

  setState({ screen: 'processing', error: '' });

  try {
    const response = await fetch(`/api/store/exchanges?locale=${encodeURIComponent(state.locale)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: state.code,
        password: state.password,
        service_id: service.service_id,
        user_qr_payload: state.pendingPayload
      })
    });
    const result = await readExchangeResponse(response);

    if (!response.ok) {
      const error = new Error(result.message || t('invalidQr'));
      error.code = result.code || (response.status >= 500 ? 'SERVER_ERROR' : '');
      throw error;
    }

    setState({
      screen: 'success',
      latestResult: result,
      manualPayload: '',
      pendingPayload: '',
      pendingUser: null,
      error: ''
    });
  } catch (error) {
    showError(error);
  }
}

function brandMarkTemplate(className = 'brand-mark') {
  return `<img class="${className}" src="/assets/linktown-icon.png" alt="" />`;
}

function appHeaderTemplate(options = {}) {
  return `
    <header class="app-header ${options.dimmed ? 'is-dimmed' : ''}">
      <div class="brand">
        ${
          options.backAction
            ? `<button class="icon-btn" type="button" data-action="${escapeHtml(options.backAction)}" aria-label="back">←</button>`
            : brandMarkTemplate()
        }
        <div>
          <div class="brand-name">${escapeHtml(state.payload?.account?.name || t('product'))}</div>
          <div class="brand-sub">${escapeHtml(t('title'))}</div>
        </div>
      </div>
      <div class="header-actions">
        <button class="logout-btn" type="button" data-action="logout">${escapeHtml(t('logout'))}</button>
        <button class="locale-btn" type="button" data-action="toggle-locale">${escapeHtml(t('language'))}</button>
      </div>
    </header>
  `;
}

function accessTemplate() {
  return `
    <div class="tablet-frame tablet-frame--auth ${state.error ? 'auth-error' : ''}">
      <main class="center-stage">
        <div class="auth-card">
          <div class="hero-brand">
            ${brandMarkTemplate('login-logo')}
            <div class="name">${escapeHtml(t('product'))}</div>
            <div class="sub">${escapeHtml(t('title'))}</div>
          </div>
          <form class="code-form">
            <label for="code">${escapeHtml(t('accessCode'))}</label>
            <input id="code" class="input" name="code" value="${escapeHtml(state.code)}" placeholder="${escapeHtml(t('accessPlaceholder'))}" autocomplete="off" />
            <label for="password">${escapeHtml(t('password'))}</label>
            <input id="password" class="input" name="password" value="${escapeHtml(state.password)}" placeholder="${escapeHtml(t('passwordPlaceholder'))}" type="password" autocomplete="current-password" />
            ${state.error ? `<div class="form-error">${escapeHtml(state.error)}</div>` : ''}
            <button type="submit" class="btn btn-primary btn-block">${escapeHtml(t('signIn'))}</button>
            <button type="button" class="text-link" data-action="noop">${escapeHtml(t('forgotCode'))}</button>
          </form>
        </div>
      </main>
    </div>
  `;
}

function productCardTemplate(service, index) {
  return `
    <article class="product-card">
      <div class="product-thumb product-thumb--${(index % 3) + 1}" aria-hidden="true">
        <span>${escapeHtml(service.service_name.slice(0, 1))}</span>
      </div>
      <div class="product-copy">
        <div class="product-category">${escapeHtml(service.category_name)}</div>
        <h2>${escapeHtml(service.service_name)}</h2>
        <p>${escapeHtml(service.description)}</p>
      </div>
      <div class="product-action">
        <div class="point-label">${escapeHtml(t('requiredPoints'))}</div>
        <div class="point-value">${escapeHtml(service.required_points)}<span>pt</span></div>
        <button class="btn btn-primary" type="button" data-action="open-scanner" data-service-id="${escapeHtml(service.service_id)}">${escapeHtml(t('exchange'))}</button>
      </div>
    </article>
  `;
}

function productsTemplate(options = {}) {
  const account = state.payload.account;

  return `
    <div class="tablet-frame">
      ${appHeaderTemplate({ dimmed: options.dimmed })}
      <main class="products-stage ${options.dimmed ? 'is-dimmed' : ''}">
        <div class="page-heading">
          <div>
            <div class="store-address">${escapeHtml(account.address)}</div>
            <h1>${escapeHtml(t('selectTitle'))}</h1>
          </div>
          <div class="service-count">${escapeHtml(state.payload.services.length)}</div>
        </div>
        <div class="product-list">
          ${state.payload.services.map(productCardTemplate).join('')}
        </div>
      </main>
    </div>
  `;
}

function selectedProductStripTemplate() {
  const service = selectedService();

  return `
    <section class="selected-product">
      <div>
        <div class="product-category">${escapeHtml(service.category_name)}</div>
        <strong>${escapeHtml(service.service_name)}</strong>
      </div>
      <div class="selected-points">-${escapeHtml(service.required_points)}<span>pt</span></div>
    </section>
  `;
}

function scannerBodyTemplate(options = {}) {
  return `
    <main class="scanner-stage ${options.dimmed ? 'is-dimmed' : ''}">
      ${selectedProductStripTemplate()}
      <section class="camera-panel">
        ${options.live ? '<video id="qr-camera" autoplay muted playsinline></video>' : '<div class="camera-placeholder"></div>'}
        <div class="scan-guide" aria-hidden="true"><span class="qr-glyph">▦</span></div>
        <div class="scan-prompt">${escapeHtml(t('scanPrompt'))}</div>
      </section>
      <button class="btn btn-outline btn-block" type="button" data-action="open-manual">⌨ ${escapeHtml(t('manualEntry'))}</button>
    </main>
  `;
}

function scannerTemplate() {
  return `
    <div class="tablet-frame">
      ${appHeaderTemplate({ backAction: 'open-products' })}
      ${scannerBodyTemplate({ live: true })}
    </div>
  `;
}

function manualTemplate() {
  let preview = null;

  try {
    preview = state.manualPayload ? parseUserPreview(state.manualPayload) : null;
  } catch (error) {
    preview = null;
  }

  return `
    <div class="tablet-frame">
      ${appHeaderTemplate({ backAction: 'open-scanner-current' })}
      <main class="manual-stage">
        <form class="manual-form">
          <h1>${escapeHtml(t('manualTitle'))}</h1>
          ${selectedProductStripTemplate()}
          <label for="user-qr">${escapeHtml(t('manualTitle'))}</label>
          <textarea id="user-qr" class="input" name="user_qr_payload" placeholder="${escapeHtml(t('manualPlaceholder'))}">${escapeHtml(state.manualPayload)}</textarea>
          <div class="recipient-card">
            <span>${escapeHtml(t('customer'))}</span>
            <strong>${escapeHtml(preview?.name || '-')}</strong>
          </div>
          <div class="split-actions">
            <button class="btn btn-outline" type="button" data-action="open-scanner-current">▣ ${escapeHtml(t('camera'))}</button>
            <button class="btn btn-primary" type="submit">${escapeHtml(t('confirm'))}</button>
          </div>
          <button class="text-link" type="button" data-action="open-products">${escapeHtml(t('chooseAnother'))}</button>
        </form>
      </main>
    </div>
  `;
}

function analyzingTemplate() {
  return `
    <div class="tablet-frame">
      ${appHeaderTemplate()}
      <main class="status-stage status-stage--soft">
        <div class="scan-loader"><span class="qr-glyph">▦</span></div>
        <h1>${escapeHtml(t('analyzing'))}</h1>
        <div class="loading-dots" aria-hidden="true"><span></span><span></span><span></span></div>
      </main>
    </div>
  `;
}

function confirmTemplate(processing = false) {
  const service = selectedService();

  return `
    <div class="tablet-frame">
      ${appHeaderTemplate({ dimmed: true })}
      ${scannerBodyTemplate({ dimmed: true })}
      <div class="modal-overlay">
        <section class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(processing ? t('processing') : t('confirmTitle'))}">
          ${
            processing
              ? `<div class="processing-ring" aria-hidden="true"></div><h1>${escapeHtml(t('processing'))}</h1><p class="modal-hint">${escapeHtml(t('processingHint'))}</p>`
              : `<h1>${escapeHtml(t('confirmTitle'))}</h1>
                 <div class="recipient"><span>${escapeHtml(t('customer'))}</span><strong>${escapeHtml(state.pendingUser?.name || '-')}</strong></div>
                 <div class="exchange-summary"><div><span>${escapeHtml(service.service_name)}</span><strong>-${escapeHtml(service.required_points)} pt</strong></div></div>
                  <div class="actions"><button class="btn btn-outline" type="button" data-action="cancel-confirm">${escapeHtml(t('cancel'))}</button><button class="btn btn-primary" type="button" data-action="submit-exchange">${escapeHtml(t('execute'))}</button></div>
                  <button class="text-link" type="button" data-action="open-products">${escapeHtml(t('chooseAnother'))}</button>`
          }
        </section>
      </div>
    </div>
  `;
}

function successTemplate() {
  const result = state.latestResult;

  return `
    <div class="tablet-frame">
      ${appHeaderTemplate({ backAction: 'open-products' })}
      <main class="status-stage status-stage--success">
        <div class="success-mark">✓</div>
        <h1>${escapeHtml(t('completed'))}</h1>
        <div class="status-name">${escapeHtml(result?.user?.name || '')}</div>
        <div class="status-delta">-${escapeHtml(result?.used_points || selectedService()?.required_points || 0)} pt</div>
        <div class="remaining"><span>${escapeHtml(t('remainingPoints'))}</span><strong>${escapeHtml(result?.current_points ?? '-')} pt</strong></div>
        <div class="status-actions">
          <button class="btn btn-primary" type="button" data-action="open-scanner-current">${escapeHtml(t('nextExchange'))}</button>
          <button class="text-link" type="button" data-action="open-products">${escapeHtml(t('chooseAnother'))}</button>
        </div>
      </main>
    </div>
  `;
}

function errorTemplate() {
  return `
    <div class="tablet-frame tablet-frame--error">
      ${appHeaderTemplate({ backAction: 'open-products' })}
      <main class="status-stage status-stage--error">
        <div class="error-mark">!</div>
        <h1>${escapeHtml(state.error || t('invalidQr'))}</h1>
        <p>${escapeHtml(t('errorHint'))}</p>
        <div class="status-actions status-actions--row">
          <button class="btn btn-primary" type="button" data-action="open-scanner-current">${escapeHtml(t('retry'))}</button>
          <button class="btn btn-outline" type="button" data-action="open-manual">${escapeHtml(t('manualEntry'))}</button>
        </div>
        <button class="text-link" type="button" data-action="open-products">${escapeHtml(t('chooseAnother'))}</button>
      </main>
    </div>
  `;
}

function render() {
  document.documentElement.lang = state.locale;

  if (!state.payload || state.screen === 'access') {
    app.innerHTML = accessTemplate();
    return;
  }

  const templates = {
    products: productsTemplate,
    scanner: scannerTemplate,
    manual: manualTemplate,
    analyzing: analyzingTemplate,
    confirm: () => confirmTemplate(false),
    processing: () => confirmTemplate(true),
    success: successTemplate,
    error: errorTemplate
  };

  app.innerHTML = (templates[state.screen] || productsTemplate)();
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

  if (target.dataset.action === 'logout') {
    logout();
    return;
  }

  if (target.dataset.action === 'open-products') {
    setState({ screen: 'products', selectedServiceId: '', error: '' });
    return;
  }

  if (target.dataset.action === 'open-scanner') {
    openScanner(target.dataset.serviceId);
    return;
  }

  if (target.dataset.action === 'open-scanner-current') {
    openScanner();
    return;
  }

  if (target.dataset.action === 'open-manual') {
    setState({ screen: 'manual', manualPayload: '', error: '' });
    return;
  }

  if (target.dataset.action === 'cancel-confirm') {
    setState({ screen: 'manual', manualPayload: state.pendingPayload, error: '' });
    return;
  }

  if (target.dataset.action === 'submit-exchange') {
    await submitExchange();
  }
});

app.addEventListener('submit', (event) => {
  if (event.target.classList.contains('code-form')) {
    event.preventDefault();
    const form = new FormData(event.target);
    state.code = String(form.get('code') || '').trim();
    state.password = String(form.get('password') || '');

    if (!state.code || !state.password) {
      setState({ payload: null, screen: 'access', error: t('invalidCode') });
      return;
    }

    loadPortal(event);
    return;
  }

  if (event.target.classList.contains('manual-form')) {
    event.preventDefault();
    const form = new FormData(event.target);
    state.manualPayload = String(form.get('user_qr_payload') || '');
    prepareConfirmation(state.manualPayload);
  }
});

app.addEventListener('input', (event) => {
  if (event.target.name === 'user_qr_payload') {
    state.manualPayload = event.target.value;
  }
});

window.addEventListener('beforeunload', stopCamera);
render();

if (savedSession) {
  loadPortal();
}
