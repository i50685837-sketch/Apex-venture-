"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const localTestUser = {
  _id: "local-test-user",
  name: "Local Test User",
  email: process.env.LOCAL_TEST_EMAIL || "local.test@example.com",
  phone: process.env.LOCAL_TEST_PHONE || "0700000000",
  password: process.env.LOCAL_TEST_PASSWORD || "TestUser123!",
  role: "client"
};

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

function cleanPhone(phone) {
  return String(phone || "")
    .trim()
    .replace(/\s+/g, "");
}

/* =========================================================
   REGISTER
   POST /api/auth/register
   POST /api/v1/auth/register
========================================================= */

router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone and password are required"
      });
    }

    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPhoneNumber = cleanPhone(phone);

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: "Name is required"
      });
    }

    if (!cleanPhoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required"
      });
    }

    if (!cleanEmail) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters"
      });
    }

    if (process.env.SKIP_DATABASE === "true") {
      return res.status(503).json({
        success: false,
        message: "Registration is disabled while the database is skipped"
      });
    }

    const existingUser = await User.findOne({
      phone: cleanPhoneNumber
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Phone number already registered"
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      12
    );

    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhoneNumber,
      password: hashedPassword
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role || "client"
      }
    });

  } catch (error) {
    console.error(
      "REGISTER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Registration failed"
    });
  }
});

/* =========================================================
   LOGIN
   POST /api/auth/login
   POST /api/v1/auth/login
========================================================= */

router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone number and password are required"
      });
    }

    const cleanPhoneNumber = cleanPhone(phone);

    const user = process.env.SKIP_DATABASE === "true"
      ? cleanPhoneNumber === localTestUser.phone
        ? localTestUser
        : null
      : await User.findOne({ phone: cleanPhoneNumber });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid phone number or password"
      });
    }

    const passwordMatch = process.env.SKIP_DATABASE === "true"
      ? password === user.password
      : await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid phone number or password"
      });
    }

    if (!process.env.JWT_ACCESS_SECRET) {
      console.error(
        "JWT_ACCESS_SECRET is missing"
      );

      return res.status(500).json({
        success: false,
        message: "Authentication is not configured"
      });
    }

    const role = user.role || "client";

    const accessToken = jwt.sign(
      {
        id: user._id.toString(),
        phone: user.phone,
        role
      },
      process.env.JWT_ACCESS_SECRET,
      {
        expiresIn: "15m"
      }
    );

    return res.json({
      success: true,
      message: "Login successful",
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role
      }
    });

  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
});

/* =========================================================
   EXPORT
========================================================= */

module.exports = router;
