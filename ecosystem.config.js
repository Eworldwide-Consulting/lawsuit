module.exports = {
  apps: [
    {
      name: 'trivanta',
      script: 'server/src/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      max_memory_restart: '400M',

      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },

      // Logs (created automatically in ./logs/)
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};
