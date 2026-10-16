import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { ConfigError } from '../config/env';

export { AppError };

// Maps AWS SDK errors to a safe message. Details (never secrets) go to the server log.
const awsErrorMessage = (err: any): string | undefined => {
  switch (err?.name) {
    case 'ResourceNotFoundException':
      return 'Database table not found. Check DYNAMODB_TABLE_NAME and AWS_REGION (see SETUP.md).';
    case 'AccessDeniedException':
    case 'UnrecognizedClientException':
      return 'The server is not allowed to access the database. Check the IAM permissions (see SETUP.md).';
    case 'CredentialsProviderError':
    case 'ExpiredTokenException':
    case 'InvalidSignatureException':
      return 'The server could not obtain valid AWS credentials (see SETUP.md).';
    case 'ProvisionedThroughputExceededException':
    case 'ThrottlingException':
    case 'RequestLimitExceeded':
      return 'The database is busy. Please retry in a moment.';
    case 'ValidationException':
      return 'The database rejected the request (key or schema mismatch). Check the table definition in SETUP.md.';
    default:
      return undefined;
  }
};

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err?.statusCode || 500;
  let message = err?.message || 'Internal Server Error';
  let errors: { path: string; message: string }[] | undefined;

  if (err instanceof ZodError) {
    statusCode = 400;
    errors = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    message = errors.map((e) => (e.path ? `${e.path}: ${e.message}` : e.message)).join('; ');
  } else if (err instanceof ConfigError) {
    statusCode = 500;
    message = 'Server configuration error. Check the server logs.';
  } else if (!(err instanceof AppError)) {
    const awsMessage = awsErrorMessage(err);
    if (awsMessage) {
      statusCode = ['ProvisionedThroughputExceededException', 'ThrottlingException', 'RequestLimitExceeded'].includes(err.name) ? 503 : 500;
      message = awsMessage;
    } else if (err?.type === 'entity.too.large') {
      statusCode = 413;
      message = 'Request body is too large';
    } else if (err?.type === 'entity.parse.failed') {
      statusCode = 400;
      message = 'Malformed JSON body';
    }
  }

  console.error(`[Error] ${req.method} ${req.originalUrl} (${statusCode}):`, err?.name, err?.message, statusCode >= 500 ? err?.stack : '');

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
    stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
  });
};
