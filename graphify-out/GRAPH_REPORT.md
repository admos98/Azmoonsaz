# Graph Report - azmoon  (2026-09-16)

## Corpus Check
- 106 files · ~76,049 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 660 nodes · 1167 edges · 52 communities (41 shown, 11 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `384e487c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- teacher.js
- api.ts
- devDependencies
- UIComponents.tsx
- scripts
- Azmoonsaz — Comprehensive Codebase Audit
- generate-demo-seed-sql.mjs
- compilerOptions
- SecureExamPortal.tsx
- README.md
- teacherApi.ts
- AGENTS.md
- Fix Plan — Azmoonsaz Codebase Issues
- security-architecture.md
- ErrorBoundary.tsx
- schema-security-draft.sql
- 20260617000001_initial_security_schema.sql
- api.test.ts
- Final Vercel deployment guide
- upgrade-v2-beta.mjs
- supabase-hardening.md
- Deployment checklist
- Teacher auth and real students
- verify-production-safety.mjs
- Mock cleanup plan
- Real question bank and exams
- Real results and grading
- Route migration and mock lockdown
- env.js
- Secure student frontend route
- Student API flow
- Local API testing
- vercel.json
- FINAL_STATUS.md
- supabase-first-run.md
- vercel-api-routing-fix.md
- vercel-hobby-function-limit.md
- 20260915000001_rate_limits.sql
- cleanup-generated.mjs
- public.student_answers
- public.student_exam_sessions
- public.teacher_profiles

## God Nodes (most connected - your core abstractions)
1. `json()` - 27 edges
2. `scripts` - 23 edges
3. `requireMethod()` - 21 edges
4. `requireTeacher()` - 18 edges
5. `logger` - 15 edges
6. `Exam` - 15 edges
7. `compilerOptions` - 15 edges
8. `handleStudentStartSession()` - 14 edges
9. `formatPersianNumber()` - 13 edges
10. `Question` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Exams()` --references--> `react`  [EXTRACTED]
  src/pages/teacher/Exams.tsx → package.json
- `QuestionRendererProps` --references--> `Question`  [EXTRACTED]
  src/components/QuestionRenderer.tsx → src/types.ts
- `Sidebar()` --indirect_call--> `Settings()`  [INFERRED]
  src/components/Sidebar.tsx → src/pages/teacher/Settings.tsx
- `Stepper()` --calls--> `formatPersianNumber()`  [EXTRACTED]
  src/components/UIComponents.tsx → src/utils/persian.ts
- `ExamTimer()` --calls--> `formatPersianNumber()`  [EXTRACTED]
  src/components/UIComponents.tsx → src/utils/persian.ts

## Import Cycles
- None detected.

## Communities (52 total, 11 thin omitted)

### Community 0 - "teacher.js"
Cohesion: 0.08
Nodes (71): handler(), routePath(), routes, getBearerToken(), maskNationalId(), nationalIdHash(), normalizeNationalId(), validateIranianNationalId() (+63 more)

### Community 1 - "api.ts"
Cohesion: 0.07
Nodes (60): App(), QuestionRenderer(), QuestionRendererProps, Sidebar(), SidebarProps, Badge(), Button, Card() (+52 more)

### Community 2 - "devDependencies"
Cohesion: 0.04
Nodes (49): esbuild, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, jsdom, devDependencies (+41 more)

### Community 3 - "UIComponents.tsx"
Cohesion: 0.07
Nodes (36): BackendModeBadge(), Topbar(), TopbarProps, BadgeProps, ButtonProps, CardProps, ConfirmDialogProps, DrawerProps (+28 more)

### Community 4 - "scripts"
Cohesion: 0.05
Nodes (43): lucide-react, motion, dependencies, lucide-react, motion, papaparse, react, react-dom (+35 more)

### Community 5 - "Azmoonsaz — Comprehensive Codebase Audit"
Cohesion: 0.06
Nodes (35): Azmoonsaz — Comprehensive Codebase Audit, C-1: Rate limiter in-memory — silent data loss in serverless, C-2: `api/index.js` — 790-line monolith, C-3: `questionService.uploadQuestionImage` is a stub, C-4: `examService.generateExamDraft` uses `this.createExam` — wrong context, C-5: Rate limiter is per-instance — not global, CRITICAL — Security / Correctness, Files to Modify (per fix) (+27 more)

### Community 6 - "generate-demo-seed-sql.mjs"
Cohesion: 0.09
Nodes (21): checks, envLocal, forbiddenTracked, required, loadLocalEnv(), maskSecret(), full, hash (+13 more)

### Community 7 - "compilerOptions"
Cohesion: 0.07
Nodes (26): dist, DOM, DOM.Iterable, ES2022, node_modules, playwright.config.ts, src, src/test (+18 more)

### Community 8 - "SecureExamPortal.tsx"
Cohesion: 0.17
Nodes (19): ApiError, apiGet(), apiPost(), apiRequest(), friendlyApiError(), PayloadResponse, Phase, SafeExam (+11 more)

### Community 9 - "README.md"
Cohesion: 0.10
Nodes (19): Audit & Quality, Commands, Deployment, Development, Environment Variables, Exam Lifecycle, First Time Use, Getting Started (+11 more)

### Community 10 - "teacherApi.ts"
Cohesion: 0.18
Nodes (9): PublicEnv, getSupabasePublicClient(), ResetPassword(), ResetPasswordProps, uploadQuestionImage(), getTeacherAccessToken(), teacherGet(), teacherPost() (+1 more)

### Community 11 - "AGENTS.md"
Cohesion: 0.13
Nodes (13): API Route Pattern, Architecture, Commands, Dev Server Quirks, Docs, Environment Variables, Project, Runtime Modes (+5 more)

### Community 12 - "Fix Plan — Azmoonsaz Codebase Issues"
Cohesion: 0.13
Nodes (14): 3a: Extend `handleTeacherClasses` in `api/index.js` (line 471-478), 3b: Update `classService` in `src/services/api.ts` (lines 115-143), 4a: `src/types.ts` line 20 — add `status?: 'active' | 'suspended' | 'examining';`, 4b: `src/pages/teacher/Students.tsx`, Execution Order, Fix 1: Create `src/pages/teacher/Settings.tsx`, Fix 2: `isSecureTeacherModeAvailable()` — `src/services/teacherApi.ts`, Fix 3: `classService` backend integration (+6 more)

### Community 13 - "security-architecture.md"
Cohesion: 0.17
Nodes (11): Anti-cheat reality, Critical rule: no plain national IDs, Deployment hardening, Exam payload rules, Frontend should never contain, Logging and audit trail, Recommended production stack, Security goal (+3 more)

### Community 14 - "ErrorBoundary.tsx"
Cohesion: 0.18
Nodes (3): ErrorBoundary, ErrorBoundaryProps, ErrorBoundaryState

### Community 15 - "schema-security-draft.sql"
Cohesion: 0.36
Nodes (11): public.audit_logs, public.class_groups, public.exam_allowed_classes, public.exam_questions, public.exams, public.questions, public.student_answers, public.student_exam_sessions (+3 more)

### Community 16 - "20260617000001_initial_security_schema.sql"
Cohesion: 0.42
Nodes (10): public.class_groups, public.exam_allowed_classes, public.exam_questions, public.exams, public.questions, public.student_answers, public.student_exam_sessions, public.students (+2 more)

### Community 17 - "api.test.ts"
Cohesion: 0.20
Nodes (9): mockDelete, mockEq, mockIn, mockInsert, mockMaybeSingle, mockRpc, mockSelect, mockSingle (+1 more)

### Community 18 - "Final Vercel deployment guide"
Cohesion: 0.22
Nodes (8): 1. Pre-deploy local checks, 2. GitHub, 3. Vercel project settings, 4. Vercel environment variables, 5. Supabase SQL before production, 6. Post-deploy checks, 7. Security reminders, Final Vercel deployment guide

### Community 19 - "upgrade-v2-beta.mjs"
Cohesion: 0.22
Nodes (8): appPath, __dirname, __filename, NL, pkg, pkgPath, root, tsconfigPath

### Community 20 - "supabase-hardening.md"
Cohesion: 0.25
Nodes (7): 1. Auth, 2. RLS, 3. Secrets, 4. Storage, 5. National ID handling, 6. Rate limiting, 7. Backups

### Community 21 - "Deployment checklist"
Cohesion: 0.33
Nodes (5): Before deploy, Deployment checklist, Post-deploy checks, Vercel environment variables, Vercel settings

### Community 22 - "Teacher auth and real students"
Cohesion: 0.33
Nodes (5): Important, Local testing, Security, Teacher auth and real students, What is real now

### Community 23 - "verify-production-safety.mjs"
Cohesion: 0.40
Nodes (5): forbidden, root, scan(), scanDirs, walk()

### Community 24 - "Mock cleanup plan"
Cohesion: 0.40
Nodes (4): Already real or partially real, Mock cleanup plan, Safe cleanup order, Still needs migration

### Community 25 - "Real question bank and exams"
Cohesion: 0.40
Nodes (4): Added endpoints, Local development, Real question bank and exams, Security model

### Community 26 - "Real results and grading"
Cohesion: 0.40
Nodes (4): Added endpoints, Real results and grading, Storage model, Test flow

### Community 27 - "Route migration and mock lockdown"
Cohesion: 0.40
Nodes (4): Migration, Production env, Route migration and mock lockdown, Routes

### Community 28 - "env.js"
Cohesion: 0.83
Nodes (3): candidateEnvPaths(), loadApiEnv(), parseEnvLine()

### Community 29 - "Secure student frontend route"
Cohesion: 0.50
Nodes (3): Local development, Secure student frontend route, Why not use npm run dev:vercel for UI?

### Community 30 - "Student API flow"
Cohesion: 0.50
Nodes (3): Endpoints, Local testing, Student API flow

## Knowledge Gaps
- **289 isolated node(s):** `QUESTION_BODY_WHITELIST`, `OPTION_WHITELIST`, `PART_WHITELIST`, `localCache`, `routes` (+284 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Exams()` connect `scripts` to `api.ts`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **What connects `QUESTION_BODY_WHITELIST`, `OPTION_WHITELIST`, `PART_WHITELIST` to the rest of the system?**
  _289 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `teacher.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07871148459383753 - nodes in this community are weakly interconnected._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0742296918767507 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `UIComponents.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06763285024154589 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._