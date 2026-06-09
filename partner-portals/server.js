const fs = require('fs/promises');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const {
  getTranslatedField,
  loadTranslationCache,
  refreshTranslationCache
} = require('./lib/translationCache');

const APP_ROLE = process.env.PARTNER_APP_ROLE === 'store' ? 'store' : 'event';
const PORT = Number(process.env.PORT || (APP_ROLE === 'store' ? 5182 : 5181));
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, APP_ROLE === 'store' ? 'store-app' : 'event-organizer-app');
const DATA_PATH = path.join(ROOT_DIR, 'data', 'partner-data.json');
const CACHE_PATH = path.join(ROOT_DIR, 'data', 'translation-cache.json');
const DAY_MS = 24 * 60 * 60 * 1000;
const processedScans = new Set();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

async function readPartnerData(dataPath = DATA_PATH) {
  const raw = await fs.readFile(dataPath, 'utf8');
  return JSON.parse(raw);
}

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
    throw new Error('User QR payload is required.');
  }

  const trimmed = rawPayload.trim();
  let payload;

  if (trimmed.startsWith('{')) {
    payload = JSON.parse(trimmed);
  } else {
    const payloadUrl = new URL(trimmed);
    const isUserPresentUrl = payloadUrl.protocol === 'linktown:' && payloadUrl.hostname === 'user-present';

    if (!isUserPresentUrl) {
      throw new Error('Invalid user QR format.');
    }

    payload = Object.fromEntries(payloadUrl.searchParams.entries());
  }

  if (payload.type !== 'user-present') {
    throw new Error('Invalid user QR type.');
  }

  const userId = String(payload.user_id || '').trim();
  const name = String(payload.name || '').trim();
  const nonce = String(payload.nonce || '').trim();
  const expiresAt = new Date(payload.expires_at);

  if (!userId || !nonce || Number.isNaN(expiresAt.getTime())) {
    throw new Error('User QR is missing required fields.');
  }

  if (expiresAt.getTime() < Date.now()) {
    throw new Error('User QR has expired.');
  }

  return {
    user_id: userId,
    name: name || `User ${userId}`,
    nonce,
    issued_at: payload.issued_at || null,
    expires_at: expiresAt.toISOString()
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

async function buildEventPayload(code, locale, options = {}) {
  const data = await readPartnerData(options.dataPath || DATA_PATH);
  const organizer = data.eventOrganizers.find((item) => item.login_code === code);

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
    events
  };
}

async function buildStorePayload(code, locale, options = {}) {
  const data = await readPartnerData(options.dataPath || DATA_PATH);
  const store = data.stores.find((item) => item.login_code === code);

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

async function processEventCheckIn(body, locale) {
  const data = await readPartnerData();
  const organizer = data.eventOrganizers.find((item) => item.login_code === body.code);

  if (!organizer) {
    return { status: 401, body: { message: 'Invalid event organizer access code.' } };
  }

  const event = data.events.find((item) => item.event_id === body.event_id && organizer.event_ids.includes(item.event_id));

  if (!event) {
    return { status: 404, body: { message: 'Event not found for this organizer.' } };
  }

  const user = parseUserQrPayload(body.user_qr_payload);
  const scanKey = `event:${event.event_id}:${user.user_id}:${user.nonce}`;

  if (processedScans.has(scanKey)) {
    return { status: 409, body: { message: 'This user QR has already been used for this event.', user, event_id: event.event_id } };
  }

  processedScans.add(scanKey);

  const cache = await loadTranslationCache(CACHE_PATH);
  const translatedEvent = translateEvent(event, cache, locale);

  return {
    status: 201,
    body: {
      message: 'Event check-in completed.',
      user,
      event_id: event.event_id,
      event_name: translatedEvent.event_name,
      granted_points: event.grant_points
    }
  };
}

async function processStoreExchange(body, locale) {
  const data = await readPartnerData();
  const store = data.stores.find((item) => item.login_code === body.code);

  if (!store) {
    return { status: 401, body: { message: 'Invalid store access code.' } };
  }

  const service = data.services.find((item) => item.service_id === body.service_id && store.service_ids.includes(item.service_id));

  if (!service) {
    return { status: 404, body: { message: 'Service not found for this store.' } };
  }

  const user = parseUserQrPayload(body.user_qr_payload);
  const scanKey = `store:${service.service_id}:${user.user_id}:${user.nonce}`;

  if (processedScans.has(scanKey)) {
    return { status: 409, body: { message: 'This user QR has already been used for this service.', user, service_id: service.service_id } };
  }

  processedScans.add(scanKey);

  const cache = await loadTranslationCache(CACHE_PATH);
  const category = data.serviceCategories.find((item) => item.category_id === service.category_id);
  const translatedService = translateService(service, category, cache, locale);

  return {
    status: 201,
    body: {
      message: 'Store exchange completed.',
      user,
      service_id: service.service_id,
      service_name: translatedService.service_name,
      used_points: service.required_points
    }
  };
}

async function handleApi(request, response, requestUrl) {
  if (request.method === 'GET' && requestUrl.pathname === '/api/bootstrap') {
    const code = requestUrl.searchParams.get('code') || '';
    const locale = requestUrl.searchParams.get('locale') === 'en' ? 'en' : 'ja';

    if (APP_ROLE === 'event') {
      const payload = await buildEventPayload(code, locale);

      if (!payload) {
        return sendError(response, 401, 'Invalid event organizer access code.');
      }

      return sendJson(response, 200, payload);
    }

    const payload = await buildStorePayload(code, locale);

    if (!payload) {
      return sendError(response, 401, 'Invalid store access code.');
    }

    return sendJson(response, 200, payload);
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/event/check-ins') {
    if (APP_ROLE !== 'event') {
      return sendError(response, 404, 'API route not found.');
    }

    try {
      const locale = requestUrl.searchParams.get('locale') === 'en' ? 'en' : 'ja';
      const result = await processEventCheckIn(await readJsonBody(request), locale);
      return sendJson(response, result.status, result.body);
    } catch (error) {
      return sendError(response, 400, error.message);
    }
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/store/exchanges') {
    if (APP_ROLE !== 'store') {
      return sendError(response, 404, 'API route not found.');
    }

    try {
      const locale = requestUrl.searchParams.get('locale') === 'en' ? 'en' : 'ja';
      const result = await processStoreExchange(await readJsonBody(request), locale);
      return sendJson(response, result.status, result.body);
    } catch (error) {
      return sendError(response, 400, error.message);
    }
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/translations/refresh') {
    const refreshKey = process.env.PARTNER_REFRESH_KEY;

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
  processEventCheckIn,
  processStoreExchange,
  refreshTranslationsOnSchedule,
  startServer
};
