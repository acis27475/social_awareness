# Social Awareness Web App – Front-End Prototype

Client: Advanced Consulting Services (ACS) · Project Manager: Ram Prasad Thapaliya
Methodology: Prototype Development Model · Version 1.0

A Single Page Application (SPA) built with plain HTML, CSS and JavaScript. No build step or install needed.

## Run it
Open `index.html` in a modern browser (Chrome, Firefox, Edge, Safari).
Optional local server: `python3 -m http.server 8000` then visit http://localhost:8000

## Folder structure
```
social-awareness-frontend/
├── index.html      page shell (header, main, footer)
├── css/styles.css  styling, responsive layout, light/dark theme
├── js/data.js      constants and seed data (stand-in for a database)
├── js/app.js       state, views, routing, forms, admin actions
└── README.md
```

## Features (from the project charter)
- Home with featured campaigns and business promotions
- Register, login, logout, profile editing
- Browse, search and filter causes; support a cause
- Create campaigns (pending until admin approval)
- Business profiles, listings and enquiry (lead) capture
- Admin: approve/reject campaigns, remove users

## Demo login
Admin: `admin@acs.test` / `admin123`

## Notes
- Data is saved in the browser (localStorage) only; there is no backend yet.
- Passwords are stored unencrypted in this prototype. Do not use real ones.
- Next stages: connect to the back-end API and database, HTTPS, password recovery, email notifications, cloud deployment.
- Out of scope per charter: payments, live chat, AI recommendations, multilingual support, native apps.
