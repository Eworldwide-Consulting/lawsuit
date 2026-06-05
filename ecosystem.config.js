module.exports = {
  apps: [
    {
      name: 'trivanta',
      script: 'server/src/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,

      // ── Restart policy ────────────────────────────────────────────────────
      autorestart: true,
      exp_backoff_restart_delay: 100,   // 100ms → 200ms → 400ms … capped at 15s
      max_restarts: 15,
      restart_delay: 2000,

      // ── Memory guard ──────────────────────────────────────────────────────
      max_memory_restart: '500M',
      node_args: '--max-old-space-size=400',

      // ── Scheduled restart — clears any memory drift once a day at 4 AM ──
      cron_restart: '0 4 * * *',

      // ── Environment ───────────────────────────────────────────────────────
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },

      // ── Logs ─────────────────────────────────────────────────────────────
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // ── Graceful shutdown ─────────────────────────────────────────────────
      kill_timeout: 8000,
      listen_timeout: 15000,

      // ── PM2+ monitoring (free tier) ───────────────────────────────────────
      pmx: true,
    },
  ],
};
