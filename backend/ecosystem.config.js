module.exports = {
  apps: [
    {
      name: 'rwkv-backend',
      script: 'npm',
      args: 'run dev',
      cwd: '/root/repo/app_website/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      error_file: '/root/.pm2/logs/rwkv-backend-error.log',
      out_file: '/root/.pm2/logs/rwkv-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
    },
  ],
};
