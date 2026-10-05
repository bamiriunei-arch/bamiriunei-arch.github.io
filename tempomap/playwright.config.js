// テンポマップの自動テストの設定
// ・index.html をこのフォルダから小さなサーバーで配って、Chromium で開いてテストします
// ・GitHub Actions（リポジトリのいちばん上の .github/workflows/test.yml）でも、同じ設定で動きます
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  // 結果はこのフォルダの中に置く（リポジトリのいちばん上だと、ツールごとに上書きされてしまうため）
  outputDir: path.join(__dirname, 'test-results'),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: path.join(__dirname, 'playwright-report') }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8303/',
    trace: 'retain-on-failure',
    // 自分のパソコンにある Chromium を使うとき：PW_CHROMIUM=/path/to/chrome npx playwright test
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: 'pc', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } }, testIgnore: /phone\.spec\.js/ },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: true }, testMatch: /phone\.spec\.js/ },
  ],
  webServer: {
    command: 'python3 -m http.server 8303 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8303/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
