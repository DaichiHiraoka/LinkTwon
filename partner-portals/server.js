const fs = require('fs/promises');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const { attachQrImages } = require('./lib/qr');
const {
  getTranslatedField,
  loadTranslationCache,
  refreshTranslationCache
} = require('./lib/translationCache');

const PORT = Number(process.env.PORT || 5180);
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_PATH = path.join(ROOT_DIR, 'data', 'partner-data.json');
const CACHE_PATH = path.join(ROOT_DIR, 'data', 'translation-cache.json');
const DAY_MS = 24 * 60 * 60 * 1000;

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

function notTranslatedFields() {
  return [
    'store_name',
    'store_address',
    'map_query',
    'location',
    'event_datetime',
    'grant_points',
    'required_points',
    'check_in_code',
    'exchange_code',
    'qr_payload'
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
    events: await attachQrImages(events, (event) => event.qr_payload)
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
    services: await attachQrImages(services, (service) => service.qr_payload)
  };
}

async function handleApi(request, response, requestUrl) {
  if (request.method === 'GET' && requestUrl.pathname === '/api/bootstrap') {
    const role = requestUrl.searchParams.get('role');
    const code = requestUrl.searchParams.get('code') || '';
    const locale = requestUrl.searchParams.get('locale') === 'en' ? 'en' : 'ja';

    if (role === 'event') {
      const payload = await buildEventPayload(code, locale);

      if (!payload) {
        return sendError(response, 401, 'Invalid event organizer access code.');
      }

      return sendJson(response, 200, payload);
    }

    if (role === 'store') {
      const payload = await buildStorePayload(code, locale);

      if (!payload) {
        return sendError(response, 401, 'Invalid store access code.');
      }

      return sendJson(response, 200, payload);
    }

    return sendError(response, 400, 'Invalid role.');
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
  const resolvedPath = path.resolve(PUBLIC_DIR, `.${decodeURIComponent(safePath)}`);

  if (resolvedPath !== PUBLIC_DIR && !resolvedPath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
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
    console.log(`LinkTwon partner portals running at http://localhost:${PORT}/`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  buildEventPayload,
  buildStorePayload,
  handleRequest,
  refreshTranslationsOnSchedule,
  startServer
};
