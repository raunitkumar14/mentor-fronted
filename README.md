# mentor-analytics-frontend

React (Vite) frontend for the CRM call-coverage dashboard. Talks to the
[mentor-analytics-backend](../backend) FastAPI service over `VITE_API_BASE`.

## Setup

```bash
npm install
cp .env.example .env   # defaults to http://localhost:8000
npm run dev
```

Requires the backend running (see its README) for `/api/owners` and
`/api/metrics` to return data.
