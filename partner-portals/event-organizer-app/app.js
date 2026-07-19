const SESSION_KEY = 'linktown-event-portal-session';

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
  locale: localStorage.getItem('event-portal-locale') || 'ja',
  code: savedSession?.code || '',
  password: savedSession?.password || '',
  payload: null,
  screen: 'access',
  selectedEventId: '',
  scanType: 'check_in',
  manualPayload: '',
  pendingPayload: '',
  pendingUser: null,
  latestResult: null,
  resultById: {},
  error: ''
};

const ui = {
  ja: {
    title: 'イベント受付',
    product: 'Link Town',
    language: 'EN',
    logout: 'ログアウト',
    accessCode: 'イベント主催者ID',
    accessPlaceholder: 'イベント主催者IDを入力',
    password: 'パスワード',
    passwordPlaceholder: 'パスワードを入力',
    signIn: '続ける',
    forgotCode: 'パスワードを忘れた方',
    invalidCode: 'イベント主催者IDまたはパスワードが違います',
    homeTitle: '受付するイベント',
    organizer: '主催者',
    contact: '連絡先',
    eventDate: '開催日時',
    location: '集合場所',
    points: '付与ポイント',
    accepted: '受付済',
    startScan: 'QR読取開始',
    scanPrompt: 'QRコードをかざしてください',
    manualEntry: '手入力で受付',
    manualTitle: 'QRの内容を入力',
    manualPlaceholder: '参加者アプリに表示されたQR内容を貼り付けてください',
    camera: 'カメラ',
    confirm: '確認する',
    confirmTitle: '受付しますか？',
    cancel: 'キャンセル',
    checkIn: '受付する',
    completed: '受付しました',
    continueScan: '続けて受付する',
    granted: '付与',
    participant: '参加者',
    scanAgain: 'もう一度読み取る',
    qrRequired: 'QR内容を入力してください。',
    invalidQr: 'QRの形式を確認してください。',
    validating: 'イベント応募状況を確認中です…',
    notApplied: 'このイベントに応募していないため受付できません。',
    notAppliedHint: '利用者アプリからイベントへ応募した後、もう一度QRを読み取ってください。',
    notCheckedIn: 'このイベントの受付が完了していないため、参加完了を認証できません。',
    notCheckedInHint: '先に受付QRを読み取ってから、参加完了QRを読み取ってください。',
    completionUnavailable: '完了確認QRはイベント終了日時以降に利用できます。',
    cameraUnavailable: 'このブラウザではカメラQR読取を利用できません。手入力で受付してください。'
  },
  en: {
    title: 'Event Check-in',
    product: 'Link Town',
    language: 'JA',
    logout: 'Log out',
    accessCode: 'Organizer ID',
    accessPlaceholder: 'Enter organizer ID',
    password: 'Password',
    passwordPlaceholder: 'Enter password',
    signIn: 'Continue',
    forgotCode: 'Forgot code',
    invalidCode: 'Check the access code.',
    homeTitle: 'Events to check in',
    organizer: 'Organizer',
    contact: 'Contact',
    eventDate: 'Date',
    location: 'Meeting point',
    points: 'Grant points',
    accepted: 'Checked in',
    startScan: 'Start QR scan',
    scanPrompt: 'Hold up the QR code',
    manualEntry: 'Manual check-in',
    manualTitle: 'Enter QR payload',
    manualPlaceholder: 'Paste the QR payload shown in the participant app',
    camera: 'Camera',
    confirm: 'Confirm',
    confirmTitle: 'Check in?',
    cancel: 'Cancel',
    checkIn: 'Check in',
    completed: 'Checked in',
    continueScan: 'Check in next',
    granted: 'granted',
    participant: 'Participant',
    scanAgain: 'Scan again',
    qrRequired: 'Enter the QR payload.',
    invalidQr: 'Check the QR format.',
    validating: 'Checking event application…',
    notApplied: 'This user has not applied for this event.',
    notAppliedHint: 'Ask the user to apply for the event in the participant app, then scan the QR again.',
    notCheckedIn: 'This user has not checked in for this event.',
    notCheckedInHint: 'Scan the check-in QR before confirming event completion.',
    completionUnavailable: 'Completion QR becomes available after the event end time.',
    cameraUnavailable: 'Camera QR scanning is unavailable in this browser. Use manual check-in.'
  }
};

const app = document.getElementById('app');

function t(key) {
  return ui[state.locale][key];
}

function setState(nextState) {
  Object.assign(state, nextState);
  localStorage.setItem('event-portal-locale', state.locale);
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
    selectedEventId: '',
    manualPayload: '',
    pendingPayload: '',
    pendingUser: null,
    latestResult: null,
    resultById: {},
    error: ''
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

function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(state.locale === 'en' ? 'en-US' : 'ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatEventSub(eventItem) {
  const date = new Date(eventItem.event_datetime);
  const time = Number.isNaN(date.getTime())
    ? eventItem.event_datetime
    : new Intl.DateTimeFormat(state.locale === 'en' ? 'en-US' : 'ja-JP', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);

  return `${time} ${eventItem.location}`;
}

function currentEvent() {
  return state.payload?.events.find((eventItem) => eventItem.event_id === state.selectedEventId) || state.payload?.events[0] || null;
}

function checkinCount(eventId) {
  const eventItem = state.payload?.events.find((item) => item.event_id === eventId);
  return Number(eventItem?.checked_in_count || 0);
}

function isCompletionScanReady(eventItem, now = Date.now()) {
  if (!eventItem?.event_end_datetime) {
    return true;
  }

  const endTime = new Date(eventItem.event_end_datetime).getTime();
  return Number.isNaN(endTime) || now >= endTime;
}

function parseUserPreview(rawPayload) {
  const trimmed = String(rawPayload || '').trim();

  if (!trimmed) {
    throw new Error(t('qrRequired'));
  }

  try {
    if (trimmed.startsWith('{')) {
      const payload = JSON.parse(trimmed);
      return {
        user_id: String(payload.user_id || '').trim(),
        name: String(payload.name || '').trim(),
        nonce: String(payload.nonce || '').trim()
      };
    }

    const payloadUrl = new URL(trimmed);
    return {
      user_id: String(payloadUrl.searchParams.get('user_id') || '').trim(),
      name: String(payloadUrl.searchParams.get('name') || '').trim(),
      nonce: String(payloadUrl.searchParams.get('nonce') || '').trim()
    };
  } catch (error) {
    throw new Error(t('invalidQr'));
  }
}

function ensurePreview(rawPayload) {
  const user = parseUserPreview(rawPayload);

  if (!user.user_id || !user.nonce) {
    throw new Error(t('invalidQr'));
  }

  return {
    ...user,
    name: user.name || `User ${user.user_id}`
  };
}

function showError(message) {
  setState({ screen: 'error', error: message || t('invalidQr') });
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
      if (response.status === 401) {
        clearPortalSession();
      }
      throw new Error(t('invalidCode'));
    }

    savePortalSession();

    setState({
      payload,
      error: '',
      screen: 'eventList',
      selectedEventId: payload.events[0]?.event_id || '',
      manualPayload: '',
      pendingPayload: '',
      pendingUser: null,
      latestResult: null,
      resultById: {}
    });
  } catch (error) {
    setState({ payload: null, screen: 'access', error: error.message || t('invalidCode') });
  }
}

async function readQrWithCamera() {
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
    throw new Error(t('cameraUnavailable'));
  }

  const overlay = document.createElement('div');
  overlay.className = 'camera-overlay';
  overlay.innerHTML = `
    <div class="camera-box">
      <video autoplay muted playsinline></video>
      <button type="button" aria-label="close">×</button>
    </div>
  `;
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

async function prepareConfirmation(rawPayload) {
  try {
    const pendingUser = ensurePreview(rawPayload);
    const eventItem = currentEvent();
    if (!eventItem) {
      throw new Error(t('invalidQr'));
    }

    setState({
      screen: 'validating',
      pendingPayload: String(rawPayload || '').trim(),
      pendingUser,
      error: ''
    });

    const response = await fetch(`/api/event/check-in-eligibility?locale=${encodeURIComponent(state.locale)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: state.code,
        password: state.password,
        event_id: eventItem.event_id,
        scan_type: state.scanType,
        user_qr_payload: state.pendingPayload
      })
    });
    const result = await response.json();

    if (!response.ok) {
      const message =
        result.code === 'EVENT_APPLICATION_REQUIRED'
          ? t('notApplied')
          : result.code === 'EVENT_CHECK_IN_REQUIRED'
            ? t('notCheckedIn')
            : result.message || t('invalidQr');
      throw new Error(message);
    }

    setState({
      screen: 'confirm',
      pendingUser: result.user,
      error: ''
    });
  } catch (error) {
    showError(error.message);
  }
}

async function submitEventScan() {
  const eventItem = currentEvent();

  if (!eventItem || !state.pendingPayload) {
    showError(t('invalidQr'));
    return;
  }

  try {
    const endpoint = state.scanType === 'completion' ? 'completions' : 'check-ins';
    const response = await fetch(`/api/event/${endpoint}?locale=${encodeURIComponent(state.locale)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: state.code,
        password: state.password,
        event_id: eventItem.event_id,
        user_qr_payload: state.pendingPayload
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Scan failed.');
    }

    setState({
      screen: 'success',
      latestResult: result,
      resultById: { ...state.resultById, [eventItem.event_id]: result },
      manualPayload: '',
      pendingPayload: '',
      pendingUser: null,
      error: ''
    });
  } catch (error) {
    showError(error.message);
  }
}

function brandMarkTemplate() {
  return `
    <img class="brand-mark" src="/assets/linktown-icon.png" alt="" />
  `;
}

function appHeaderTemplate(eventItem, options = {}) {
  const title = eventItem ? eventItem.event_name : t('product');
  const sub = eventItem ? formatEventSub(eventItem) : t('title');
  const showBack = options.backTo;
  const count = eventItem ? checkinCount(eventItem.event_id) : 0;

  return `
    <header class="app-header ${options.dimmed ? 'is-dimmed' : ''}">
      <div class="brand">
        ${
          showBack
            ? `<button class="icon-btn" type="button" data-action="${escapeHtml(showBack)}" aria-label="back">←</button>`
            : brandMarkTemplate()
        }
        <div>
          <div class="brand-name">${escapeHtml(title)}</div>
          <div class="brand-sub">${escapeHtml(sub)}</div>
        </div>
      </div>
      <div class="header-actions">
        <button class="logout-btn" type="button" data-action="logout">${escapeHtml(t('logout'))}</button>
        <button class="locale-btn" type="button" data-action="toggle-locale">${escapeHtml(t('language'))}</button>
        ${eventItem ? `<div class="counter"><div class="num">${escapeHtml(count)}</div><div class="lbl">${escapeHtml(t('accepted'))}</div></div>` : ''}
      </div>
    </header>
  `;
}

function accessTemplate() {
  return `
    <div class="tablet-frame tablet-frame--auth ${state.error ? 'auth-error' : ''}">
      <div class="center-stage">
        <div class="center-stage-inner auth-card">
          <div class="hero-brand">
            <img class="login-logo" src="/assets/linktown-icon.png" alt="" />
            <div class="name">${escapeHtml(t('product'))}</div>
            <div class="sub">${escapeHtml(t('title'))}</div>
          </div>
          <form class="code-form">
            <label for="code">${escapeHtml(t('accessCode'))}</label>
            <input id="code" class="input" name="code" value="${escapeHtml(state.code)}" placeholder="${escapeHtml(t('accessPlaceholder'))}" autocomplete="off" />
            <label for="password">${escapeHtml(t('password'))}</label>
            <input id="password" class="input" name="password" value="${escapeHtml(state.password)}" placeholder="${escapeHtml(t('passwordPlaceholder'))}" type="password" autocomplete="current-password" />
            ${state.error ? `<div class="form-error">${escapeHtml(state.error)}</div>` : ''}
            <button type="submit" class="btn btn-primary btn-block btn-xl">${escapeHtml(t('signIn'))}</button>
            <button type="button" class="text-link" data-action="noop">${escapeHtml(t('forgotCode'))}</button>
          </form>
        </div>
      </div>
    </div>
  `;
}

function eventListTemplate() {
  const account = state.payload.account;
  const submissionPlaceholders =
    state.locale === 'en'
      ? {
          eventName: 'Event name (required)',
          startDateTime: 'Start date and time (required)',
          endDateTime: 'End date and time (required)',
          location: 'Location (e.g. Central Park)',
          requestedPoints: 'Requested points (e.g. 100)',
          description: 'Event details (activities, requirements, etc.)'
        }
      : {
          eventName: 'イベント名（必須・例：地域清掃イベント）',
          startDateTime: '開始日時（必須）',
          endDateTime: '終了日時（必須）',
          location: '開催場所（例：〇〇公園）',
          requestedPoints: '付与希望ポイント（例：100）',
          description: 'イベント概要（活動内容・参加条件など）'
        };

  return `
    <div class="tablet-frame">
      ${appHeaderTemplate(null)}
      <main class="event-home">
        <section class="account-strip">
          <div>
            <div class="label">${escapeHtml(t('organizer'))}</div>
            <strong>${escapeHtml(account.name)}</strong>
          </div>
          <div>
            <div class="label">${escapeHtml(t('contact'))}</div>
            <strong>${escapeHtml(account.email)}</strong>
          </div>
        </section>
        <section class="event-list" aria-label="${escapeHtml(t('homeTitle'))}">
          <h1>${escapeHtml(t('homeTitle'))}</h1>
          <div class="event-grid">
            ${state.payload.events.map(eventCardTemplate).join('')}
          </div>
        </section>
        <section class="event-list">
          <h1>${state.locale === 'en' ? 'Event submissions' : 'イベント申請'}</h1>
          <form class="submission-form">
            <input class="input" name="event_name" required aria-label="${escapeHtml(submissionPlaceholders.eventName)}" placeholder="${escapeHtml(submissionPlaceholders.eventName)}" />
            <div class="split-actions">
              <label class="submission-datetime-field">
                <span class="submission-datetime-field__placeholder" aria-hidden="true">${escapeHtml(submissionPlaceholders.startDateTime)}</span>
                <input class="input" name="event_datetime" type="datetime-local" required aria-label="${escapeHtml(submissionPlaceholders.startDateTime)}" placeholder="${escapeHtml(submissionPlaceholders.startDateTime)}" />
              </label>
              <label class="submission-datetime-field">
                <span class="submission-datetime-field__placeholder" aria-hidden="true">${escapeHtml(submissionPlaceholders.endDateTime)}</span>
                <input class="input" name="event_end_datetime" type="datetime-local" required aria-label="${escapeHtml(submissionPlaceholders.endDateTime)}" placeholder="${escapeHtml(submissionPlaceholders.endDateTime)}" />
              </label>
            </div>
            <input class="input" name="location" aria-label="${escapeHtml(submissionPlaceholders.location)}" placeholder="${escapeHtml(submissionPlaceholders.location)}" />
            <input class="input" name="requested_grant_points" type="number" min="0" aria-label="${escapeHtml(submissionPlaceholders.requestedPoints)}" placeholder="${escapeHtml(submissionPlaceholders.requestedPoints)}" />
            <textarea class="input" name="description" aria-label="${escapeHtml(submissionPlaceholders.description)}" placeholder="${escapeHtml(submissionPlaceholders.description)}"></textarea>
            <button class="btn btn-primary" type="submit">${state.locale === 'en' ? 'Submit for review' : '審査へ申請'}</button>
          </form>
          <div class="event-grid">
            ${(state.payload.submissions || []).map(submissionCardTemplate).join('') ||
              `<p>${state.locale === 'en' ? 'No submissions yet.' : '申請はまだありません。'}</p>`}
          </div>
        </section>
      </main>
      <div class="frame-id">E-03</div>
    </div>
  `;
}

function submissionCardTemplate(item) {
  return `
    <article class="event-card">
      <div class="event-card-main">
        <h2>${escapeHtml(item.event_name)}</h2>
        <p>${escapeHtml(item.status)} · ${escapeHtml(formatDateTime(item.event_datetime))}</p>
        ${item.review_note ? `<p>${escapeHtml(item.review_note)}</p>` : ''}
      </div>
      ${['pending', 'rejected'].includes(item.status)
        ? `<div class="detail__actions">
            <button class="btn btn-outline" type="button" data-action="edit-submission" data-submission-id="${escapeHtml(item.submission_id)}">${state.locale === 'en' ? 'Edit / resubmit' : '編集・再申請'}</button>
            ${item.status === 'pending' ? `<button class="btn btn-outline" type="button" data-action="withdraw-submission" data-submission-id="${escapeHtml(item.submission_id)}">${state.locale === 'en' ? 'Withdraw' : '取り下げ'}</button>` : ''}
          </div>`
        : ''}
    </article>`;
}

function eventCardTemplate(eventItem) {
  const completionReady = isCompletionScanReady(eventItem);
  return `
    <article class="event-card">
      <div class="event-card-main">
        <h2>${escapeHtml(eventItem.event_name)}</h2>
        <dl class="meta-list">
          <div><dt>${escapeHtml(t('eventDate'))}</dt><dd>${escapeHtml(formatDateTime(eventItem.event_datetime))}</dd></div>
          <div><dt>${escapeHtml(t('location'))}</dt><dd>${escapeHtml(eventItem.location)}</dd></div>
          <div><dt>${escapeHtml(t('points'))}</dt><dd>+${escapeHtml(eventItem.grant_points)} pt</dd></div>
        </dl>
        <p>${escapeHtml(eventItem.description)}</p>
      </div>
      <div class="event-card-side">
        <div class="counter counter--large">
          <div class="num">${escapeHtml(eventItem.application_count || 0)} / ${escapeHtml(eventItem.checked_in_count || 0)} / ${escapeHtml(eventItem.completed_count || 0)}</div>
          <div class="lbl">${state.locale === 'en' ? 'Applied / checked in / completed' : '申込 / 受付 / 完了'}</div>
        </div>
        <button class="btn btn-primary" type="button" data-action="open-scan" data-scan-type="check_in" data-event-id="${escapeHtml(eventItem.event_id)}">${state.locale === 'en' ? 'Check-in QR' : '開始受付QR'}</button>
        <button class="btn btn-primary" type="button" data-action="open-scan" data-scan-type="completion" data-event-id="${escapeHtml(eventItem.event_id)}" ${completionReady ? '' : `disabled title="${escapeHtml(t('completionUnavailable'))}"`}>${state.locale === 'en' ? 'Completion QR' : '完了確認QR'}</button>
        ${completionReady ? '' : `<p class="event-card-note">${escapeHtml(t('completionUnavailable'))}</p>`}
        <button class="btn btn-outline" type="button" data-action="close-event" data-event-id="${escapeHtml(eventItem.event_id)}">${state.locale === 'en' ? 'Close event' : 'イベント受付終了'}</button>
      </div>
    </article>
  `;
}

function scanStageTemplate(options = {}) {
  const eventItem = currentEvent();

  return `
    <div class="scan-stage ${options.dimmed ? 'is-dimmed' : ''}">
      <div class="scan-info">
        <div>
          <div class="label">${escapeHtml(t('points'))}</div>
          <div class="points-large">+${escapeHtml(eventItem.grant_points)}<span>pt</span></div>
        </div>
        <div class="target-meta">
          <div class="row"><span class="icon">□</span><span>${escapeHtml(formatDateTime(eventItem.event_datetime))}</span></div>
          <div class="row"><span class="icon">⌖</span><span>${escapeHtml(eventItem.location)}</span></div>
        </div>
        <button class="btn btn-outline btn-xl" type="button" data-action="open-manual">⌨ ${escapeHtml(t('manualEntry'))}</button>
      </div>
      <button class="scan-target" type="button" data-action="camera">
        <span class="qr-frame">
          <span class="corners" aria-hidden="true"></span>
          <span class="qr-icon" aria-hidden="true">▦</span>
        </span>
        <span class="prompt">${escapeHtml(t('scanPrompt'))}</span>
      </button>
    </div>
  `;
}

function scanTemplate() {
  const eventItem = currentEvent();

  return `
    <div class="tablet-frame">
      ${appHeaderTemplate(eventItem, { backTo: 'open-home' })}
      ${scanStageTemplate()}
      <div class="frame-id">E-04</div>
    </div>
  `;
}

function manualTemplate() {
  const eventItem = currentEvent();
  let preview = null;

  try {
    preview = state.manualPayload ? parseUserPreview(state.manualPayload) : null;
  } catch (error) {
    preview = null;
  }

  return `
    <div class="tablet-frame">
      ${appHeaderTemplate(eventItem, { backTo: 'open-scan-current' })}
      <main class="center-stage center-stage--manual">
        <form class="center-stage-inner manual-form">
          <h1>${escapeHtml(t('manualTitle'))}</h1>
          <textarea class="input" name="user_qr_payload" placeholder="${escapeHtml(t('manualPlaceholder'))}">${escapeHtml(state.manualPayload)}</textarea>
          <div class="recipient-card">
            <div class="label">${escapeHtml(t('participant'))}</div>
            <div class="recipient-name">${escapeHtml(preview?.name || '-')}</div>
          </div>
          <div class="split-actions">
            <button class="btn btn-outline btn-xl" type="button" data-action="camera">□ ${escapeHtml(t('camera'))}</button>
            <button class="btn btn-primary btn-xl" type="submit">${escapeHtml(t('confirm'))}</button>
          </div>
        </form>
      </main>
      <div class="frame-id">E-05</div>
    </div>
  `;
}

function confirmTemplate() {
  const eventItem = currentEvent();
  const user = state.pendingUser;

  return `
    <div class="tablet-frame">
      ${appHeaderTemplate(eventItem, { backTo: 'open-home', dimmed: true })}
      ${scanStageTemplate({ dimmed: true })}
      <div class="modal-overlay">
        <section class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(t('confirmTitle'))}">
          <h1>${state.scanType === 'completion' ? (state.locale === 'en' ? 'Confirm completion?' : '参加完了にしますか？') : escapeHtml(t('confirmTitle'))}</h1>
          <div class="recipient">
            <div class="name">${escapeHtml(user?.name || '-')}</div>
          </div>
          <div class="delta" ${state.scanType === 'check_in' ? 'hidden' : ''}>
            <div class="label">${escapeHtml(t('points'))}</div>
            <div class="value">+${escapeHtml(eventItem.grant_points)}<span>pt</span></div>
            <div class="for">${escapeHtml(eventItem.event_name)}</div>
          </div>
          <div class="actions">
            <button class="btn btn-outline btn-xl" type="button" data-action="cancel-confirm">${escapeHtml(t('cancel'))}</button>
            <button class="btn btn-primary btn-xl" type="button" data-action="submit-checkin">${state.scanType === 'completion' ? (state.locale === 'en' ? 'Complete and grant points' : '完了してポイント付与') : escapeHtml(t('checkIn'))}</button>
          </div>
        </section>
      </div>
      <div class="frame-id">E-06</div>
    </div>
  `;
}

function validatingTemplate() {
  const eventItem = currentEvent();

  return `
    <div class="tablet-frame">
      ${appHeaderTemplate(eventItem, { backTo: 'open-home', dimmed: true })}
      ${scanStageTemplate({ dimmed: true })}
      <div class="modal-overlay">
        <section class="modal" role="status" aria-live="polite" aria-label="${escapeHtml(t('validating'))}">
          <h1>${escapeHtml(t('validating'))}</h1>
        </section>
      </div>
      <div class="frame-id">E-06</div>
    </div>
  `;
}

function successTemplate() {
  const eventItem = currentEvent();
  const result = state.latestResult;

  return `
    <div class="tablet-frame">
      ${appHeaderTemplate(eventItem)}
      <main class="success-stage">
        <div class="check">✓</div>
        <div class="msg">${state.scanType === 'completion' ? (state.locale === 'en' ? 'Completion confirmed' : '参加完了を確認しました') : escapeHtml(t('completed'))}</div>
        <div class="name-line"><strong>${escapeHtml(result?.user?.name || '')}</strong> さん</div>
        ${state.scanType === 'completion' ? `<div class="delta">+${escapeHtml(result?.granted_points || 0)} pt ${escapeHtml(t('granted'))}</div>` : ''}
        <button class="btn btn-primary btn-xl" type="button" data-action="open-scan-current">${escapeHtml(t('continueScan'))}</button>
      </main>
      <div class="frame-id">E-07</div>
    </div>
  `;
}

function errorTemplate() {
  const eventItem = currentEvent();

  return `
    <div class="tablet-frame">
      ${appHeaderTemplate(eventItem)}
      <main class="alert-stage warn">
        <div class="mark">!</div>
        <div class="msg">${escapeHtml(state.error || t('invalidQr'))}</div>
        <div class="hint">${escapeHtml(
          state.error === t('notApplied')
            ? t('notAppliedHint')
            : state.error === t('notCheckedIn')
              ? t('notCheckedInHint')
              : t('invalidQr')
        )}</div>
        <button class="btn btn-primary btn-xl" type="button" data-action="open-scan-current">${escapeHtml(t('scanAgain'))}</button>
      </main>
      <div class="frame-id">E-08</div>
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
    eventList: eventListTemplate,
    scan: scanTemplate,
    manual: manualTemplate,
    validating: validatingTemplate,
    confirm: confirmTemplate,
    success: successTemplate,
    error: errorTemplate
  };

  app.innerHTML = (templates[state.screen] || eventListTemplate)();
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

  if (target.dataset.action === 'open-home') {
    setState({ screen: 'eventList', error: '' });
    return;
  }

  if (target.dataset.action === 'open-scan') {
    setState({
      screen: 'scan',
      selectedEventId: target.dataset.eventId,
      scanType: target.dataset.scanType || 'check_in',
      error: ''
    });
    return;
  }

  if (target.dataset.action === 'open-scan-current') {
    setState({ screen: 'scan', error: '' });
    return;
  }

  if (target.dataset.action === 'open-manual') {
    setState({ screen: 'manual', manualPayload: '', error: '' });
    return;
  }

  if (target.dataset.action === 'cancel-confirm') {
    setState({ screen: 'manual', pendingPayload: '', pendingUser: null, error: '' });
    return;
  }

  if (target.dataset.action === 'submit-checkin') {
    await submitEventScan();
    return;
  }

  if (target.dataset.action === 'withdraw-submission') {
    const response = await fetch(`/api/event/submissions/${target.dataset.submissionId}/withdraw`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: state.code, password: state.password })
    });
    const result = await response.json();
    if (!response.ok) return showError(result.message);
    await loadPortal();
    return;
  }

  if (target.dataset.action === 'edit-submission') {
    const current = (state.payload.submissions || []).find(
      (item) => String(item.submission_id) === String(target.dataset.submissionId)
    );
    if (!current) return;
    const form = document.querySelector('.submission-form');
    if (!form) return;
    form.dataset.submissionId = String(current.submission_id);
    form.elements.event_name.value = current.event_name || '';
    form.elements.event_datetime.value = String(current.event_datetime || '').replace(' ', 'T').slice(0, 16);
    form.elements.event_end_datetime.value = String(current.event_end_datetime || '').replace(' ', 'T').slice(0, 16);
    form.elements.location.value = current.location || '';
    form.elements.requested_grant_points.value = String(current.requested_grant_points || 0);
    form.elements.description.value = current.description || '';
    form.querySelector('button[type="submit"]').textContent =
      state.locale === 'en' ? 'Save and resubmit' : '保存して再申請';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (target.dataset.action === 'close-event') {
    if (target.dataset.confirming !== 'true') {
      target.dataset.confirming = 'true';
      target.textContent = state.locale === 'en' ? 'Click again to confirm close' : 'もう一度押して受付終了を確定';
      return;
    }
    const response = await fetch(`/api/event/events/${target.dataset.eventId}/close`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: state.code, password: state.password })
    });
    const result = await response.json();
    if (!response.ok) return showError(result.message);
    await loadPortal();
    return;
  }

  if (target.dataset.action === 'camera') {
    try {
      const rawPayload = await readQrWithCamera();
      prepareConfirmation(rawPayload);
    } catch (error) {
      showError(error.message);
    }
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

  if (event.target.classList.contains('submission-form')) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.target).entries());
    const submissionId = event.target.dataset.submissionId;
    fetch(submissionId ? `/api/event/submissions/${submissionId}` : '/api/event/submissions', {
      method: submissionId ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, code: state.code, password: state.password })
    })
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => {
        if (!response.ok) throw new Error(result.message);
        return loadPortal();
      })
      .catch((error) => showError(error.message));
  }
});

app.addEventListener('input', (event) => {
  if (event.target.name === 'user_qr_payload') {
    state.manualPayload = event.target.value;
  }
});

render();

if (savedSession) {
  loadPortal();
}
