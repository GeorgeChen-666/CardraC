export interface ImageCacheOptions {
  maxMemorySize?: number;
}

export class ImageCache {
  constructor(name: string, options?: ImageCacheOptions);

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
