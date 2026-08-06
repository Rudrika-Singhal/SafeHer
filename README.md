# 🛡️ SafeHer — With you, every step

A smart safety platform that helps women instantly alert trusted contacts and authorities during emergencies — with real AI, real location tracking, and real-time safe-route planning.

Built for HACKDAYS under the problem statement: **Women Safety & Security**.

---

## 🚨 The Problem

Existing safety apps typically offer only a panic button + location share. They fall short on:
- Working reliably when connectivity is poor
- Suggesting *safe* routes, not just the fastest ones
- Discreet ways to exit unsafe situations without confrontation
- Proactively checking in, instead of only reacting after something goes wrong

**SafeHer** addresses all of these with a fully working, end-to-end prototype — not just a UI mockup.

---

## ✨ Features

### Core
- 🔐 Real signup/login with Firebase Authentication + Firestore
- 🆘 One-tap SOS with live GPS location + readable address
- 🤖 AI-generated emergency alert messages (Groq)
- 📩 Real SMS delivery to trusted contacts (Twilio)
- 📞 Quick-dial emergency helplines (112 / 1091 / 181)

### Unique / Differentiators
- 🗺️ **Real Safest-Route Planning** — actual road routing (OSRM) scored by nearby footfall/amenity density (Overpass API), color-coded Green/Yellow/Red
- ⏱️ **Missed Check-In System** — auto-triggers a real SOS if the user doesn't confirm safety within an expected arrival window
- 📍 **Real Nearby Police/Hospital Finder** — live OpenStreetMap data, searchable by any location
- 💬 **AI Safety Chatbot** — real conversational assistant (Groq) that can trigger SOS mid-conversation if it detects danger
- 🎭 **Fake Exit** — instantly disguises the screen as a weather app
- 📞 **Fake Incoming Call** — simulates a realistic incoming call (with ringtone) to help exit uncomfortable situations
- 🎙️ **Voice-Triggered SOS** — say a safe word, and SOS fires automatically, hands-free
- 📡 **Offline Awareness** — detects lost connectivity, warns the user clearly, and auto-retries a failed alert once back online

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript (vanilla) |
| Maps & Routing | Leaflet.js + OpenStreetMap, OSRM, Overpass API, Photon/Nominatim |
| Auth & Database | Firebase Authentication + Firestore |
| Backend | Node.js + Express |
| AI (messages + chatbot) | Groq API |
| SMS | Twilio |

---

## 📂 Project Structure

```
SafeHer/
├── index.html          # App structure/UI
├── style.css            # Styling
├── script.js             # All frontend logic (auth, maps, SOS, chatbot, voice)
└── server/
    ├── server.js         # Backend — Groq AI + Twilio SMS
    ├── package.json
    └── .env.example      # Template for your own API keys (never commit real .env)
```

---

## ⚙️ Setup & Run Locally

### 1. Frontend
Open `index.html` with a local server (e.g. VS Code's **Live Server** extension). A real Firebase project's config is already wired into `script.js` — replace with your own project's keys if forking this repo.

### 2. Backend
```bash
cd server
npm install
cp .env.example .env   # then fill in your own keys
npm start
```
Required keys in `.env`:
```
GROQ_API_KEY=       # https://console.groq.com
TWILIO_SID=          # https://console.twilio.com
TWILIO_AUTH_TOKEN=
TWILIO_PHONE=
```

The app works in a graceful **demo/fallback mode** even without these keys — AI messages fall back to templates, and SMS sending is simulated, so the UI never breaks.

---

## 🎯 What Makes This Different

Most hackathon safety-app submissions are UI mockups. SafeHer is a **fully working prototype** — real GPS, real AI, real SMS, real routing — end to end, not simulated.

---

## 🚧 Known Limitations (and why)

- As a website (not a native app), it requires the browser tab to stay open for continuous location tracking — mitigated with a clear "Journey Mode."
- True zero-internet SOS sending isn't technically possible for any website (browsers don't allow silent background SMS) — mitigated with offline detection, clear manual-call guidance, and auto-retry once reconnected.

---

## 🔮 Future Scope

- Native mobile app for true background tracking
- Bluetooth mesh relay for zero-network areas
- Verified community "guardian" responder network
- Image/audio-based threat detection during evidence recording

---

## 📄 License

This project was built for HACKDAYS DELHI.
