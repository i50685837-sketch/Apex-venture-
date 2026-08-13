const mongoose = require("mongoose");

const investmentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        plan: {
            type: String,
            required: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0
        },

        profitRate: {
            type: Number,
            required: true
        },

        duration: {
            type: String,
            required: true
        },

        status: {
            type: String,
            enum: [
                "active",
                "completed",
                "cancelled"
            ],
            default: "active"
        },

        startedAt: {
            type: Date,
            default: Date.now
        },

        completedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Investment",
    investmentSchema
);
