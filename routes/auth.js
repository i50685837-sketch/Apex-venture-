const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

const router = express.Router();


router.post("/register", async (req, res) => {

    try {

        const {
            name,
            email,
            password
        } = req.body;

        if (!name || !email || !password) {

            return res.status(400).json({
                message: "All fields are required"
            });
        }

        const existing =
            await User.findOne({
                email
            });

        if (existing) {

            return res.status(409).json({
                message: "Email already registered"
            });
        }

        const hashed =
            await bcrypt.hash(
                password,
                12
            );

        const user =
            await User.create({
                name,
                email,
                password: hashed
            });

        const token =
            jwt.sign(
                {
                    id: user._id
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "7d"
                }
            );

        res.status(201).json({
            message: "Account created",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Registration failed"
        });
    }
});


router.post("/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        const user =
            await User.findOne({
                email
            });

        if (!user) {

            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const valid =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!valid) {

            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token =
            jwt.sign(
                {
                    id: user._id
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "7d"
                }
            );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Login failed"
        });
    }
});


module.exports = router;
