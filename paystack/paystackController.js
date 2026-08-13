const crypto = require("crypto");

const User =
    require("../models/User");

const Transaction =
    require("../models/Transaction");

const {
    initializeTransaction,
    verifyTransaction
} = require("./paystackService");


async function initializePayment(
    req,
    res
) {

    try {

        const user =
            await User.findById(
                req.user.id
            );

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
        await Transaction.create({

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
                result.data.status,

            reference:
                result.data.reference,

            amount:
                result.data.amount,

            currency:
                result.data.currency

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
    verifyPayment
};
