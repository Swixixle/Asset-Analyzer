# Production Deployment Guide

> **Note:** Authoritative deploy config is `render.yaml`.
> This doc covers generic infrastructure patterns.
> Service names, build commands, and env flags below reflect the current Debrief stack.

This guide covers deploying **Debrief** to production environments.

## Prerequisites

- PostgreSQL database (managed service recommended: RDS, Cloud SQL, or Neon)
- Reverse proxy capable server (nginx recommended)
- Domain with SSL/TLS certificate
- Minimum 2GB RAM, 2 CPU cores, 20GB storage

## Server Binding & Networking

### Port Configuration

The Debrief API process binds to a single port for web traffic (API + static SPA):

- **Default**: Port `5000`
- **Configurable**: Set `PORT` environment variable
- **Host**: Binds to `0.0.0.0` (all interfaces) by default
- **Override**: Set `HOST` environment variable

**Important**: In production, invalid `PORT` values cause fail-fast startup errors.

### Startup Boot Report

On successful startup, Debrief emits a structured JSON log line:

```json
{
  "timestamp": "2026-02-17T00:00:00.000Z",
  "app_version": "1.0.0",
  "node_env": "production",
  "host": "0.0.0.0",
  "port": 5000,
  "db_configured": true,
  "ci_enabled": true,
  "semantic_enabled": false
}
```

Use this for monitoring and observability.

### Architecture

```
Internet → Reverse Proxy (nginx/caddy) → Debrief API (port 5000)
             (TLS termination)              (HTTP only)
```

### Runtime processes (API + optional BullMQ worker)

```
API service:    node dist/index.cjs   (DEBRIEF_RUN_ANALYZER_WORKER=0)
Worker service: node dist/worker.cjs  (DEBRIEF_RUN_ANALYZER_WORKER=1, DEBRIEF_USE_BULLMQ=1)
```

Run a **separate** worker process (or Render worker service) when using Redis-backed analysis queues. The API alone does not drain `debrief-analyzer` jobs unless you colocate the worker (not typical in production).

### Database schema

Apply the Drizzle schema to Postgres from the repo root (no separate `migrate` CLI):

```
npm run db:push
```

Requires `DATABASE_URL`. Take a backup before pushing against production if you are risk-averse.

### Feature flags (evidence chain and queue)

```
DEBRIEF_CHAIN_ENABLED=true      — enables receipt chain and scheduled targets tables
DEBRIEF_SCHEDULER_ENABLED=true  — enables cron scheduler (requires DEBRIEF_CHAIN_ENABLED and BullMQ)
DEBRIEF_USE_BULLMQ=1            — enables Redis queue (requires REDIS_URL)
```

**Never expose port 5000 directly to the internet.** Always use a reverse proxy for:
- TLS/SSL termination
- Rate limiting
- DDoS protection
- Load balancing (if multiple instances)

## Deployment Options

### Option 1: Docker Compose (Recommended)

#### 1. Create Production Environment File

Create `.env.production`:

```bash
# Required
DATABASE_URL=postgresql://user:password@db-host:5432/debrief
API_KEY=<generate-with-openssl-rand-hex-32>
NODE_ENV=production
PORT=5000

# GitHub Integration (if using webhooks)
GITHUB_WEBHOOK_SECRET=<your-webhook-secret>
GITHUB_TOKEN=<github-pat-for-private-repos>

# Optional
CI_TMP_DIR=/tmp/ci
ANALYZER_TIMEOUT_MS=600000
```

#### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    image: ghcr.io/swixixle/debrief:latest
    # Or build locally:
    # build: .
    ports:
      - "5000:5000"
    env_file:
      - .env.production
    volumes:
      - ./out:/app/out
      - ci-tmp:/tmp/ci
    restart: unless-stopped
    depends_on:
      - db
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/ci/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: debrief
      POSTGRES_USER: debrief_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:
  ci-tmp:
```

#### 3. Deploy

```bash
docker-compose up -d
docker-compose logs -f app
```

### Option 2: Systemd + Nginx

#### 1. Build the Application

```bash
cd /opt/debrief
npm install --production
npm run build
```

#### 2. Create Systemd Service

Create `/etc/systemd/system/debrief.service`:

```ini
[Unit]
Description=Debrief API Service
After=network.target postgresql.service

[Service]
Type=simple
User=debrief
WorkingDirectory=/opt/debrief
Environment="NODE_ENV=production"
Environment="PORT=5000"
EnvironmentFile=/opt/debrief/.env.production
ExecStart=/usr/bin/node /opt/debrief/dist/index.cjs
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=debrief

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/debrief/out /tmp/ci

[Install]
WantedBy=multi-user.target
```

#### 3. Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable debrief
sudo systemctl start debrief
sudo systemctl status debrief
```

#### 4. Configure Nginx Reverse Proxy

Create `/etc/nginx/sites-available/debrief`:

```nginx
upstream debrief_upstream {
    server 127.0.0.1:5000;
    keepalive 64;
}

server {
    listen 80;
    server_name pta.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name pta.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/pta.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pta.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Increase timeout for analyzer operations
    proxy_read_timeout 600s;
    proxy_connect_timeout 600s;
    proxy_send_timeout 600s;

    # Request size limits
    client_max_body_size 100M;

    location / {
        proxy_pass http://debrief_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support for real-time updates
    location /ws {
        proxy_pass http://debrief_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

#### 5. Enable Nginx Configuration

```bash
sudo ln -s /etc/nginx/sites-available/debrief /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Option 3: Cloud Platform Deployment

#### AWS Elastic Beanstalk

1. Create `Procfile`:
```
web: npm start
```

2. Deploy:
```bash
eb init -p node.js-18 debrief
eb create prod-env
eb deploy
```

#### Google Cloud Run

```bash
gcloud run deploy debrief \
  --source . \
  --platform managed \
  --region us-central1 \
  --set-env-vars NODE_ENV=production,DATABASE_URL=$DATABASE_URL,API_KEY=$API_KEY
```

#### Heroku

```bash
heroku create debrief-prod
heroku addons:create heroku-postgresql:mini
heroku config:set NODE_ENV=production API_KEY=$(openssl rand -hex 32)
git push heroku main
```

## TLS/HTTPS Enforcement

Debrief includes production startup checks that enforce HTTPS by default.

### Disable HTTPS Check (Not Recommended)

Only if running behind a trusted reverse proxy that handles TLS:

```bash
FORCE_HTTP=true npm start
```

**Warning:** Never use `FORCE_HTTP=true` in production without a reverse proxy handling TLS termination.

## Post-Deployment Verification

### 1. Health Check

```bash
curl https://pta.yourdomain.com/api/ci/health
```

### 2. Test Analysis (with API key)

```bash
curl -X POST https://pta.yourdomain.com/api/ci/enqueue \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"owner":"octocat","repo":"Hello-World","ref":"main"}'
```

### 3. Monitor Logs

**Docker:**
```bash
docker-compose logs -f app
```

**Systemd:**
```bash
journalctl -u debrief -f
```

## Monitoring & Maintenance

### Database Backup Schedule

See [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) for backup procedures.

### Log Rotation

Configure log rotation for analyzer logs:

Create `/etc/logrotate.d/debrief`:

```
/opt/debrief/out/_log/*.ndjson {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 debrief debrief
    sharedscripts
    postrotate
        systemctl reload debrief > /dev/null 2>&1 || true
    endscript
}
```

### Resource Monitoring

Monitor these metrics:
- CPU usage (should stay < 80% under load)
- Memory usage (baseline ~500MB, peak ~2GB during analysis)
- Disk usage (`out/ci/` directory growth)
- Database connections (pool size)
- CI job queue depth

### Cleanup Old Analysis Results

```bash
# Remove CI runs older than 30 days
find /opt/debrief/out/ci -type d -mtime +30 -exec rm -rf {} +
```

## Scaling Considerations

### Horizontal Scaling

Debrief can run multiple API instances with shared PostgreSQL:

1. Use a load balancer (nginx, HAProxy, AWS ALB)
2. Ensure shared database is accessible from all instances
3. Use shared storage for `out/ci/` or configure per-instance directories
4. The CI worker uses database-level job leasing for concurrency safety

### Vertical Scaling

- **2GB RAM**: Handles 1-2 concurrent analyses
- **4GB RAM**: Handles 3-5 concurrent analyses
- **8GB RAM**: Handles 6-10 concurrent analyses

Adjust `ANALYZER_TIMEOUT_MS` based on repository sizes.

## Security Best Practices

1. **Never expose without TLS** in production
2. **Rotate API_KEY** regularly (quarterly minimum)
3. **Use managed PostgreSQL** with encryption at rest
4. **Enable database SSL** connections
5. **Restrict database access** to application IP ranges
6. **Set strong `GITHUB_WEBHOOK_SECRET`** (32+ characters)
7. **Use read-only `GITHUB_TOKEN`** when possible
8. **Monitor failed authentication attempts** in logs
9. **Keep dependencies updated** (run `npm audit` weekly)

## Troubleshooting

### Service won't start

Check logs and verify:
- DATABASE_URL is correct and database is accessible
- API_KEY is set and >= 32 characters
- Node.js version is 18+

### "HTTPS required in production"

Either:
1. Set up proper TLS termination (recommended)
2. Temporarily set `FORCE_HTTP=true` (only behind trusted proxy)

### High memory usage

- Check for stuck analyzer processes: `ps aux | grep debrief` or `ps aux | grep analyzer_cli`
- Verify `ANALYZER_TIMEOUT_MS` is set (default: 600000ms)
- Consider reducing concurrent CI jobs

### Database connection errors

- Verify DATABASE_URL connection string
- Check PostgreSQL is running and accessible
- Ensure connection pool limits aren't exceeded

## Support

For issues and questions:
- GitHub Issues: https://github.com/Swixixle/debrief/issues
- Documentation: https://github.com/Swixixle/debrief/tree/main/docs
