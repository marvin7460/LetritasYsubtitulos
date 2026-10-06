import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end check with the REAL Whisper model (downloads it from Hugging Face). Not part of CI:
 * run it locally with `npm run test:real`. Uses Google Chrome when installed (real WebGPU).
 */
export default defineConfig({
  testDir: './e2e/real',
  timeout: 15 * 60 * 1000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4181', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CHROMIUM_EXECUTABLE ? undefined : 'chrome',
        launchOptions: {
          args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'],
          ...(process.env.PW_CHROMIUM_EXECUTABLE
            ? { executablePath: process.env.PW_CHROMIUM_EXECUTABLE }
            : {}),
        },
      },
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4181 --strictPort',
    url: 'http://localhost:4181',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
