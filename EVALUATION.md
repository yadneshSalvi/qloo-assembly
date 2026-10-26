# Evaluation

This record separates deterministic verification, actual provider behavior and product outcomes. A successful software rehearsal does not establish independent human demand or the success of an event.

## Candidate verification

The release candidate passed [GitHub CI run 40414736236](https://github.com/yadneshSalvi/qloo-assembly/actions/runs/40414736236) at application commit `1b64da08d1dd3e90b5abd00c22fed2f0943e52c1`: 109 backend, provider-contract, presentation, scheduling and real PostgreSQL tests across 13 files, with no skips, and 15 browser tests in one clean 49.8-second batch. TypeScript, lint and production build also passed in CI; formatting passed locally. The browser suite exercised a complete rehearsal with independent operator, guest and supplier contexts: publication, exact confirmations, allocation, supplier loss, revised terms, guest reconfirmation, production tasks, check-in and completion.

Additional browser coverage included own-production inventory entry, workspace switching, rejected capability misuse, stale versions, keyboard interaction, layouts at 390/768/1024/1440 pixels and automated accessibility checks on the public, studio and private-role screens. Automated accessibility tests are not a substitute for assistive-technology user testing.

The independent source audit found no P1/P2 issue in the reviewed owner, private response, consent, capacity and worker-fencing paths. It reproduced a malformed replacement request that produced a server error instead of validation; the candidate added an explicit guard. This was a scoped review, not a security certification.

## Live provider observations

Recorded on 26 October 2026 UTC; the browser displayed 27 October in Asia/Kolkata.

| Run                                   | Observed result                                                                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Initial API setup probes              | Six catalog searches and four Insights requests; all ten HTTP responses were 200                                                                             |
| Integrated browser catalog searches   | Six completed searches, one Qloo request each, with observed queue-to-completion times of 2.24–2.89 seconds                                                  |
| First integrated composition          | Four Qloo requests and three model steps; stopped after 27.23 seconds because creative copy violated an operational-claim guard; no proposals were published |
| Controlled retry after bounded repair | Completed three grounded concepts in 23.16 seconds, reusing all four normalized Qloo responses with zero new Qloo calls and four model steps                 |

The failed run retained normalized Qloo results in its private cache so a corrected proposal could reuse them. A failed model output is not counted as a completed generation. Application call reservations do not reveal the hackathon key's remaining credit; the setup responses supplied no quota-balance header.

Catalog identities were explicitly selected in the browser. The initial restricted artist-influence probe returned three of four supplied candidates; the overlapping input anchor was omitted. Omitted candidates were not assigned a zero score or invented rank. Cultural scores were kept category-specific.

The retry exercised the actual repair path: its first proposal failed a creative operational-wording check, the fourth model step corrected it, and validation accepted all three proposals. The concepts used different operator inventories and returned artist, film and book references; the full-capacity costs were £1,164, £1,364 and £744, all host-funded scenarios with a zero guest price.

After the repair change, 76 tests passed. They establish that a first valid proposal stops after three model calls, a corrected proposal stops after four, two invalid proposals stop at four, denied fourth-call authorization prevents dispatch, and a provider failure prevents the next model step. Budget and cancellation authorization runs in awaited `prepareStep`; lifecycle notification callbacks are not treated as a blocking security boundary.

The earlier 81-test presentation candidate also verified deterministic human-readable concept presentation. Saved compositions can be displayed without another model request; selecting a direction explicitly creates new program terms, while reading an already approved proposal never rewrites its terms or hash. The live local rehearsal was reselected and published through the browser with these readable terms.

## Hosted verification

The Google Cloud candidate's database and worker readiness checks passed. Automatic scheduled recovery recorded a persisted worker heartbeat; anonymous access to the private dispatch endpoint was denied. The database smoke test accepted its unique instance CA, rejected an unrelated CA and verified the runtime role's narrow data permissions.

An independent hosted probe passed 26 capability, privacy and concurrency checks. Two simultaneous last-seat requests produced one successful allocation and one conflict. A material change retained held seats while rejecting stale consent, and cancellation released the allocation and blocked late confirmation.

All nine distinct browser scenarios passed across runs. The complete independent operator/guest/supplier rehearsal passed twice after a test-only selector and save-acknowledgment fix. The final combined batch passed five scenarios before four further scenarios encountered the expected hourly fresh-session limit; those four had already passed in the earlier run. This is an aggregate result, not a clean nine-test final batch. No further broad rerun was made. The checks used authored fictional data and consumed no paid provider calls.

The hosted browser also completed six actual Qloo catalog searches and saved deliberate identity and influence selections. Persisted job durations were 7.177, 2.412, 2.335, 2.264, 2.280 and 2.267 seconds, with six Qloo calls and zero model calls. All six automatic Cloud Tasks dispatch requests returned HTTP 200.

Manual review found that the generated run of show had started supplier activities at doors-open rather than respecting the offer's specified slot. The corrected candidate uses explicit program/setup slots, deliberate concurrent-service consent and a reviewed shift when doors move. Five focused local browser checks cover the offer editor, timing review and preflight that avoids an unusable paid composition.

The real PostgreSQL suite then caught property-order-sensitive comparisons after JSONB storage. Canonical comparisons and hashes now preserve every value and array order while ignoring object-key order; the 109-test pass includes both structural and actual database round-trip regressions. Existing approved hashes are retained on reads.

The corrected hosted candidate completed its first live composition in **37.296 seconds**, using **four Qloo requests and four model steps**, including one bounded proposal correction against the same evidence. Cloud Tasks began dispatch 251 milliseconds after enqueue and returned HTTP 200. Including the preceding catalog searches, this hosted workspace used ten Qloo requests and four model steps. These are measured calls, not a claim about remaining provider credit.

The actual generated concepts were **A Room Between Rhythms**, **The Stories Between Us** and **Traces of a Shared Frequency**. The second used the returned film _Roma_ and book _Scoff: A History of Food and Class in Britain_ as creative prompts. Returned identities and model interpretation remained separately labelled. The first was selected for the hosted end-to-end rehearsal.

That browser rehearsal published exact terms v4 with a 19:00–19:50 performance and 20:00–20:45 food service. A fictional guest response for two places confirmed those terms and received an allocation after supplier confirmation and operator greenlight. The music supplier then withdrew through its scoped view. New reservations paused and the existing places stayed held. A confirmed replacement raised the full-capacity estimate from £1,164 to £1,204; host approval created terms v5, the guest explicitly accepted again, and the operator renewed the three production responsibilities before resuming.

Five dependency-ordered tasks, readiness, two recorded arrivals, completion and one explicitly synthetic feedback response were then saved. The outcome showed two current confirmed choices by quantity, two allocated sample places, two recorded sample arrivals, four live Qloo evidence records and £0 collected. Browser error logs were empty across the three role views. This manual capture used separate role tabs in one browser; independent session isolation was verified by the earlier automated three-context rehearsal. It is software behavior evidence, not an independent human pilot.

This final review also caught two presentation issues: conservative freshness rejection incorrectly implied that assignment terms necessarily changed, and the resume control did not display the remaining operational gates. The server rejected both stale responses and premature resume correctly. The release clarifies the freshness message and aligns the resume control with current supplier and responsibility checks.

The first full CI run passed all 109 backend tests and 14 of 15 browser tests, exposing a draft-save defect: blank optional program/setup fields were sent as empty strings rather than omitted. The editor now omits those blank fields. The regression saves and reopens the unfinished offer and verifies that its times remain absent. Provided-time validation and the stricter composition, publication and greenlight gates are unchanged; the subsequent full CI run passed all 15 browser tests.

## What the tests establish

Deterministic tests exercise unknown inventory and evidence rejection, constrained factual copy, provider request bounds, cache handling, budget precharge, job cancellation, input changes, stale lease rejection, exact terms, private role scope, concurrent capacity and expiry. Database integration tests use real PostgreSQL transactions, including competing allocation requests. Browser tests exercise the rendered controls and independent session boundaries.

Reproduce with the commands in [README](README.md). Provider-free suites must remain separate from intentional live smoke runs. Never use a production database for test fixtures or publish private capability links or raw provider responses.

## Outcomes not measured

There has been no independent operator study, consenting audience experiment, real supplier engagement, licensed event, verified attendance, payment or causal conversion/revenue measurement. Rehearsal interest and allocations are demonstration activity. Completion in own-production mode is an operator assertion; a guest response does not prove a unique human or verified identity.

The software supports an operational experiment. It does not turn Qloo's ranking into evidence of audience preference, willingness to pay, operational availability or a real-world outcome.
