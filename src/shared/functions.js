export const waitTime = async timeout => new Promise(resolve => setTimeout(resolve, timeout));
export const waitCondition = async (Condition = () => true, timeout = 500, totalWatingTime = 30000) => new Promise(resolve => {
  const startTime = new Date().getTime() / 1000;
  const timer = setInterval(() => {
    const nowTime = new Date().getTime() / 1000;
    if(Condition() || nowTime - startTime > totalWatingTime) {
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