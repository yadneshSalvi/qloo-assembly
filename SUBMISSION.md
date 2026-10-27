# ASSEMBLY — Make a night of it.

[Live application](https://assembly-web-yuouzcvoaa-uc.a.run.app) · [3:58 demonstration film](https://assembly-demo-yuouzcvoaa-uc.a.run.app) · [Public source](https://github.com/yadneshSalvi/qloo-assembly)

## Elevator pitch

Turn an empty evening into a cultural gathering people can explicitly choose. ASSEMBLY combines Qloo's cultural graph, a bounded creative agent and a production desk that keeps approvals, commitments and changes connected.

## Inspiration

A small venue can have an available room, a limited budget and good local collaborators, yet still lack a compelling reason for people to come. A recommendation is only the beginning. Someone must turn a cultural connection into a viable proposition, ask for a real choice, coordinate the people behind it and recover when the plan changes.

ASSEMBLY follows that entire chain. Its central question is simple: what would make this particular room worth gathering in, and what must be true before the doors can open?

## What it does

The operator enters a venue, constraints and available offers, then confirms the exact cultural identities behind their inspiration. A tool-using agent inspects the inventory, consults Qloo across categories and proposes three distinct nights. Each has an original poster, grounded ingredients, inspectable evidence and deterministic costs.

The operator chooses a direction and approves the exact conditional invitation. Guests make their own choices through private response links. Suppliers confirm their own date, scope and fee. Only after the relevant commitments and responsibility checks are current can the operator open free reservations.

Then comes the difficult moment: a supplier withdraws. ASSEMBLY pauses reservations, exposes the proposed replacement and changed terms, and requires fresh approval and affected guests' consent. An old yes cannot stand in for a different night. The production desk then carries the updated plan through readiness, a timed run of show, check-in and recorded completion.

## How we built it

Next.js and React power a warm editorial interface with original geometric posters. PostgreSQL transactions protect capacity, exact approvals and idempotency. Explicit program and setup slots connect the run of show to supplier confirmations and change review. Separate public, operator, guest and supplier views expose only the information each role needs.

The OpenAI agent's enforced loop invokes three typed tool stages: inspect inventory, discover cultural options and propose concepts. The official Qloo harness resolves catalog identities and retrieves cross-domain references. Restricted artist queries compare the entered offers' confirmed cultural influences without pretending that Qloo knows a local supplier's availability.

Structured validation rejects unknown inventory, unsupported references and creative copy that announces unconfirmed operational facts. A failed proposal gets at most one targeted repair step using the same cultural evidence. Provider budgets are reserved before dispatch, and stale or cancelled jobs cannot overwrite current work.

The Google Cloud deployment separates a public web service from a private worker, uses OIDC-authenticated task delivery and scheduled recovery, and stores data in private PostgreSQL with narrowly scoped runtime permissions. Provider credentials are available only to the worker.

## What makes it different

- Cultural discovery produces three operationally distinct choices from entered inventory, with visible evidence and cost boundaries.
- Taste is never treated as consent. Guests explicitly accept the particular proposition they are considering.
- Change is a first-class product flow. Supplier loss, revised terms, paused allocation and renewed consent remain linked.
- The interface makes the next human decision clear while the agent handles bounded research and composition.

## What we learned

Real model outputs need a correction path as well as a schema. Our first live composition correctly stopped when its creative wording crossed an operational-claim boundary. A bounded repair then produced three accepted proposals while reusing the cached Qloo evidence. The engineering lesson was to put authorization in an awaited pre-dispatch boundary, rather than relying on lifecycle notifications to stop a model call.

We also learned to preserve what a cultural API actually returned. An omitted candidate is unknown, not a zero score. A film or book reference can inspire a conversation; it does not supply performance rights or prove attendance.

## Evidence and scope

The [v0.2.0 film](https://assembly-demo-yuouzcvoaa-uc.a.run.app) records a new functioning-app journey at normal speed, with slow input, a single gentle focus and optional captions. Its [transcript](DEMO-TRANSCRIPT.md) follows the same 478 spoken words.

See [Evaluation](EVALUATION.md) for reproducible checks and actual provider observations, and [Architecture](ARCHITECTURE.md) for the trust boundaries. The demonstration is explicitly a fictional rehearsal. It verifies working software, not independent audience demand, real supplier engagement, licensed performance, payment or causal business impact.

Own-production workspaces support entered inventory and free reservations. Account recovery, paid ticketing, email delivery and external inventory reconciliation remain future work. The next product experiment is a consenting operator-led event that measures the full funnel from proposal views to current choices, reservations and attendance.
