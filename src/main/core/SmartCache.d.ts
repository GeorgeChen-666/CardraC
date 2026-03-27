export interface SmartCacheOptions {
  maxMemorySize?: number;
}

export class SmartCache {
  constructor(name: string, options?: SmartCacheOptions);

  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): boolean;
  keys(): string[];
  readonly size: number;
  toPlainObject(): Record<string, Promise<string | undefined>>;

  // Proxy 支持
  [key: string]: any;
}
