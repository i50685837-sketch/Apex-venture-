const express = require("express");

const auth = require("../middleware/auth");

const Transaction =
    require("../models/Transaction");

const router = express.Router();


router.get("/", auth, async (req, res) => {

    try {

        const transactions =
            await Transaction.find({
                user: req.user.id
            })
            .sort({
                createdAt: -1
            })
            .limit(100);

        res.json({
            transactions
        });

    } catch (error) {

        res.status(500).json({
            message:
                "Could not load transactions"
        });
    }
});


module.exports = router;
