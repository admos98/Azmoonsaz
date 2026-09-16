# آزمون‌ساز (Azmoonsaz)

A full-stack Iranian education exam platform — build, manage, and take exams online with secure authentication, real-time grading, and a Persian-first UI.

---

## What It Does

**For teachers:** Create exams from a question bank, assign them to class groups, set time windows and access controls, review submissions, and grade both auto-graded and descriptive questions.

**For students:** Authenticate with national ID + entry code, take timed exams with anti-cheat measures, answer offline if the connection drops, and receive instant results for auto-graded sections.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Backend | Vercel Serverless Functions (Node.js) |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| Animation | Motion (Framer Motion successor) |
| Testing | Vitest, React Testing Library |
| Linting | ESLint (flat config), Prettier |

---

## Project Structure

```
src/
├── App.tsx                  # Root — routing, role switching
├── main.tsx                 # Entry point, ErrorBoundary
├── types.ts                 # All shared TypeScript interfaces
├── config/
│   ├── env.ts               # Public environment variables
│   └── runtimeMode.ts       # Backend mode detection
├── lib/
│   ├── apiClient.ts         # Typed fetch wrapper (apiGet, apiPost)
│   ├── logger.ts            # Centralized logger (dev: all levels, prod: errors only)
│   └── supabasePublic.ts    # Supabase client singleton
├── services/
│   ├── api.ts               # All data services (auth, students, questions, exams, grading)
│   ├── storageService.ts    # Supabase Storage uploads
│   ├── teacherApi.ts        # Teacher session / access token helpers
│   ├── offlineAnswerQueue.ts # Offline answer persistence + sync
│   └── persianHelpers.ts    # Re-exports from utils/persian
├── utils/
│   └── persian.ts           # Iranian national ID validation, Persian date/number formatting
├── components/
│   ├── ErrorBoundary.tsx    # React error boundary with retry
│   ├── BackendModeBadge.tsx # "بک‌اند امن" indicator
│   ├── Sidebar.tsx          # Teacher panel navigation
│   ├── Topbar.tsx           # Teacher panel top bar
│   └── UIComponents.tsx     # Shared UI primitives (Button, Card, Badge, Modal, Table, etc.)
├── pages/
│   ├── teacher/
│   │   ├── Login.tsx        # Email + password auth
│   │   ├── Dashboard.tsx    # Stats, charts, class overview
│   │   ├── Classes.tsx      # Class group management
│   │   ├── Students.tsx     # Student roster, Excel import
│   │   ├── Questions.tsx    # Question bank (CRUD, import, search)
│   │   ├── Exams.tsx        # Exam list with sub-views
│   │   ├── NewExam.tsx      # Multi-step exam builder
│   │   ├── ExamPreview.tsx  # Live exam preview + question replacement
│   │   ├── ExamSettings.tsx # Per-exam config (timing, access, anti-cheat)
│   │   ├── ExamResults.tsx  # Submission review, grading, score tables
│   │   └── Settings.tsx     # Account settings, backend status
│   └── student/
│       ├── SecureExamPortal.tsx  # Secure student exam (Supabase-backed)
│       └── ExamPortal.tsx        # Legacy exam portal
└── test/                    # Unit tests (Vitest + RTL)
    ├── components/
    ├── config/
    ├── lib/
    ├── services/
    └── utils/

api/                         # Vercel Serverless API
├── index.js                 # Thin router → dispatches to route files
├── routes/
│   ├── auth.js              # Signup, email verification, onboarding
│   ├── public.js            # Public endpoints (exam lookup, student auth)
│   ├── student.js           # Student endpoints (start exam, save answers, submit)
│   └── teacher.js           # Teacher endpoints (CRUD for all resources)
└── _lib/
    ├── auth.js              # Session token creation / verification
    ├── crypto.js            # Entry code hashing
    ├── env.js               # Server-side env vars
    ├── examSecurity.js      # Exam access validation
    ├── http.js              # Response helpers (json, cors headers)
    ├── rateLimit.js         # Supabase-backed rate limiter with local fallback
    ├── studentSession.js    # Student session management
    ├── supabaseAdmin.js     # Supabase service-role client
    ├── teacherAuth.js       # Teacher authentication middleware
    └── utils.js             # Shared server utilities
```

---

## Key Features

### Exam Lifecycle
- **Build:** Multi-step wizard — title/grade → pick questions from bank → configure settings → preview → publish
- **Assign:** Target specific class groups, set start/end windows, generate entry codes
- **Take:** Student enters national ID + code → timed exam → anti-cheat (tab switch detection, fullscreen lock) → auto-submit on timeout
- **Grade:** Auto-graded MCQ + manual grading for descriptive questions with rubrics
- **Review:** Per-question stats, score distribution, export-ready results

### Security
- **Teacher signup/login:** Email-first flow — enter email, then password. New emails get a Supabase verification email automatically. Existing emails authenticate with password.
- **Onboarding gate:** First login requires school name and subject before accessing the dashboard.
- Teacher authentication via Supabase Auth with access tokens
- Student sessions scoped per exam with entry code verification
- Exam content locked during active session (no pre-fetching)
- Cross-instance rate limiting via Supabase (prevents per-Vercel-instance bypass)
- Anti-cheat: tab-switch warnings, fullscreen enforcement, one-device-per-login

### Offline Resilience
- Student answers are saved to localStorage during the exam
- If the network drops, answers queue locally and sync when connection returns
- Exam state survives page refresh

### Persian-First
- All UI text in Persian (RTL layout)
- Iranian national ID validation (10-digit checksum)
- Persian date formatting (Jalali calendar)
- Persian digit display for numbers

---

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase project (for database, auth, storage)

### Setup

```bash
npm install
```

Create `.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=/api
```

Apply database migrations:
```bash
npx supabase db push
```

### First Time Use

1. Open the app → enter your email → enter a password
2. If the email is new, Supabase sends a verification email — click the link
3. After email verification, log in with email + password
4. First login shows the onboarding page — enter school name and subject
5. Done — you're in the dashboard

### Development

```bash
npm run dev          # Vite dev server (proxies /api to localhost:3001)
npx vercel dev       # Full stack with Vercel serverless
```

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint (0 errors, warnings tracked) |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run check` | Full pipeline: typecheck + lint + build |

### Deployment

Deployed on Vercel. Push to `main` triggers automatic deployment. The API runs as serverless functions under `/api/`.

Supabase migrations live in `supabase/migrations/`. Apply via:
```bash
npx supabase db push
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `VITE_API_URL` | No | API base path (default: `/api`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase admin key (set in Vercel) |

---

## Audit & Quality

A comprehensive audit was conducted on 2026-09-15 covering security, architecture, and code quality. All 16 findings have been resolved. See `.hermes/plans/2026-09-15_comprehensive-audit.md` for the full audit report and fix details.

### Quality Gates
- **TypeScript** — strict type checking (0 errors)
- **ESLint** — flat config with TypeScript + React Hooks rules (0 errors, 217 warnings tracked)
- **Vitest** — 40 unit tests across 9 test files (utils, services, config, lib, components)
- **Vite build** — production-optimized, ~259KB gzipped

---

## License

Apache-2.0 (SPDX)
