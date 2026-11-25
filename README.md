# KLU GameZone Ultimate Esports Portal (v4 - Live Active Users & Auto-Slot Scheduler)

Features real-time tracking of currently logged-in users (count + names + online badges in the Admin Panel), automatic match-slot generation with timings as soon as 8 squads register, persistent JSON storage (`db.json` — no MongoDB required), and LAN multi-laptop support.

## Quick Start

### 1. Start Backend Server
```bash
cd server
npm install
npm start
```

### 2. Start Frontend Client
```bash
cd client
npm install
npm run dev
```

### 3. Open on Another Laptop
- Connect both laptops to the same Wi-Fi or mobile hotspot.
- Open the **Network** URL (e.g., `http://192.168.x.x:5173/`) shown in Vite's terminal.

## Default Admin Login
- **Email:** `admin@klu.edu.in`
- **Password:** `admin123`
