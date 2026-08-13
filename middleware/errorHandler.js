function errorHandler(err, req, res, next) {

    console.error("SERVER ERROR:", err);

    const statusCode =
        err.statusCode ||
        err.status ||
        500;

    res.status(statusCode).json({
        success: false,
        message:
            statusCode === 500
                ? "Internal server error"
                : err.message
    });
}

module.exports = errorHandler;
