module.exports = {
  apps: [{
    name: 'tzbot',
    script: './dist/index.js',
    cwd: '/var/www/tzbot/current',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    exp_backoff_restart_delay: 100,
    listen_timeout: 10000,
    kill_timeout: 5000,
    // PM2 event hooks for runtime monitoring
    // These hooks trigger the monitoring script on critical events
    post_update: [
      'echo "PM2 config updated"'
    ],
    // Note: PM2 doesn't support direct error event hooks in ecosystem config
    // Instead, we use a cron-based monitoring script (vps-monitor.sh)
    // that checks process status, restart frequency, and memory usage
  }]
};
