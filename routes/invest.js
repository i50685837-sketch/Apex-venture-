const express = require("express");

const auth = require("../middleware/auth");

const User = require("../models/User");
const Investment =
    require("../models/Investment");

const Transaction =
    require("../models/Transaction");

const router = express.Router();


const PLANS = {

    Starter: {
        minimum: 750,
        rate: 15,
        duration: "3 Hours"
    },

    Growth: {
        minimum: 1000,
        rate: 25,
        duration: "6 Hours"
    },

    Silver: {
        minimum: 2500,
        rate: 30,
        duration: "12 Hours"
    },

    Premium: {
        minimum: 5000,
        rate: 35,
        duration: "24 Hours"
    },

    Gold: {
        minimum: 10000,
        rate: 40,
        duration: "2 Days"
    },

    Platinum: {
        minimum: 25000,
        rate: 50,
        duration: "3 Days"
    },

    Elite: {
        minimum: 50000,
        rate: 60,
        duration: "7 Days"
    }

};


router.get("/", auth, async (req, res) => {

    try {

        const investments =
            await Investment.find({
                user: req.user.id
            })
            .sort({
                createdAt: -1
            });

        res.json({
            investments
        });

    } catch (error) {

        res.status(500).json({
            message: "Could not load investments"
        });
    }
});


router.post("/", auth, async (req, res) => {

    try {

        const {
            amount,
            plan
        } = req.body;

        const investmentAmount =
            Number(amount);

        const selectedPlan =
            PLANS[plan];

        if (!selectedPlan) {

            return res.status(400).json({
                message: "Invalid investment plan"
            });
        }

        if (
            !Number.isFinite(
                investmentAmount
            ) ||
            investmentAmount <= 0
        ) {

            return res.status(400).json({
                message: "Invalid investment amount"
            });
        }

        if (
            investmentAmount <
            selectedPlan.minimum
        ) {

            return res.status(400).json({
                message:
                    `Minimum investment is KES ${selectedPlan.minimum}`
            });
        }


        const user =
            await User.findById(
                req.user.id
            );

        if (!user) {

            return res.status(404).json({
                message: "User not found"
            });
        }


        /*
         * SANDBOX:
         * We only use the user's existing
         * demo balance.
         */

        if (
            investmentAmount >
            user.balance
        ) {

            return res.status(400).json({
                message: "Insufficient demo balance"
            });
        }


        user.balance -=
            investmentAmount;

        await user.save();


        const investment =
            await Investment.create({

                user: user._id,

                plan,

                amount:
                    investmentAmount,

                profitRate:
                    selectedPlan.rate,

                duration:
                    selectedPlan.duration

            });


        await Transaction.create({

            user: user._id,

            type:
                "Investment",

            amount:
                investmentAmount,

            status:
                "successful",

            reference:
                `INV-${Date.now()}`
        });


        res.status(201).json({

            message:
                "Investment created successfully",

            investment

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message:
                "Investment could not be created"
        });
    }
});


module.exports = router;
