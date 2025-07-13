const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const renderKey = process.env.npm_lifecycle_event === 'renderer';
module.exports = {
  packagerConfig: {
    icon: "icon",
    asar: {
      unpack: "**/node_modules/{sharp,@img}/**/*"
    }
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
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
        devContentSecurityPolicy: 'default-src \'self\' \'unsafe-inline\' data:; img-src \'self\' file://* data: blob:; script-src \'self\' \'unsafe-eval\' \'unsafe-inline\' data:',
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './index.html',
              js: `./src/${renderKey}/renderer.js`,
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
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
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
