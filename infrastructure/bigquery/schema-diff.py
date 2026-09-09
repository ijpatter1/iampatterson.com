#!/usr/bin/env python3
"""Compare a live BigQuery schema against the committed schema.json.

Exit 0 and print nothing when they match on (name, type, mode) for every
declared column. Exit 1 and print the differences otherwise.

Counting columns is not comparing them: a rename, a type change, or a
delete-plus-add in one edit all leave the count unchanged while the schema is
materially different, and a reconcile that skips on an equal count drops the
payload silently at the write. This exists so that decision is made on the
actual schemas, and so it is testable without BigQuery — both inputs are files.
"""
import json
import sys


def index(fields):
    """{name: (type, mode)} — BigQuery omits mode when it is NULLABLE."""
    return {
        f["name"]: (f["type"].upper(), (f.get("mode") or "NULLABLE").upper())
        for f in fields
    }


def diff(live_fields, declared_fields):
    live, declared = index(live_fields), index(declared_fields)
    out = []
    for name, spec in declared.items():
        if name not in live:
            out.append(f"  + {name} ({spec[0]}, {spec[1]}) — declared, absent from the table")
        elif live[name] != spec:
            out.append(
                f"  ~ {name} — table has {live[name][0]}/{live[name][1]}, "
                f"schema.json declares {spec[0]}/{spec[1]}"
            )
    for name in live:
        if name not in declared:
            out.append(f"  - {name} — in the table, not declared (bq update cannot drop it)")
    return out


def main(argv):
    if len(argv) != 3:
        print("usage: schema-diff.py LIVE_SCHEMA_JSON DECLARED_SCHEMA_JSON", file=sys.stderr)
        return 2
    with open(argv[1]) as fh:
        live = json.load(fh)
    with open(argv[2]) as fh:
        declared = json.load(fh)
    # `bq show --schema --format=json` emits a bare array; so does schema.json.
    differences = diff(live, declared)
    if differences:
        print("\n".join(differences))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
