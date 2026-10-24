# ASSEMBLY

**Make a night of it.** ASSEMBLY is a working local sample of a cultural production desk: an independent room becomes a proposal, verified conditional interest, an approved production, capacity-checked sample bookings, and an evening that can recover when a supplier drops out.

The public experience uses warm editorial typography and original event posters. The producer’s ink-colored workspace keeps the next decision, exact terms, evidence, and operational responsibilities visible.

## What works today

- Isolated, cookie-scoped sample workspaces backed by PostgreSQL, with a 24-hour lifetime and a reset that affects only the current workspace.
- Editable venue capacity, access, curfew, availability, and a structured cultural brief.
- A persistent worker that selects budget-eligible **authored sample concepts**. It does not pretend to call Qloo or a model.
- Three distinct treatments with costs, break-even calculations, provenance, and concept-specific schedules.
- Owner approval of exact conditional terms, followed by a public invitation and deduplicated sample interest.
- Explicit **simulated contact verification**. No emails are sent; the sample confirmation link appears in the same browser.
- Separate interest, verified-current-choice, booking, and check-in counts.
- Supplier scope confirmation, recorded responsibility checks, owner greenlight, and explicit opening of sample booking.
- Transactional capacity allocation, idempotency keys, stale-version rejection, and idempotent check-in.
- Run-of-show, ordered production tasks with completion evidence, readiness, event start, and observed sample completion.
- A Blue Hour supplier-loss rehearsal: pause booking, compare a replacement and cost delta, approve a new terms version, require affected choices to reconfirm or withdraw, then resume.
- Evidence, audit history, scoped supplier role-play, keyboard dialogs, responsive layouts, and reduced-motion support.

All venues, suppliers, offers, and creative treatments are fictional. Names of cultural anchors identify editorial influences, not partnerships, licensed content, or direct Qloo matches. There are no real reservations, payments, supplier contracts, email deliveries, independent participants, or measured Qloo outcomes.

## Run locally

Requires Node **22.22.3**, pnpm **10.15.0**, and PostgreSQL 17. The lockfile pins the application dependencies, including Next.js 16.4.3 and React 19.3.1.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Start the optional local database container, or point `DATABASE_URL` at an existing dedicated database:

```sh
docker compose up -d postgres
pnpm db:migrate
```

The supplied Compose credentials are for local development only. It binds PostgreSQL to `127.0.0.1:55432` and creates `assembly` and `assembly_test` on a fresh volume. If that port is already occupied, use the existing local database or change both the Compose port and `DATABASE_URL`.

Run the persistent worker and web server in separate terminals:

```sh
pnpm worker
```

```sh
pnpm dev
```

Open [the local app](http://127.0.0.1:3102). The research screen stays queued if the worker is not running; work is stored in PostgreSQL and survives browser refreshes. The worker claims jobs using PostgreSQL leases and `SKIP LOCKED`, permits bounded recovery, and periodically purges expired sample workspaces.

For a production build of this **sample application**:

```sh
pnpm build
pnpm start
```

Keep the worker running. Set `APP_ORIGIN` to the exact web origin and configure `DATABASE_URL` server-side. The current scripts bind locally. Deploying publicly needs an appropriately bound process, HTTPS, database backups, access/rate controls, and a continuously running worker. No public deployment has been made by this implementation.

## Try the complete story

1. Open **Enter the studio → Open my production desk → Shape the brief**.
2. Save the brief and choose **Explore sample concepts**. Select **Blue hour, shared table**.
3. Open **Audience**, review the exact proposal, and approve publication.
4. Open the attendee page. Use a made-up name and `example.com` email, accept the terms, and complete the explicitly simulated contact verification.
5. Return to **Production**. Confirm both sample supplier offers and record the three responsibility checks. Review and approve greenlight, then open sample bookings.
6. Open the saved audience choice from **Audience** and allocate sample places. Interest does not allocate a place by itself.
7. In **Production**, rehearse the music supplier cancellation. Review the change, confirm the replacement, and approve the proposed program and cost delta.
8. Open each affected choice and accept the new terms or withdraw. Resume booking from the change view. Existing allocations stay reserved during review.
9. Complete the five production tasks with evidence, respecting dependencies. Mark ready, check in the sample booking, open the doors, and complete the event.
10. Inspect **The outcome**. It reports only activity recorded in this workspace, including zero paid revenue.

The audience and collaborator links are role-play views scoped to the same browser session, **not public multi-user authentication**. A copied event URL in a different browser opens that browser’s own isolated sample.

## Qloo boundary

The official Qloo harness **0.1.26** and MCP SDK **1.32.2** are pinned. The adapter starts the official `qloo mcp` process, inspects tools, validates the envelope, applies bounded calls, and enforces the ten-input shortlist/signal limits. A capability probe can run without a credential:

```sh
pnpm qloo:probe
```

The verified local probe found ten tools and contract version 1.0.0, with `ready: false` and `liveCallMade: false` when no key was supplied. It does not perform an authenticated API request. Set `QLOO_API_KEY` only on the server when issued.

**Adding a key does not enable live research automatically.** The live research action currently fails explicitly: confirmed entity mappings, operational inventory joins, supported parameter probes, and the agent integration remain unfinished. The adapter preserves `ok`, `empty`, `needs_input`, `partial`, `degraded`, and `error` distinctions. It never substitutes sample content for live evidence.

The AI SDK is installed, but no model-backed tool loop is connected to the UI. `AI_GATEWAY_API_KEY` and `AI_MODEL` are reserved for that integration and currently unused. No model identifier or AI-produced evidence is implied by the sample worker.

## Architecture and API

- `apps/web`: Next.js App Router pages, the editorial audience journey, producer workspace, and request-boundary checks.
- `apps/worker`: persistent Node process for leased, bounded sample research jobs and expiry cleanup.
- `packages/contracts`: shared typed records, exact terms, counts, and deterministic economics.
- `packages/domain`: action guards, schedules, PostgreSQL transactions, session isolation, idempotency, and immutable audit entries within the saved workspace document.
- `packages/qloo`: official harness adapter and capability probe boundary.
- `tests`: domain, PostgreSQL concurrency, adapter, browser-flow, responsive, and automated accessibility checks.

The sample schema stores a versioned JSONB workspace plus relational idempotency and job tables. Every mutation locks its workspace row, validates the expected version, and commits before returning success. Capacity is authoritative only within this local app-managed sample allotment. This is not protection against outside ticket sales.

| Interface              | Behavior                                                                         |
| ---------------------- | -------------------------------------------------------------------------------- |
| `GET /api/workspace`   | Read or create the current isolated sample session                               |
| `POST /api/actions`    | Validated action, expected version, idempotency key; returns committed workspace |
| `POST /api/demo/reset` | Reset only the authenticated cookie’s sample workspace                           |

Mutations require same-origin JSON requests. Opaque session tokens are HTTP-only cookies; the database stores their hashes. Submitted contacts are reduced to a masked address and a workspace-scoped digest. Raw email addresses are not persisted or sent to Qloo. Contact tokens remain scoped to the owner’s sample session and expire with it.

## Verification

```sh
pnpm typecheck
pnpm lint
pnpm test
```

The PostgreSQL suite is opt-in and should use the separate disposable test database:

```sh
DATABASE_URL=postgresql://qloo:qloo_local_dev@127.0.0.1:55432/assembly_test pnpm test:db
```

With the web server and worker running:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

The domain/adapter suite tests consent, stale approvals, duplicate contacts, capacity, schedule validity, recovery, terms, and adapter limits. PostgreSQL tests exercise actual competing last-seat writes, session isolation, idempotent retries, queued-job/reset races, and retry exhaustion. Browser tests run the full brief-to-completion flow, check layouts at 390/768/1024/1440 pixels, exercise a stale second tab, and verify keyboard focus and automated WCAG contrast rules. These are sample/integration tests, not evidence of a successful live pilot. Automated accessibility checks supplement, rather than replace, assistive-technology user testing.

## Remaining production work

Real organization accounts/RBAC, normalized tenant-scoped production tables, real contact verification, rate limiting, real offer evidence and rights, paid ticket providers, signed webhook reconciliation, transactional outbound delivery, object storage, a live cultural agent, worker heartbeat monitoring, cancellation workflows, and independently observed pilots are not implemented. Recovery currently exercises the authored Blue Hour music-supplier substitution; general venue/date/price/access change proposals are not exposed. Anonymous sample polling is supported; authenticated resumable SSE is not. There is one production per sample workspace. Expiry cleanup requires the worker.

## License and assets

The application is [MIT licensed](LICENSE). The geometric event posters and venue illustrations were created as original SVG/CSS artwork for this repository; no remote images, film stills, album art, or performer photos are used. Manrope and Fraunces are self-hosted through `next/font/local` under the SIL Open Font License; their license files are in `apps/web/public/fonts/`. Lucide icons are distributed under the ISC license. Qloo’s name and API remain the property of their respective owner; no endorsement is implied.
