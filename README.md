# Kanbo — Real-Time Collaborative Kanban Board

A mini-Trello: create boards, add lists and cards, drag cards around, and invite teammates. Everyone on the board sees changes live.

**Live demo:** _add your Vercel link here_

## Features

- Sign up / log in with JWT authentication (passwords hashed with bcrypt)
- Boards, lists and cards with full create / edit / delete
- Drag and drop cards between lists (optimistic UI with dnd-kit)
- Real-time updates for everyone on the same board (Socket.io rooms)
- Invite collaborators by email; only board members can see or change a board
- Labels, due dates and assignees on cards
- Request validation with Zod
- API tests with Vitest + Supertest

## Tech Stack

| Layer | Tools |
|---|---|
| Frontend | React, TypeScript, Vite, React Router, Axios, dnd-kit, Socket.io client |
| Backend | Node.js, Express, TypeScript, Socket.io, Zod, JWT, bcrypt |
| Database | PostgreSQL (Neon) with Prisma ORM and migrations |
| Testing | Vitest, Supertest |
| Deployment | Vercel (frontend), Railway (backend), Neon (database) |

## How it works

```
React (Vercel) ──HTTP /api──▶ Express (Railway) ──Prisma──▶ PostgreSQL (Neon)
       ▲                            │
       └──── Socket.io "board:<id>" room ◀──┘
```

1. The frontend calls the REST API with `Authorization: Bearer <token>`.
2. Auth middleware verifies the JWT; `boardAccess` checks the user is a member of the board.
3. After a change, the server emits an event to that board's Socket.io room.
4. Other clients in the room re-fetch the board, so everyone stays in sync.

## Data model

`User`, `Board`, `BoardMember` (who can access which board), `List`, `Card`, `Label`, `CardLabel` (many-to-many between cards and labels).

## API overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create an account |
| POST | `/api/auth/login` | Log in, returns a token |
| GET | `/api/me` | Current user |
| GET / POST | `/api/boards` | List my boards / create a board |
| GET / PATCH / DELETE | `/api/boards/:boardId` | Get (with lists and cards) / rename / delete |
| POST | `/api/boards/:boardId/lists` | Add a list |
| POST / DELETE | `/api/boards/:boardId/members` | Invite / remove a collaborator |
| POST / DELETE | `/api/boards/:boardId/labels` | Create / delete a label |
| PATCH / DELETE | `/api/lists/:listId` | Rename / delete a list |
| POST | `/api/lists/:listId/cards` | Add a card |
| PATCH / DELETE | `/api/lists/cards/:cardId` | Edit or move / delete a card |
| POST / DELETE | `/api/lists/cards/:cardId/labels/:labelId` | Add / remove a label on a card |

## Run it locally

**Requirements:** Node.js 18+ and a PostgreSQL database (a free [Neon](https://neon.tech) database works).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # then fill in DATABASE_URL and JWT_SECRET
npx prisma migrate dev    # creates the tables
npm run dev               # http://localhost:4000
```

`.env` values:

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Long random string used to sign tokens |
| `PORT` | Defaults to 4000 |
| `CLIENT_URL` | Allowed frontend origin(s) for CORS, defaults to `http://localhost:5173` |

### 2. Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Set `VITE_API_URL` if the backend is not on `http://localhost:4000`.

### 3. Tests

Create `backend/.env.test` with a separate test database URL (tables are wiped before each test), then:

```bash
cd backend
npm test
```

## Project structure

```
kanban-app/
├── backend/
│   ├── prisma/              # schema.prisma + migrations
│   └── src/
│       ├── config/db.ts     # Prisma client
│       ├── middleware/auth.ts
│       ├── routes/          # auth, boards, lists (+ cards)
│       ├── utils/boardAccess.ts
│       ├── socket.ts        # Socket.io rooms per board
│       ├── test/            # Vitest + Supertest
│       └── index.ts
└── frontend/
    └── src/
        ├── api/             # axios client + socket
        ├── components/
        └── pages/           # Login, Signup, Dashboard, BoardPage
```
