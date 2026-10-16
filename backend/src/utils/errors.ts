// Errors with an HTTP status. The central error handler turns these into JSON responses.

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

// Used when a DynamoDB condition fails: duplicate value, slot already booked,
// stock changed by a concurrent request, etc.
export class ConflictError extends AppError {
  constructor(message = 'The request conflicts with the current state of the resource. Please retry.') {
    super(message, 409);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}
