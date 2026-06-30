module.exports = {
  apps: [
    {
      name: "decave-server",
      script: "dist/server.js",

      // Run as a single instance. Bump to "max" + exec_mode: "cluster"
      // later if you need to scale across CPU cores — note the in-memory
      // auth token cache and Redis connection singleton in this codebase
      // assume a single process today, so don't flip this without also
      // revisiting those.
      instances: 1,
      exec_mode: "fork",

      // Restart policy
      autorestart: true,
      watch: false, // never watch in production; use `pm2 reload` after deploys
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 2000,

      // Guard against memory leaks taking the box down
      max_memory_restart: "500M",

      env: {
        NODE_ENV: "production",
      },

      // Logs
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
  ],
};