# 🚀 Deployment Guide - AgentPulse Public Version

Kompleksowy przewodnik po wdrożeniu AgentPulse jako publicznej aplikacji webowej.

**Autor:** Toniacz.log

## 📋 Spis treści

1. [Przygotowanie do deploymentu](#przygotowanie)
2. [Deployment na różnych platformach](#platformy)
3. [Konfiguracja domeny](#domena)
4. [Bezpieczeństwo](#bezpieczeństwo)
5. [Skalowanie](#skalowanie)
6. [Monitoring](#monitoring)

---

## 🔧 Przygotowanie

### Struktura projektu

```
agentpulse-public/
├── public-frontend/
│   ├── index.html
│   └── app.js
├── public-server.js
├── package.json
├── .gitignore
└── README.md
```

### Aktualizacja package.json

```json
{
  "name": "agentbar-public",
  "version": "1.0.0",
  "description": "Public AgentBar - AI Agents Monitor",
  "main": "public-server.js",
  "scripts": {
    "start": "node public-server.js",
    "dev": "nodemon public-server.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "openai": "^4.68.0",
    "@google/generative-ai": "^0.21.0",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "ws": "^8.14.2"
  }
}
```

---

## 🌐 Platformy Deploymentu

### 1. Railway (⭐ REKOMENDOWANE - Najłatwiejsze)

**Dlaczego Railway:**
- ✅ Automatyczne HTTPS
- ✅ Wsparcie dla WebSocket
- ✅ Darmowy tier (500h/miesiąc)
- ✅ Łatwe zarządzanie zmiennymi środowiskowymi

**Kroki:**

1. **Zainstaluj Railway CLI**
```bash
npm install -g @railway/cli
```

2. **Zaloguj się**
```bash
railway login
```

3. **Inicjalizuj projekt**
```bash
railway init
```

4. **Deploy**
```bash
railway up
```

5. **Dodaj domenę (opcjonalnie)**
```bash
railway domain
```

**Ważne:** Railway automatycznie wykrywa Node.js i uruchamia `npm start`

---

### 2. Heroku

**Kroki:**

1. **Zainstaluj Heroku CLI**
```bash
npm install -g heroku
```

2. **Zaloguj się**
```bash
heroku login
```

3. **Utwórz aplikację**
```bash
heroku create agentpulse-yourname
```

4. **Deploy**
```bash
git push heroku main
```

5. **Włącz WebSocket (Heroku automatycznie wspiera)**
```bash
heroku ps:scale web=1
```

**Procfile** (utwórz ten plik):
```
web: node public-server.js
```

---

### 3. Render.com

**Kroki:**

1. Połącz GitHub repo z Render
2. Wybierz "Web Service"
3. Konfiguracja:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free

**render.yaml** (opcjonalnie):
```yaml
services:
  - type: web
    name: agentpulse
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

---

### 4. VPS (DigitalOcean, Linode, AWS EC2)

**Dla zaawansowanych użytkowników**

#### Ubuntu Setup:

```bash
# Aktualizuj system
sudo apt update && sudo apt upgrade -y

# Zainstaluj Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Zainstaluj PM2 (process manager)
sudo npm install -g pm2

# Sklonuj repo
git clone your-repo.git
cd agentbar-public

# Zainstaluj zależności
npm install

# Uruchom z PM2
pm2 start public-server.js --name agentpulse
pm2 save
pm2 startup
```

#### Nginx Reverse Proxy:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### SSL z Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 🌍 Konfiguracja Domeny

### Cloudflare (Rekomendowane)

**Zalety:**
- ✅ Darmowy SSL
- ✅ DDoS protection
- ✅ CDN
- ✅ Wsparcie dla WebSocket

**Kroki:**

1. Dodaj domenę do Cloudflare
2. Zaktualizuj nameservery u rejestratora
3. Dodaj rekord DNS:
   ```
   Type: A
   Name: @
   Content: [IP twojego serwera]
   Proxy: ✅ Proxied
   ```
4. Włącz **WebSocket** w Cloudflare:
   - Network → WebSockets: ON

---

## 🔒 Bezpieczeństwo

### 1. Rate Limiting

Dodaj do `public-server.js`:

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minut
    max: 100 // max 100 requestów na IP
});

app.use('/api/', limiter);
```

### 2. CORS Configuration

```javascript
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',') 
        : '*',
    credentials: true
};

app.use(cors(corsOptions));
```

### 3. Helmet.js (Security Headers)

```bash
npm install helmet
```

```javascript
const helmet = require('helmet');
app.use(helmet());
```

### 4. Input Validation

```bash
npm install express-validator
```

```javascript
const { body, validationResult } = require('express-validator');

app.post('/api/task/:sessionId/:agentId',
    body('prompt').trim().isLength({ min: 1, max: 5000 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        // ... rest of code
    }
);
```

### 5. Environment Variables

**Nigdy nie commituj:**
- Żadnych kluczy API
- Secrets
- Passwords

Użyj `.env` lokalnie i zmiennych środowiskowych na produkcji.

---

## 📊 Skalowanie

### Redis dla Session Storage

Zamiast `Map()` w pamięci:

```bash
npm install redis
```

```javascript
const redis = require('redis');
const client = redis.createClient({
    url: process.env.REDIS_URL
});

// Store session
await client.set(`session:${sessionId}`, JSON.stringify(sessionData));

// Get session
const data = await client.get(`session:${sessionId}`);
```

### Load Balancing

Dla wysokiego ruchu użyj:
- Railway: Automatyczne skalowanie
- Heroku: Dynos
- Nginx: Upstream servers
- Cloudflare: Load balancing

---

## 📈 Monitoring

### 1. Application Monitoring

**New Relic** (darmowy tier):
```bash
npm install newrelic
```

### 2. Error Tracking

**Sentry**:
```bash
npm install @sentry/node
```

```javascript
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN });
```

### 3. Uptime Monitoring

- **UptimeRobot** (darmowy)
- **Pingdom**
- **StatusCake**

### 4. Logs

PM2 logs:
```bash
pm2 logs agentpulse
```

Railway logs:
```bash
railway logs
```

---

## 🔄 CI/CD

### GitHub Actions

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Railway

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install Railway
        run: npm install -g @railway/cli
      - name: Deploy
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

## 💰 Koszty

### Railway
- Free: 500h/miesiąc (~$5 kredytu)
- Pro: $20/miesiąc

### Heroku
- Free: Przestarzałe (już nie oferowane)
- Eco: $5/miesiąc
- Basic: $7/miesiąc

### Render
- Free: 750h/miesiąc
- Starter: $7/miesiąc

### VPS
- DigitalOcean: od $6/miesiąc
- Linode: od $5/miesiąc

---

## ✅ Checklist przed Deployment

- [ ] Testy lokalne przeszły pomyślnie
- [ ] `.env` nie jest w repo
- [ ] `.gitignore` jest skonfigurowane
- [ ] Rate limiting włączony
- [ ] HTTPS/SSL skonfigurowane
- [ ] WebSocket działa
- [ ] Error handling zaimplementowany
- [ ] Monitoring skonfigurowany
- [ ] Backup strategy określona
- [ ] Dokumentacja zaktualizowana

---

## 🆘 Troubleshooting

### WebSocket nie działa
- Sprawdź czy Cloudflare ma włączone WebSocket
- Upewnij się że reverse proxy przekazuje `Upgrade` header

### Sesje się gubią
- Zaimplementuj Redis dla persystencji
- Zwiększ timeout sesji

### Wolne response times
- Dodaj caching
- Optymalizuj API calls
- Rozważ CDN

---

## 📚 Dodatkowe Zasoby

- [Railway Docs](https://docs.railway.app/)
- [Heroku Node.js Guide](https://devcenter.heroku.com/articles/getting-started-with-nodejs)
- [Let's Encrypt](https://letsencrypt.org/)
- [Cloudflare Docs](https://developers.cloudflare.com/)

---

**Powodzenia! 🚀**

Masz pytania? Otwórz issue na GitHub!
