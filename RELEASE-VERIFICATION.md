# Release verification

[Deployed application](https://assembly-web-yuouzcvoaa-uc.a.run.app) · [Source](https://github.com/yadneshSalvi/qloo-assembly) · [Film](https://assembly-demo-yuouzcvoaa-uc.a.run.app) · [Detailed evaluation](EVALUATION.md)

## Earlier application verification (v0.1.0)

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

- [CI run 40414736236](https://github.com/yadneshSalvi/qloo-assembly/actions/runs/40414736236) passed for application commit `1b64da08d1dd3e90b5abd00c22fed2f0943e52c1`: 109 backend, provider-contract, presentation, scheduling and real PostgreSQL tests across 13 files, with no skips, and 15 browser tests in one clean 49.8-second batch. TypeScript, lint and production build passed in CI; formatting passed locally.
- The independent hosted security probe passed 26 capability, privacy and concurrency checks, including competing final-seat requests, stale consent, cancellation and late confirmation.
- Nine distinct hosted browser scenarios passed across runs. The final combined run encountered the hourly fresh-workspace limit after five passing scenarios; its remaining four had passed earlier. This is not represented as a clean final nine-test batch.
- Independent browser contexts verified owner, guest and supplier separation. The manual live capture used separate role tabs in one browser.
- Focused timing checks verified explicit program/setup entry, overlap rules, reviewed schedule shifts and the preflight that prevents unusable live composition.
- Actual PostgreSQL JSONB round-trip regressions verified canonical comparisons while preserving values, array order and existing approved hashes.

## Deployment boundaries

The application runs in a dedicated Google Cloud project with a public web service, private worker, OIDC-authenticated Cloud Tasks and scheduled recovery. The web has no Qloo or OpenAI credentials. Both runtime services connect to private PostgreSQL with the unique instance CA and a narrowly granted application role.

Readiness depends on both database access and a recent persisted worker heartbeat. Anonymous private-worker requests return 403. Automatic scheduled delivery and task dispatch were verified. The database smoke check accepted the intended CA, rejected an unrelated CA, and verified that the runtime role lacks schema-creation and administrative privileges.

Private capability paths use no-referrer and no-store behavior and are excluded from default request-log retention. Access is possession-based: there is no organization account system, email verification or recovery. Samples expire after 24 hours; own-production workspaces after 90 days. The demo uses a small zonal database without high availability. Capacity protection covers only the app-managed allotment, and own-production reservations are free.

The live capture used the schedule-corrected application image. Subsequent release polish clarifies stale supplier-response wording, exposes remaining operational gates before allowing the resume action, and permits unfinished supplier drafts to omit optional times. Composition and publication still require workable program times; backend operational checks remain enforced. The combined backend and browser suites cover all three corrections.

The final application image is `sha256:b41f6813313078e8dd88d5fead685252e1a680fc5d776acc0ea94ced74d42e68`, produced by Cloud Build `5a9fa17e-ceaf-4d0f-8ae1-ef53994e3d0b`. Web revision `assembly-web-00008-cqg` and worker revision `assembly-worker-00004-4p6` are healthy. Automatic scheduled dispatch returned HTTP 200 at 22:51 UTC on 26 October 2026, with a persisted heartbeat; anonymous worker access returned 403. The completed browser workspace remained available after rollout.

## Demonstration film v0.2.0

The replacement film records a new functioning-app rehearsal, separate from the earlier provider measurements above. The operator confirms Khruangbin and the entered SAULT influence, then starts actual live research. The returned concepts are **A Room Held in Rhythm**, **The Distance Between Us** and **Traces of What We Hear**. The first is chosen and published. Morgan's fictional two-person party records interest, confirms the exact terms and receives two sample places after current supplier responses and host checks.

Nila & The Low Lights then withdraws. Existing places stay held while the operator proposes Sunday People, reviews the £40 cost increase, obtains independent replacement confirmation and approves the exact change. Morgan accepts terms v6 on the existing booking. The operator renews the responsibilities, resumes production, reviews five completed tasks and records two arrivals and completion. The final native outcome shows two current choices, two places, two arrivals, £0 collected, entered cost £1204, four live Qloo evidence records and independent impact not measured. These are authored rehearsal actions, not independent participation or a real event outcome.

The film is 238.033 seconds, 1920 × 1080, 30 fps, H.264/AAC. It uses 35 clips from 12 new source recordings at normal speed. All 46 retained actions and three complete slow typing intervals remain; declared edits remove repeated entries and inactive waits. A single 1.08× focus keeps the full guest form visible, with 1.8-second moves and a seven-second settled view. No film-owned titles, subtitles, caption bands, fabricated UI or generated cursor paths appear. The ending is the actual completed application.

All 478 narration words were approved and aligned to actual Deepgram word timestamps. Gemini 3.1 Flash TTS in the Kore voice and one original instrumental source form the soundtrack. An initial listening review identified a flat short insert; the whole surrounding passage was regenerated as one connected take. The corrected full encoded soundtrack passed a model listening review for natural delivery, consistent voice, intelligibility, music balance, action pauses and a clean ending. This is a model opinion, not human listening. Actual AAC measures −14.02 LUFS integrated and −1.31 dBTP at 48 kHz stereo. The optional English WebVTT has 94 non-overlapping cues; [the transcript](DEMO-TRANSCRIPT.md) contains the matching approved narration.

The editable preview and full HyperFrames check passed. All 7,141 encoded frames decoded without errors or detected black intervals. Thirty-five clip samples, all 34 edit seams (170 frames) and 19 native keyframes were visually inspected. The exact-change controls, guest form and captured cursor remain correctly aligned across source bitmap sizes. The final audio repair preserved every encoded H.264 packet and its video clock.

The MP4 is 92,445,447 bytes with SHA-256 `6b23b4e3c1f412b18066e46865dd8930d20ecfe137be9276ef07fde816b538f0`. Raw captures, original takes, word timing, editing plans and the previous film remain private.

The [public player](https://assembly-demo-yuouzcvoaa-uc.a.run.app) uses a separate static media service with the existing roleless identity, minimum zero and maximum one instance, no database, provider credentials or VPC attachment. The pinned Nginx image and Cloud Run both enable HTTP/2 cleartext for the container connection. Staging accepts at most 128 MiB and exactly eight allowlisted files. Versioned media URLs prevent a cached earlier film from replacing v0.2.0. Cloud Build `58fd07a3-99e0-44d1-b9b3-2b4a848af9c6` produced media revision `assembly-demo-00002-b9m`, serving 100% of media traffic. All 12 anonymous HTTP checks passed: the full 92,445,447-byte video matched the approved hash, poster/captions/page matched staged bytes, first and final ranges returned 206 with correct Content-Range, an invalid range returned 416, and private capture/audio/environment/build paths returned 404. The live container port is `h2c`; its environment and volume lists are empty and it has no VPC attachment. The application and worker remain `assembly-web-00008-cqg` and `assembly-worker-00004-4p6` with the same images.
