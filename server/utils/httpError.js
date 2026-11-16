// Error with an HTTP status code, thrown by services for client-side problems
class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Shared error responder for controllers
const sendError = (res, error, fallbackMessage) => {
  let statusCode = error.statusCode || 500;
  let message = error.message;

  if (error.name === "ValidationError" || error.name === "CastError") {
    statusCode = 400;
  }

  if (error.code === 11000) {
    statusCode = 409;
    const field = Object.keys(error.keyValue || {})[0] || "value";
    message = `A record with this ${field} already exists`;
  }

  // Hide internal details of unexpected errors; deliberate HttpErrors
  // (e.g. 503 "AI not set up") keep their user-facing message
  if (statusCode >= 500 && !(error instanceof HttpError)) {
    console.error(`${fallbackMessage}:`, error);
    message = fallbackMessage;
  }

  return res.status(statusCode).json({ success: false, message });
};

module.exports = { HttpError, sendError };
