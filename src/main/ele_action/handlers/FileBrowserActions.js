import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { eleActions } from '../../../shared/constants';
import { expandPath, fixPath, imagePathToImageSrc } from '../../../shared/functions';

// ✅ 工具函数
const isHidden = (filePath) => {
  const fileName = path.basename(filePath);
  if (fileName.startsWith('.')) return true;
  if (os.platform() === 'win32') {
    const hiddenNames = [
      'desktop.ini', 'thumbs.db', '$recycle.bin',
      'system volume information', 'pagefile.sys', 'hiberfil.sys'
    ];
    return hiddenNames.includes(fileName.toLowerCase());
  }
  return false;
};

const safeStat = (p) => {
  try {
    return fs.statSync(p);
  } catch (e) {
    return ['EPERM', 'EACCES', 'ENOENT'].includes(e.code) ? null : (() => { throw e; })();
  }
};

const buildFileDetails = (targetPath) => {
  const realPath = expandPath(targetPath);
  const st = safeStat(realPath);
  if (!st) return null;

  return {
    name: path.basename(realPath),
    path: targetPath,
    realPath,
    safePath: fixPath(realPath),
    isDirectory: st.isDirectory(),
    size: st.isDirectory() ? undefined : st.size,
    modified: st.mtime.getTime(),
    ext: path.extname(realPath).toLowerCase().replace('.', ''),
  };
};

// safeReaddir 改为返回 Dirent
const safeReaddir = (p) => {
  try {
    return fs.readdirSync(p, { withFileTypes: true }).filter(dirent => {
      if (isHidden(dirent.name)) return false;
      return true;
    });
  } catch (e) {
    return ['EPERM', 'EACCES', 'ENOENT'].includes(e.code) ? [] : (() => { throw e; })();
  }
};


const getDrives = () => {
  if (os.platform() !== 'win32') return ['/'];
  return Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i) + ':\\')
    .filter(safeStat)
    .map(d => d[0]);
};

// ✅ 列出驱动器
const listDrives = () => {
  const drives = getDrives();
  return {
    type: 'directory',
    currentPath: '',
    items: drives.map(d => ({
      name: `${d}:`,
      path: `${d}:`,
      isDirectory: true
    })),
    parent: null
  };
};

// ✅ 浏览路径
const browse = (drivePath, query = {}) => {
  const m = drivePath.match(/^([A-Z]):(.*)$/i);
  if (!m) {
    return { type: 'error', status: 400, message: 'Invalid path' };
  }

  const [, drv, sub] = m;
  const root = `${drv.toUpperCase()}:\\`;
  if (!safeStat(root)) {
    return { type: 'error', status: 404, message: 'Drive not found' };
  }

  let up = (sub || '').replace(/\\/g, '/');
  if (up && !up.startsWith('/')) up = '/' + up;
  if (!up) up = '/';

  const cur = up === '/' ? `${drv.toUpperCase()}:` : `${drv.toUpperCase()}:${up}`;
  const real = path.join(root, up === '/' ? '' : up.replace(/^\//, ''));

  const { sort = 'name', order = 'asc', ext } = query;
  const needFileStat = sort === 'modified' || sort === 'size';

  const st = safeStat(real);
  if (!st) {
    return { type: 'error', status: 404, message: 'Not found' };
  }

  // ✅ 如果是文件
  if (st.isFile()) {
    return {
      type: 'file',
      name: path.basename(real),
      path: cur,
      realPath: real,
      safePath: fixPath(real),
      size: st.size,
      modified: st.mtime.getTime(),
      // url: `${basePath}/${cur}${suffix}`,
      // fileUrl: `${basePath}/${cur}`,
      // //添加缩略图 URL
      // thumbnailUrl: imagePathToImageSrc(fixPath(real), { quality: 'low' })
    };
  }

  // ✅ 如果是目录
  let items = safeReaddir(real).map(dirent => {
    const fp = path.join(real, dirent.name);
    const itemPath = up === '/' ? `${drv.toUpperCase()}:/${dirent.name}` : `${cur}/${dirent.name}`;
    const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(dirent.name);
    const st = needFileStat && !dirent.isDirectory() ? safeStat(fp) : null;
    return {
      name: dirent.name,
      path: itemPath,
      realPath: fp,
      safePath: fixPath(fp),
      isDirectory: dirent.isDirectory(), // ← 直接用，无需 stat
      size: st ? st.size : undefined,
      modified: st ? st.mtime.getTime() : undefined,
      ext: path.extname(dirent.name).toLowerCase().replace('.', ''),
      isImage,
      ...(isImage && { thumbnailUrl: imagePathToImageSrc(fixPath(fp), { quality: 'low' }) })
    };
  }).filter(Boolean);

  // ✅ 过滤扩展名
  if (ext) {
    items = items.filter(i => i.isDirectory || ext.toLowerCase().split(',').includes(i.ext));
  }

  // ✅ 排序
  const naturalCompare = (a, b) => {
    return a.localeCompare(b, 'en', {
      numeric: true,
      sensitivity: 'base'
    });
  };

  items.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    let r;
    if (sort === 'size') {
      r = (a.size ?? 0) - (b.size ?? 0);
    } else if (sort === 'modified') {
      r = (a.modified ?? 0) - (b.modified ?? 0);
    } else {
      r = naturalCompare(a.name, b.name);
    }
    return order === 'desc' ? -r : r;
  });

  return {
    type: 'directory',
    currentPath: cur,
    fullPath: real,
    items: items,
    parent: up === '/' ? '' : `${drv}:${path.dirname(up)}`
  };
};

// ✅ 导出
export default (getMainWindow) => {
  // ✅ 列出驱动器
  ipcMain.on(eleActions.listDrives, (event, args) => {
    const { returnChannel } = args;
    const mainWindow = getMainWindow();
    try {
      const result = listDrives();
      mainWindow.webContents.send(returnChannel, result);
    } catch (error) {
      console.error('Failed to list drives:', error);
      mainWindow.webContents.send(returnChannel, {
        type: 'error',
        message: error.message
      });
    }
  });

  // ✅ 浏览路径
  ipcMain.on(eleActions.browsePath, (event, args) => {
    const { returnChannel, path, query = {} } = args;
    const mainWindow = getMainWindow();
    try {
      const result = browse(path, query);
      mainWindow.webContents.send(returnChannel, result);
    } catch (error) {
      console.error('Failed to browse path:', error);
      mainWindow.webContents.send(returnChannel, {
        type: 'error',
        message: error.message
      });
    }
  });

  ipcMain.on(eleActions.getFileDetails, (event, args) => {
    const { returnChannel, paths = [] } = args;
    const mainWindow = getMainWindow();
    try {
      const details = paths.map(buildFileDetails).filter(Boolean);
      mainWindow.webContents.send(returnChannel, details);
    } catch (error) {
      console.error('Failed to get file details:', error);
      mainWindow.webContents.send(returnChannel, []);
    }
  });
};
