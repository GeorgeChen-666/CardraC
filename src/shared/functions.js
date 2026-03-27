import path from 'path';

export const waitTime = async timeout => new Promise(resolve => setTimeout(resolve, timeout));
export const waitCondition = async (Condition = () => true, timeout = 500, totalWaitingTime  = 30000) => new Promise(resolve => {
  const startTime = new Date().getTime();
  const timer = setInterval(() => {
    const nowTime = new Date().getTime();
    if(Condition() || nowTime - startTime > totalWaitingTime) {
      clearInterval(timer);
      resolve();
    }
  }, timeout);
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
/**
 * 将绝对路径压缩为使用 ~ 的相对路径
 */
export const fixPath = (filePath, homeDir) => {
  if (!filePath || typeof filePath !== 'string') return filePath;
  if (!homeDir) return filePath;
  const normalizedPath = normalizePath(filePath);
  const normalizedHome = normalizePath(homeDir);
  if (normalizedPath.toLowerCase().startsWith(normalizedHome.toLowerCase())) {
    const relativePath = normalizedPath.substring(normalizedHome.length);
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