const path = require('path');

const appRoot = process.env.APP_WEBSITE_BACKEND_CWD || __dirname;

module.exports = {
  apps: [
    {
      name: 'rwkv-backend',
      cwd: appRoot,
      script: path.join(appRoot, 'dist/main.js'),
      interpreter: process.env.NODE_INTERPRETER || 'node',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: 3462,
      },
      // 使用稳定文件名，交由系统 logrotate 做轮转。
      error_file: path.join(appRoot, 'logs/rwkv-backend-error.log'),
      out_file: path.join(appRoot, 'logs/rwkv-backend-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
      watch: false,
      max_memory_restart: '500M',
      // 确保进程名称唯一
      instance_var: 'INSTANCE_ID',
    },
  ],
};
