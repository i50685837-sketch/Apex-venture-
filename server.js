require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const Redis = require('ioredis');

const app = express();

// 1. Connect to Redis for Queue and Token Blocklisting
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
redis.on('connect', () => console.log('📁 Redis connected successfully'));

// 2. Global Middleware
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*', credentials: true }));
app.use(cookieParser());

// IMPORTANT: Webhooks need raw bodies for crypto verification. 
// Standard JSON parsing is applied to all OTHER routes.
app.use((req, res, next) => {
    if (req.originalUrl === '/api/v1/payments/paystack-webhook' || req.originalUrl === '/api/v1/payments/pesapal-webhook') {
        express.raw({ type: 'application/json' })(req, res, next);
    } else {
        express.json()(req, res, next);
    }
});

// ==========================================
// 🔒 JWT AUTHENTICATION SYSTEM
// ==========================================

// Middleware to verify short-lived Access Token
const authenticateJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. Token missing.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Check if token is blocklisted in Redis (logged out)
        const isBlocklisted = await redis.get(`block:${token}`);
        if (isBlocklisted) return res.status(403).json({ error: 'Token is revoked.' });

        const verified = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
};

// Login Route: Issues Access Token & httpOnly Refresh Token
app.post('/api/v1/auth/login', async (req, res) => {
    // [Database user verification logic goes here]
    const userPayload = { userId: "apex_user_101", role: "client" };

    const accessToken = jwt.sign(userPayload, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(userPayload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // Store Refresh Token securely in httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true, // Requires HTTPS in production
        sameSite: 'Strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 Days
    });

    res.json({ success: true, accessToken });
});

// ==========================================
// 💳 PAYMENT WEBHOOKS (Asynchronous Pipeline)
// ==========================================

// Paystack Webhook Handler
app.post('/api/v1/payments/paystack-webhook', async (req, res) => {
    try {
        const hash = crypto
            .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
            .update(req.body)
            .digest('hex');

        // Secure Validation: Confirm event matches Paystack's signature
        if (hash !== req.headers['x-paystack-signature']) {
            return res.status(401).send('Invalid signature');
        }

        const event = JSON.parse(req.body.toString());

        // Avoid long DB actions. Push payload to Redis queue for background workers.
        await redis.rpush('payment_webhook_queue', JSON.stringify({ gateway: 'paystack', data: event }));

        // IMMEDIATELY return 200 OK to stop Paystack retry loops
        return res.status(200).send('Event received');
    } catch (error) {
        console.error('Paystack webhook error:', error);
        return res.status(500).send('Internal Server Error');
    }
});

// Pesapal V3 Webhook Handler
app.post('/api/v1/payments/pesapal-webhook', async (req, res) => {
    try {
        const event = JSON.parse(req.body.toString());
        
        // Push raw metadata parameters to Redis background workers
        await redis.rpush('payment_webhook_queue', JSON.stringify({ gateway: 'pesapal', data: event }));

        // IMMEDIATELY acknowledge receipt to Pesapal
        return res.status(200).json({ "status": "200", "message": "Notification received successfully" });
    } catch (error) {
        console.error('Pesapal webhook error:', error);
        return res.status(500).send('Internal Server Error');
    }
});

// ==========================================
// 🛡️ PROTECTED APEX VENTURES ROUTES
// ==========================================
app.get('/api/v1/dashboard', authenticateJWT, (req, res) => {
    res.json({ message: "Welcome to Apex Ventures Secured Dashboard", user: req.user });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Apex Ventures Server spinning on port ${PORT}`));
         
