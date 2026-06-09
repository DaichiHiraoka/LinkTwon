const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const DEFAULT_SOURCE_LOCALE = 'ja';
const DEFAULT_TARGET_LOCALES = ['en'];
const DEFAULT_CACHE = {
  version: 1,
  updated_at: null,
  entries: []
};

const FIELD_CONFIG = [
  { contentType: 'event', collection: 'events', idField: 'event_id', fields: ['event_name', 'description', 'activity', 'notes'] },
  { contentType: 'service', collection: 'services', idField: 'service_id', fields: ['service_name', 'description'] },
  { contentType: 'service_category', collection: 'serviceCategories', idField: 'category_id', fields: ['category_name'] }
];

const MOCK_TRANSLATIONS = new Map([
  ['防災備蓄点検と地域案内', 'Disaster Supply Check and Local Guidance'],
  ['商店街清掃ボランティア', 'Shopping Street Cleanup Volunteer'],
  ['地域の防災備蓄品を確認し、避難経路を住民に案内します。', 'Check local disaster supplies and guide residents through evacuation routes.'],
  ['備蓄品の数量確認、期限確認、避難経路の案内、受付補助を行います。', 'Support stock counts, expiry checks, evacuation route guidance, and reception work.'],
  ['動きやすい服装で集合してください。雨天時は屋内作業へ切り替えます。', 'Please wear comfortable clothing. In rainy weather, work will move indoors.'],
  ['商店街周辺の歩道と広場を清掃し、来街者が歩きやすい環境を整えます。', 'Clean sidewalks and plazas around the shopping street to make the area easier to walk through.'],
  ['ごみ拾い、落ち葉の回収、掲示板周辺の拭き掃除を担当します。', 'Pick up litter, collect fallen leaves, and wipe areas around notice boards.'],
  ['軍手とごみ袋は主催者が用意します。', 'Work gloves and trash bags will be provided by the organizer.'],
  ['季節の野菜セット', 'Seasonal Vegetable Set'],
  ['焼き菓子詰め合わせ', 'Baked Sweets Assortment'],
  ['日用品ミニセット', 'Daily Goods Mini Set'],
  ['地域で仕入れた旬の野菜を少量ずつ詰め合わせた交換商品です。', 'A redemption item with small portions of seasonal vegetables sourced locally.'],
  ['商店街の協力店舗が用意する焼き菓子の詰め合わせです。', 'An assortment of baked sweets prepared by cooperating shops in the shopping street.'],
  ['ティッシュや洗剤など、日常で使いやすい日用品をまとめた商品です。', 'A set of everyday goods such as tissues and detergent.'],
  ['商店街の人気商品', 'Popular Shopping Street Products'],
  ['生活応援商品', 'Daily Life Support Products']
]);

function hashSourceText(sourceText) {
  return crypto.createHash('sha256').update(sourceText, 'utf8').digest('hex');
}

function getEntryKey(record, targetLocale) {
  return `${record.contentType}:${record.contentId}:${record.fieldName}:${targetLocale}`;
}

function extractTranslationRecords(data) {
  const records = [];

  for (const config of FIELD_CONFIG) {
    const items = Array.isArray(data[config.collection]) ? data[config.collection] : [];

    for (const item of items) {
      for (const fieldName of config.fields) {
        const sourceText = item[fieldName];

        if (typeof sourceText !== 'string' || sourceText.trim() === '') {
          continue;
        }

        records.push({
          contentType: config.contentType,
          contentId: String(item[config.idField]),
          fieldName,
          sourceLocale: DEFAULT_SOURCE_LOCALE,
          sourceText
        });
      }
    }
  }

  return records;
}

async function readJson(filePath, fallbackValue) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      return fallbackValue;
    }

    throw error;
  }
}

async function loadTranslationCache(cachePath) {
  const cache = await readJson(cachePath, DEFAULT_CACHE);
  return {
    version: cache.version || 1,
    updated_at: cache.updated_at || null,
    entries: Array.isArray(cache.entries) ? cache.entries : []
  };
}

async function saveTranslationCache(cachePath, cache) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  const tempPath = `${cachePath}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, cachePath);
}

function findEntry(cache, record, targetLocale) {
  const entryKey = getEntryKey(record, targetLocale);
  return cache.entries.find((entry) => entry.key === entryKey);
}

function isEntryCurrent(entry, sourceText) {
  return entry && entry.translation_status === 'current' && entry.source_text_hash === hashSourceText(sourceText);
}

async function translateWithConfiguredApi(record, targetLocale) {
  const apiUrl = process.env.TRANSLATION_API_URL;

  if (!apiUrl) {
    return null;
  }

  const headers = {
    'content-type': 'application/json'
  };

  if (process.env.TRANSLATION_API_TOKEN) {
    headers.authorization = `Bearer ${process.env.TRANSLATION_API_TOKEN}`;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      source_locale: record.sourceLocale,
      target_locale: targetLocale,
      text: record.sourceText,
      content_type: record.contentType,
      content_id: record.contentId,
      field_name: record.fieldName
    })
  });

  if (!response.ok) {
    throw new Error(`Translation API failed with status ${response.status}`);
  }

  const body = await response.json();
  const translatedText = body.translated_text || body.translation;

  if (typeof translatedText !== 'string' || translatedText.trim() === '') {
    throw new Error('Translation API response did not include translated_text.');
  }

  return {
    translatedText,
    provider: process.env.TRANSLATION_PROVIDER || 'translation-api'
  };
}

function translateWithMockProvider(record, targetLocale) {
  if (targetLocale === record.sourceLocale) {
    return {
      translatedText: record.sourceText,
      provider: 'source'
    };
  }

  const translatedText = MOCK_TRANSLATIONS.get(record.sourceText) || `[${targetLocale}] ${record.sourceText}`;
  return {
    translatedText,
    provider: 'mock-cache'
  };
}

async function translateRecord(record, targetLocale) {
  const apiTranslation = await translateWithConfiguredApi(record, targetLocale);

  if (apiTranslation) {
    return apiTranslation;
  }

  return translateWithMockProvider(record, targetLocale);
}

async function refreshTranslationCache(data, options = {}) {
  const cachePath = options.cachePath;
  const targetLocales = options.targetLocales || DEFAULT_TARGET_LOCALES;
  const force = Boolean(options.force);
  const cache = await loadTranslationCache(cachePath);
  const records = extractTranslationRecords(data);
  let translated = 0;
  let skipped = 0;
  let failed = 0;

  for (const record of records) {
    for (const targetLocale of targetLocales) {
      const sourceTextHash = hashSourceText(record.sourceText);
      const entryKey = getEntryKey(record, targetLocale);
      const existing = findEntry(cache, record, targetLocale);

      if (!force && isEntryCurrent(existing, record.sourceText)) {
        skipped += 1;
        continue;
      }

      try {
        const result = await translateRecord(record, targetLocale);
        const nextEntry = {
          key: entryKey,
          content_type: record.contentType,
          content_id: record.contentId,
          field_name: record.fieldName,
          source_locale: record.sourceLocale,
          target_locale: targetLocale,
          source_text_hash: sourceTextHash,
          translated_text: result.translatedText,
          translated_at: new Date().toISOString(),
          translation_provider: result.provider,
          translation_status: 'current'
        };

        if (existing) {
          Object.assign(existing, nextEntry);
        } else {
          cache.entries.push(nextEntry);
        }

        translated += 1;
      } catch (error) {
        failed += 1;
        const failedEntry = {
          key: entryKey,
          content_type: record.contentType,
          content_id: record.contentId,
          field_name: record.fieldName,
          source_locale: record.sourceLocale,
          target_locale: targetLocale,
          source_text_hash: sourceTextHash,
          translated_text: existing?.translated_text || record.sourceText,
          translated_at: existing?.translated_at || null,
          translation_provider: process.env.TRANSLATION_PROVIDER || 'translation-api',
          translation_status: 'failed',
          error_message: error.message
        };

        if (existing) {
          Object.assign(existing, failedEntry);
        } else {
          cache.entries.push(failedEntry);
        }
      }
    }
  }

  cache.updated_at = new Date().toISOString();
  await saveTranslationCache(cachePath, cache);

  return {
    records: records.length,
    translated,
    skipped,
    failed,
    cache_updated_at: cache.updated_at
  };
}

function getTranslatedField(cache, contentType, contentId, fieldName, sourceText, targetLocale) {
  if (!targetLocale || targetLocale === DEFAULT_SOURCE_LOCALE || typeof sourceText !== 'string') {
    return sourceText;
  }

  const record = {
    contentType,
    contentId: String(contentId),
    fieldName,
    sourceLocale: DEFAULT_SOURCE_LOCALE,
    sourceText
  };
  const entry = findEntry(cache, record, targetLocale);

  if (!isEntryCurrent(entry, sourceText)) {
    return sourceText;
  }

  return entry.translated_text;
}

module.exports = {
  DEFAULT_SOURCE_LOCALE,
  DEFAULT_TARGET_LOCALES,
  extractTranslationRecords,
  getTranslatedField,
  loadTranslationCache,
  refreshTranslationCache,
  saveTranslationCache
};
