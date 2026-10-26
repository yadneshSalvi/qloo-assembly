#!/usr/bin/env bash
set -euo pipefail
# Apply before first public traffic. Preserve all unrelated exclusions and sinks.
gc=${ASSEMBLY_GCLOUD_WRAPPER:-./deploy/gcp/gcloud.sh}
name=assembly-private-capability-requests
filter=$(cat ./deploy/gcp/capability-request-exclusion.filter)
existing=$("$gc" logging sinks describe _Default --format=json)
if python3 -c 'import json,sys; x=json.load(sys.stdin); sys.exit(not any(e.get("name")==sys.argv[1] for e in x.get("exclusions",[])))' "$name" <<<"$existing"; then mode=--update-exclusion; else mode=--add-exclusion; fi
"$gc" logging sinks update _Default "$mode=name=$name,filter=$filter,description=Omit possession-token capability request URLs" --quiet
final=$("$gc" logging sinks describe _Default --format=json)
python3 -c 'import json,sys; x=json.load(sys.stdin); e=next((e for e in x.get("exclusions",[]) if e.get("name")==sys.argv[1]),None); assert e and not e.get("disabled",False) and e.get("filter")==sys.argv[2], "Capability request exclusion is not active"; print(json.dumps({"sink":x["name"],"enabledCapabilityExclusion":e["name"],"filter":e["filter"]}))' "$name" "$filter" <<<"$final"
