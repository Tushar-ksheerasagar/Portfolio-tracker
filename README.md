# Portfolio Tracker

A full-stack portfolio analytics application with authentication, CSV import, live pricing, portfolio dashboard insights, stock charts, recommendation data, and news sentiment analysis.

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, Framer Motion, Recharts
- Backend: FastAPI, Uvicorn, Psycopg2, JWT (python-jose), Passlib
- Data Sources: PostgreSQL, Yahoo Finance, VADER Sentiment

## Features

- User registration and login with JWT auth
- Per-user portfolio storage in PostgreSQL
- CSV upload with validation
- Real-time stock price lookup (Yahoo Finance with DB fallback)
- Dashboard with P/L metrics, sector allocation, top holdings
- Company details with financial statements and ratios
- Stock recommendation endpoint
- News sentiment endpoint (VADER-based BUY/SELL/HOLD signal)
- Cached responses for chart/details/recommendation/sentiment APIs

## Project Structure

```
portfolio tracker/
├─ src/                     # React frontend
├─ fastapi_backend/         # FastAPI backend
├─ uploads/                 # Uploaded files (gitignored)
├─ postgres_prerequisites.txt
└─ README.md
```

## Prerequisites

- Node.js 18+
- npm 9+
- Python 3.10+
- PostgreSQL 13+

## PostgreSQL Setup

Run the SQL in `postgres_prerequisites.txt` before starting the app.

This script includes:

- Role and database creation
- Required tables
- Indexes
- `company_name` support in financial tables
- Backfill and trigger logic
- Minimal seed data in `stock_info`

## Environment Variables (Backend)

Create `fastapi_backend/.env`:

```env
DB_HOST=localhost
DB_NAME=capstone_db
DB_USER=postgres
DB_PASSWORD=1234
DB_PORT=5432

JWT_SECRET_KEY=change-this-in-production
JWT_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

## Install and Run

### 1) Clone

```bash
git clone https://github.com/Tushar-ksheerasagar/Portfolio-tracker.git
cd Portfolio-tracker
```

### 2) Start Backend (FastAPI)

```bash
cd fastapi_backend
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies and run:

```bash
pip install -r requirements.txt
python main.py
```

Backend runs on: `http://localhost:5000`

### 3) Start Frontend (Vite)

Open a new terminal at project root:

```bash
npm install
npm run dev
```

Frontend runs on: `http://localhost:5173`

## CSV Upload Format

Required columns:

- `company_name` (or `symbol`)
- `quantity` (positive integer)
- `buy_price` (positive number)

Example:

```csv
company_name,quantity,buy_price
Reliance Industries,10,2450.50
TCS,5,3680.00
Infosys,8,1525.75
```

## API Endpoints (Main)

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /upload` (auth required)
- `GET /portfolio` (auth required)
- `POST /refresh-portfolio`
- `GET /company-details/{symbol}`
- `GET /stock-chart/{symbol}`
- `GET /live-quote/{symbol}`
- `GET /recommendation/{symbol}`
- `GET /sentiment/{symbol}`

## Notes

- Frontend API base URL defaults to `/api` and can be overridden with `VITE_API_BASE_URL`.
- Keep secrets out of Git (do not commit `.env`).
- Default CORS is permissive for development; restrict for production.

## Troubleshooting

- 401 Unauthorized: login again and verify token is present in local storage.
- Upload company not found: ensure company/symbol exists in `stock_info`.
- DB connection error: verify PostgreSQL service and `.env` values.
- Empty analytics: ensure financial tables are populated.
