const express = require("express");

const auth = require("../middleware/auth");

const {
    initializePayment,
    verifyPayment
} = require("./paystackController");

const router = express.Router();

/*
 * Initialize Paystack payment
 * POST /api/paystack/initialize
 */
router.post(
    "/initialize",
    auth,
    initializePayment
);

/*
 * Verify Paystack payment
 * GET /api/paystack/verify/:reference
 */
router.get(
    "/verify/:reference",
    auth,
    verifyPayment
);

module.exports = router;
