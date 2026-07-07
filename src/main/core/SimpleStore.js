import path from 'path';
import fs from 'fs';
import { getAppDataPath } from '../../shared/functions';

const WRITE_DEBOUNCE_MS = 500;
const storeCleanupRegistry = new Set();
let cleanupHooksRegistered = false;

const runRegisteredFlushes = async () => {
  const stores = Array.from(storeCleanupRegistry);
  await Promise.allSettled(stores.map(async (store) => {
    try {
      await store.flush();
    } catch (e) {
      console.error(`Failed to flush config ${store.name} on exit:`, e);
    }
  }));
};

const registerProcessCleanupHooks = () => {
  if (cleanupHooksRegistered) return;

  process.once('exit', () => {
    for (const store of Array.from(storeCleanupRegistry)) {
      try {
        if (store._writeTimer) {
          clearTimeout(store._writeTimer);
          store._writeTimer = null;
        }
        if (store._cache !== null) {
          fs.writeFileSync(store.configPath, JSON.stringify(store._cache, null, 2), 'utf-8');
        }
      } catch (e) {
        console.error(`Failed to flush config ${store.name} on exit:`, e);
      }
    }
  });

  const attachSignalHandler = (signal) => {
    process.once(signal, async () => {
      await runRegisteredFlushes();
      process.exit(0);
    });
  };

  attachSignalHandler('SIGINT');
  attachSignalHandler('SIGTERM');
  cleanupHooksRegistered = true;
};

export class SimpleStore {
  constructor(name = 'config', cwd = null, options = {}) {
    this.configDir = cwd ? path.join(cwd) : path.join(getAppDataPath(), 'cardrac');
    this.configPath = path.join(this.configDir, `${name}.json`);
    this.name = name;
    this._cache = null;
    this._writeTimer = null;
    this._writing = false;  // 写锁
    this._writeDebounceMs = options.writeDebounceMs || WRITE_DEBOUNCE_MS;
    this._cleanupRegistered = false;

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    if (!fs.existsSync(this.configPath)) {
      fs.writeFileSync(this.configPath, '{}', 'utf-8');
    }
    if (options.registerCleanup !== false) {
      this.registerCleanup();
    }
  }

  async _doWrite() {
    if (this._writing) return;
    if (this._cache === null) {
      return;  // 阻止写入 null
    }
    this._writing = true;
    try {
      await fs.promises.writeFile(this.configPath, JSON.stringify(this._cache, null, 2), 'utf-8');
    } finally {
      this._writing = false;
    }
  }

  _scheduleWrite() {
    if (this._writeTimer) clearTimeout(this._writeTimer);
    this._writeTimer = setTimeout(() => {
      this._writeTimer = null;
      this._doWrite();
    }, this._writeDebounceMs);
  }

  get(defaultValue = {}) {
    if (this._cache !== null) return Object.keys(this._cache).length === 0 ? defaultValue : this._cache;
    try {
      const data = fs.readFileSync(this.configPath, 'utf-8').trim();
      this._cache = (data ? JSON.parse(data) : null) || {};
      return Object.keys(this._cache).length === 0 ? defaultValue : this._cache;
    } catch (e) {
      console.error(`Failed to read config ${this.name}:`, e);
      this._cache = {};
      return defaultValue;
    }
  }

  set(value) {
    const current = this.get();
    this._cache = { ...current, ...value };
    this._scheduleWrite();
  }

  clear() {
    this._cache = {};
    this._scheduleWrite();
  }

  delete() {
    try {
      if (this._writeTimer) {
        clearTimeout(this._writeTimer);
        this._writeTimer = null;
      }
      this._cache = null;
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath);
      }
    } catch (e) {
      console.error(`Failed to delete config ${this.name}:`, e);
    }
  }

  async flush() {
    if (this._writeTimer) {
      clearTimeout(this._writeTimer);
      this._writeTimer = null;
    }
    await this._doWrite();
  }

  registerCleanup() {
    if (this._cleanupRegistered) return;
    storeCleanupRegistry.add(this);
    registerProcessCleanupHooks();
    this._cleanupRegistered = true;
  }

  async close(options = {}) {
    const { flush = true } = options;

    if (flush) {
      await this.flush();
    } else if (this._writeTimer) {
      clearTimeout(this._writeTimer);
      this._writeTimer = null;
    }

    if (this._cleanupRegistered) {
      storeCleanupRegistry.delete(this);
      this._cleanupRegistered = false;
    }
  }

}
