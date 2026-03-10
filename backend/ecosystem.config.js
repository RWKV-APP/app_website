const path = require('path');

module.exports = {
  apps: [
    {
      name: 'rwkv-backend',
      script: 'npm',
      args: 'run dev',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        HOST: '0.0.0.0',
        PORT: 3462,
      },
      error_file: path.join(__dirname, 'logs/rwkv-backend-error.log'),
      out_file: path.join(__dirname, 'logs/rwkv-backend-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
    },
  ],
};
