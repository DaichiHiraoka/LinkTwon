const fs = require('fs/promises');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const {
  getTranslatedField,
  loadTranslationCache,
  refreshTranslationCache
} = require('./lib/translationCache');
const {
  readPartnerData,
  verifyEventApplication,
  recordEventCheckIn,
  recordEventCompletion,
  saveEventSubmission,
  closeOrganizerEvent,
  recordStoreExchange
} = require('./lib/partnerRepository');
const { env } = require('./config/env');

const APP_ROLE = env.PARTNER_APP_ROLE;
const PORT = env.PORT;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, APP_ROLE === 'store' ? 'store-app' : 'event-organizer-app');
const CACHE_PATH = path.join(ROOT_DIR, 'data', 'translation-cache.json');
const DAY_MS = 24 * 60 * 60 * 1000;
const USER_QR_CLOCK_TOLERANCE_MS = 30 * 60 * 1000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(JSON.stringify(body, null, 2));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { message });
}

const API_ERROR_MESSAGES = {
  ja: {
    INVALID_REQUEST: '送信された情報を確認できませんでした。もう一度お試しください。',
    QR_REQUIRED: 'QRコードが読み取られていません。利用者のQRコードをもう一度読み取ってください。',
    QR_INVALID_FORMAT: 'Link Townの利用者QRではありません。利用者アプリに表示されたQRコードを確認してください。',
    QR_INVALID_TYPE: 'このQRコードは利用者確認用ではありません。利用者アプリのQRコードを確認してください。',
    QR_MISSING_FIELDS: 'QRコードの情報が不足しています。利用者アプリでQRコードを更新してください。',
    QR_NOT_YET_VALID: 'QRコードの時刻が正しくありません。端末の時刻設定を確認してください。',
    QR_EXPIRED: 'QRコードの有効期限が切れています。利用者アプリでQRコードを更新してください。',
    QR_ALREADY_USED: 'このQRコードはすでに使用されています。利用者アプリで新しいQRコードを表示してください。',
    QR_USER_NOT_FOUND: 'QRコードの利用者が見つかりません。利用者アカウントを確認してください。',
    EVENT_ORGANIZER_AUTH_INVALID: 'イベント主催者IDまたはパスワードが正しくありません。',
    EVENT_NOT_FOUND: '選択したイベントを確認できません。イベント一覧を更新してください。',
    EVENT_CLOSED: 'このイベントは受付を終了しています。',
    EVENT_APPLICATION_REQUIRED: 'この利用者はイベントに応募していないため、受付できません。',
    EVENT_CHECK_IN_REQUIRED: 'この利用者は開始受付が完了していないため、参加完了にできません。',
    EVENT_ALREADY_CHECKED_IN: 'この利用者はすでに開始受付済みです。',
    EVENT_ALREADY_COMPLETED: 'この利用者はすでに参加完了済みです。',
    PARTICIPATION_STATUS_INVALID: '現在の参加状態では、このQR操作を実行できません。',
    COMPLETION_TOO_EARLY: '完了確認はイベント終了日時以降に実行してください。',
    STORE_AUTH_INVALID: '店舗IDまたはパスワードが正しくありません。',
    SERVICE_NOT_FOUND: '選択した商品を確認できません。商品一覧を更新してください。',
    POINTS_INSUFFICIENT: '利用者のポイントが不足しています。',
    SERVER_ERROR: 'サーバー処理に失敗しました。時間をおいてもう一度お試しください。'
  },
  en: {
    INVALID_REQUEST: 'The submitted request could not be read. Please try again.',
    QR_REQUIRED: 'No QR code was received. Scan the participant QR code again.',
    QR_INVALID_FORMAT: 'This is not a Link Town participant QR code.',
    QR_INVALID_TYPE: 'This QR code cannot be used to identify a participant.',
    QR_MISSING_FIELDS: 'The QR code is missing required information. Ask the participant to refresh it.',
    QR_NOT_YET_VALID: 'The QR code time is invalid. Check the device clock.',
    QR_EXPIRED: 'The QR code has expired. Ask the participant to refresh it.',
    QR_ALREADY_USED: 'This QR code has already been used. Ask the participant to display a new one.',
    QR_USER_NOT_FOUND: 'The participant for this QR code was not found.',
    EVENT_ORGANIZER_AUTH_INVALID: 'The event organizer ID or password is incorrect.',
    EVENT_NOT_FOUND: 'The selected event could not be found. Refresh the event list.',
    EVENT_CLOSED: 'This event is closed.',
    EVENT_APPLICATION_REQUIRED: 'This participant has not applied for the event.',
    EVENT_CHECK_IN_REQUIRED: 'This participant has not checked in for the event.',
    EVENT_ALREADY_CHECKED_IN: 'This participant has already checked in.',
    EVENT_ALREADY_COMPLETED: 'This participant has already completed the event.',
    PARTICIPATION_STATUS_INVALID: 'This QR operation is not available for the current participation status.',
    COMPLETION_TOO_EARLY: 'Completion can only be confirmed after the event end time.',
    STORE_AUTH_INVALID: 'The store ID or password is incorrect.',
    SERVICE_NOT_FOUND: 'The selected item could not be found. Refresh the item list.',
    POINTS_INSUFFICIENT: 'The participant does not have enough points.',
    SERVER_ERROR: 'The server could not complete the request. Please try again later.'
  }
};

function apiErrorMessage(code, locale) {
  const language = locale === 'en' ? 'en' : 'ja';
  return API_ERROR_MESSAGES[language][code] || API_ERROR_MESSAGES[language].SERVER_ERROR;
}

function createApiError(code, statusCode = 400) {
  const error = new Error(API_ERROR_MESSAGES.en[code] || API_ERROR_MESSAGES.en.SERVER_ERROR);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function apiFailure(status, code, locale, details = {}) {
  return {
    status,
    body: {
      code,
      message: apiErrorMessage(code, locale),
      ...details
    }
  };
}

function sendQrError(response, error, locale) {
  if (error?.code && API_ERROR_MESSAGES.en[error.code]) {
    return sendJson(response, error.statusCode || 400, {
      code: error.code,
      message: apiErrorMessage(error.code, locale)
    });
  }

  if (error instanceof SyntaxError) {
    return sendJson(response, 400, {
      code: 'INVALID_REQUEST',
      message: apiErrorMessage('INVALID_REQUEST', locale)
    });
  }

  console.error('[qr-api] Unexpected QR processing error.', error);
  return sendJson(response, 500, {
    code: 'SERVER_ERROR',
    message: apiErrorMessage('SERVER_ERROR', locale)
  });
}

function participationErrorCode(scanType, participationStatus) {
  if (participationStatus === 'completed') {
    return 'EVENT_ALREADY_COMPLETED';
  }
  if (scanType === 'check_in' && participationStatus === 'checked_in') {
    return 'EVENT_ALREADY_CHECKED_IN';
  }
  return scanType === 'completion' ? 'EVENT_CHECK_IN_REQUIRED' : 'EVENT_APPLICATION_REQUIRED';
}

function toSqlDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();

  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody);
}

function parseUserQrPayload(rawPayload) {
  if (typeof rawPayload !== 'string' || rawPayload.trim() === '') {
    throw createApiError('QR_REQUIRED');
  }

  const trimmed = rawPayload.trim();
  let payload;

  if (trimmed.startsWith('{')) {
    try {
      payload = JSON.parse(trimmed);
    } catch (error) {
      throw createApiError('QR_INVALID_FORMAT');
    }
  } else {
    let payloadUrl;
    try {
      payloadUrl = new URL(trimmed);
    } catch (error) {
      throw createApiError('QR_INVALID_FORMAT');
    }
    const isUserPresentUrl = payloadUrl.protocol === 'linktown:' && payloadUrl.hostname === 'user-present';

    if (!isUserPresentUrl) {
      throw createApiError('QR_INVALID_FORMAT');
    }

    payload = Object.fromEntries(payloadUrl.searchParams.entries());
  }

  if (payload.type !== 'user-present') {
    throw createApiError('QR_INVALID_TYPE');
  }

  const userId = String(payload.user_id || '').trim();
  const name = String(payload.name || '').trim();
  const nonce = String(payload.nonce || '').trim();
  const issuedAt = payload.issued_at ? new Date(payload.issued_at) : null;
  const expiresAt = new Date(payload.expires_at);

  if (!userId || !nonce || Number.isNaN(expiresAt.getTime())) {
    throw createApiError('QR_MISSING_FIELDS');
  }

  if (issuedAt && Number.isNaN(issuedAt.getTime())) {
    throw createApiError('QR_MISSING_FIELDS');
  }

  const now = Date.now();
  if (issuedAt && issuedAt.getTime() - USER_QR_CLOCK_TOLERANCE_MS > now) {
    throw createApiError('QR_NOT_YET_VALID');
  }

  if (expiresAt.getTime() + USER_QR_CLOCK_TOLERANCE_MS < now) {
    throw createApiError('QR_EXPIRED');
  }

  return {
    user_id: userId,
    name: name || `User ${userId}`,
    nonce,
    issued_at: issuedAt ? toSqlDateTime(issuedAt) : null,
    expires_at: toSqlDateTime(expiresAt)
  };
}

function notTranslatedFields() {
  return [
    'store_name',
    'store_address',
    'map_query',
    'location',
    'event_datetime',
    'grant_points',
    'required_points'
  ];
}

function translateEvent(event, cache, locale) {
  return {
    ...event,
    event_name: getTranslatedField(cache, 'event', event.event_id, 'event_name', event.event_name, locale),
    description: getTranslatedField(cache, 'event', event.event_id, 'description', event.description, locale),
    activity: getTranslatedField(cache, 'event', event.event_id, 'activity', event.activity, locale),
    notes: getTranslatedField(cache, 'event', event.event_id, 'notes', event.notes, locale)
  };
}

function translateService(service, category, cache, locale) {
  return {
    ...service,
    category_name: category
      ? getTranslatedField(cache, 'service_category', category.category_id, 'category_name', category.category_name, locale)
      : '',
    service_name: getTranslatedField(cache, 'service', service.service_id, 'service_name', service.service_name, locale),
    description: getTranslatedField(cache, 'service', service.service_id, 'description', service.description, locale)
  };
}

function matchesPartnerCredentials(item, code, password) {
  return item.login_code === code && item.login_password === password;
}

async function buildEventPayload(code, password, locale, options = {}) {
  const data = await readPartnerData(options);
  const organizer = data.eventOrganizers.find((item) => matchesPartnerCredentials(item, code, password));

  if (!organizer) {
    return null;
  }

  const cache = await loadTranslationCache(options.cachePath || CACHE_PATH);
  const events = data.events
    .filter((event) => organizer.event_ids.includes(event.event_id))
    .map((event) => translateEvent(event, cache, locale));

  return {
    role: 'event',
    locale,
    account: {
      id: organizer.organizer_id,
      name: organizer.organizer_name,
      email: organizer.contact_email
    },
    not_translated_fields: notTranslatedFields(),
    events,
    submissions: data.eventSubmissions.filter(
      (submission) => String(submission.organizer_id) === String(organizer.organizer_id)
    )
  };
}

async function buildStorePayload(code, password, locale, options = {}) {
  const data = await readPartnerData(options);
  const store = data.stores.find((item) => matchesPartnerCredentials(item, code, password));

  if (!store) {
    return null;
  }

  const cache = await loadTranslationCache(options.cachePath || CACHE_PATH);
  const categoriesById = new Map(data.serviceCategories.map((category) => [category.category_id, category]));
  const services = data.services
    .filter((service) => store.service_ids.includes(service.service_id))
    .map((service) => translateService(service, categoriesById.get(service.category_id), cache, locale));

  return {
    role: 'store',
    locale,
    account: {
      id: store.store_id,
      name: store.store_name,
      email: store.contact_email,
      address: store.store_address,
      map_query: store.map_query
    },
    not_translated_fields: notTranslatedFields(),
    services
  };
}

async function processEventAttendance(body, locale, scanType, options = {}) {
  const data = await readPartnerData(options);
  const organizer = data.eventOrganizers.find((item) => matchesPartnerCredentials(item, body.code, body.password));

  if (!organizer) {
    return apiFailure(401, 'EVENT_ORGANIZER_AUTH_INVALID', locale);
  }

  const event = data.events.find((item) => item.event_id === body.event_id && organizer.event_ids.includes(item.event_id));

  if (!event) {
    return apiFailure(404, 'EVENT_NOT_FOUND', locale);
  }

  const user = parseUserQrPayload(body.user_qr_payload);
  const writeResult =
    scanType === 'completion'
      ? await recordEventCompletion({ organizer, event, user }, options)
      : await recordEventCheckIn({ organizer, event, user }, options);

  if (writeResult.duplicate) {
    return apiFailure(409, 'QR_ALREADY_USED', locale, { user, event_id: event.event_id });
  }
  if (writeResult.userNotFound) {
    return apiFailure(404, 'QR_USER_NOT_FOUND', locale, { user, event_id: event.event_id });
  }
  if (writeResult.eventClosed) {
    return apiFailure(409, 'EVENT_CLOSED', locale, { user, event_id: event.event_id });
  }
  if (writeResult.notApplied) {
    const code = scanType === 'completion' ? 'EVENT_CHECK_IN_REQUIRED' : 'EVENT_APPLICATION_REQUIRED';
    return apiFailure(403, code, locale, {
      user,
      event_id: event.event_id,
      participation_status: writeResult.participation_status ?? null
    });
  }
  if (writeResult.invalidStatus) {
    const code = participationErrorCode(scanType, writeResult.participation_status);
    return apiFailure(409, code, locale, {
      user,
      event_id: event.event_id,
      participation_status: writeResult.participation_status
    });
  }
  if (writeResult.tooEarly) {
    return apiFailure(409, 'COMPLETION_TOO_EARLY', locale, {
      event_id: event.event_id,
      event_end_datetime: writeResult.event_end_datetime
    });
  }

  const cache = await loadTranslationCache(options.cachePath || CACHE_PATH);
  const translatedEvent = translateEvent(event, cache, locale);

  return {
    status: 201,
    body: {
      message: scanType === 'completion' ? 'Event completion confirmed.' : 'Event check-in completed.',
      user,
      event_id: event.event_id,
      event_name: translatedEvent.event_name,
      participation_status: writeResult.participation_status,
      ...(scanType === 'completion'
        ? {
            granted_points: writeResult.granted_points,
            current_points: writeResult.current_points
          }
        : {}),
    }
  };
}

async function processEventEligibility(body, locale, options = {}) {
  const data = await readPartnerData(options);
  const organizer = data.eventOrganizers.find((item) => matchesPartnerCredentials(item, body.code, body.password));

  if (!organizer) {
    return apiFailure(401, 'EVENT_ORGANIZER_AUTH_INVALID', locale);
  }

  const event = data.events.find((item) => item.event_id === body.event_id && organizer.event_ids.includes(item.event_id));
  if (!event) {
    return apiFailure(404, 'EVENT_NOT_FOUND', locale);
  }

  const user = parseUserQrPayload(body.user_qr_payload);
  const scanType = body.scan_type === 'completion' ? 'completion' : 'check_in';
  const eligibility = await verifyEventApplication({ event, user, scanType }, options);

  if (eligibility.userNotFound) {
    return apiFailure(404, 'QR_USER_NOT_FOUND', locale, { user, event_id: event.event_id });
  }
  if (eligibility.eventClosed) {
    return apiFailure(409, 'EVENT_CLOSED', locale, { user, event_id: event.event_id });
  }
  if (eligibility.notEligible) {
    const code = participationErrorCode(scanType, eligibility.participation_status);
    return apiFailure(403, code, locale, {
      user,
      event_id: event.event_id,
      expected_status: eligibility.expected_status,
      participation_status: eligibility.participation_status
    });
  }

  const cache = await loadTranslationCache(options.cachePath || CACHE_PATH);
  const translatedEvent = translateEvent(event, cache, locale);
  return {
    status: 200,
    body: {
      eligible: true,
      user: { ...user, name: eligibility.user_name || user.name },
      event_id: event.event_id,
      event_name: translatedEvent.event_name,
      participation_status: eligibility.participation_status
    }
  };
}

async function processEventCheckIn(body, locale, options = {}) {
  return processEventAttendance(body, locale, 'check_in', options);
}

async function processEventCompletion(body, locale, options = {}) {
  return processEventAttendance(body, locale, 'completion', options);
}

async function processStoreExchange(body, locale, options = {}) {
  const data = await readPartnerData(options);
  const store = data.stores.find((item) => matchesPartnerCredentials(item, body.code, body.password));

  if (!store) {
    return apiFailure(401, 'STORE_AUTH_INVALID', locale);
  }

  const service = data.services.find((item) => item.service_id === body.service_id && store.service_ids.includes(item.service_id));

  if (!service) {
    return apiFailure(404, 'SERVICE_NOT_FOUND', locale);
  }

  const user = parseUserQrPayload(body.user_qr_payload);
  const writeResult = await recordStoreExchange({ store, service, user }, options);

  if (writeResult.duplicate) {
    return apiFailure(409, 'QR_ALREADY_USED', locale, { user, service_id: service.service_id });
  }
  if (writeResult.userNotFound) {
    return apiFailure(404, 'QR_USER_NOT_FOUND', locale, { user, service_id: service.service_id });
  }
  if (writeResult.notEnoughPoints) {
    return apiFailure(400, 'POINTS_INSUFFICIENT', locale, {
      user,
      service_id: service.service_id,
      required_points: service.required_points,
      current_points: writeResult.current_points
    });
  }

  const cache = await loadTranslationCache(options.cachePath || CACHE_PATH);
  const category = data.serviceCategories.find((item) => item.category_id === service.category_id);
  const translatedService = translateService(service, category, cache, locale);

  return {
    status: 201,
    body: {
      message: 'Store exchange completed.',
      user,
      service_id: service.service_id,
      service_name: translatedService.service_name,
      used_points: service.required_points,
      current_points: writeResult.current_points
    }
  };
}

async function handleApi(request, response, requestUrl) {
  if (request.method === 'GET' && requestUrl.pathname === '/api/bootstrap') {
    const code = requestUrl.searchParams.get('code') || '';
    const password = requestUrl.searchParams.get('password') || '';
    const locale = requestUrl.searchParams.get('locale') === 'en' ? 'en' : 'ja';

    if (APP_ROLE === 'event') {
      const payload = await buildEventPayload(code, password, locale);

      if (!payload) {
        return sendError(response, 401, 'Invalid event organizer credentials.');
      }

      return sendJson(response, 200, payload);
    }

    const payload = await buildStorePayload(code, password, locale);

    if (!payload) {
      return sendError(response, 401, 'Invalid store credentials.');
    }

    return sendJson(response, 200, payload);
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/event/check-ins') {
    if (APP_ROLE !== 'event') {
      return sendError(response, 404, 'API route not found.');
    }

    const locale = requestUrl.searchParams.get('locale') === 'en' ? 'en' : 'ja';
    try {
      const result = await processEventCheckIn(await readJsonBody(request), locale);
      return sendJson(response, result.status, result.body);
    } catch (error) {
      return sendQrError(response, error, locale);
    }
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/event/check-in-eligibility') {
    if (APP_ROLE !== 'event') {
      return sendError(response, 404, 'API route not found.');
    }

    const locale = requestUrl.searchParams.get('locale') === 'en' ? 'en' : 'ja';
    try {
      const result = await processEventEligibility(await readJsonBody(request), locale);
      return sendJson(response, result.status, result.body);
    } catch (error) {
      return sendQrError(response, error, locale);
    }
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/event/completions') {
    if (APP_ROLE !== 'event') {
      return sendError(response, 404, 'API route not found.');
    }
    const locale = requestUrl.searchParams.get('locale') === 'en' ? 'en' : 'ja';
    try {
      const result = await processEventCompletion(await readJsonBody(request), locale);
      return sendJson(response, result.status, result.body);
    } catch (error) {
      return sendQrError(response, error, locale);
    }
  }

  if (APP_ROLE === 'event' && requestUrl.pathname === '/api/event/submissions') {
    if (request.method === 'GET') {
      const code = requestUrl.searchParams.get('code') || '';
      const password = requestUrl.searchParams.get('password') || '';
      const payload = await buildEventPayload(code, password, 'ja');
      if (!payload) return sendError(response, 401, 'Invalid event organizer credentials.');
      return sendJson(response, 200, payload.submissions);
    }
    if (request.method === 'POST') {
      const body = await readJsonBody(request);
      const data = await readPartnerData();
      const organizer = data.eventOrganizers.find((item) =>
        matchesPartnerCredentials(item, body.code, body.password)
      );
      if (!organizer) return sendError(response, 401, 'Invalid event organizer credentials.');
      const result = await saveEventSubmission({ organizer, action: 'create', data: body });
      if (result.error) return sendError(response, 400, result.error);
      return sendJson(response, 201, result);
    }
  }

  const submissionMatch = requestUrl.pathname.match(/^\/api\/event\/submissions\/(\d+)(\/withdraw)?$/);
  if (APP_ROLE === 'event' && submissionMatch && ['PUT', 'POST'].includes(request.method)) {
    const isWithdraw = submissionMatch[2] === '/withdraw';
    if ((isWithdraw && request.method !== 'POST') || (!isWithdraw && request.method !== 'PUT')) {
      return sendError(response, 405, 'Method not allowed.');
    }
    const body = await readJsonBody(request);
    const data = await readPartnerData();
    const organizer = data.eventOrganizers.find((item) =>
      matchesPartnerCredentials(item, body.code, body.password)
    );
    if (!organizer) return sendError(response, 401, 'Invalid event organizer credentials.');
    const result = await saveEventSubmission({
      organizer,
      submissionId: Number(submissionMatch[1]),
      action: isWithdraw ? 'withdraw' : 'update',
      data: body
    });
    if (result.notFound) return sendError(response, 404, 'Event submission not found.');
    if (result.conflict) return sendError(response, 409, 'This event submission cannot be changed.');
    if (result.error) return sendError(response, 400, result.error);
    return sendJson(response, 200, result);
  }

  const closeMatch = requestUrl.pathname.match(/^\/api\/event\/events\/(\d+)\/close$/);
  if (APP_ROLE === 'event' && request.method === 'POST' && closeMatch) {
    const body = await readJsonBody(request);
    const data = await readPartnerData();
    const organizer = data.eventOrganizers.find((item) =>
      matchesPartnerCredentials(item, body.code, body.password)
    );
    if (!organizer) return sendError(response, 401, 'Invalid event organizer credentials.');
    const result = await closeOrganizerEvent({ organizer, eventId: Number(closeMatch[1]) });
    if (result.notFound) return sendError(response, 404, 'Event not found for this organizer.');
    if (result.conflict) return sendError(response, 409, 'Event is already closed.');
    return sendJson(response, 200, result);
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/store/exchanges') {
    if (APP_ROLE !== 'store') {
      return sendError(response, 404, 'API route not found.');
    }

    const locale = requestUrl.searchParams.get('locale') === 'en' ? 'en' : 'ja';
    try {
      const result = await processStoreExchange(await readJsonBody(request), locale);
      return sendJson(response, result.status, result.body);
    } catch (error) {
      return sendQrError(response, error, locale);
    }
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/translations/refresh') {
    const refreshKey = env.PARTNER_REFRESH_KEY;

    if (refreshKey && request.headers['x-refresh-key'] !== refreshKey) {
      return sendError(response, 403, 'Invalid refresh key.');
    }

    const data = await readPartnerData();
    const result = await refreshTranslationCache(data, {
      cachePath: CACHE_PATH,
      targetLocales: ['en'],
      force: requestUrl.searchParams.get('force') === '1'
    });

    return sendJson(response, 200, result);
  }

  return sendError(response, 404, 'API route not found.');
}

async function serveStatic(request, response, requestUrl) {
  const safePath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const staticRoot = safePath === '/shared.css' ? ROOT_DIR : PUBLIC_DIR;
  const resolvedPath = path.resolve(staticRoot, `.${decodeURIComponent(safePath)}`);

  if (resolvedPath !== staticRoot && !resolvedPath.startsWith(`${staticRoot}${path.sep}`)) {
    return sendError(response, 403, 'Forbidden.');
  }

  try {
    const body = await fs.readFile(resolvedPath);
    response.writeHead(200, {
      'content-type': MIME_TYPES[path.extname(resolvedPath)] || 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    response.end(body);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return sendError(response, 404, 'Not found.');
    }

    throw error;
  }
}

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  try {
    if (requestUrl.pathname.startsWith('/api/')) {
      await handleApi(request, response, requestUrl);
      return;
    }

    await serveStatic(request, response, requestUrl);
  } catch (error) {
    console.error(error);
    sendError(response, 500, 'Internal server error.');
  }
}

async function refreshTranslationsOnSchedule() {
  const data = await readPartnerData();
  const result = await refreshTranslationCache(data, {
    cachePath: CACHE_PATH,
    targetLocales: ['en']
  });
  console.log('Translation cache refreshed:', result);
}

async function startServer() {
  try {
    await refreshTranslationsOnSchedule();
  } catch (error) {
    console.error('Initial translation refresh failed.');
    console.error(error);
  }

  setInterval(() => {
    refreshTranslationsOnSchedule().catch((error) => {
      console.error('Scheduled translation refresh failed.');
      console.error(error);
    });
  }, DAY_MS).unref();

  http.createServer(handleRequest).listen(PORT, () => {
    console.log(`LinkTwon ${APP_ROLE} portal running at http://localhost:${PORT}/`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  buildEventPayload,
  buildStorePayload,
  handleRequest,
  parseUserQrPayload,
  processEventEligibility,
  processEventCheckIn,
  processEventCompletion,
  processStoreExchange,
  readPartnerData,
  refreshTranslationsOnSchedule,
  startServer
};
