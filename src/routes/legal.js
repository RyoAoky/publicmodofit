const express = require('express');
const router = express.Router();
const controllerrender = require('../controllers/controllerrender');

// Legal pages routes
router.get('/faq', controllerrender.renderFAQ);
router.get('/privacy-policy', controllerrender.renderPrivacyPolicy);
router.get('/terms-conditions', controllerrender.renderTermsConditions);

module.exports = router;