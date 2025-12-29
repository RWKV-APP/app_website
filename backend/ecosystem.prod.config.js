const path = require('path');

module.exports = {
  apps: [
    {
      name: 'app-website-prod',
      script: path.join(__dirname, 'dist/src/main.js'),
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // 独立的日志文件，确保不会和其他任务混在一起
      error_file: path.join(__dirname, 'logs/app-website-prod-error.log'),
      out_file: path.join(__dirname, 'logs/app-website-prod-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: false, // 不合并日志，保持独立
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      // 日志轮转配置
      max_memory_restart: '500M',
      // 确保进程名称唯一
      instance_var: 'INSTANCE_ID',
    },
  ],
};
