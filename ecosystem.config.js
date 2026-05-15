module.exports = {
  apps: [
    {
      name: 'trivanta',
      script: 'server/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '300M',
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
