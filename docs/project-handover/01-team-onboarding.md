# Team Onboarding and Portal Usage

## 1. Local development setup

### Prerequisites

- Node.js 20 or newer and npm 10 or newer
- PostgreSQL 15 or newer
- Redis 7 or newer
- Docker and Docker Compose recommended
- Git access to the repository

The authoritative package scripts are in `backend/package.json` and `frontend/package.json`. Do not rely on the older root README for framework versions or credentials; it contains stale examples.

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill required local values; never copy production secrets into local files
npm run prisma:generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

The API runs on port 3000 by default and is mounted under `/api/v1`. Configuration is centralized in `backend/src/config/index.ts`; `DATABASE_URL`, `JWT_SECRET`, and `JWT_REFRESH_SECRET` are required in every environment.

The repository does not contain a tracked `.env.example` according to the configuration review. Obtain approved variable names and local-safe values through the team’s secure setup process; never copy production values into local files.

### Frontend

In another terminal:

```bash
cd frontend
npm install
cp .env.example .env
# Set VITE_API_URL=http://localhost:3000/api/v1
npm run dev
```

Open the Vite URL shown by the command, normally `http://localhost:5173`.

### Local verification

```bash
cd backend
npm run build
npm test
npm run lint

cd ../frontend
npm run build
npm test
npx tsc --noEmit
```

Frontend browser tests are run with `npm run test:e2e`, with focused projects available for smoke, accessibility, and Credit LOS coverage.

Vitest discovers tests under `frontend/src/**/*.{test,spec}.{ts,tsx}`. Tests placed only under `frontend/pages/` will not be picked up by the normal Vitest command.

## 2. How users work in the portal

### End user

1. Sign in.
2. Choose a service desk/request type.
3. Complete the dynamic form and attach supporting files where permitted.
4. Submit the request.
5. Follow status, activity, notifications, approvals, and SLA updates from the request detail page.
6. Respond to clarification/approval requests and confirm resolution or closure.

### Agent and approver

1. Open the dashboard/unified inbox.
2. Use queue filters and request detail to inspect assigned work.
3. Follow the configured workflow transition presented by the API/UI.
4. Add activities and evidence; do not bypass required approvals or transition reasons.
5. Observe SLA status, escalation, and notification outcomes.
6. Use delegation only through the approval-delegation feature and within policy.

### Administrator

Administrators manage service desks, request types, forms, status definitions, workflow versions, transitions, approval policies, notification templates, entities, departments, users/permissions, catalog entitlements, banners, schedules, and system settings. Configuration changes should be tested in a non-production environment and recorded with the release/change ticket.

### Credit LOS users

Credit is gated separately by the `credit:module` feature flag and `credit:*` permissions. Start with `docs/handover/00-README.md`; do not infer Credit behavior from the generic request lifecycle.

## 3. First-day exercises

- Log in with a non-production seeded account supplied through the team’s secure channel.
- Create one IT, HR, and Finance request and verify the resulting request detail/activity.
- Process one approval and one delegated approval in a test database.
- Upload a safe test attachment and verify scan/status/download behavior.
- Publish a workflow version in a test environment and verify a request follows the published graph.
- Confirm the relevant audit event, notification, and SLA behavior.
- Run the backend and frontend builds before making a first code change.

## 4. Credentials and access

Seeded account names are documented in `AGENTS.md` and the module guides, but passwords must be obtained through the approved secure channel. Never put passwords in this pack, source control, tickets, chat, screenshots, or test output. Production secrets reside in the production environment configuration and must not be copied into local `.env` files.
