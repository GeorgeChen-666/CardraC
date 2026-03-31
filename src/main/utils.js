import { ipcMain } from 'electron';

/**
 * 从主进程异步调用渲染进程功能
 * @param {BrowserWindow} window - 目标窗口
 * @param {string} channel - 通信频道名
 * @param {any} data - 发送的数据
 * @param {number} timeout - 超时时间（毫秒），默认 30 秒
 * @returns {Promise<any>} 渲染进程返回的结果
 */
export const invokeRenderer = (window, channel, data = {}, timeout = 30000) => {
  return new Promise((resolve, reject) => {
    const requestId = `${channel}-${Date.now()}-${Math.random()}`;
    const resultChannel = `${channel}-result-${requestId}`;

    // 设置超时
    const timer = setTimeout(() => {
      ipcMain.removeAllListeners(resultChannel);
      reject(new Error(`Renderer invoke timeout: ${channel}`));
    }, timeout);

    // 监听结果
    ipcMain.once(resultChannel, (event, result) => {
      clearTimeout(timer);

      if (result.error) {
        reject(new Error(result.error));
      } else {
        resolve(result.data);
      }
    });

    // 发送请求
    window.webContents.send(channel, {
      requestId,
      resultChannel,
      ...data
    });
  });
};