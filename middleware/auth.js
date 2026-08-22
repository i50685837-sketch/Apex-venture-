const jwt = require("jsonwebtoken");

function auth(req, res, next) {
    try {
        const header = req.headers.authorization;

        if (!header || !header.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const token = header.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Token missing"
            });
        }

        const accessSecret =
            process.env.JWT_ACCESS_SECRET ||
            process.env.JWT_SECRET;

        if (!accessSecret) {
            return res.status(500).json({
                success: false,
                message: "Authentication is not configured"
            });
        }

        const decoded = jwt.verify(
            token,
            accessSecret
        );

        req.user = {
            id: decoded.id
        };

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
}

module.exports = auth;
