import { emptyImg } from './constants';

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

const getSystemPath = (pathType) => {
  // 渲染进程
  if (typeof window !== 'undefined' && window.systemPaths?.[pathType]) {
    return window.systemPaths[pathType];
  }

  // 主进程
  if (typeof process !== 'undefined' && process.env) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/';

    switch (pathType) {
      case 'home':
        return homeDir;

      case 'appData':
        if (process.platform === 'win32') {
          return process.env.APPDATA || `${homeDir}/AppData/Roaming`;
        } else if (process.platform === 'darwin') {
          return `${homeDir}/Library/Application Support`;
        } else {
          return `${homeDir}/.config`;
        }
    }
  }

  return '/';
};

export const homeDir = getSystemPath('home');
export const getAppDataPath = () => getSystemPath('appData');


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
  const normalizedHomeKey = filePathToImageKey(normalizedHome);
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

export const imagePathToImageSrc = (imagePath, {quality = 'auto', version = 1} = {}) =>
  imagePath
    ? `cardrac://image/${fixPath(imagePath)}?quality=${quality}&version=${version}`
    : emptyImg.path;

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

export function extractImages(state) {
  const imagePaths = new Map();

  if (state.CardList && Array.isArray(state.CardList)) {
    state.CardList.forEach(card => {
      if (card.face?.path) {
        !imagePaths.has(card.face.path) && imagePaths.set(card.face.path, card.face);
      }
      if (card.back?.path) {
        !imagePaths.has(card.back.path) && imagePaths.set(card.back.path, card.back);
      }
    });
  }
  if (state.Config?.globalBackground?.path) {
    !imagePaths.has(state.Config.globalBackground.path) && imagePaths.set(state.Config.globalBackground.path, state.Config.globalBackground);
  }

  return [...imagePaths.values()];
}