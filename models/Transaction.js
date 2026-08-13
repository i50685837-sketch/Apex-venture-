const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        type: {
            type: String,
            enum: [
                "deposit",
                "withdrawal",
                "investment",
                "return",
                "refund"
            ],
            required: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0
        },

        status: {
            type: String,
            enum: [
                "pending",
                "successful",
                "failed",
                "reversed"
            ],
            default: "pending"
        },

        reference: {
            type: String,
            unique: true,
            sparse: true
        },

        provider: {
            type: String,
            enum: [
                "paystack",
                "pesapal",
                "internal"
            ],
            default: "internal"
        },

        description: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Transaction",
    transactionSchema
);
