import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { ensureRunId, recordLatest, runOutputDir } from './tests/utils/artifact-retention';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const baseURL = process.env.FIRELIGHT_BASE_URL || 'https://flqanext.insurancetechnologies.com/EGApp/';
const authState = path.resolve(__dirname, '.auth/firelight-state.json');
const runId = ensureRunId();
recordLatest(runId);

export default defineConfig({
  testDir: './tests/specs',
  outputDir: runOutputDir(runId),
  preserveOutput: 'failures-only',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['blob', { outputDir: path.join('blob-report', 'runs', runId) }],
    ['json', { outputFile: 'tests/reports/last-run.json' }],
  ],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      testDir: './tests',
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authState,
      },
      dependencies: ['setup'],
    },
  ],
});
