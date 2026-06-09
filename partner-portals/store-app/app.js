const state = {
  locale: localStorage.getItem('store-portal-locale') || 'ja',
  code: localStorage.getItem('store-portal-code') || 'store-demo',
  payload: null,
  error: ''
};

const ui = {
  ja: {
    title: '商店ポータル',
    language: 'EN',
    accessCode: '商店アクセスコード',
    signIn: 'QRを表示',
    qrIssued: '管理者発行済みQR',
    downloadPng: 'PNG保存',
    printPdf: 'PDF保存',
    copyCode: 'コードコピー',
    copied: 'コピーしました',
    store: '店舗',
    contact: '連絡先',
    address: '住所',
    requiredPoints: '必要ポイント',
    description: '説明',
    category: 'カテゴリ',
    openMap: 'Google Map',
    invalidCode: '商店アクセスコードを確認してください。',
    payload: 'QR内容'
  },
  en: {
    title: 'Store Portal',
    language: 'JA',
    accessCode: 'Store access code',
    signIn: 'Open QR',
    qrIssued: 'Admin-issued QR',
    downloadPng: 'Save PNG',
    printPdf: 'Save PDF',
    copyCode: 'Copy code',
    copied: 'Copied',
    store: 'Store',
    contact: 'Contact',
    address: 'Address',
    requiredPoints: 'Required points',
    description: 'Description',
    category: 'Category',
    openMap: 'Google Map',
    invalidCode: 'Check the store access code.',
    payload: 'QR payload'
  }
};

const app = document.getElementById('app');

function t(key) {
  return ui[state.locale][key];
}

function setState(nextState) {
  Object.assign(state, nextState);
  localStorage.setItem('store-portal-locale', state.locale);
  localStorage.setItem('store-portal-code', state.code);
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

function downloadDataUrl(dataUrl, fileName) {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

async function copyText(value, button) {
  await navigator.clipboard.writeText(value);
  const original = button.textContent;
  button.textContent = t('copied');
  window.setTimeout(() => {
    button.textContent = original;
  }, 1200);
}

async function loadPortal(event) {
  if (event) {
    event.preventDefault();
  }

  state.error = '';

  try {
    const response = await fetch(`/api/bootstrap?code=${encodeURIComponent(state.code)}&locale=${encodeURIComponent(state.locale)}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || t('invalidCode'));
    }

    setState({ payload, error: '' });
  } catch (error) {
    setState({ payload: null, error: error.message || t('invalidCode') });
  }
}

function headerTemplate() {
  return `
    <header class="topbar">
      <div>
        <p class="eyebrow">LinkTwon</p>
        <h1>${escapeHtml(t('title'))}</h1>
      </div>
      <button class="icon-button" type="button" data-action="toggle-locale" aria-label="${escapeHtml(t('language'))}">${escapeHtml(t('language'))}</button>
    </header>
  `;
}

function loginTemplate() {
  return `
    <section class="toolbar toolbar--single">
      <form class="access-form">
        <label>
          <span>${escapeHtml(t('accessCode'))}</span>
          <input name="code" value="${escapeHtml(state.code)}" autocomplete="off" />
        </label>
        <button class="primary-button" type="submit">${escapeHtml(t('signIn'))}</button>
      </form>
    </section>
    ${state.error ? `<p class="error-message">${escapeHtml(state.error)}</p>` : ''}
  `;
}

function qrActionsTemplate(item, id, code) {
  return `
    <div class="qr-actions">
      <button type="button" data-action="download-png" data-id="${escapeHtml(id)}">${escapeHtml(t('downloadPng'))}</button>
      <button type="button" data-action="print">${escapeHtml(t('printPdf'))}</button>
      <button type="button" data-action="copy-code" data-code="${escapeHtml(code)}">${escapeHtml(t('copyCode'))}</button>
    </div>
    <details class="payload-details">
      <summary>${escapeHtml(t('payload'))}</summary>
      <code>${escapeHtml(item.qr_payload)}</code>
    </details>
  `;
}

function serviceCardTemplate(service) {
  return `
    <article class="portal-card" data-qr-id="${escapeHtml(service.service_id)}">
      <div class="card-main">
        <div class="card-heading">
          <span class="status-pill">${escapeHtml(t('qrIssued'))}</span>
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
      <aside class="qr-panel">
        <img src="${escapeHtml(service.qr_image)}" alt="${escapeHtml(service.service_name)} QR" />
        <strong>${escapeHtml(service.exchange_code)}</strong>
        ${qrActionsTemplate(service, service.service_id, service.exchange_code)}
      </aside>
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

app.addEventListener('click', (event) => {
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

  if (target.dataset.action === 'download-png') {
    const container = target.closest('[data-qr-id]');
    const image = container?.querySelector('.qr-panel img');
    const id = target.dataset.id;

    if (image && id) {
      downloadDataUrl(image.src, `linktown-store-${id}.png`);
    }
    return;
  }

  if (target.dataset.action === 'print') {
    window.print();
    return;
  }

  if (target.dataset.action === 'copy-code') {
    copyText(target.dataset.code || '', target);
  }
});

app.addEventListener('submit', (event) => {
  if (!event.target.classList.contains('access-form')) {
    return;
  }

  const form = new FormData(event.target);
  state.code = String(form.get('code') || '').trim();
  loadPortal(event);
});

render();
loadPortal();
