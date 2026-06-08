// In-process job queue — works without Redis.
// API mirrors BullMQ exactly, so upgrading is a one-line import swap:
//
//   const { Queue, Worker } = require('bullmq');
//   const connection = new Redis(config.redis.url);
//
// Until then this runs reliably on a single instance with exponential backoff.

const { EventEmitter } = require('events');
const logger = require('../logger');

const QUEUE_NAMES = {
  EMAIL:        'email',
  NOTIFICATION: 'notification',
  AUDIT:        'audit',
};

class InMemoryQueue extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this._pending = [];
    this._counter = 0;
  }

  async add(jobName, data, opts = {}) {
    const job = {
      id:       String(++this._counter),
      name:     jobName,
      data,
      opts:     { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, ...opts },
      attemptsMade: 0,
    };
    this._pending.push(job);
    setImmediate(() => this.emit('waiting', job));
    return job;
  }

  async count()  { return this._pending.length; }
  async close()  { this._pending = []; }
  _consume(id)   { this._pending = this._pending.filter(j => j.id !== id); }
}

class InMemoryWorker extends EventEmitter {
  constructor(queueName, processor, opts = {}) {
    super();
    this.queueName   = queueName;
    this.processor   = processor;
    this.concurrency = opts.concurrency || 5;
    this._active     = 0;
  }

  attach(queue) {
    queue.on('waiting', job => this._run(queue, job));
  }

  async _run(queue, job) {
    if (this._active >= this.concurrency) {
      setTimeout(() => queue.emit('waiting', job), 50);
      return;
    }

    this._active++;
    try {
      await this.processor(job);
      queue._consume(job.id);
      this.emit('completed', job, null);
    } catch (err) {
      job.attemptsMade++;
      const max = job.opts.attempts;

      if (job.attemptsMade >= max) {
        queue._consume(job.id);
        logger.error({ queue: queue.name, job: job.name, jobId: job.id, err }, 'Job failed permanently');
        this.emit('failed', job, err);
      } else {
        const delay = job.opts.backoff?.type === 'exponential'
          ? (job.opts.backoff.delay || 1000) * Math.pow(2, job.attemptsMade - 1)
          : (job.opts.backoff?.delay || 1000);
        logger.warn({ queue: queue.name, job: job.name, attempt: job.attemptsMade, retryIn: delay }, 'Job retrying');
        setTimeout(() => queue.emit('waiting', job), delay);
      }
    } finally {
      this._active--;
    }
  }

  async close() { this._active = 0; }
}

// Singleton registry — one queue per name per process
const _registry = new Map();

function getQueue(name) {
  if (!_registry.has(name)) {
    const q = new InMemoryQueue(name);
    _registry.set(name, q);
  }
  return _registry.get(name);
}

function createWorker(name, processor, opts = {}) {
  const queue  = getQueue(name);
  const worker = new InMemoryWorker(name, processor, opts);
  worker.attach(queue);
  return worker;
}

async function queueStats() {
  const stats = {};
  for (const [name, q] of _registry) {
    stats[name] = { waiting: await q.count() };
  }
  return stats;
}

module.exports = { QUEUE_NAMES, getQueue, createWorker, queueStats };