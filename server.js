require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const Redis = require("ioredis");

const connectDB = require("./config/db");

const paystackRoutes =
    require("./paystack/paystackRoutes");


/* ==========================================
   APP
========================================== */

const app = express();


/* ==========================================
   REDIS
========================================== */

const redis = new Redis(
    process.env.REDIS_URL ||
    "redis://127.0.0.1:6379"
);

redis.on("connect", () => {
    console.log("📁 Redis connected successfully");
});

redis.on("error", (error) => {
    console.error(
        "❌ Redis error:",
        error.message
    );
});


/* ==========================================
   GLOBAL MIDDLEWARE
========================================== */

app.use(
    cors({
        origin:
            process.env.ALLOWED_ORIGIN || "*",
        credentials: true
    })
);

app.use(cookieParser());


/*
 * Webhooks need raw request bodies.
 */
app.use((req, res, next) => {

    const webhook =
        req.originalUrl ===
            "/api/v1/payments/paystack-webhook" ||
        req.originalUrl ===
            "/api/v1/payments/pesapal-webhook";

    if (webhook) {

        return express.raw({
            type: "application/json"
        })(req, res, next);

    }

    express.json()(req, res, next);
});


/* ==========================================
   JWT AUTHENTICATION
========================================== */

const authenticateJWT =
    async (req, res, next) => {

        const authHeader =
            req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {

            return res.status(401).json({
                success: false,
                error:
                    "Access denied. Token missing."
            });

        }

        const token =
            authHeader.split(" ")[1];

        try {

            const isBlocklisted =
                await redis.get(
                    `block:${token}`
                );

            if (isBlocklisted) {

                return res.status(403).json({
                    success: false,
                    error:
                        "Token is revoked."
                });

            }

            const verified =
                jwt.verify(
                    token,
                    process.env.JWT_ACCESS_SECRET
                );

            req.user = verified;

            next();

        } catch (error) {

            return res.status(403).json({
                success: false,
                error:
                    "Invalid or expired token."
            });

        }
    };


/* ==========================================
   PAYSTACK ROUTES
========================================== */

app.use(
    "/api/paystack",
    paystackRoutes
);


/* ==========================================
   AUTH LOGIN
========================================== */

app.post(
    "/api/v1/auth/login",
    async (req, res) => {

        try {

            /*
             * Replace this demo payload with
             * your real MongoDB user lookup.
             */

            const userPayload = {
                userId: "apex_user_101",
                role: "client"
            };


            const accessToken =
                jwt.sign(
                    userPayload,
                    process.env.JWT_ACCESS_SECRET,
                    {
                        expiresIn: "15m"
                    }
                );


            const refreshToken =
                jwt.sign(
                    userPayload,
                    process.env.JWT_REFRESH_SECRET,
                    {
                        expiresIn: "7d"
                    }
                );


            res.cookie(
                "refreshToken",
                refreshToken,
                {
                    httpOnly: true,
                    secure:
                        process.env.NODE_ENV ===
                        "production",

                    sameSite: "strict",

                    maxAge:
                        7 *
                        24 *
                        60 *
                        60 *
                        1000
                }
            );


            res.json({
                success: true,
                accessToken
            });

        } catch (error) {

            console.error(
                "Login error:",
                error
            );

            res.status(500).json({
                success: false,
                error: "Login failed"
            });

        }
    }
);


/* ==========================================
   PAYSTACK WEBHOOK
========================================== */

app.post(
    "/api/v1/payments/paystack-webhook",
    async (req, res) => {

        try {

            const signature =
                req.headers[
                    "x-paystack-signature"
                ];


            const hash =
                crypto
                    .createHmac(
                        "sha512",
                        process.env
                            .PAYSTACK_SECRET_KEY
                    )
                    .update(req.body)
                    .digest("hex");


            if (
                !signature ||
                hash !== signature
            ) {

                return res
                    .status(401)
                    .send("Invalid signature");

            }


            const event =
                JSON.parse(
                    req.body.toString()
                );


            await redis.rpush(
                "payment_webhook_queue",
                JSON.stringify({
                    gateway: "paystack",
                    data: event
                })
            );


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
                .send(
                    "Internal Server Error"
                );

        }
    }
);


/* ==========================================
   PESAPAL WEBHOOK
========================================== */

app.post(
    "/api/v1/payments/pesapal-webhook",
    async (req, res) => {

        try {

            const event =
                JSON.parse(
                    req.body.toString()
                );


            await redis.rpush(
                "payment_webhook_queue",
                JSON.stringify({
                    gateway: "pesapal",
                    data: event
                })
            );


            return res.status(200).json({
                status: "200",
                message:
                    "Notification received successfully"
            });

        } catch (error) {

            console.error(
                "Pesapal webhook error:",
                error
            );

            return res
                .status(500)
                .send(
                    "Internal Server Error"
                );

        }
    }
);


/* ==========================================
   PROTECTED DASHBOARD
========================================== */

app.get(
    "/api/v1/dashboard",
    authenticateJWT,
    (req, res) => {

        res.json({

            success: true,

            message:
                "Welcome to Apex Ventures Secured Dashboard",

            user:
                req.user

        });

    }
);


/* ==========================================
   HEALTH CHECK
========================================== */

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            service:
                "Apex Ventures",

            status:
                "online"

        });

    }
);


/* ==========================================
   404
========================================== */

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "Route not found"

        });

    }
);


/* ==========================================
   START
========================================== */

const PORT =
    process.env.PORT || 5000;


async function startServer() {

    try {

        await connectDB();

        app.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    `🚀 Apex Ventures Server running on port ${PORT}`
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
