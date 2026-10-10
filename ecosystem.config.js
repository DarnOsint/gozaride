// PM2 process manager config for the Gozaride Next.js app.
// Start with: pm2 start ecosystem.config.js
// Save the process list with: pm2 save
module.exports = {
  apps: [
    {
      name: "gozaride",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "0.0.0.0",
      },
      max_memory_restart: "512M",
      // Logs are written here; Nginx sits in front and proxies to :3000.
      out_file: "/var/log/gozaride/out.log",
      error_file: "/var/log/gozaride/error.log",
      merge_logs: true,
      time: true,
      autorestart: true,
      kill_timeout: 15000,
    },
  ],
};