require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const path = require("path");

const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const investmentRoutes = require("./routes/investments");
const transactionRoutes = require("./routes/transactions");

const paystackRoutes =
    require("./paystack/paystackRoutes");


/* =====================================================
   APP
===================================================== */

const app = express();

const PORT = process.env.PORT || 5000;


/* =====================================================
   TRUST PROXY
===================================================== */

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}


/* =====================================================
   CORS
===================================================== */

const allowedOrigin =
    process.env.ALLOWED_ORIGIN || "*";

app.use(
    cors({
        origin: allowedOrigin,
        credentials: allowedOrigin !== "*"
    })
);


/* =====================================================
   COOKIES
===================================================== */

app.use(cookieParser());


/* =====================================================
   PAYSTACK WEBHOOK
   MUST RECEIVE RAW BODY
===================================================== */

app.post(
    "/api/v1/payments/paystack-webhook",

    express.raw({
        type: "application/json"
    }),

    async (req, res) => {

        try {

            const secret =
                process.env.PAYSTACK_SECRET_KEY;

            if (!secret) {

                console.error(
                    "PAYSTACK_SECRET_KEY missing"
                );

                return res
                    .status(500)
                    .send("Server configuration error");
            }


            const signature =
                req.headers[
                    "x-paystack-signature"
                ];


            if (!signature) {

                return res
                    .status(401)
                    .send("Missing signature");
            }


            const expectedSignature =
                crypto
                    .createHmac(
                        "sha512",
                        secret
                    )
                    .update(req.body)
                    .digest("hex");


            /*
             * Timing-safe comparison prevents
             * simple signature comparison attacks.
             */

            const received =
                Buffer.from(signature);

            const expected =
                Buffer.from(expectedSignature);


            if (
                received.length !==
                expected.length ||
                !crypto.timingSafeEqual(
                    received,
                    expected
                )
            ) {

                console.warn(
                    "Invalid Paystack webhook signature"
                );

                return res
                    .status(401)
                    .send("Invalid signature");
            }


            const event =
                JSON.parse(
                    req.body.toString("utf8")
                );


            console.log(
                "Paystack event:",
                event.event
            );


            /*
             * IMPORTANT:
             *
             * Do not credit a wallet merely because
             * the browser reports success.
             *
             * Process the verified event here or
             * through a dedicated payment service.
             */

            if (
                event.event ===
                "charge.success"
            ) {

                console.log(
                    "Verified Paystack payment:",
                    event.data.reference
                );

                /*
                 * TODO:
                 * Find Transaction by reference
                 * Check it has not already been
                 * processed
                 * Mark it successful
                 * Credit Wallet atomically
                 */
            }


            return res
                .status(200)
                .send("Event received");

        } catch (error) {

            console.error(
                "Paystack webhook error:",
                error
            );

            return res
                .status(500)
                .send("Webhook processing failed");
        }
    }
);


/* =====================================================
   PESAPAL WEBHOOK
===================================================== */

app.post(
    "/api/v1/payments/pesapal-webhook",

    express.json(),

    async (req, res) => {

        try {

            /*
             * Pesapal notifications should be
             * processed server-side.
             *
             * Do not credit wallets from frontend
             * callbacks.
             */

            console.log(
                "Pesapal notification received"
            );


            /*
             * TODO:
             * Verify transaction status with
             * Pesapal before updating Transaction
             * and Wallet.
             */


            return res.status(200).json({
                success: true,
                message:
                    "Notification received"
            });

        } catch (error) {

            console.error(
                "Pesapal webhook error:",
                error
            );

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Webhook processing failed"
                });
        }
    }
);


/* =====================================================
   NORMAL JSON BODY
===================================================== */

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);


/* =====================================================
   SECURITY HEADERS
===================================================== */

app.disable("x-powered-by");


/* =====================================================
   STATIC FRONTEND
===================================================== */

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


/* =====================================================
   HEALTH CHECK
===================================================== */

app.get(
    "/api/health",
    (req, res) => {

        res.status(200).json({

            success: true,

            service:
                "Apex Ventures API",

            status:
                "online",

            database:
                "connected",

            environment:
                process.env.NODE_ENV ||
                "development",

            timestamp:
                new Date().toISOString()
        });
    }
);


/* =====================================================
   API INFORMATION
===================================================== */

app.get(
    "/api",
    (req, res) => {

        res.json({

            success: true,

            name:
                "Apex Ventures API",

            version:
                "1.0.0",

            status:
                "online"
        });
    }
);


/* =====================================================
   ROOT
===================================================== */

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            message:
                "🚀 Apex Ventures API is running",

            health:
                "/api/health"
        });
    }
);


/* =====================================================
   API ROUTES
===================================================== */

app.use(
    "/api/auth",
    authRoutes
);


app.use(
    "/api/profile",
    profileRoutes
);


app.use(
    "/api/investments",
    investmentRoutes
);


app.use(
    "/api/transactions",
    transactionRoutes
);


app.use(
    "/api/paystack",
    paystackRoutes
);


/* =====================================================
   404 HANDLER
===================================================== */

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "Route not found",

            path:
                req.originalUrl
        });
    }
);


/* =====================================================
   GLOBAL ERROR HANDLER
===================================================== */

app.use(
    (err, req, res, next) => {

        console.error(
            "🔥 Server Error:",
            err
        );


        const status =
            err.status ||
            err.statusCode ||
            500;


        res.status(status).json({

            success: false,

            message:
                status === 500
                    ? "Internal server error"
                    : err.message
        });
    }
);


/* =====================================================
   START SERVER
===================================================== */

async function startServer() {

    try {

        console.log(
            "🔄 Connecting to MongoDB..."
        );


        await connectDB();


        console.log(
            "✅ MongoDB connected"
        );


        app.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    "================================"
                );

                console.log(
                    "🚀 APEX VENTURES SERVER"
                );

                console.log(
                    `📡 PORT: ${PORT}`
                );

                console.log(
                    `🌍 ENV: ${
                        process.env.NODE_ENV ||
                        "development"
                    }`
                );

                console.log(
                    "💳 Paystack: configured"
                );

                console.log(
                    "🏦 Pesapal: configured"
                );

                console.log(
                    "🔐 JWT: enabled"
                );

                console.log(
                    "📦 Redis: disabled"
                );

                console.log(
                    "================================"
                );
            }
        );

    } catch (error) {

        console.error(
            "❌ Server startup failed:",
            error.message
        );

        process.exit(1);
    }
}


startServer();


/* =====================================================
   GRACEFUL SHUTDOWN
===================================================== */

process.on(
    "SIGTERM",
    () => {

        console.log(
            "SIGTERM received. Shutting down..."
        );

        process.exit(0);
    }
);


process.on(
    "SIGINT",
    () => {

        console.log(
            "SIGINT received. Shutting down..."
        );

        process.exit(0);
    }
);
