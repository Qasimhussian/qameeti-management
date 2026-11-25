# Qameeti Manager

A professional admin-only committee draw management starter built with HTML, CSS, Bootstrap 5, vanilla JavaScript, Node.js, Express and MongoDB.

## Features
- Admin-only login using bcrypt password hashing and HttpOnly JWT cookie
- Dashboard with committee and draw summaries
- Create committees with admin-defined month names and order
- Add members to a committee
- Full committee draw: secure random shuffle assigns unique members to available months
- Monthly draw: one random eligible member for the next pending month
- Server-side random selection using Node.js `crypto.randomInt`
- MongoDB transaction-based draw persistence
- Unique database indexes prevent duplicate member winners and duplicate month assignments
- Draw history and PDF result export
- Responsive Bootstrap admin interface

## Requirements
- Node.js 18+
- MongoDB replica set (MongoDB Atlas works). Transactions require replica-set support.
- npm

## Setup
1. Extract the ZIP.
2. Open the project folder in terminal.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy `.env.example` to `.env` and set:
   - `MONGODB_URI`
   - `JWT_SECRET` (use a long random secret)
   - `COOKIE_SECURE=true` in production behind HTTPS
5. Create the first admin:
   ```bash
   npm run create-admin
   ```
   The script prompts for username and password.
6. Start:
   ```bash
   npm run dev
   ```
7. Open `http://localhost:5000`.

The Express server serves the frontend from `frontend/`, so you do not need Live Server.

## Important deployment notes
- Deploy behind HTTPS and set `COOKIE_SECURE=true`.
- Restrict MongoDB network access and use a dedicated database user.
- Keep `.env` private. Never commit secrets.
- Configure regular database backups.
- Draws are persisted before the wheel reveal animation. The wheel is presentation only; the server determines the result.
- Do not use standalone MongoDB for this app's draw transactions; use Atlas or a replica-set deployment.
- The app intentionally does not include installment/payment management.

## Draw rules
- One committee can use one draw method. The method locks when the first draw is created.
- A member can win at most once in a committee.
- A month can be assigned at most once in a committee.
- If months are fewer than members, some members remain unselected.
- If months exceed members, draw is disabled until the configuration is corrected.
- Results are not editable through the UI. Corrections should be handled by a separately authorized audited administrative procedure.

## Project structure
```text
backend/
  config/ models/ routes/ middleware/ services/ scripts/
frontend/
  index.html
  assets/css/
  assets/js/
```
