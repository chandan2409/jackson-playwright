# Change evidence

Live `/detect-changes` writes one PNG per wizard page here (`owner.png`, …). Change review **File unexpected to Jira** attaches that PNG to the Bug when the file exists.

`npm run detect:rehearse` does not open Firelight, so there is no PNG. Defect notes then point at the rehearsal JSON (for example `tests/data/rehearsal/current/owner.json`) instead of a missing screenshot.
