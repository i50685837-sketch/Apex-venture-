const express = require("express");

const auth = require("../middleware/auth");

const {
    initializePayment,
    verifyPayment
} = require("./paystackController");

const router = express.Router();

router.post(
    "/initialize",
    auth,
    initializePayment
);

router.get(
    "/verify/:reference",
    auth,
    verifyPayment
);

module.exports = router;
