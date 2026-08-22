const express = require("express");

const auth = require("../middleware/auth");

const {
    initializePayment,
    initializeMpesaPayment,
    verifyPayment
} = require("./paystackController");

const router = express.Router();

router.post(
    "/initialize",
    auth,
    initializePayment
);

router.post(
    "/mpesa/stk",
    auth,
    initializeMpesaPayment
);

router.get(
    "/verify/:reference",
    auth,
    verifyPayment
);

module.exports = router;
