# 🤖 AgentPulse - Public Version

Profesjonalna aplikacja webowa do monitorowania agentów AI (Claude, GPT-4, Gemini) z możliwością użycia własnych kluczy API przez użytkowników.

**Autor:** Toniacz.log

## ✨ Funkcje

- ✅ **Multi-user Support** - Każdy użytkownik ma własną sesję
- ✅ **Własne klucze API** - Użytkownicy dostarczają swoje klucze
- ✅ **Real-time monitoring** - WebSocket do aktualizacji na żywo
- ✅ **Bezpieczne przechowywanie** - Klucze tylko w pamięci serwera
- ✅ **Tracking kosztów** - Monitorowanie tokenów i wydatków
- ✅ **Porównywanie modeli** - Testuj wszystkie AI jednocześnie
- ✅ **Minimalistyczny UI** - Przejrzysty interfejs

## 🚀 Szybki Start (Lokalne uruchomienie)

### 1. Instalacja

```bash
npm install
```

### 2. Uruchomienie

```bash
npm start
```

### 3. Otwórz przeglądarkę

```
http://localhost:3000
```

### 4. Skonfiguruj klucze API

Kliknij **"Skonfiguruj klucze API"** i dodaj przynajmniej jeden klucz:
- Claude: https://console.anthropic.com/
- OpenAI: https://platform.openai.com/
- Google AI: https://makersuite.google.com/app/apikey

## 🌐 Deployment na własnej domenie

Zobacz [DEPLOYMENT.md](./DEPLOYMENT.md) dla szczegółowego przewodnika.

### Szybki deploy na Railway (NAJŁATWIEJSZE):

```bash
# Zainstaluj Railway CLI
npm install -g @railway/cli

# Zaloguj się
railway login

# Deploy
railway init
railway up

# Dodaj domenę (opcjonalnie)
railway domain
```

Gotowe! Twoja aplikacja działa na HTTPS z automatycznym SSL! 🎉

## 🔒 Bezpieczeństwo

### Klucze API użytkowników

- ✅ Przechowywane **tylko w pamięci** serwera (RAM)
- ✅ **NIE są zapisywane** na dysku
- ✅ Sesja wygasa po **1 godzinie** bezczynności
- ✅ Automatyczne czyszczenie nieaktywnych sesji
- ✅ Każdy użytkownik ma **izolowaną** sesję

### Zalecane dodatkowe zabezpieczenia dla produkcji:

1. **Rate Limiting** - Ogranicz liczbę requestów
2. **HTTPS** - Zawsze używaj SSL/TLS
3. **Helmet.js** - Bezpieczne HTTP headers
4. **Input Validation** - Walidacja danych wejściowych
5. **Redis** - Zamiast pamięci dla sesji (skalowanie)

Zobacz [DEPLOYMENT.md](./DEPLOYMENT.md) sekcja "Bezpieczeństwo".

## 📖 Jak używać

### Dla użytkowników końcowych:

1. **Otwórz aplikację** w przeglądarce
2. **Kliknij "Skonfiguruj klucze API"**
3. **Wklej swoje klucze** (przynajmniej jeden)
4. **Zapisz** - klucze są zapamiętane w sesji
5. **Testuj AI** - wpisz prompt i wybierz model
6. **Porównuj** - wyślij do wszystkich modeli naraz

### Dla administratorów:

- **Monitoring** - Obserwuj logi serwera
- **Skalowanie** - Użyj Redis dla większego ruchu
- **Backup** - Regularnie backupuj kod
- **Updates** - Aktualizuj zależności npm

## 💰 Koszty

### Hosting

**Darmowe opcje:**
- Railway: 500h/miesiąc gratis
- Render: 750h/miesiąc gratis

**Płatne (jeśli potrzebujesz więcej):**
- Railway Pro: $20/miesiąc
- VPS (DigitalOcean): od $6/miesiąc

### API (użytkownicy płacą za swoje użycie)

Użytkownicy używają **swoich kluczy API**, więc:
- **Ty nie płacisz** za API calls
- **Użytkownicy płacą** według swojego użycia
- Zobacz cenniki: [Claude](https://www.anthropic.com/pricing), [OpenAI](https://openai.com/pricing), [Gemini](https://ai.google.dev/pricing)

## 🛠️ Struktura Projektu

```
agentpulse-public/
├── public-server.js          # Backend (Express + WebSocket)
├── public-frontend/
│   ├── index.html            # Frontend UI
│   └── app.js                # Frontend logic
├── package.json              # Dependencies
├── DEPLOYMENT.md             # Deployment guide
└── README.md                 # Ten plik
```

## 🔧 API Endpoints

### POST `/api/session/keys`
Zapisz klucze API użytkownika
```json
{
  "sessionId": "session_abc123",
  "apiKeys": {
    "anthropic": "sk-ant-...",
    "openai": "sk-...",
    "google": "AI..."
  }
}
```

### GET `/api/session/:sessionId`
Pobierz status sesji

### POST `/api/task/:sessionId/:agentId`
Wyślij zadanie do konkretnego agenta

### POST `/api/task/:sessionId/all`
Wyślij zadanie do wszystkich skonfigurowanych agentów

### POST `/api/reset/:sessionId`
Resetuj statystyki sesji

## 📊 Monitoring

### Logi lokalne

```bash
# Jeśli używasz PM2
pm2 logs agentbar

# Standardowy node
npm start  # Logi w konsoli
```

### Logi w chmurze

```bash
# Railway
railway logs

# Heroku
heroku logs --tail
```

## 🐛 Troubleshooting

### Problem: WebSocket nie działa
**Rozwiązanie:** Upewnij się że reverse proxy (Nginx/Cloudflare) przekazuje `Upgrade` header

### Problem: Sesje się gubią
**Rozwiązanie:** Zaimplementuj Redis zamiast Map() w pamięci

### Problem: "API key not configured"
**Rozwiązanie:** Użytkownik musi dodać klucze API w ustawieniach

### Problem: Wolne odpowiedzi
**Rozwiązanie:** Sprawdź czy klucze API są poprawne, sprawdź rate limity

## 🤝 Wkład w projekt

Pull requesty są mile widziane! Dla większych zmian, najpierw otwórz issue.

## 📄 Licencja

MIT License - możesz swobodnie używać i modyfikować.

## 🆘 Wsparcie

- 📧 Email: your-email@example.com
- 💬 GitHub Issues: [Otwórz issue](../../issues)
- 📚 Docs: Zobacz [DEPLOYMENT.md](./DEPLOYMENT.md)

## 🙏 Podziękowania

Stworzone przy użyciu:
- [Anthropic Claude](https://www.anthropic.com/)
- [OpenAI GPT-4](https://openai.com/)
- [Google Gemini](https://ai.google.dev/)

---

**Autor: Toniacz.log**

**Stworzono z ❤️ dla społeczności AI**
