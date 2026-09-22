# Kanban Board — Full-Stack Project

A real-time collaborative Kanban board (like a mini-Trello). Built with:
- **Backend:** Node.js, Express, TypeScript, PostgreSQL, Prisma, JWT auth, Socket.io
- **Frontend:** React, TypeScript (to be added Day 3)

## Day 1 setup — do this now

1. **Install Postgres** if you don't have it. Easiest path: create a free database on
   [Railway](https://railway.app) or [Neon](https://neon.tech) — you'll get a `DATABASE_URL`
   instantly without installing anything locally.

2. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and paste in your real `DATABASE_URL`, and set `JWT_SECRET` to any
   random long string (e.g. run `openssl rand -hex 32` to generate one).

4. **Create the database tables:**
   ```bash
   npx prisma migrate dev --name init
   ```
   This reads `prisma/schema.prisma` and creates the actual tables in your database.

5. **Start the server:**
   ```bash
   npm run dev
   ```
   You should see `Server running on http://localhost:4000`.

6. **Test it.** Using Postman, Insomnia, or curl:
   ```bash
   curl -X POST http://localhost:4000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
   ```
   You should get back a `token` and `user` object. That's your signup working end-to-end.

   Then try logging in:
   ```bash
   curl -X POST http://localhost:4000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123"}'
   ```

7. **Bonus check:** copy the `token` from the response above and try:
   ```bash
   curl http://localhost:4000/api/me \
     -H "Authorization: Bearer PASTE_YOUR_TOKEN_HERE"
   ```
   This proves your auth middleware is protecting routes correctly.

## What you just built (in plain terms)
- A database with tables for Users, Boards, Lists, and Cards, all connected to each other
- A signup endpoint that safely stores passwords (hashed, never plain text)
- A login endpoint that checks credentials and hands back a token
- A way to "lock" routes so only logged-in users can access them

## Project roadmap
- **Day 1** ✅ Backend setup + auth (you're here)
- **Day 2** — Board/List/Card CRUD endpoints
- **Day 3** — React frontend + connect login
- **Day 4** — Board UI + drag and drop
- **Day 5** — Real-time updates with Socket.io
- **Day 6** — Invite collaborators + polish + tests
- **Day 7** — Deploy + README + resume prep

## Folder structure
```
kanban-app/
├── backend/
│   ├── prisma/schema.prisma   # database structure
│   ├── src/
│   │   ├── config/db.ts       # database connection
│   │   ├── middleware/auth.ts # protects routes
│   │   ├── routes/auth.ts     # signup/login endpoints
│   │   └── index.ts           # server entry point
│   └── .env.example
└── frontend/                  # you'll fill this in Day 3
```
