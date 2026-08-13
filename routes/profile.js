const express = require("express");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

/*
========================================
GET PROFILE
GET /api/profile
========================================
*/

router.get("/", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user
        });

    } catch (error) {
        console.error("Profile error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load profile"
        });
    }
});


/*
========================================
UPDATE PROFILE
PUT /api/profile
========================================
*/

router.put("/", auth, async (req, res) => {
    try {
        const { name, email } = req.body;

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (name !== undefined) {
            user.name = name.trim();
        }

        if (email !== undefined) {
            user.email = email
                .trim()
                .toLowerCase();
        }

        await user.save();

        res.json({
            success: true,
            message: "Profile updated successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error("Update profile:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Email already exists"
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to update profile"
        });
    }
});


/*
========================================
DELETE ACCOUNT
DELETE /api/profile
========================================
*/

router.delete("/", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        await User.findByIdAndDelete(req.user.id);

        res.json({
            success: true,
            message: "Account deleted successfully"
        });

    } catch (error) {
        console.error("Delete profile:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete account"
        });
    }
});


module.exports = router;
