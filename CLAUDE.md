# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CWC 2.0 is an Enterprise Help Center / Service Desk system supporting IT Support, HR Services, and Group Finance workflows. Monorepo with separate `backend/` and `frontend/` directories.

## Commands

### Backend (run from `backend/`)
- **Dev server:** `npm run dev` (tsx watch, port 3000)
- **Build:** `npm run build` (tsc)
- **Tests:** `npm test` / `npm run test:watch` / `npm run test:coverage`
- **Lint:** `npm run lint` / `npm run lint:fix`
- **DB migrations:** `npx prisma migrate dev`
- **DB seed:** `npm run prisma:seed`
- **DB studio:** `npm run prisma:studio`
- **Generate Prisma client:** `npm run prisma:generate`

### Frontend (run from `frontend/`)
- **Dev server:** `npm run dev` (Vite, port 5173)
- **Build:** `npm run build`

## Architecture

### Backend
- **Runtime:** Node.js + Express + TypeScript
- **ORM:** Prisma with PostgreSQL (`backend/prisma/schema.prisma`)
- **Auth:** JWT via passport-jwt, bcrypt password hashing
- **API prefix:** `/api/v1` (configurable via `API_PREFIX` env var)
- **Config:** `backend/src/config/index.ts` — centralized env var config
- **Route structure:** `backend/src/routes/index.ts` mounts all sub-routers. Each domain has its own `*.routes.ts` and `*.controller.ts`.
- **Middleware stack:** helmet → CORS → body parser → compression → morgan → rate limiter → routes → 404 → error handler
- **Services layer:** `backend/src/services/` for business logic

### Frontend
- **Framework:** React 19 + TypeScript + Vite
- **Routing:** React Router v7 with `HashRouter` (defined in `frontend/App.tsx`)
- **Path alias:** `@` maps to `frontend/` root
- **API client:** Axios, base URL from `VITE_API_URL` env var
- **Auth context:** `frontend/src/context/AuthContext`
- **Page components split across two dirs:** `frontend/pages/` (main pages) and `frontend/src/pages/` (auth pages like Login/Register)
- **Shared components:** `frontend/src/components/`
- **AI integration:** Gemini API key exposed via `process.env.GEMINI_API_KEY` in Vite config

### Key Domain Areas
- **Service Desks:** IT Support (5 categories), HR Services (4 categories), Group Finance (3 categories)
- **Workflows:** Request creation, approvals, interviews, screening, LOA, onboarding
- **Roles:** Admin, Agent, End User

### Default Seed Credentials
- Admin: `admin@helpdesk.com` / `admin123`
- Agent: `agent@helpdesk.com` / `agent123`
- User: `user@helpdesk.com` / `user123`
