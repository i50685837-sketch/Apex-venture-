const config = require("./paystackConfig");

async function paystackRequest(
    endpoint,
    options = {}
) {
    if (!config.secretKey) {
        throw new Error(
            "Paystack secret key is not configured"
        );
    }

    const response = await fetch(
        `${config.baseURL}${endpoint}`,
        {
            ...options,

            headers: {
                "Authorization":
                    `Bearer ${config.secretKey}`,

                "Content-Type":
                    "application/json",

                ...(options.headers || {})
            }
        }
    );

    const data =
        await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Paystack request failed"
        );
    }

    return data;
}


/*
 * Initialize a transaction.
 */
async function initializeTransaction({
    email,
    amount,
    reference,
    callbackUrl
}) {

    return paystackRequest(
        "/transaction/initialize",
        {
            method: "POST",

            body: JSON.stringify({
                email,

                /*
                 * Paystack expects the amount
                 * in the currency's smallest unit.
                 */
                amount: Math.round(
                    Number(amount) * 100
                ),

                currency: config.currency,

                reference,

                callback_url: callbackUrl
            })
        }
    );
}

async function chargeMpesa({
    email,
    amount,
    phone,
    reference
}) {
    const normalizedPhone = String(phone || "").startsWith("+")
        ? String(phone)
        : `+${String(phone)}`;

    return paystackRequest(
        "/charge",
        {
            method: "POST",
            body: JSON.stringify({
                email,
                amount: Math.round(Number(amount) * 100),
                currency: config.currency,
                reference,
                mobile_money: {
                    phone: normalizedPhone,
                    provider: "mpesa"
                }
            })
        }
    );
}


/*
 * Verify a transaction.
 */
async function verifyTransaction(
    reference
) {

    return paystackRequest(
        `/transaction/verify/${encodeURIComponent(
            reference
        )}`,
        {
            method: "GET"
        }
    );
}


module.exports = {
    initializeTransaction,
    chargeMpesa,
    verifyTransaction
};
