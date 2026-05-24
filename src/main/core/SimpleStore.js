import path from 'path';
import fs from 'fs';
import { getAppDataPath } from '../../shared/functions';

export class SimpleStore {
  constructor(name = 'config', cwd = null) {
    this.configDir = path.join(getAppDataPath() , 'cardrac');
    this.configPath = path.join(this.configDir, `${name}.json`);
    this.name = name;

    // 确保目录存在
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    // 初始化配置文件
    if (!fs.existsSync(this.configPath)) {
      fs.writeFileSync(this.configPath, '{}', 'utf-8');
    }
  }

  get(defaultValue = {}) {
    try {
      const data = fs.readFileSync(this.configPath, 'utf-8');
      const result = JSON.parse(data);
      if (!result || (typeof result === 'object' && Object.keys(result).length === 0)) {
        return defaultValue;
      }
      return result;
    } catch (e) {
      console.error(`Failed to read config ${this.name}:`, e);
      return defaultValue;
    }
  }

  set(value) {
    try {
      const current = this.get();
      const updated = { ...current, ...value };
      fs.writeFileSync(this.configPath, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (e) {
      console.error(`Failed to write config ${this.name}:`, e);
    }
  }

  //新增：清空配置
  clear() {
    try {
      fs.writeFileSync(this.configPath, '{}', 'utf-8');
    } catch (e) {
      console.error(`Failed to clear config ${this.name}:`, e);
    }
  }

  //新增：删除配置文件
  delete() {
    try {
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath);
      }
    } catch (e) {
      console.error(`Failed to delete config ${this.name}:`, e);
    }
  }
}