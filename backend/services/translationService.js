const crypto = require('crypto');
const pool = require('../config/db');
const { env } = require('../config/env');

const SOURCE_LOCALE = 'ja';
const TARGET_LOCALE_MAP = {
  ja: 'JA',
  en: 'EN-US'
};
const SOURCE_LOCALE_MAP = {
  ja: 'JA'
};
const DEEPL_BATCH_SIZE = 50;
const CACHE_SELECT_BATCH_SIZE = 200;
const REFRESH_FIELD_CONFIG = [
  { tableName: 'events', contentType: 'event', idField: 'event_id', fields: ['event_name'] },
  { tableName: 'services', contentType: 'service', idField: 'service_id', fields: ['service_name'] },
  { tableName: 'notifications', contentType: 'notification', idField: 'notification_id', fields: ['title', 'body'] }
];

let quotaWarningLogged = false;
let schemaReadyPromise;

class TranslationValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TranslationValidationError';
    this.status = 400;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashSourceText(sourceText) {
  return crypto.createHash('sha256').update(sourceText, 'utf8').digest('hex');
}

function isTranslatableText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function normalizeLocale(locale, fallback = SOURCE_LOCALE) {
  return typeof locale === 'string' && locale.trim() ? locale.trim().toLowerCase() : fallback;
}

function assertSupportedLocales(sourceLocale, targetLocale) {
  if (!SOURCE_LOCALE_MAP[sourceLocale]) {
    throw new TranslationValidationError(`Unsupported source_locale: ${sourceLocale}`);
  }

  if (!TARGET_LOCALE_MAP[targetLocale]) {
    throw new TranslationValidationError(`Unsupported target_locale: ${targetLocale}`);
  }
}

function getProvider() {
  return env.TRANSLATION_PROVIDER || (env.DEEPL_API_KEY ? 'deepl' : 'mock');
}

function getEntryKey(record, targetLocale) {
  return `${record.contentType}:${record.contentId}:${record.fieldName}:${targetLocale}`;
}

function toRecord({ contentType, contentId, fieldName, sourceText, sourceLocale = SOURCE_LOCALE }) {
  return {
    contentType,
    contentId: String(contentId),
    fieldName,
    sourceLocale: normalizeLocale(sourceLocale),
    sourceText
  };
}

function isEntryCurrent(entry, record) {
  return entry && entry.translation_status === 'current' && entry.source_text_hash === hashSourceText(record.sourceText);
}

function truncateErrorMessage(message) {
  return String(message || 'Translation failed.').slice(0, 255);
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function createTranslationSchema() {
  if (env.DB_CLIENT === 'mysql') {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS content_translations (
        translation_id INT AUTO_INCREMENT PRIMARY KEY,
        content_type VARCHAR(50) NOT NULL,
        content_id VARCHAR(50) NOT NULL,
        field_name VARCHAR(100) NOT NULL,
        source_locale VARCHAR(10) NOT NULL DEFAULT 'ja',
        target_locale VARCHAR(10) NOT NULL,
        source_text_hash CHAR(64) NOT NULL,
        translated_text TEXT NOT NULL,
        translation_provider VARCHAR(50) NOT NULL,
        translation_status ENUM('current', 'failed') NOT NULL DEFAULT 'current',
        error_message VARCHAR(255) NULL,
        translated_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_translation (content_type, content_id, field_name, target_locale)
      )`
    );
    return;
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS content_translations (
      translation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_type TEXT NOT NULL,
      content_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      source_locale TEXT NOT NULL DEFAULT 'ja',
      target_locale TEXT NOT NULL,
      source_text_hash TEXT NOT NULL,
      translated_text TEXT NOT NULL,
      translation_provider TEXT NOT NULL,
      translation_status TEXT NOT NULL DEFAULT 'current' CHECK(translation_status IN ('current', 'failed')),
      error_message TEXT,
      translated_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (content_type, content_id, field_name, target_locale)
    )`
  );
}

async function ensureTranslationSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = createTranslationSchema().catch((error) => {
      schemaReadyPromise = undefined;
      throw error;
    });
  }

  return schemaReadyPromise;
}

async function loadExistingEntries(records, targetLocale) {
  const entries = new Map();

  if (records.length === 0) {
    return entries;
  }

  await ensureTranslationSchema();

  for (const recordChunk of chunk(records, CACHE_SELECT_BATCH_SIZE)) {
    const where = recordChunk
      .map(() => '(content_type = ? AND content_id = ? AND field_name = ? AND target_locale = ?)')
      .join(' OR ');
    const params = recordChunk.flatMap((record) => [record.contentType, record.contentId, record.fieldName, targetLocale]);
    const [rows] = await pool.query(
      `SELECT content_type, content_id, field_name, target_locale, source_text_hash,
              translated_text, translation_provider, translation_status, translated_at
       FROM content_translations
       WHERE ${where}`,
      params
    );

    for (const row of rows) {
      entries.set(`${row.content_type}:${row.content_id}:${row.field_name}:${row.target_locale}`, row);
    }
  }

  return entries;
}

async function upsertCurrentTranslation(record, targetLocale, translatedText, provider) {
  const sourceTextHash = hashSourceText(record.sourceText);
  await ensureTranslationSchema();

  if (env.DB_CLIENT === 'mysql') {
    await pool.query(
      `INSERT INTO content_translations
       (content_type, content_id, field_name, source_locale, target_locale, source_text_hash,
        translated_text, translation_provider, translation_status, error_message, translated_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'current', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
        source_locale = VALUES(source_locale),
        source_text_hash = VALUES(source_text_hash),
        translated_text = VALUES(translated_text),
        translation_provider = VALUES(translation_provider),
        translation_status = 'current',
        error_message = NULL,
        translated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP`,
      [
        record.contentType,
        record.contentId,
        record.fieldName,
        record.sourceLocale,
        targetLocale,
        sourceTextHash,
        translatedText,
        provider
      ]
    );
    return;
  }

  await pool.query(
    `INSERT INTO content_translations
     (content_type, content_id, field_name, source_locale, target_locale, source_text_hash,
      translated_text, translation_provider, translation_status, error_message, translated_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'current', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(content_type, content_id, field_name, target_locale) DO UPDATE SET
      source_locale = excluded.source_locale,
      source_text_hash = excluded.source_text_hash,
      translated_text = excluded.translated_text,
      translation_provider = excluded.translation_provider,
      translation_status = 'current',
      error_message = NULL,
      translated_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP`,
    [
      record.contentType,
      record.contentId,
      record.fieldName,
      record.sourceLocale,
      targetLocale,
      sourceTextHash,
      translatedText,
      provider
    ]
  );
}

async function upsertFailedTranslation(record, targetLocale, fallbackText, provider, errorMessage, existing) {
  const sourceTextHash = hashSourceText(record.sourceText);
  const translatedAt = existing?.translated_at || null;
  const safeErrorMessage = truncateErrorMessage(errorMessage);
  await ensureTranslationSchema();

  if (env.DB_CLIENT === 'mysql') {
    await pool.query(
      `INSERT INTO content_translations
       (content_type, content_id, field_name, source_locale, target_locale, source_text_hash,
        translated_text, translation_provider, translation_status, error_message, translated_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
        source_locale = VALUES(source_locale),
        source_text_hash = VALUES(source_text_hash),
        translated_text = VALUES(translated_text),
        translation_provider = VALUES(translation_provider),
        translation_status = 'failed',
        error_message = VALUES(error_message),
        translated_at = VALUES(translated_at),
        updated_at = CURRENT_TIMESTAMP`,
      [
        record.contentType,
        record.contentId,
        record.fieldName,
        record.sourceLocale,
        targetLocale,
        sourceTextHash,
        fallbackText,
        provider,
        safeErrorMessage,
        translatedAt
      ]
    );
    return;
  }

  await pool.query(
    `INSERT INTO content_translations
     (content_type, content_id, field_name, source_locale, target_locale, source_text_hash,
      translated_text, translation_provider, translation_status, error_message, translated_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(content_type, content_id, field_name, target_locale) DO UPDATE SET
      source_locale = excluded.source_locale,
      source_text_hash = excluded.source_text_hash,
      translated_text = excluded.translated_text,
      translation_provider = excluded.translation_provider,
      translation_status = 'failed',
      error_message = excluded.error_message,
      translated_at = excluded.translated_at,
      updated_at = CURRENT_TIMESTAMP`,
    [
      record.contentType,
      record.contentId,
      record.fieldName,
      record.sourceLocale,
      targetLocale,
      sourceTextHash,
      fallbackText,
      provider,
      safeErrorMessage,
      translatedAt
    ]
  );
}

async function requestDeepL(texts, sourceLocale, targetLocale, retried = false) {
  const response = await fetch(env.DEEPL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${env.DEEPL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: texts,
      source_lang: SOURCE_LOCALE_MAP[sourceLocale],
      target_lang: TARGET_LOCALE_MAP[targetLocale]
    })
  });

  if (response.status === 429 && !retried) {
    await wait(2000);
    return requestDeepL(texts, sourceLocale, targetLocale, true);
  }

  if (response.status === 456 && !quotaWarningLogged) {
    quotaWarningLogged = true;
    console.warn('DeepL quota exceeded. Translation requests will fall back to source text or cached translations.');
  }

  if (response.status === 403) {
    console.error('DeepL authentication failed. Check DEEPL_API_KEY.');
  }

  if (!response.ok) {
    throw new Error(`DeepL API failed with status ${response.status}`);
  }

  const body = await response.json();
  const translations = Array.isArray(body.translations) ? body.translations : [];

  if (translations.length !== texts.length) {
    throw new Error('DeepL API response did not include the expected translations.');
  }

  return translations.map((translation) => {
    if (!translation || typeof translation.text !== 'string') {
      throw new Error('DeepL API response included an invalid translation.');
    }
    return translation.text;
  });
}

async function translateBatch(texts, sourceLocale, targetLocale) {
  const provider = getProvider();

  if (provider === 'mock') {
    return {
      provider,
      translatedTexts: texts.map((text) => `[${targetLocale}] ${text}`)
    };
  }

  return {
    provider,
    translatedTexts: await requestDeepL(texts, sourceLocale, targetLocale)
  };
}

async function translateRecords(records, targetLocale, options = {}) {
  const translations = new Map();
  const metadata = new Map();
  const existingEntries = await loadExistingEntries(records, targetLocale);
  const missingRecords = [];
  let skipped = 0;
  let translated = 0;
  let failed = 0;

  for (const record of records) {
    const key = getEntryKey(record, targetLocale);
    const existing = existingEntries.get(key);

    if (!options.force && isEntryCurrent(existing, record)) {
      translations.set(key, existing.translated_text);
      metadata.set(key, { provider: existing.translation_provider, cached: true });
      skipped += 1;
      continue;
    }

    missingRecords.push({ record, existing });
  }

  for (const missingChunk of chunk(missingRecords, DEEPL_BATCH_SIZE)) {
    try {
      const sourceLocale = missingChunk[0]?.record.sourceLocale || SOURCE_LOCALE;
      const { provider, translatedTexts } = await translateBatch(
        missingChunk.map(({ record }) => record.sourceText),
        sourceLocale,
        targetLocale
      );

      for (let index = 0; index < missingChunk.length; index += 1) {
        const { record } = missingChunk[index];
        const translatedText = translatedTexts[index];
        const key = getEntryKey(record, targetLocale);
        await upsertCurrentTranslation(record, targetLocale, translatedText, provider);
        translations.set(key, translatedText);
        metadata.set(key, { provider, cached: false });
        translated += 1;
      }
    } catch (error) {
      for (const { record, existing } of missingChunk) {
        const key = getEntryKey(record, targetLocale);
        const fallbackText = existing?.translated_text || record.sourceText;
        const provider = existing?.translation_provider || getProvider();
        await upsertFailedTranslation(record, targetLocale, fallbackText, provider, error.message, existing);
        translations.set(key, fallbackText);
        metadata.set(key, { provider, cached: Boolean(existing?.translated_text), failed: true });
        failed += 1;
      }
    }
  }

  return {
    translations,
    metadata,
    records: records.length,
    translated,
    skipped,
    failed
  };
}

async function translateText({ contentType, contentId, fieldName, sourceText, sourceLocale = SOURCE_LOCALE, targetLocale }) {
  const normalizedTargetLocale = normalizeLocale(targetLocale);
  const normalizedSourceLocale = normalizeLocale(sourceLocale);
  assertSupportedLocales(normalizedSourceLocale, normalizedTargetLocale);

  if (normalizedTargetLocale === normalizedSourceLocale || !isTranslatableText(sourceText)) {
    return { translatedText: sourceText, provider: 'source', cached: true };
  }

  const record = toRecord({ contentType, contentId, fieldName, sourceText, sourceLocale: normalizedSourceLocale });
  const result = await translateRecords([record], normalizedTargetLocale);
  const key = getEntryKey(record, normalizedTargetLocale);
  const metadata = result.metadata.get(key) || {};

  return {
    translatedText: result.translations.get(key) || sourceText,
    provider: metadata.provider || getProvider(),
    cached: Boolean(metadata.cached)
  };
}

async function localizeRows(rows, fieldConfig, targetLocale) {
  const normalizedTargetLocale = normalizeLocale(targetLocale);
  assertSupportedLocales(SOURCE_LOCALE, normalizedTargetLocale);

  if (normalizedTargetLocale === SOURCE_LOCALE || !Array.isArray(rows) || rows.length === 0) {
    return rows;
  }

  const localizedRows = rows.map((row) => ({ ...row }));
  const recordsByKey = new Map();
  const refs = [];

  for (const row of localizedRows) {
    for (const fieldName of fieldConfig.fields) {
      if (!isTranslatableText(row[fieldName])) {
        continue;
      }

      const record = toRecord({
        contentType: fieldConfig.contentType,
        contentId: row[fieldConfig.idField],
        fieldName,
        sourceText: row[fieldName]
      });
      const key = getEntryKey(record, normalizedTargetLocale);
      recordsByKey.set(key, record);
      refs.push({ row, fieldName, key });
    }
  }

  const result = await translateRecords(Array.from(recordsByKey.values()), normalizedTargetLocale);

  for (const ref of refs) {
    if (result.translations.has(ref.key)) {
      ref.row[ref.fieldName] = result.translations.get(ref.key);
    }
  }

  return localizedRows;
}

function recordFromRow(row, fieldConfig, fieldName) {
  if (!isTranslatableText(row[fieldName])) {
    return null;
  }

  return toRecord({
    contentType: fieldConfig.contentType,
    contentId: row[fieldConfig.idField],
    fieldName,
    sourceText: row[fieldName]
  });
}

async function collectRefreshRecords() {
  const records = [];

  for (const config of REFRESH_FIELD_CONFIG) {
    const [rows] = await pool.query(
      `SELECT ${config.idField}, ${config.fields.join(', ')}
       FROM ${config.tableName}`
    );

    for (const row of rows) {
      for (const fieldName of config.fields) {
        const record = recordFromRow(row, config, fieldName);
        if (record) {
          records.push(record);
        }
      }
    }
  }

  return records;
}

async function refreshTranslations({ force = false } = {}) {
  const records = await collectRefreshRecords();
  const result = await translateRecords(records, 'en', { force });

  return {
    records: result.records,
    translated: result.translated,
    skipped: result.skipped,
    failed: result.failed
  };
}

module.exports = {
  TranslationValidationError,
  hashSourceText,
  localizeRows,
  refreshTranslations,
  translateText
};
