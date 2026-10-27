# ASSEMBLY

**Make a night of it.** ASSEMBLY turns an available room into a cultural proposal, explicit audience choices, supplier commitments and an approved production that can recover when plans change.

[Open the deployed app](https://assembly-web-yuouzcvoaa-uc.a.run.app) · [Watch the 3:58 demonstration](https://assembly-demo-yuouzcvoaa-uc.a.run.app) · [Read the measured evaluation](EVALUATION.md)

The public invitation uses warm editorial typography and original event posters. The private production desk keeps the next decision, its evidence and its exact terms visible. Qloo supplies cross-domain cultural evidence; a bounded OpenAI agent composes proposals from entered inventory; people decide what happens.

## What works

- Isolated fictional rehearsals and blank own-production workspaces, with multiple productions in one private browser session.
- Qloo catalog search, explicit canonical identity selection, and operator-confirmed mappings between local offers and cultural influences.
- Three live, model-composed proposals grounded in returned references and supplied inventory, with deterministic costs and feasibility. Authored examples remain separate.
- Explicit approval of a conditional invitation and independent public guest responses. Interest, current consent, reservations and check-ins stay distinct.
- Scoped supplier invitations, exact offer confirmation, operator responsibility checks and greenlight before reservations open.
- Transactional allocation of free places against app-managed capacity, idempotent requests and stale-version rejection.
- Supplier withdrawal and general program, date, venue, capacity, access and price-change review, with exact diffs and fresh guest consent.
- Production tasks, run-of-show, readiness, cancellation, check-in, recorded completion and optional guest feedback.

Own-production mode supports **free events**. No payment processor, email service, supplier marketplace or external ticket inventory is connected. Availability, quote sources, rights and completion remain recorded human assertions.

## Try the story

1. Open **Enter the studio → Open my sample production**. The room, suppliers and participant actions are labelled fictional rehearsal data.
2. Review the venue and **People & offers**. Enter exact program and setup times for at least two workable offers. Save the brief and its constraints. Choose a zero price for a free-reservation demonstration.
3. Confirm exact catalog matches and choose **Compose with live evidence**, or select **Authored rehearsal** for the provider-free example. Failed live research never substitutes an authored result.
4. Compare three proposals, inspect their evidence, choose a direction and approve the exact invitation.
5. Open the attendee experience in a separate browser context. Make a choice and keep its private response link. Confirmed interest alone does not allocate a place.
6. Open supplier invitations separately and confirm the required offers. Review the operator greenlight and open reservations. Reserve through the guest's private response.
7. Rehearse a supplier withdrawal. Review a replacement and the changed terms. After operator approval, the affected guest accepts the revision or withdraws. Resume once dependencies are current.
8. Complete production tasks, record check-in, open the doors and record completion. The outcome reports only the workspace's activity and zero paid revenue.

Private links authorize their corresponding guest or supplier response. They do not verify email, identity or a unique person. Keep them private. Operator access belongs to this browser; there is no account recovery or organization login. Rehearsals expire after 24 hours and own-production workspaces after 90 days.

## Local setup

Requires Node **22.22.3**, pnpm **10.15.0** and PostgreSQL 17. The lockfile pins Next.js 16.4.3, React 19.3.1, AI SDK 7.0.152 and the official Qloo harness 0.1.26.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
docker compose up -d postgres
pnpm db:migrate
```

The optional Compose database binds only to `127.0.0.1:55432`. If that port is occupied, use a dedicated database on the existing server or change both the Compose port and `DATABASE_URL`. The supplied password is for local development only.

Run the web server and worker in separate terminals:

```sh
pnpm dev
```

```sh
pnpm worker
```

Open [the local app](http://127.0.0.1:3102). The local worker polls the durable queue. Production builds use `pnpm build` and `pnpm start` with the intended `PORT`; both PostgreSQL and a worker must remain available.

For live research, provide `QLOO_API_KEY`, `QLOO_BASE_URL=https://hackathon.api.qloo.com`, `OPENAI_API_KEY` and `OPENAI_MODEL=gpt-6.1-sol` **only to the worker process**. Production uses separate Secret Manager mounts. Never use `NEXT_PUBLIC_` for credentials, put keys in prompts or commit environment files. The web needs database access and its dispatch configuration. Without provider keys, the authored rehearsal remains available and live failures remain visible.

## Architecture

| Component            | Responsibility                                                            |
| -------------------- | ------------------------------------------------------------------------- |
| `apps/web`           | Operator, public invitation, guest and supplier views; request boundaries |
| `apps/worker`        | Durable claims, bounded research, checkpoints and recovery                |
| `packages/contracts` | Typed state, exact terms, provenance, cost and count calculations         |
| `packages/domain`    | Authorization, lifecycle, consent, capacity and PostgreSQL transactions   |
| `packages/qloo`      | Official-harness commands, single-request guard and response validation   |
| `packages/research`  | Safe model inputs, typed tool loop and grounded compositions              |

The agent can inspect and propose. It cannot publish, contact anyone, book, approve, or make purchases or payments. Public factual copy is assembled from selected records; the model supplies structured choices and labelled creative copy. Qloo affinity is cultural evidence, not attendance probability, availability, consent or licensing.

Provider allowance is reserved transactionally before a call. Jobs verify leases and input fingerprints before applying results; cancellation or changed inputs prevent stale results from winning. Global and workspace budgets bound calls, and cache reuse is visible. These limits do not report the API key's remaining credit.

See [architecture](ARCHITECTURE.md) and [Google Cloud deployment](deploy/gcp/README.md) for privacy, private networking, runtime database permissions, OIDC delivery and recovery.

## Verification

```sh
pnpm typecheck
pnpm lint
pnpm test
DATABASE_URL=postgresql://qloo:qloo_local_dev@127.0.0.1:55432/assembly_test ASSEMBLY_DB_TEST=1 pnpm test
```

Database tests use the separate disposable `assembly_test` database. Never point test fixtures at production. With the web and keyless rehearsal worker running:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Tests cover grounding, malformed responses, budgets, consent, exact approvals, stale versions, private capability scope, concurrent capacity and job fencing. Browser checks exercise independent operator, guest and supplier contexts, responsive layouts and automated accessibility. Synthetic checks do not establish live API success; a rehearsal does not establish real demand or impact. Live release measurements are recorded separately.

## Scope and provenance

Included venues, suppliers and authored treatments are fictional. Cultural names describe influences, not partnerships or booked appearances. Own-production information is entered by the operator. No independent human pilot, licensed event, verified attendance, payment or conversion lift has been measured for this release.

Organization accounts, email delivery, paid ticketing, external-inventory reconciliation and legal identity checks are outside the current implementation. Capacity protection covers its own allotment only. Automated accessibility checks supplement rather than replace assistive-technology user testing. The small zonal demo database has no high availability.

## License and assets

The app is [MIT licensed](LICENSE). Posters and venue illustrations are original SVG/CSS artwork. Manrope and Fraunces are self-hosted under the SIL Open Font License; their licenses are in `apps/web/public/fonts/`. Lucide icons use the ISC license. No film stills, performer photographs or album covers are redistributed. Qloo's name and API remain their owner's property; no endorsement is implied.
