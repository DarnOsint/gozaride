module.exports = {
  apps : [{
    name: "gozaride",
    script: "node",
    args: "server.js",
    cwd: "/app",
    env: {
      NODE_ENV: "production",
    },
    env_production : {
      NODE_ENV: "production",
      PORT: 3000,
      DATABASE_URL: "postgresql://gozaride:password@db.gozaride.com:5432/gozaride",
      NEXTAUTH_URL: "https://gozaride.com",
      NEXTAUTH_SECRET: "change-this-to-a-secure-random-string",
      STRIPE_PUBLIC_KEY: "pk_test_your_public_key",
      STRIPE_SECRET_KEY: "sk_live_your_secret_key",
      CLOUDFLARE_API_TOKEN: "your-cloudflare-api-token",
      CLOUDFLARE_ACCOUNT_ID: "your-cloudflare-account-id",
    }
  }],
  
  deploy: {
    production: {
      user: "root",
      host: "your-vps-ip",
      ref: "origin/master",
      repo: "git@github.com:DarnOsint/gozaride.git",
      path: "/var/www/gozaride",
      "post-deploy": "npm install && npm run build",
      "restart": "pm2 restart all",
      "stop": "pm2 stop all",
      "start": "pm2 start ecosystem.config.js"
    }
  }
};