# /iterate-script2 — Iterate variant path until green

Run Script 2 (`tests/specs/script-2-variant-path.spec.ts` / `FL-VP-001`), fix from the failure screenshot, and repeat in this chat.

Invoke the `script-2-iterator` agent. Do not ask the user to rerun npm by hand.

## Usage

```
/iterate-script2
```

## Command

```bash
cd jackson-tests && npm run test:script2
```

## Critical rules

- Write only under `jackson-tests/`
- Live DOM / screenshot labels win over Excel
- Shared `wizard-flow.ts` changes must not silently break Script 1
- No commit unless the user asks
