# Release verification

[Deployed application](https://assembly-web-yuouzcvoaa-uc.a.run.app) · [Source](https://github.com/yadneshSalvi/qloo-assembly) · [Detailed evaluation](EVALUATION.md)

## Verified product story

The hosted application completed a real-provider software rehearsal using fictional operational inventory. Six catalog searches were followed by a bounded Qloo/OpenAI composition. The resulting proposals were reviewed in the browser, and **A Room Between Rhythms** was selected and published with explicit host approval.

The original guest terms contained Nila & The Low Lights at 19:00–19:50 and Little Table at 20:00–20:45, with a zero guest price and 48-place allotment. A fictional two-person response accepted the exact terms, then reserved two places after supplier confirmation, responsibility checks and host greenlight.

Nila's scoped supplier response subsequently marked the assignment unavailable. New bookings paused automatically, and the existing allocation stayed held. The host reviewed Sunday People as a replacement: £360 instead of £320, raising the full-capacity estimate from £1,164 to £1,204. The replacement confirmed its exact assignment. Host approval created terms v5; the guest accepted again; the host renewed the production responsibilities; booking then resumed.

Five dependency-ordered production tasks, readiness, two sample arrivals, completion and one explicitly synthetic feedback response were recorded. The final outcome displayed two current confirmed choices by quantity, two allocated sample places, two recorded sample arrivals, four live Qloo evidence records and £0 collected. No browser console errors were recorded across the owner, guest and supplier views.

This is a software rehearsal. It is not evidence of a real event, independent participants, supplier engagement, licensing, verified identity, demand, revenue or conversion lift.

## Provider measurements

| Observation             | Measured result                                           |
| ----------------------- | --------------------------------------------------------- |
| Hosted catalog searches | Six completed jobs; six Qloo requests, zero model steps   |
| Hosted composition      | 37.296 seconds; four Qloo requests, four model steps      |
| Bounded correction      | One proposal correction reused the same captured evidence |
| Cloud Tasks dispatch    | Began 251 ms after enqueue; HTTP 200                      |
| Hosted workspace total  | Ten Qloo requests and four model steps                    |

The prior local integration additionally demonstrated cache reuse with zero new Qloo requests on a controlled retry. Call reservations and observed requests do not reveal the hackathon API key's remaining credit. Raw provider responses, canonical identity mappings, credentials and private response links are excluded from the repository.

## Verification scope

- 109 backend, provider-contract, presentation, scheduling and real PostgreSQL tests passed across 13 files, with no skips. TypeScript, lint and formatting passed.
- The independent hosted security probe passed 26 capability, privacy and concurrency checks, including competing final-seat requests, stale consent, cancellation and late confirmation.
- Nine distinct hosted browser scenarios passed across runs. The final combined run encountered the hourly fresh-workspace limit after five passing scenarios; its remaining four had passed earlier. This is not represented as a clean final nine-test batch.
- Independent browser contexts verified owner, guest and supplier separation. The manual live capture used separate role tabs in one browser.
- Focused timing checks verified explicit program/setup entry, overlap rules, reviewed schedule shifts and the preflight that prevents unusable live composition.
- Actual PostgreSQL JSONB round-trip regressions verified canonical comparisons while preserving values, array order and existing approved hashes.

## Deployment boundaries

The application runs in a dedicated Google Cloud project with a public web service, private worker, OIDC-authenticated Cloud Tasks and scheduled recovery. The web has no Qloo or OpenAI credentials. Both runtime services connect to private PostgreSQL with the unique instance CA and a narrowly granted application role.

Readiness depends on both database access and a recent persisted worker heartbeat. Anonymous private-worker requests return 403. Automatic scheduled delivery and task dispatch were verified. The database smoke check accepted the intended CA, rejected an unrelated CA, and verified that the runtime role lacks schema-creation and administrative privileges.

Private capability paths use no-referrer and no-store behavior and are excluded from default request-log retention. Access is possession-based: there is no organization account system, email verification or recovery. Samples expire after 24 hours; own-production workspaces after 90 days. The demo uses a small zonal database without high availability. Capacity protection covers only the app-managed allotment, and own-production reservations are free.

The live capture used the schedule-corrected application image. Subsequent release polish clarifies stale supplier-response wording and exposes remaining operational gates before allowing the resume action; backend checks continue to enforce the same requirements.
