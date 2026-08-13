const config = {
    secretKey: process.env.PAYSTACK_SECRET_KEY,

    publicKey: process.env.PAYSTACK_PUBLIC_KEY,

    baseURL: "https://api.paystack.co",

    currency: "KES"
};

if (!config.secretKey) {
    console.warn(
        "⚠️ PAYSTACK_SECRET_KEY is missing"
    );
}

module.exports = config;
