# Social Awareness Web App (ACS) – Full Stack

```
social-awareness-app/
├── frontend/   HTML, CSS and JavaScript single page app (calls the API)
└── backend/    Node.js + Express + SQLite REST API (also serves the frontend)
```

## Run
```
cd backend
npm install
cp .env.example .env      # set JWT_SECRET and ADMIN_PASSWORD
npm start
```
Open http://localhost:3000. One server hosts both the website and the API (/api).
Demo admin on first run: `admin@acs.test` / `admin123` (change in `.env` before the first start).

Run the API checks with `npm test` inside `backend`.

## What it does (from the project charter)
- Register, log in, edit profile; roles: user, business owner, admin
- Browse, search and filter causes; support a cause
- Create campaigns (pending until an admin approves)
- Business listings and enquiries (leads) for business owners
- Admin: approve or reject campaigns, remove users

## Security notes
Passwords are hashed with bcrypt, login uses signed tokens, roles are enforced on the server, input is validated, and auth routes are rate limited. For deployment set `NODE_ENV=production`, a strong `JWT_SECRET`, and serve over HTTPS.

## Not included yet (charter Should/Could items)
Password recovery, email notifications, reported-content review, automated backups, cloud deployment scripts.
