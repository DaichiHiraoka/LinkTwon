const state = {
  locale: localStorage.getItem('event-portal-locale') || 'ja',
  code: localStorage.getItem('event-portal-code') || 'event-demo',
  payload: null,
  error: ''
};

const ui = {
  ja: {
    title: 'イベント主催者ポータル',
    language: 'EN',
    accessCode: '主催者アクセスコード',
    signIn: 'QRを表示',
    qrIssued: '管理者発行済みQR',
    downloadPng: 'PNG保存',
    printPdf: 'PDF保存',
    copyCode: 'コードコピー',
    copied: 'コピーしました',
    organizer: '主催者',
    contact: '連絡先',
    eventDate: '開催日時',
    location: '集合場所',
    points: '付与ポイント',
    activity: '活動内容',
    notes: '注意事項',
    description: '説明',
    expiresAt: '有効期限',
    invalidCode: '主催者アクセスコードを確認してください。',
    payload: 'QR内容'
  },
  en: {
    title: 'Event Organizer Portal',
    language: 'JA',
    accessCode: 'Organizer access code',
    signIn: 'Open QR',
    qrIssued: 'Admin-issued QR',
    downloadPng: 'Save PNG',
    printPdf: 'Save PDF',
    copyCode: 'Copy code',
    copied: 'Copied',
    organizer: 'Organizer',
    contact: 'Contact',
    eventDate: 'Date',
    location: 'Meeting point',
    points: 'Grant points',
    activity: 'Activity',
    notes: 'Notes',
    description: 'Description',
    expiresAt: 'Expires',
    invalidCode: 'Check the organizer access code.',
    payload: 'QR payload'
  }
};

const app = document.getElementById('app');

function t(key) {
  return ui[state.locale][key];
}

function setState(nextState) {
  Object.assign(state, nextState);
  localStorage.setItem('event-portal-locale', state.locale);
  localStorage.setItem('event-portal-code', state.code);
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

function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(state.locale === 'en' ? 'en-US' : 'ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
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

function eventCardTemplate(eventItem) {
  return `
    <article class="portal-card" data-qr-id="${escapeHtml(eventItem.event_id)}">
      <div class="card-main">
        <div class="card-heading">
          <span class="status-pill">${escapeHtml(t('qrIssued'))}</span>
          <h2>${escapeHtml(eventItem.event_name)}</h2>
        </div>
        <dl class="meta-grid">
          <div><dt>${escapeHtml(t('eventDate'))}</dt><dd>${escapeHtml(formatDateTime(eventItem.event_datetime))}</dd></div>
          <div><dt>${escapeHtml(t('location'))}</dt><dd>${escapeHtml(eventItem.location)}</dd></div>
          <div><dt>${escapeHtml(t('points'))}</dt><dd>${escapeHtml(eventItem.grant_points)}pt</dd></div>
          <div><dt>${escapeHtml(t('expiresAt'))}</dt><dd>${escapeHtml(formatDateTime(eventItem.check_in_expires_at))}</dd></div>
        </dl>
        <section class="text-block">
          <h3>${escapeHtml(t('description'))}</h3>
          <p>${escapeHtml(eventItem.description)}</p>
        </section>
        <section class="text-block">
          <h3>${escapeHtml(t('activity'))}</h3>
          <p>${escapeHtml(eventItem.activity)}</p>
        </section>
        <section class="text-block">
          <h3>${escapeHtml(t('notes'))}</h3>
          <p>${escapeHtml(eventItem.notes)}</p>
        </section>
      </div>
      <aside class="qr-panel">
        <img src="${escapeHtml(eventItem.qr_image)}" alt="${escapeHtml(eventItem.event_name)} QR" />
        <strong>${escapeHtml(eventItem.check_in_code)}</strong>
        ${qrActionsTemplate(eventItem, eventItem.event_id, eventItem.check_in_code)}
      </aside>
    </article>
  `;
}

function accountTemplate(payload) {
  const account = payload.account;
  return `
    <section class="account-band">
      <dl>
        <div><dt>${escapeHtml(t('organizer'))}</dt><dd>${escapeHtml(account.name)}</dd></div>
        <div><dt>${escapeHtml(t('contact'))}</dt><dd>${escapeHtml(account.email)}</dd></div>
      </dl>
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
      ${state.payload.events.map(eventCardTemplate).join('')}
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
      downloadDataUrl(image.src, `linktown-event-${id}.png`);
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
