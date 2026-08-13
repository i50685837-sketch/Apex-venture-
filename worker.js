require('dotenv').config();
const Redis = require('ioredis');

// 1. Initialize Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
redis.on('connect', () => console.log('⚙️ Worker connected to Redis successfully'));

// ==========================================
// 🏦 SIMULATED DATABASE OPERATIONS
// ==========================================
// Replace these mocks with actual calls to your Database ORM (e.g., Prisma, Mongoose, or pg-pool)
const db = {
    isWebhookProcessed: async (referenceId) => {
        // SELECT id FROM processed_webhooks WHERE reference = referenceId;
        return false; 
    },
    markWebhookAsProcessed: async (referenceId, gateway) => {
        // INSERT INTO processed_webhooks (reference, gateway, processed_at) VALUES (...);
        console.log(`💾 Saved event reference [${referenceId}] to DB to prevent duplicate processing.`);
    },
    fulfillOrder: async (referenceId, amount, customerEmail) => {
        // UPDATE orders SET status = 'paid' WHERE payment_ref = referenceId;
        console.log(`🎉 Apex Ventures Fulfill Order: Credited $${amount} to ${customerEmail}`);
    }
};

// ==========================================
// 🛡️ GATEWAY PROCESSING ENGINES
// ==========================================

const handlePaystackEvent = async (eventData) => {
    // Only process successful charges
    if (eventData.event !== 'charge.success') {
        console.log(`ℹ️ Paystack skipped unhandled event: ${eventData.event}`);
        return;
    }

    const { reference, amount, customer } = eventData.data;
    const cleanAmount = amount / 100; // Paystack transmits currency in lowest denominators (cents/kobo)

    // Strict Idempotency Check: Protect Apex Ventures against double network triggers
    const alreadyProcessed = await db.isWebhookProcessed(reference);
    if (alreadyProcessed) {
        console.warn(`⚠️ Duplicate Paystack trigger caught for Reference: ${reference}. Dropping task.`);
        return;
    }

    // Process payment and record to avoid double-processing
    await db.fulfillOrder(reference, cleanAmount, customer.email);
    await db.markWebhookAsProcessed(reference, 'paystack');
};

const handlePesapalEvent = async (eventData) => {
    // Pesapal V3 sends an OrderTrackingId and an IPNNotificationType
    const { OrderTrackingId, IPNNotificationType } = eventData;

    if (IPNNotificationType !== 'RESULT') {
        console.log(`ℹ️ Pesapal skipped operational notification: ${IPNNotificationType}`);
        return;
    }

    const alreadyProcessed = await db.isWebhookProcessed(OrderTrackingId);
    if (alreadyProcessed) {
        console.warn(`⚠️ Duplicate Pesapal trigger caught for Tracking ID: ${OrderTrackingId}. Dropping task.`);
        return;
    }

    try {
        // NOTE: Pesapal webhooks only notify changes. You must execute an HTTP request 
        // back to Pesapal to fetch the exact status and final currency amounts.
        console.log(`🔄 Querying Pesapal transaction details for Tracking ID: ${OrderTrackingId}...`);
        
        // [SIMULATED FETCH ARTIFACT]: Assume returned status is COMPLETED
        const pesapalTransactionStatus = 'COMPLETED'; 
        const pesapalAmount = 1500; // e.g., KES 1500
        const customerEmail = 'client@apexventures.com';

        if (pesapalTransactionStatus === 'COMPLETED') {
            await db.fulfillOrder(OrderTrackingId, pesapalAmount, customerEmail);
            await db.markWebhookAsProcessed(OrderTrackingId, 'pesapal');
        }
    } catch (err) {
        console.error(`❌ Failed to fetch actual Pesapal payload details:`, err.message);
        throw err; // Put task back or push to an error queue
    }
};

// ==========================================
// 🔄 ASYNC QUEUE RUNTIME LOOP
// ==========================================
const startWorker = async () => {
    console.log('🚀 Apex Ventures Webhook Processing Engine started. Listening for payment logs...');

    while (true) {
        try {
            // BLPOP blocks execution until an entry arrives in 'payment_webhook_queue'
            // Timeout 0 means wait indefinitely; prevents high CPU utilization loops
            const task = await redis.blpop('payment_webhook_queue', 0);
            
            // task[0] contains the key name ('payment_webhook_queue'), task[1] contains the stringified payload
            const rawPayload = task[1];
            const { gateway, data } = JSON.parse(rawPayload);

            console.log(`📥 Processing a background job from: [${gateway.toUpperCase()}]`);

            if (gateway === 'paystack') {
                await handlePaystackEvent(data);
            } else if (gateway === 'pesapal') {
                await handlePesapalEvent(data);
            }

        } catch (error) {
            console.error('❌ Critical error inside queue event pipeline execution loop:', error);
            // Implement a small cooldown pause if the connection breaks to avoid crashing the worker process entirely
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
};

// Fire up worker loop
startWorker();

