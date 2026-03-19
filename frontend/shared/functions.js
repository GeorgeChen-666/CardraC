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

/**
 * 将绝对路径压缩为使用 ~ 的相对路径
 */
export const fixPath = (filePath, homeDir) => {
  if (!filePath || typeof filePath !== 'string') return filePath;
  if (!homeDir || typeof homeDir !== 'string') return filePath;

  // 浏览器环境下的路径规范化
  const normalizePath = (p) => {
    return p.replace(/\\/g, '/').replace(/\/+/g, '/');
  };

  const normalizedPath = normalizePath(filePath);
  const normalizedHome = normalizePath(homeDir);

  if (normalizedPath.toLowerCase().startsWith(normalizedHome.toLowerCase())) {
    const relativePath = normalizedPath.substring(normalizedHome.length);
    return '~' + relativePath;
  }

  return filePath;
};
