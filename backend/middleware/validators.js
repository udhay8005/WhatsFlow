/**
 * @file validators.js
 * @description Express-validator rule chains for all API input validation.
 *              Provides validateCampaignCreation and validateSettings middleware arrays.
 *              Attach these arrays directly to route definitions.
 * @module backend/middleware/validators
 * @author Udhaya Chandra SA
 * @version 1.0.0
 */

const { body, validationResult } = require('express-validator');

// Middleware to handle validation errors
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

const validateCampaignCreation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Campaign name is required')
        .isLength({ min: 3, max: 100 }).withMessage('Name must be between 3 and 100 characters')
        .escape(),

    body('templateName')
        .custom((value, { req }) => {
            if (req.body.status === 'draft') return true;
            // For active campaigns, templateName is required
            if (!value || value.trim() === '') {
                throw new Error('Template name is required');
            }
            return true;
        })
        .escape(),

    body('contacts')
        .custom((value, { req }) => {
            if (req.body.status === 'draft') return true;
            // For active campaigns, contacts must be non-empty array
            if (!Array.isArray(value) || value.length === 0) {
                throw new Error('Contacts must be a non-empty array');
            }
            return true;
        }),

    body('contacts.*.phone')
        .if(body('status').not().equals('draft')) // Only validate phone numbers if not draft (or if contacts exist)
        .exists().withMessage('Phone number is required for each contact')
        .matches(/^\+[1-9]\d{1,14}$/).withMessage('Phone number must be in E.164 format (e.g. +1234567890)'),

    body('scheduledAt')
        .optional({ nullable: true })
        .isISO8601().withMessage('Scheduled date must be a valid ISO 8601 date')
        .toDate()
        .custom((value) => {
            if (value && new Date(value) < new Date()) {
                throw new Error('Scheduled date must be in the future');
            }
            return true;
        }),

    validate
];

const validateSettings = [
    body('wa_access_token')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ min: 20 }).withMessage('Access Token seems too short'),

    body('wa_phone_id')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .matches(/^\d{10,20}$/).withMessage('Phone ID must be 10-20 digits'),

    body('wa_waba_id')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .matches(/^\d{10,20}$/).withMessage('WABA ID must be 10-20 digits'),

    body('max_tps')
        .optional()
        .toInt()
        .isInt({ min: 1, max: 100 }).withMessage('Max TPS must be between 1 and 100'),

    body('smtp_port')
        .optional({ nullable: true, checkFalsy: true })
        .toInt()
        .isInt({ min: 1, max: 65535 }).withMessage('Invalid SMTP Port'),

    body('smtp_host')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isFQDN().withMessage('Invalid SMTP Host'),

    body('smtp_secure')
        .optional({ nullable: true })
        .isIn(['true', 'false']).withMessage('SMTP Secure must be "true" or "false"'),

    validate
];

module.exports = {
    validateCampaignCreation,
    validateSettings
};
