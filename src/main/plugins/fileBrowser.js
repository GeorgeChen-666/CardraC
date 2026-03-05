const fs = require('fs');
const path = require('path');
const os = require('os');
const { readCompressedImage, SimpleStore } = require('../functions');
const { fixPath, expandPath } = require('../utils');
const { OverviewStorage } = require('../file_render/utils'); // ✅ 引入压缩函数

const defaultPathStore = new SimpleStore('defaultPathConfig')
const getDefaultPath = () => {
  try {
    const { defaultPath } = defaultPathStore.get();
    return defaultPath || os.homedir().replace(/\\/g, '/').replace(/^([A-Z]):/, '$1:');
  } catch (e) {
    console.error('Failed to read default path from config:', e);
    return os.homedir().replace(/\\/g, '/').replace(/^([A-Z]):/, '$1:');
  }
};

const setDefaultPath = (pathToSave) => {
  try {
    defaultPathStore.set({ defaultPath:pathToSave });
  } catch (e) {
    console.error('Failed to save default path to config:', e);
  }
};

const isHidden = (filePath) => {
  const fileName = path.basename(filePath);
  // Unix-style 隐藏文件（以 . 开头）
  if (fileName.startsWith('.')) return true;
  // Windows 常见隐藏文件/文件夹
  if (os.platform() === 'win32') {
    const hiddenNames = [
      'desktop.ini',
      'thumbs.db',
      '$recycle.bin',
      'system volume information',
      'pagefile.sys',
      'hiberfil.sys'
    ];
    return hiddenNames.includes(fileName.toLowerCase());
  }
  return false;
};
const safeStat = (p) => {
  try { return fs.statSync(p); }
  catch (e) { return ['EPERM', 'EACCES', 'ENOENT'].includes(e.code) ? null : (() => { throw e; })(); }
};

const safeReaddir = (p) => {
  try {
    return fs.readdirSync(p).filter(f => {
      const fullPath = path.join(p, f);
      if (isHidden(fullPath)) return false;
      try { fs.statSync(path.join(p, f)); return true; }
      catch (e) { return !['EPERM', 'EACCES'].includes(e.code); }
    });
  } catch (e) { return ['EPERM', 'EACCES', 'ENOENT'].includes(e.code) ? [] : (() => { throw e; })(); }
};

const formatSize = (b) => b < 1024 ? b + ' B' : b < 1024 ** 2 ? (b / 1024).toFixed(1) + ' KB' : b < 1024 ** 3 ? (b / 1024 ** 2).toFixed(1) + ' MB' : (b / 1024 ** 3).toFixed(1) + ' GB';

const renderHTML = (title, heading, rows, info = '') => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:monospace;padding:20px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd}th{background:#f0f0f0}a{text-decoration:none;color:#06c}a:hover{text-decoration:underline}</style></head><body><h1>${heading}</h1>${info}<table><tr><th>Name</th><th>Size</th><th>Modified</th></tr>${rows}</table></body></html>`;

const getDrives = () => {
  if (os.platform() !== 'win32') return ['/'];
  return Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i) + ':\\').filter(safeStat).map(d => d[0]);
};

const listDrives = (query = {}, basePath = '/browse') => {
  const drives = getDrives();
  const qs = new URLSearchParams(query).toString();
  const suffix = qs ? `?${qs}` : '';

  if (query.mode === 'api' || query.mode === 'json') {
    return {
      type: 'json',
      data: {
        type: 'directory',
        currentPath: '',
        items: drives.map(d => ({
          name: `${d}:`,
          path: `${d}:`,
          url: `${basePath}/${d}:/${suffix}`,
          fileUrl: `${basePath}/${d}:/`,
          // ✅ 添加缩略图 URL
          thumbnailUrl: `${basePath}/${d}:/`,
          isDirectory: true
        })),
        parent: null
      }
    };
  }

  return {
    type: 'html',
    data: renderHTML('All Drives', '💾 All Drives', drives.map(d => `<tr><td><a href="${basePath}/${d}:/${suffix}">📁 ${d}:\\</a></td><td>-</td><td>-</td></tr>`).join(''))
  };
};

const browse = (drivePath, query = {}, basePath = '/browse') => {
  const m = drivePath.match(/^([A-Z]):(.*)$/i);
  if (!m) return { type: 'error', status: 400, message: 'Invalid path' };

  const [, drv, sub] = m;
  const root = `${drv.toUpperCase()}:\\`;
  if (!safeStat(root)) return { type: 'error', status: 404, message: 'Drive not found' };

  let up = (sub || '').replace(/\\/g, '/');
  if (up && !up.startsWith('/')) up = '/' + up;
  if (!up) up = '/';

  const cur = up === '/' ? `${drv.toUpperCase()}:` : `${drv.toUpperCase()}:${up}`;
  const real = path.join(root, up === '/' ? '' : up.replace(/^\//, ''));

  const { mode, sort = 'name', order = 'asc', ext, thumbnail } = query; // ✅ 添加 thumbnail 参数
  const qs = new URLSearchParams(query).toString();
  const suffix = qs ? `?${qs}` : '';

  const st = safeStat(real);
  if (!st) return { type: 'error', status: 404, message: 'Not found' };

  if (st.isFile()) {
    if (mode === 'api' || mode === 'json') {
      return {
        type: 'json',
        data: {
          type: 'file',
          name: path.basename(real),
          path: cur,
          realPath: real,
          safePath: fixPath(real),
          size: st.size,
          modified: st.mtime.getTime(),
          url: `${basePath}/${cur}${suffix}`,
          fileUrl: `${basePath}/${cur}`,
          // ✅ 添加缩略图 URL
          thumbnailUrl: `${basePath}/${cur}?thumbnail=true`
        }
      };
    }

    // ✅ 如果请求缩略图，标记为需要压缩
    if (thumbnail === 'true') {
      return { type: 'thumbnail', path: real };
    }

    return { type: 'file', path: real };
  }

  let items = safeReaddir(real).map(f => {
    const fp = path.join(real, f);
    const fst = safeStat(fp);
    if (!fst) return null;

    const itemPath = up === '/' ? `${drv.toUpperCase()}:/${f}` : `${cur}/${f}`;

    return {
      name: f,
      path: itemPath,
      realPath: fp,
      safePath: fixPath(fp),
      isDirectory: fst.isDirectory(),
      size: fst.size,
      modified: fst.mtime.getTime(),
      ext: path.extname(f).toLowerCase().replace('.', ''),
      isImage: /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f)
    };
  }).filter(Boolean);

  if (ext) items = items.filter(i => i.isDirectory || ext.toLowerCase().split(',').includes(i.ext));

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
      r = a.size - b.size;
    } else if (sort === 'modified') {
      r = a.modified - b.modified;
    } else {
      r = naturalCompare(a.name, b.name);
    }

    return order === 'desc' ? -r : r;
  });

  if (mode === 'api' || mode === 'json') {
    return {
      type: 'json',
      data: {
        type: 'directory',
        currentPath: cur,
        fullPath: real,
        items: items.map(i => ({
          ...i,
          url: `${basePath}/${i.path}${i.isDirectory ? '/' : ''}${suffix}`,
          fileUrl: `${basePath}/${i.path}${i.isDirectory ? '/' : ''}`,
          thumbnailUrl: i.isImage ? `${basePath}/${i.path}?thumbnail=true` : undefined
        })),
        parent: up === '/' ? `${basePath}${suffix}` : `${basePath}/${drv}:${path.dirname(up)}${suffix}`
      }
    };
  }

  const info = sort !== 'name' || order !== 'asc' || ext ? `<p>Sort: ${sort} | Order: ${order}${ext ? ` | Filter: ${ext}` : ''}</p>` : '';
  const parent = up === '/' ? `<tr><td><a href="${basePath}${suffix}">📁 ..</a></td><td>-</td><td>-</td></tr>` : `<tr><td><a href="../${suffix}">📁 ..</a></td><td>-</td><td>-</td></tr>`;
  const rows = parent + items.map(i => `<tr><td><a href="${i.name}${i.isDirectory ? '/' : ''}${suffix}">${i.isDirectory ? '📁' : '📄'} ${i.name}</a></td><td>${i.isDirectory ? '-' : formatSize(i.size)}</td><td>${new Date(i.modified).toLocaleString()}</td></tr>`).join('');

  return {
    type: 'html',
    data: renderHTML(`Index of /${cur}`, `📁 /${cur}`, rows, info)
  };
};

const registerRoutes = (app, basePath = '/browse') => {
  // 获取默认路径
  app.get(`${basePath}/default-path`, (req, res) => {
    res.json({ path: getDefaultPath() });
  });

  // 保存默认路径
  app.post(`${basePath}/default-path`, (req, res) => {
    const { path } = req.body;
    setDefaultPath(path);
    res.json({ success: true });
  });

  app.get(basePath, (req, res) => {
    const result = listDrives(req.query, basePath);
    if (result.type === 'json') return res.json(result.data);
    res.send(result.data);
  });

  app.use(new RegExp(`^${basePath.replace(/\//g, '\\/')}\\/(.*)$`), async (req, res) => {
    const fp = req.params[0]?.replace(/\/$/, '');
    if (!fp) return res.status(400).send('Invalid path');

    const result = browse(fp, req.query, basePath);

    if (result.type === 'error') return res.status(result.status).send(result.message);
    if (result.type === 'json') return res.json(result.data);

    if (result.type === 'thumbnail') {
      if (!readCompressedImage) {
        return res.status(500).send('Image compressor not configured');
      }

      try {
        const imagePathKey = fixPath(result.path).replaceAll('\\', '');
        let imageData = OverviewStorage[imagePathKey];
        if(!imageData) {
          imageData = await readCompressedImage(result.path, { maxWidth: 100 });
          imageData && (OverviewStorage[imagePathKey] = imageData);
        }
        if(imageData) {
          const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');

          const ext = result.path.split('.').pop().toLowerCase();
          const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp'
          };
          const mimeType = mimeTypes[ext] || 'image/png';
          res.set('Content-Type', mimeType);
          res.send(buffer);
          return
        }
        res.status(404).send('Image not found');
        return;
      } catch (error) {
        console.error('Failed to compress image:', error);
        res.status(500).send('Failed to compress image');
      }
      return;
    }

    if (result.type === 'file') return res.sendFile(result.path);
    res.send(result.data);
  });
};

module.exports = { listDrives, browse, registerRoutes };
