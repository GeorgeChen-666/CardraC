import path from 'path';
import fs from 'fs';
import { getAppDataPath } from '../../shared/functions';

const WRITE_DEBOUNCE_MS = 500;

export class SimpleStore {
  constructor(name = 'config', cwd = null) {
    this.configDir = path.join(getAppDataPath(), 'cardrac');
    this.configPath = path.join(this.configDir, `${name}.json`);
    this.name = name;
    this._cache = null;
    this._writeTimer = null;
    this._writing = false;  // 写锁

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    if (!fs.existsSync(this.configPath)) {
      fs.writeFileSync(this.configPath, '{}', 'utf-8');
    }
    this.registerCleanup();
  }

  async _doWrite() {
    if (this._writing) return;
    this._writing = true;
    try {
      await fs.promises.writeFile(this.configPath, JSON.stringify(this._cache, null, 2), 'utf-8');
    } catch (e) {
      console.error(`Failed to write config ${this.name}:`, e);
    } finally {
      this._writing = false;
    }
  }

  _scheduleWrite() {
    if (this._writeTimer) clearTimeout(this._writeTimer);
    this._writeTimer = setTimeout(() => {
      this._writeTimer = null;
      this._doWrite();
    }, WRITE_DEBOUNCE_MS);
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
    const cleanup = async () => {
      try {
        await this.flush();
      } catch (e) {
        console.error(`Failed to flush config ${this.name} on exit:`, e);
      }
    };

    let called = false;
    const safe = async () => {
      if (!called) {
        called = true;
        await cleanup();
      }
    };

    process.on('exit', safe);
    process.on('SIGINT', async () => { await safe(); process.exit(0); });
    process.on('SIGTERM', async () => { await safe(); process.exit(0); });
  }

}
