# Hospital Management System

Full-stack MERN app: **React.js** frontend, **Node.js + Express** REST API, **MongoDB** (Mongoose), **JWT** authentication with **role-based authorization**.

## Roles
| Role | Can do |
|---|---|
| patient | Register publicly, view own record and clinical notes, book / cancel own appointments |
| doctor | View own appointments (complete / cancel), search patients, read records, add clinical notes |
| admin | See all appointments, manage patients (delete), create doctor/admin accounts |

Public registration always creates a **patient**; staff accounts are created by an admin (first admin via `npm run seed`).

## Security & reliability
- Passwords hashed with bcrypt (cost 12); JWT (8h) verified on every request and the user is re-loaded so deleted users lose access.
- `authorize(...roles)` middleware on every protected route; patients can only read their own record.
- Input validation (express-validator) on all write endpoints, ObjectId validation, regex-escaped search.
- helmet, CORS allow-list, request body limit, rate limiting on `/api/auth`.
- Structured JSON logging (winston): requests, logins (success/fail), bookings, status changes, unhandled errors. Central error handler returns clean JSON errors.
- Double-booking prevention for a doctor's time slot (cancelled slots can be rebooked).

## API
`POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me`
`GET /api/users/doctors` · `POST /api/users` (admin)
`GET /api/patients` · `GET /api/patients/me` · `GET|PUT|DELETE /api/patients/:id` · `POST /api/patients/:id/notes`
`POST /api/appointments` · `GET /api/appointments` · `PATCH /api/appointments/:id/status`

## Run locally
```bash
# backend (needs MongoDB running locally or set MONGO_URI)
cd backend && cp .env.example .env && npm install
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=ChangeMe123 npm run seed
npm run dev                  # http://localhost:5000

# frontend
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## Docker
```bash
JWT_SECRET=$(openssl rand -hex 32) docker compose up --build   # UI on http://localhost:8080
docker compose exec -e ADMIN_EMAIL=admin@example.com -e ADMIN_PASSWORD=ChangeMe123 backend node src/seed.js
```

## Tests
```bash
cd backend && npm test    # 16 tests; uses an in-memory MongoDB (downloads a binary on first run)
```

## Deploy
- **Database:** MongoDB Atlas (free tier) → `MONGO_URI`.
- **Backend:** Render / Railway (root `backend`, start `npm start`; set `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGIN`).
- **Frontend:** Vercel / Netlify (root `frontend`); add a rewrite from `/api/*` to the backend URL.
