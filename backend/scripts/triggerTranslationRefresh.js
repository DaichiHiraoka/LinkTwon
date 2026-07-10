function getRefreshUrl() {
  const configuredUrl = String(process.env.TRANSLATION_REFRESH_URL || '').trim();
  if (!configuredUrl) {
    throw new Error('TRANSLATION_REFRESH_URL is required.');
  }

  return configuredUrl;
}

async function triggerTranslationRefresh() {
  const headers = { Accept: 'application/json' };
  const refreshKey = String(process.env.TRANSLATION_REFRESH_KEY || '').trim();
  if (refreshKey) {
    headers['x-refresh-key'] = refreshKey;
  }

  const response = await fetch(getRefreshUrl(), {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(120000)
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.message || `Translation refresh failed with HTTP ${response.status}.`);
  }

  return body;
}

async function main() {
  const result = await triggerTranslationRefresh();
  console.log(JSON.stringify(result));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { triggerTranslationRefresh };
