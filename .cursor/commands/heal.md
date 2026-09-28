# Heal Firelight scripts after acceptance

Apply human-accepted expected changes and refresh the self-healed baseline.

## Steps

1. Follow `playwright-agent/commands/heal.md`
2. Require explicit accepted change IDs
3. Use `playwright-agent/agents/self-healer.md`
4. Update locators from `playwright-agent/templates/locators.template.json` + `.snapshots/` when present; POMs stay on `page-object.template.ts` entry helpers
5. Write defect notes for unexpected/rejected
6. Run `cd jackson-tests && npm run baseline:capture`
7. Summarize and suggest commit of healed baseline
8. If unexpected defects were written, mention optional `/file-jira`
