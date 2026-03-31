

export const waitTime = async timeout => new Promise(resolve => setTimeout(resolve, timeout));
export const waitCondition = async (Condition = () => true, timeout = 500, totalWaitingTime = 30000) => new Promise((resolve) => {
  const startTime = new Date().getTime();

  const checkCondition = async () => {
    const nowTime = new Date().getTime();

    try {
      const result = await Condition();

      if (result || nowTime - startTime > totalWaitingTime) {
        clearInterval(timer);
        resolve();
      }
    } catch (err) {
      console.error('waitCondition error:', err);
      clearInterval(timer);
      resolve();
    }
  };

  const timer = setInterval(checkCondition, timeout);

  checkCondition();
});

export const fixFloat = num => num ?? parseFloat(num?.toFixed?.(2));

export const decodeSvg = (data) => {
  if (!data) return '';
  try {
    let decoded = '';
    if (data.startsWith('<svg')) {
      decoded = data;
    } else if (data.startsWith('data:image/svg+xml;charset=utf-8,')) {
      decoded = decodeURIComponent(data.replace('data:image/svg+xml;charset=utf-8,', ''));
    } else if (data.startsWith('data:image/svg+xml,')) {
      decoded = decodeURIComponent(data.replace('data:image/svg+xml,', ''));
    } else if (data.startsWith('data:image/svg+xml;base64,')) {
      const base64Data = data.replace('data:image/svg+xml;base64,', '');
      decoded = atob(base64Data);
    }
    return decoded;
  } catch (e) {
    console.error('Failed to decode SVG:', e);
  }
  return '';
};

export const isDev = process.env.NODE_ENV === 'development';

export const homeDir = process.env.HOME;

export const getAppDataPath = () => process.env.APPDATA;

/**
 * 浏览器兼容的路径规范化
 */
export const normalizePath = (p) => {
  if (!p || typeof p !== 'string') return p;

  // 统一使用正斜杠
  let normalized = p.replace(/\\/g, '/');

  // 移除多余的斜杠
  normalized = normalized.replace(/\/+/g, '/');

  // 移除末尾的斜杠
  if (normalized.endsWith('/') && normalized.length > 1) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
};

/**
 * 浏览器兼容的路径拼接
 */
export const joinPath = (...parts) => {
  if (parts.length === 0) return '';

  // 过滤空值
  const validParts = parts.filter(p => p && typeof p === 'string');
  if (validParts.length === 0) return '';

  // 拼接并规范化
  return validParts
    .map(p => p.replace(/\\/g, '/'))
    .map((p, i) => {
      // 移除开头的斜杠（除了第一个部分）
      if (i > 0 && p.startsWith('/')) {
        p = p.substring(1);
      }
      // 移除末尾的斜杠
      if (p.endsWith('/')) {
        p = p.slice(0, -1);
      }
      return p;
    })
    .filter(p => p.length > 0)
    .join('/');
};

export const getLangFilePath = () => {
  if (isDev) {
    return joinPath(process.cwd(), 'locales');
  } else {
    return joinPath(process.resourcesPath, 'locales');
  }
};

export const filePathToImageKey = path => path?.replaceAll?.('\\', '')?.replaceAll?.('/', '');

/**
 * 将绝对路径压缩为使用 ~ 的相对路径
 */
export const fixPath = (filePath) => {
  if (!filePath || typeof filePath !== 'string') return filePath;
  if (!homeDir) return filePath;
  const normalizedPath = joinPath(filePath);
  const normalizedHome = joinPath(homeDir);
  const normalizedHomeKey = filePathToImageKey(normalizedHome)
  if (normalizedPath.startsWith(normalizedHome)) {
    const relativePath = normalizedPath.substring(normalizedHome.length);
    return '~' + relativePath;
  }
  if (normalizedPath.startsWith(normalizedHomeKey)) {
    const relativePath = normalizedPath.substring(normalizedHomeKey.length);
    return '~' + relativePath;
  }
  return filePath;
};


/**
 * 展开 ~ 为实际的用户目录路径
 */
export const expandPath = (filePath) => {
  if (!filePath || typeof filePath !== 'string') return filePath;

  if (filePath.startsWith('~')) {
    return joinPath(homeDir, filePath.substring(1));
  }

  return filePath;
};

export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function extractImagePaths(state) {
  const imagePaths = new Set();

  // 1. 提取 CardList 中的图片
  if (state.CardList && Array.isArray(state.CardList)) {
    state.CardList.forEach(card => {
      // 提取 face
      if (card.face?.path) {
        imagePaths.add(card.face.path);
      }

      // 提取 back（处理数组和对象两种情况）
      if (card.back) {
        if (Array.isArray(card.back)) {
          card.back.forEach(item => {
            if (item.face?.path) imagePaths.add(item.face.path);
            if (item.back?.path) imagePaths.add(item.back.path);
          });
        } else if (card.back.path) {
          imagePaths.add(card.back.path);
        }
      }

      // 提取自定义背景（如果有）
      if (card.config?.globalBackground?.path) {
        imagePaths.add(card.config.globalBackground.path);
      }
    });
  }

  // 2. 提取全局背景
  if (state.Config?.globalBackground?.path) {
    imagePaths.add(state.Config.globalBackground.path);
  }

  return Array.from(imagePaths);
}