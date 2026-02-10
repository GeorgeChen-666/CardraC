module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/main/index.js',
  // Put your normal webpack config below here
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
  module: {
    rules: require('./webpack.rules'),
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
  externals: {
    'sharp': 'commonjs sharp',
  },
  optimization: {
    minimize: process.env.NODE_ENV === 'production',
    // 移除未使用的代码
    usedExports: true,
    // 合并模块
    concatenateModules: true,
  },
};
