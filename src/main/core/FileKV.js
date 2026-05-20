import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class FileKV {
  constructor({ dir, pid, ttl = 24*3600 }) {
    this.dir = dir;
    this.ttl = ttl;
    this.pid = pid || process.pid;
    this.ensureDir(dir);
    this._cleanupInterval = setInterval(() => this.cleanupExpired(), 60000);
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  keyToFile(key) {
    // 防止key中包含路径穿越等
    const keyHash = crypto.createHash('md5').update(key).digest('hex');
    return path.join(this.dir, `${keyHash}.json`);
  }

  async set(key, value) {
    const file = this.keyToFile(key);
    const data = {
      expire: Date.now() + this.ttl * 1000,
      value
    };
    await fs.promises.writeFile(file, JSON.stringify(data), 'utf8');
  }

  async get(key) {
    const file = this.keyToFile(key);
    try {
      const data = JSON.parse(await fs.promises.readFile(file, 'utf8'));
      if (Date.now() > data.expire) {
        await fs.promises.unlink(file).catch(()=>{});
        return undefined;
      }
      return data.value;
    } catch {
      return undefined;
    }
  }

  async delete(key) {
    const file = this.keyToFile(key);
    await fs.promises.unlink(file).catch(()=>{});
  }

  async clear() {
    const files = await fs.promises.readdir(this.dir);
    await Promise.all(
      files.filter(f => f.endsWith('.json')).map(f =>
        fs.promises.unlink(path.join(this.dir, f)).catch(()=>{})
      )
    );
  }

  async keys() {
    const files = await fs.promises.readdir(this.dir);
    return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  }

  async cleanupExpired() {
    const files = await fs.promises.readdir(this.dir);
    const now = Date.now();
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const fPath = path.join(this.dir, file);
          const { expire } = JSON.parse(await fs.promises.readFile(fPath, 'utf8'));
          if (now > expire) await fs.promises.unlink(fPath).catch(()=>{});
        } catch {}
      }
    }
  }

  close() {
    clearInterval(this._cleanupInterval);
  }
}