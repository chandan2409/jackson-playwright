import { defineConfig } from '@playwright/test';

/** Used only by `npm run report:all` / merge-reports — not by live test runs. */
export default defineConfig({
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report-all' }]],
});
