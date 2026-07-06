const express = require('express');
const { env } = require('../config/env');
const {
  TranslationValidationError,
  refreshTranslations,
  translateText
} = require('../services/translationService');

const router = express.Router();

function requireRefreshKey(req, res, next) {
  if (env.TRANSLATION_REFRESH_KEY && req.get('x-refresh-key') !== env.TRANSLATION_REFRESH_KEY) {
    return res.status(403).json({ message: 'Invalid refresh key.' });
  }

  next();
}

function handleTranslationError(error, res, next) {
  if (error instanceof TranslationValidationError) {
    return res.status(error.status).json({ message: error.message });
  }

  return next(error);
}

router.post('/translate', requireRefreshKey, async (req, res, next) => {
  try {
    const {
      source_locale,
      target_locale,
      text,
      content_type,
      content_id,
      field_name
    } = req.body || {};

    if (typeof text !== 'string' || !content_type || content_id === undefined || !field_name) {
      return res.status(400).json({ message: 'text, content_type, content_id, and field_name are required.' });
    }

    const result = await translateText({
      contentType: content_type,
      contentId: content_id,
      fieldName: field_name,
      sourceText: text,
      sourceLocale: source_locale || 'ja',
      targetLocale: target_locale
    });

    res.json({
      translated_text: result.translatedText,
      provider: result.provider
    });
  } catch (error) {
    handleTranslationError(error, res, next);
  }
});

router.post('/refresh', requireRefreshKey, async (req, res, next) => {
  try {
    const result = await refreshTranslations({ force: req.query.force === '1' });
    res.json(result);
  } catch (error) {
    handleTranslationError(error, res, next);
  }
});

module.exports = router;
