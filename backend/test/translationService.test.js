const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linktown-translation-service-'));

process.env.APP_ENV = 'test';
process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_PATH = path.join(tempDir, 'translation-service.sqlite');
process.env.JWT_SECRET = 'link-town-test-secret';
process.env.MAIL_DRIVER = 'outbox';
process.env.TRANSLATION_PROVIDER = 'deepl';
process.env.DEEPL_API_KEY = 'test-deepl-key';
process.env.DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

const { hashSourceText, translateText } = require('../services/translationService');
const pool = require('../config/db');

async function main() {
  await pool.query('DROP TABLE IF EXISTS content_translations');

  const fetchBodies = [];
  global.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    fetchBodies.push(body);
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          translations: body.text.map((text) => ({ text: `deepl:${text}`, detected_source_language: 'JA' }))
        };
      }
    };
  };

  const first = await translateText({
    contentType: 'event',
    contentId: 'unit-1',
    fieldName: 'event_name',
    sourceText: '地域清掃',
    targetLocale: 'en'
  });
  const second = await translateText({
    contentType: 'event',
    contentId: 'unit-1',
    fieldName: 'event_name',
    sourceText: '地域清掃',
    targetLocale: 'en'
  });

  assert.strictEqual(first.translatedText, 'deepl:地域清掃');
  assert.strictEqual(second.translatedText, 'deepl:地域清掃');
  assert.strictEqual(second.cached, true);
  assert.strictEqual(fetchBodies.length, 1, 'cache hit must not call fetch');

  const changed = await translateText({
    contentType: 'event',
    contentId: 'unit-1',
    fieldName: 'event_name',
    sourceText: '地域清掃更新',
    targetLocale: 'en'
  });

  assert.strictEqual(changed.translatedText, 'deepl:地域清掃更新');
  assert.strictEqual(fetchBodies.length, 2, 'source hash change must call fetch again');

  await pool.query(
    `INSERT INTO content_translations
     (content_type, content_id, field_name, source_locale, target_locale, source_text_hash,
      translated_text, translation_provider, translation_status, translated_at, created_at, updated_at)
     VALUES (?, ?, ?, 'ja', 'en', ?, ?, 'mock', 'current', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    ['event', 'unit-provider', 'event_name', hashSourceText('子ども食堂サポート'), '[en] 子ども食堂サポート']
  );

  const providerChanged = await translateText({
    contentType: 'event',
    contentId: 'unit-provider',
    fieldName: 'event_name',
    sourceText: '子ども食堂サポート',
    targetLocale: 'en'
  });

  assert.strictEqual(providerChanged.translatedText, 'deepl:子ども食堂サポート');
  assert.strictEqual(fetchBodies.length, 3, 'provider change must ignore stale mock cache');

  global.fetch = async () => ({
    ok: false,
    status: 500,
    async json() {
      return {};
    }
  });

  const failed = await translateText({
    contentType: 'service',
    contentId: 'unit-failed',
    fieldName: 'service_name',
    sourceText: '失敗時原文',
    targetLocale: 'en'
  });

  assert.strictEqual(failed.translatedText, '失敗時原文');

  const [failedRows] = await pool.query(
    `SELECT translation_status, translated_text
     FROM content_translations
     WHERE content_type = ? AND content_id = ? AND field_name = ? AND target_locale = ?`,
    ['service', 'unit-failed', 'service_name', 'en']
  );
  assert.strictEqual(failedRows[0].translation_status, 'failed');
  assert.strictEqual(failedRows[0].translated_text, '失敗時原文');

  console.log('translationService unit test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
