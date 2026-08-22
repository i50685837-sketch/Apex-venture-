const crypto = require("crypto");
const mongoose = require("mongoose");

const User =
    require("../models/User");

const Transaction =
    require("../models/Transaction");

const {
    initializeTransaction,
    chargeMpesa,
    verifyTransaction
} = require("./paystackService");

async function findPaymentUser(userId) {
    if (process.env.SKIP_DATABASE === "true") {
        return {
            _id: userId,
            email:
                process.env.LOCAL_TEST_EMAIL ||
                "local.test@example.com"
        };
    }

    return User.findById(userId);
}

async function recordPendingTransaction(transaction) {
    if (mongoose.connection.readyState !== 1) {
        return;
    }

    await Transaction.create(transaction);
}


async function initializePayment(
    req,
    res
) {

    try {

        const user =
            await findPaymentUser(req.user.id);

        if (!user) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }


        const amount =
            Number(req.body.amount);


        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            });
        }


        const reference =
            `APEX-${Date.now()}-${crypto
                .randomBytes(5)
                .toString("hex")}`;


        /*
         * Record the payment as pending.
         */
        await recordPendingTransaction({

            user: user._id,

            type: "deposit",

            amount,

            status: "pending",

            reference,

            provider: "paystack",

            description:
                "Paystack deposit"

        });


        const result =
            await initializeTransaction({

                email: user.email,

                amount,

                reference,

                callbackUrl:
                    process.env.PAYSTACK_CALLBACK_URL

            });


        return res.json({

            success: true,

            authorizationUrl:
                result.data.authorization_url,

            reference,

            accessCode:
                result.data.access_code

        });

    } catch (error) {

        console.error(
            "Paystack initialize:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Could not initialize payment"

        });
    }
}


async function initializeMpesaPayment(req, res) {
    try {
        const user = await findPaymentUser(req.user.id);
        const amount = Number(req.body.amount);
        const phone = String(req.body.phone || "").trim();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            });
        }

        if (!/^\+?254\d{9}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid Kenyan phone number"
            });
        }

        const reference =
            `APEX-${Date.now()}-${crypto
                .randomBytes(5)
                .toString("hex")}`;

        const result = await chargeMpesa({
            email: user.email,
            amount,
            phone,
            reference
        });

        await recordPendingTransaction({
            user: user._id,
            type: "deposit",
            amount,
            status: "pending",
            reference,
            provider: "paystack",
            description: "Paystack M-Pesa deposit"
        });

        return res.json({
            success: true,
            reference,
            status: result.data && result.data.status,
            displayText:
                result.data && result.data.display_text
        });
    } catch (error) {
        console.error("Paystack M-Pesa initialize:", error);

        return res.status(502).json({
            success: false,
            message:
                error.message ||
                "Could not initiate M-Pesa payment"
        });
    }
}

async function verifyPayment(
    req,
    res
) {

    try {

        const { reference } =
            req.params;


        if (!reference) {

            return res.status(400).json({
                success: false,
                message: "Reference required"
            });
        }


        const result =
            await verifyTransaction(
                reference
            );

        const providerStatus =
            result.data.status;

        const transactionStatus = [
            "success"
        ].includes(providerStatus)
            ? "successful"
            : [
                "failed",
                "abandoned",
                "reversed"
            ].includes(providerStatus)
                ? providerStatus === "reversed"
                    ? "reversed"
                    : "failed"
                : "pending";

        if (mongoose.connection.readyState === 1) {
            await Transaction.findOneAndUpdate(
                { reference },
                { status: transactionStatus }
            );
        }


        /*
         * Do NOT credit the wallet merely
         * because the browser says payment
         * succeeded.
         *
         * Your transaction record should be
         * updated only after the provider's
         * verified response is checked.
         */


        return res.json({

            success: true,

            status:
                providerStatus,

            reference:
                result.data.reference,

            amount:
                result.data.amount,

            currency:
                result.data.currency,

            message:
                result.data.message ||
                result.data.gateway_response ||
                ""

        });

    } catch (error) {

        console.error(
            "Paystack verification:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Payment verification failed"

        });
    }
}


module.exports = {
    initializePayment,
    initializeMpesaPayment,
    verifyPayment
};
