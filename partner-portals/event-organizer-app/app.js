const state = {
  locale: localStorage.getItem('event-portal-locale') || 'ja',
  code: localStorage.getItem('event-portal-code') || 'event-demo',
  payload: null,
  resultById: {},
  errorById: {},
  error: ''
};

const ui = {
  ja: {
    title: 'イベント主催者ポータル',
    language: 'EN',
    accessCode: '主催者アクセスコード',
    signIn: 'イベントを表示',
    organizer: '主催者',
    contact: '連絡先',
    eventDate: '開催日時',
    location: '集合場所',
    points: '付与ポイント',
    activity: '活動内容',
    notes: '注意事項',
    description: '説明',
    scannerTitle: '参加者QR読取',
    scannerHint: '参加者のアプリに表示された本人確認QRを読み取って受付します。',
    cameraScan: 'カメラで読む',
    qrPayload: 'QR内容',
    confirm: '受付する',
    completed: '受付完了',
    user: '参加者',
    grantedPoints: '付与ポイント',
    invalidCode: '主催者アクセスコードを確認してください。',
    cameraUnavailable: 'このブラウザではカメラQR読取を利用できません。QR内容を手入力してください。'
  },
  en: {
    title: 'Event Organizer Portal',
    language: 'JA',
    accessCode: 'Organizer access code',
    signIn: 'Open events',
    organizer: 'Organizer',
    contact: 'Contact',
    eventDate: 'Date',
    location: 'Meeting point',
    points: 'Grant points',
    activity: 'Activity',
    notes: 'Notes',
    description: 'Description',
    scannerTitle: 'Participant QR scan',
    scannerHint: 'Scan the identity QR shown in the participant app to check them in.',
    cameraScan: 'Scan with camera',
    qrPayload: 'QR payload',
    confirm: 'Check in',
    completed: 'Check-in completed',
    user: 'Participant',
    grantedPoints: 'Grant points',
    invalidCode: 'Check the organizer access code.',
    cameraUnavailable: 'Camera QR scanning is unavailable in this browser. Enter the QR payload manually.'
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

async function submitEventScan(eventId, rawPayload) {
  const payload = rawPayload.trim();

  if (!payload) {
    setState({ errorById: { ...state.errorById, [eventId]: t('qrPayload') } });
    return;
  }

  try {
    const response = await fetch(`/api/event/check-ins?locale=${encodeURIComponent(state.locale)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: state.code,
        event_id: eventId,
        user_qr_payload: payload
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Scan failed.');
    }

    setState({
      resultById: { ...state.resultById, [eventId]: result },
      errorById: { ...state.errorById, [eventId]: '' }
    });
  } catch (error) {
    setState({ errorById: { ...state.errorById, [eventId]: error.message } });
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
          <input name="code" value="${escapeHtml(state.code)}" autocomplete="off" />
        </label>
        <button class="primary-button" type="submit">${escapeHtml(t('signIn'))}</button>
      </form>
    </section>
    ${state.error ? `<p class="error-message">${escapeHtml(state.error)}</p>` : ''}
  `;
}

function scannerTemplate(eventItem) {
  const result = state.resultById[eventItem.event_id];
  const error = state.errorById[eventItem.event_id];

  return `
    <section class="scan-panel">
      <h3>${escapeHtml(t('scannerTitle'))}</h3>
      <p>${escapeHtml(t('scannerHint'))}</p>
      <button class="secondary-button" type="button" data-action="camera" data-event-id="${escapeHtml(eventItem.event_id)}">${escapeHtml(t('cameraScan'))}</button>
      <form class="scan-form" data-event-id="${escapeHtml(eventItem.event_id)}">
        <label>
          <span>${escapeHtml(t('qrPayload'))}</span>
          <textarea name="user_qr_payload" rows="3"></textarea>
        </label>
        <button class="primary-button" type="submit">${escapeHtml(t('confirm'))}</button>
      </form>
      ${error ? `<p class="error-message">${escapeHtml(error)}</p>` : ''}
      ${
        result
          ? `<div class="scan-result"><strong>${escapeHtml(t('completed'))}</strong><dl><div><dt>${escapeHtml(t('user'))}</dt><dd>${escapeHtml(result.user.name)} (${escapeHtml(result.user.user_id)})</dd></div><div><dt>${escapeHtml(t('grantedPoints'))}</dt><dd>${escapeHtml(result.granted_points)}pt</dd></div></dl></div>`
          : ''
      }
    </section>
  `;
}

function eventCardTemplate(eventItem) {
  return `
    <article class="portal-card">
      <div class="card-main">
        <div class="card-heading">
          <span class="status-pill">${escapeHtml(t('scannerTitle'))}</span>
          <h2>${escapeHtml(eventItem.event_name)}</h2>
        </div>
        <dl class="meta-grid">
          <div><dt>${escapeHtml(t('eventDate'))}</dt><dd>${escapeHtml(formatDateTime(eventItem.event_datetime))}</dd></div>
          <div><dt>${escapeHtml(t('location'))}</dt><dd>${escapeHtml(eventItem.location)}</dd></div>
          <div><dt>${escapeHtml(t('points'))}</dt><dd>${escapeHtml(eventItem.grant_points)}pt</dd></div>
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
      ${scannerTemplate(eventItem)}
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
    const eventId = target.dataset.eventId;

    try {
      const rawPayload = await readQrWithCamera();
      await submitEventScan(eventId, rawPayload);
    } catch (error) {
      setState({ errorById: { ...state.errorById, [eventId]: error.message } });
    }
  }
});

app.addEventListener('submit', (event) => {
  if (event.target.classList.contains('access-form')) {
    const form = new FormData(event.target);
    state.code = String(form.get('code') || '').trim();
    loadPortal(event);
    return;
  }

  if (event.target.classList.contains('scan-form')) {
    event.preventDefault();
    const form = new FormData(event.target);
    submitEventScan(event.target.dataset.eventId, String(form.get('user_qr_payload') || ''));
  }
});

render();
loadPortal();
