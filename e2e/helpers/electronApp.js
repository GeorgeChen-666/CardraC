const { chromium, expect } = require('@playwright/test');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..', '..');
const DEBUG_PORT = 9222;

function waitForDebugPort(port, timeoutMs = 90000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          res.resume();
          resolve();
          return;
        }

        res.resume();
        retry();
      });

      req.on('error', retry);
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`Timed out waiting for Electron debug port ${port}`));
        return;
      }

      setTimeout(tryConnect, 500);
    };

    tryConnect();
  });
}

function killProcessTree(pid) {
  if (!pid) return;

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }

  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    // ignore cleanup failures
  }
}

function waitForProcessExit(childProcess, timeoutMs = 15000) {
  if (!childProcess) {
    return Promise.resolve();
  }

  if (childProcess.exitCode !== null || childProcess.killed) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    const handleExit = () => {
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      childProcess.removeListener('exit', handleExit);
      childProcess.removeListener('close', handleExit);
      childProcess.removeListener('error', handleExit);
    };

    childProcess.once('exit', handleExit);
    childProcess.once('close', handleExit);
    childProcess.once('error', handleExit);
  });
}

function prepareE2EProfile(defaultPath) {
  const appDataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cardrac-e2e-'));
  const appConfigDir = path.join(appDataRoot, 'cardrac');

  fs.mkdirSync(appConfigDir, { recursive: true });

  if (defaultPath) {
    fs.writeFileSync(
      path.join(appConfigDir, 'defaultPathConfig.json'),
      JSON.stringify({ defaultPath }, null, 2),
      'utf8',
    );
  }

  return { appDataRoot, appConfigDir };
}

function cleanupE2EProfile(profile) {
  if (!profile?.appDataRoot) {
    return;
  }

  try {
    fs.rmSync(profile.appDataRoot, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures
  }
}

async function launchApp(options = {}) {
  const {
    defaultPath,
    readyButtonName = '参数设置。',
    readyTimeout = 30000,
  } = options;

  const profile = prepareE2EProfile(defaultPath);
  const appProcess = spawn('npm start', {
    cwd: ROOT,
    env: {
      ...process.env,
      APPDATA: profile.appDataRoot,
      NODE_ENV: 'development',
      PLAYWRIGHT_E2E: '1',
    },
    shell: true,
    detached: process.platform !== 'win32',
    stdio: 'ignore',
  });

  try {
    await waitForDebugPort(DEBUG_PORT);

    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
    const context = browser.contexts()[0] || await browser.newContext();
    const page = context.pages()[0] || await context.waitForEvent('page');

    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('button', { name: readyButtonName })).toBeVisible({ timeout: readyTimeout });

    return { profile, appProcess, browser, page };
  } catch (error) {
    killProcessTree(appProcess.pid);
    cleanupE2EProfile(profile);
    throw error;
  }
}

async function closeApp(session) {
  const { page, browser, appProcess, profile } = session || {};

  if (page && !page.isClosed()) {
    await page.evaluate(() => {
      window.close();
    }).catch(() => {});
  }

  const exited = await waitForProcessExit(appProcess);
  if (!exited) {
    killProcessTree(appProcess?.pid);
    await waitForProcessExit(appProcess, 5000);
  }

  if (browser) {
    await browser.close().catch(() => {});
  }

  cleanupE2EProfile(profile);
}

module.exports = {
  ROOT,
  DEBUG_PORT,
  launchApp,
  closeApp,
};

