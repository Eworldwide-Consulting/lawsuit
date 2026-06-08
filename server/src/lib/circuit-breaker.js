// Simple circuit breaker — prevents cascade failures when Stripe, SMTP, or
// any external service is down. Three states:
//
//   CLOSED   → calls pass through normally
//   OPEN     → calls fail fast for `resetMs` milliseconds
//   HALF_OPEN → one probe call is allowed; success closes, failure re-opens

const logger = require('../logger');

const STATE = { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half_open' };

class CircuitBreaker {
  constructor(name, opts = {}) {
    this.name         = name;
    this.threshold    = opts.threshold    || 5;    // failures before opening
    this.resetMs      = opts.resetMs      || 60_000; // ms to wait before half-open
    this.timeoutMs    = opts.timeoutMs    || 10_000; // per-call timeout
    this._state       = STATE.CLOSED;
    this._failures    = 0;
    this._nextAttempt = 0;
  }

  get state() { return this._state; }

  async call(fn) {
    if (this._state === STATE.OPEN) {
      if (Date.now() < this._nextAttempt)
        throw new Error(`Circuit open: ${this.name} is unavailable`);
      this._state = STATE.HALF_OPEN;
      logger.info({ circuit: this.name }, 'Circuit half-open — probing');
    }

    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Circuit timeout: ${this.name}`)), this.timeoutMs)
        ),
      ]);
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure(err);
      throw err;
    }
  }

  _onSuccess() {
    if (this._state === STATE.HALF_OPEN)
      logger.info({ circuit: this.name }, 'Circuit closed after probe success');
    this._failures = 0;
    this._state    = STATE.CLOSED;
  }

  _onFailure(err) {
    this._failures++;
    if (this._state === STATE.HALF_OPEN || this._failures >= this.threshold) {
      this._state       = STATE.OPEN;
      this._nextAttempt = Date.now() + this.resetMs;
      logger.warn({ circuit: this.name, failures: this._failures, err: err.message }, 'Circuit opened');
    }
  }

  toJSON() {
    return {
      name:    this.name,
      state:   this._state,
      failures: this._failures,
    };
  }
}

// Pre-wired breakers for external dependencies
const breakers = {
  stripe: new CircuitBreaker('stripe', { threshold: 3, resetMs: 30_000 }),
  smtp:   new CircuitBreaker('smtp',   { threshold: 5, resetMs: 120_000 }),
  s3:     new CircuitBreaker('s3',     { threshold: 5, resetMs: 60_000 }),
};

module.exports = { CircuitBreaker, breakers };