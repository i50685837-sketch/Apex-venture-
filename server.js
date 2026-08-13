require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const mongoose = require("mongoose");

const app = express();

/* =========================================================
   CONFIG
========================================================= */

const PORT = process.env.PORT || 5000;

const FRONTEND_ORIGIN =
  process.env.ALLOWED_ORIGIN || "*";

/* =========================================================
   DATABASE
========================================================= */

async function connectDatabase() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing from environment variables");
  }

  await mongoose.connect(process.env.MONGO_URI);

  console.log("✅ MongoDB connected");
}

/* =========================================================
   GLOBAL MIDDLEWARE
========================================================= */

app.set("trust proxy", 1);

app.use(
  cors({
    origin: FRONTEND_ORIGIN === "*" ? true : FRONTEND_ORIGIN,
    credentials: true
  })
);

app.use(cookieParser());

/*
 * Normal JSON requests.
 *
 * Payment webhook routes can use their own raw-body
 * middleware when signature verification requires it.
 */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   REQUEST LOGGER
========================================================= */

app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} ${req.method} ${req.originalUrl}`
  );

  next();
});

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "Apex Ventures API",
    status: "online",
    version: "1.0.0"
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    server: "online",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected"
  });
});

/* =========================================================
   AUTHENTICATION
========================================================= */

try {
  const authRoutes = require("./routes/auth");

  app.use(
    "/api/v1/auth",
    authRoutes
  );

  console.log("✅ Auth routes loaded");
} catch (error) {
  console.error(
    "⚠️ Auth routes could not be loaded:",
    error.message
  );
}

/* =========================================================
   PROFILE
========================================================= */

try {
  const profileRoutes = require("./routes/profile");

  app.use(
    "/api/v1/profile",
    profileRoutes
  );

  console.log("✅ Profile routes loaded");
} catch (error) {
  console.error(
    "⚠️ Profile routes could not be loaded:",
    error.message
  );
}

/* =========================================================
   WALLET
========================================================= */

try {
  const walletRoutes = require("./routes/wallet");

  app.use(
    "/api/v1/wallet",
    walletRoutes
  );

  console.log("✅ Wallet routes loaded");
} catch (error) {
  console.error(
    "⚠️ Wallet routes not loaded:",
    error.message
  );
}

/* =========================================================
   DEPOSIT
========================================================= */

try {
  const depositRoutes = require("./routes/deposit");

  app.use(
    "/api/v1/deposit",
    depositRoutes
  );

  console.log("✅ Deposit routes loaded");
} catch (error) {
  console.error(
    "⚠️ Deposit routes not loaded:",
    error.message
  );
}

/* =========================================================
   WITHDRAWAL
========================================================= */

try {
  const withdrawalRoutes = require("./routes/withdrawal");

  app.use(
    "/api/v1/withdrawal",
    withdrawalRoutes
  );

  console.log("✅ Withdrawal routes loaded");
} catch (error) {
  console.error(
    "⚠️ Withdrawal routes not loaded:",
    error.message
  );
}

/* =========================================================
   INVESTMENTS
========================================================= */

try {
  const investmentRoutes = require("./routes/investment");

  app.use(
    "/api/v1/investments",
    investmentRoutes
  );

  console.log("✅ Investment routes loaded");
} catch (error) {
  console.error(
    "⚠️ Investment routes not loaded:",
    error.message
  );
}

/* =========================================================
   TRANSACTIONS
========================================================= */

try {
  const transactionRoutes = require("./routes/transactions");

  app.use(
    "/api/v1/transactions",
    transactionRoutes
  );

  console.log("✅ Transaction routes loaded");
} catch (error) {
  console.error(
    "⚠️ Transaction routes not loaded:",
    error.message
  );
}

/* =========================================================
   SURVEYS
========================================================= */

try {
  const surveyRoutes = require("./routes/surveys");

  app.use(
    "/api/v1/surveys",
    surveyRoutes
  );

  console.log("✅ Survey routes loaded");
} catch (error) {
  console.error(
    "⚠️ Survey routes not loaded:",
    error.message
  );
}

/* =========================================================
   LOANS
========================================================= */

try {
  const loanRoutes = require("./routes/loan");

  app.use(
    "/api/v1/loans",
    loanRoutes
  );

  console.log("✅ Loan routes loaded");
} catch (error) {
  console.error(
    "⚠️ Loan routes not loaded:",
    error.message
  );
}

/* =========================================================
   PAYSTACK
========================================================= */

try {
  const paystackRoutes =
    require("./paystack/paystackRoutes");

  app.use(
    "/api/v1/paystack",
    paystackRoutes
  );

  console.log("✅ Paystack routes loaded");
} catch (error) {
  console.error(
    "⚠️ Paystack routes not loaded:",
    error.message
  );
}

/* =========================================================
   MPESA
========================================================= */

try {
  const mpesaRoutes =
    require("./mpesa/mpesaRoutes");

  app.use(
    "/api/v1/mpesa",
    mpesaRoutes
  );

  console.log("✅ M-Pesa routes loaded");
} catch (error) {
  console.error(
    "⚠️ M-Pesa routes not loaded:",
    error.message
  );
}

/* =========================================================
   PESAPAL
========================================================= */

try {
  const pesapalRoutes =
    require("./pesapal/pesapalRoutes");

  app.use(
    "/api/v1/pesapal",
    pesapalRoutes
  );

  console.log("✅ Pesapal routes loaded");
} catch (error) {
  console.error(
    "⚠️ Pesapal routes not loaded:",
    error.message
  );
}

/* =========================================================
   PAYMENT WEBHOOKS
========================================================= */

/*
 * These endpoints are intentionally kept separate from
 * browser-facing payment initiation endpoints.
 */

app.post(
  "/api/v1/webhooks/paystack",
  express.raw({
    type: "application/json"
  }),
  async (req, res) => {
    try {
      const crypto = require("crypto");

      const signature =
        req.headers["x-paystack-signature"];

      if (!process.env.PAYSTACK_SECRET_KEY) {
        return res.status(500).json({
          success: false,
          message: "Paystack secret is not configured"
        });
      }

      const hash =
        crypto
          .createHmac(
            "sha512",
            process.env.PAYSTACK_SECRET_KEY
          )
          .update(req.body)
          .digest("hex");

      if (hash !== signature) {
        return res.status(401).json({
          success: false,
          message: "Invalid webhook signature"
        });
      }

      const event =
        JSON.parse(req.body.toString());

      console.log(
        "✅ Paystack webhook:",
        event.event
      );

      /*
       * Update payment/transaction records here.
       *
       * Do NOT trust the frontend to mark a deposit as paid.
       */

      return res.status(200).send("OK");

    } catch (error) {
      console.error(
        "Paystack webhook error:",
        error
      );

      return res.status(500).send("Webhook error");
    }
  }
);

/* =========================================================
   PESAPAL WEBHOOK
========================================================= */

app.post(
  "/api/v1/webhooks/pesapal",
  express.json(),
  async (req, res) => {
    try {
      console.log(
        "Pesapal notification received"
      );

      /*
       * Verify transaction status with Pesapal
       * before crediting the user's wallet.
       */

      return res.status(200).json({
        success: true,
        message: "Notification received"
      });

    } catch (error) {
      console.error(
        "Pesapal webhook error:",
        error
      );

      return res.status(500).json({
        success: false
      });
    }
  }
);

/* =========================================================
   M-PESA CALLBACK
========================================================= */

app.post(
  "/api/v1/webhooks/mpesa",
  express.json(),
  async (req, res) => {
    try {
      console.log(
        "M-Pesa callback received"
      );

      /*
       * Verify callback information and transaction
       * before updating wallet balance.
       */

      return res.json({
        ResultCode: 0,
        ResultDesc: "Accepted"
      });

    } catch (error) {
      console.error(
        "M-Pesa callback error:",
        error
      );

      return res.json({
        ResultCode: 1,
        ResultDesc: "Failed"
      });
    }
  }
);

/* =========================================================
   STATIC FRONTEND
========================================================= */

const publicPath =
  path.join(__dirname, "public");

app.use(
  express.static(publicPath)
);

/*
 * This allows:
 *
 * /login.html
 * /register.html
 * /dashboard.html
 *
 * to be served directly.
 */

app.get("/login", (req, res) => {
  res.sendFile(
    path.join(publicPath, "login.html")
  );
});

app.get("/register", (req, res) => {
  res.sendFile(
    path.join(publicPath, "register.html")
  );
});

app.get("/dashboard", (req, res) => {
  res.sendFile(
    path.join(publicPath, "dashboard.html")
  );
});

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use((error, req, res, next) => {
  console.error(
    "🔥 Server error:",
    error
  );

  if (res.headersSent) {
    return next(error);
  }

  res.status(
    error.status || 500
  ).json({
    success: false,
    message:
      error.message ||
      "Internal server error"
  });
});

/* =========================================================
   START SERVER
========================================================= */

async function startServer() {
  try {

    await connectDatabase();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log("");
        console.log(
          "🚀 Apex Ventures API is running"
        );

        console.log(
          `🌐 Port: ${PORT}`
        );

        console.log(
          "🔐 JWT authentication enabled through routes"
        );

        console.log(
          "💳 Payment gateways configured through routes"
        );

        console.log(
          "💰 Wallet / investment APIs ready"
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
