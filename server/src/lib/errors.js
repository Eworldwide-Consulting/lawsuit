class AppError extends Error {
  constructor(message, status = 500, code) {
    super(message);
    this.name  = 'AppError';
    this.status = status;
    this.code   = code;
  }
}

class NotFoundError extends AppError {
  constructor(entity = 'Resource') {
    super(`${entity} not found`, 404, 'NOT_FOUND');
  }
}

class ForbiddenError extends AppError {
  constructor(msg = 'Forbidden') {
    super(msg, 403, 'FORBIDDEN');
  }
}

class ValidationError extends AppError {
  constructor(msg) {
    super(msg, 400, 'VALIDATION_ERROR');
  }
}

class ConflictError extends AppError {
  constructor(msg) {
    super(msg, 409, 'CONFLICT');
  }
}

class UnauthorizedError extends AppError {
  constructor(msg = 'Unauthorized') {
    super(msg, 401, 'UNAUTHORIZED');
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
};