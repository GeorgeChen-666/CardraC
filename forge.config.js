// forge.config.js
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');
const fs = require('fs');

const isProduction = process.argv.includes('package') ||
  process.argv.includes('make') ||
  process.argv.includes('publish');

if (isProduction) {
  process.env.NODE_ENV = 'production';
} else {
  process.env.NODE_ENV = 'development';
}

//Electron 瘦身函数
function slimElectron(buildPath, platform) {
  console.log('🔧 开始 Electron 瘦身...');
  console.log('📂 应用路径:', buildPath);

  //Electron 根目录在 buildPath 的上两级
  // buildPath = .../resources/app
  // electronRoot = .../
  const electronRoot = path.join(buildPath, '..', '..');
  console.log('📂 Electron 根目录:', electronRoot);

  let totalSaved = 0;

  // 1️⃣ 删除多余语言包
  const localesPath = path.join(electronRoot, 'locales');
  console.log('🔍 检查语言包路径:', localesPath);

  if (fs.existsSync(localesPath)) {
    const keepLocales = ['en-US.pak', 'zh-CN.pak'];
    const files = fs.readdirSync(localesPath);
    console.log(`📦 找到 ${files.length} 个语言包`);

    let deletedCount = 0;
    files.forEach(file => {
      if (!keepLocales.includes(file)) {
        const filePath = path.join(localesPath, file);
        try {
          const size = fs.statSync(filePath).size;
          fs.unlinkSync(filePath);
          totalSaved += size;
          deletedCount++;
        } catch (error) {
          console.warn(`  ⚠️ 无法删除: ${file}`);
        }
      }
    });

    console.log(`✅ 删除 ${deletedCount} 个语言包 (保留: ${keepLocales.join(', ')})`);
  } else {
    console.log('⚠️ 语言包路径不存在');
  }

  // 2️⃣ 删除 PDF 查看器
  const pdfPath = path.join(electronRoot, 'pdf_viewer_resources');
  console.log('🔍 检查 PDF 查看器路径:', pdfPath);

  if (fs.existsSync(pdfPath)) {
    try {
      const size = getFolderSize(pdfPath);
      fs.rmSync(pdfPath, { recursive: true, force: true });
      totalSaved += size;
      console.log(`✅ 删除 PDF 查看器 (${(size / 1024 / 1024).toFixed(2)} MB)`);
    } catch (error) {
      console.warn('⚠️ 无法删除 PDF 查看器:', error.message);
    }
  } else {
    console.log('⚠️ PDF 查看器路径不存在');
  }

  // 3️⃣ 删除 DevTools
  const devtoolsPaths = [
    path.join(buildPath, 'electron.asar.unpacked', 'default_app'),
    path.join(buildPath, '..', 'default_app.asar')
  ];

  devtoolsPaths.forEach(p => {
    console.log('🔍 检查 DevTools 路径:', p);
    if (fs.existsSync(p)) {
      try {
        const stats = fs.statSync(p);
        const size = stats.isDirectory() ? getFolderSize(p) : stats.size;
        fs.rmSync(p, { recursive: true, force: true });
        totalSaved += size;
        console.log(` 删除: ${path.basename(p)} (${(size / 1024 / 1024).toFixed(2)} MB)`);
      } catch (error) {
        console.warn(`  ⚠️ 无法删除: ${p}`, error.message);
      }
    } else {
      console.log('  ⚠️ 路径不存在');
    }
  });

  // 4️⃣ 删除不需要的 DLL (Windows)
  if (platform === 'win32') {
    const unnecessaryFiles = [
      'vk_swiftshader.dll',
      'vk_swiftshader_icd.json',
      'd3dcompiler_47.dll',
    ];

    let deletedDllCount = 0;
    unnecessaryFiles.forEach(file => {
      const filePath = path.join(electronRoot, file);

      if (fs.existsSync(filePath)) {
        try {
          const size = fs.statSync(filePath).size;
          fs.unlinkSync(filePath);
          totalSaved += size;
          deletedDllCount++;
          console.log(` 删除: ${file} (${(size / 1024 / 1024).toFixed(2)} MB)`);
        } catch (error) {
          console.warn(`  ⚠️ 无法删除: ${file}`);
        }
      }
    });

    console.log(`✅ 删除 ${deletedDllCount} 个不必要的 DLL`);
  }

  // 5️⃣ 删除 LICENSES.chromium.html
  const licensePaths = [
    path.join(electronRoot, 'LICENSES.chromium.html'),
    path.join(electronRoot, 'LICENSE'),
    path.join(electronRoot, 'LICENSES.chromium.html.gz')
  ];

  let deletedLicenseCount = 0;
  licensePaths.forEach(licensePath => {
    if (fs.existsSync(licensePath)) {
      try {
        const size = fs.statSync(licensePath).size;
        fs.unlinkSync(licensePath);
        totalSaved += size;
        deletedLicenseCount++;
        console.log(` 删除: ${path.basename(licensePath)} (${(size / 1024).toFixed(2)} KB)`);
      } catch (error) {
        console.warn(`  ⚠️ 无法删除: ${path.basename(licensePath)}`);
      }
    }
  });

  if (deletedLicenseCount > 0) {
    console.log(`✅ 删除 ${deletedLicenseCount} 个许可证文件`);
  }

  const savedMB = (totalSaved / 1024 / 1024).toFixed(2);
  console.log(`\n🎉 瘦身完成！节省约 ${savedMB} MB\n`);
}

function getFolderSize(folderPath) {
  let size = 0;

  try {
    const files = fs.readdirSync(folderPath);

    files.forEach(file => {
      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        size += getFolderSize(filePath);
      } else {
        size += stats.size;
      }
    });
  } catch (error) {
    console.warn(`⚠️ 无法读取文件夹: ${folderPath}`);
  }

  return size;
}

module.exports = {
  packagerConfig: {
    icon: "icon",
    asar: {
      unpack: "**/node_modules/{sharp,@img}/**/*"
    },
    extraResource: [
      'src/main/locales',
      'node_modules/sql.js/dist/sql-wasm.wasm'
    ],
    prune: true,
    derefSymlinks: true
  },
  rebuildConfig: {},
  hooks: {
    packageAfterPrune: async (config, buildPath, electronVersion, platform, arch) => {
      console.log('\n📦 packageAfterPrune 钩子触发');
      console.log('平台:', platform);
      console.log('架构:', arch);
      slimElectron(buildPath, platform);
    }
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        setupExe: 'CardraC-Setup.exe',
        setupIcon: 'icon.ico'
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        devContentSecurityPolicy: "default-src 'self' 'unsafe-inline' data:; img-src 'self' http://localhost:* file://* data: blob: cardrac:; script-src 'self' 'unsafe-eval' 'unsafe-inline' data:; connect-src 'self' http://localhost:* ws://localhost:*",
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './index.html',
              js: `./src/renderer/renderer.js`,
              name: 'main_window',
              preload: {
                js: './src/renderer/preload.js',
              },
            },
          ],
        },
      },
    },
    {
      name: "@timfish/forge-externals-plugin",
      config: {
        "externals": ["sharp"],
        "includeDeps": true
      }
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
