# Heal Firelight scripts after acceptance

Apply human-accepted expected changes and refresh the self-healed baseline.

## Steps

1. Follow `playwright-agent/commands/heal.md`
2. Require explicit accepted change IDs
3. Use `playwright-agent/agents/self-healer.md`
4. Update locators/POMs/fixtures; write defect notes for unexpected/rejected
5. Run `cd jackson-tests && npm run baseline:capture`
6. Summarize and suggest commit of healed baseline
