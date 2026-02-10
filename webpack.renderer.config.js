const rules = require('./webpack.rules');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  // Put your normal webpack config below here
  target: 'electron-renderer',
  entry: `./src/renderer/index.js`,
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
  resolve:{
    extensions:['.js','.jsx','.json']
  },
  devServer: {
    hot: true,
    watchFiles: {
      paths: ['src/**/*', 'public/**/*'],
    },
  },
  module: {
    rules: [ ...rules,
      {
        test: /\.jsx?$/,
        use: {
          loader: 'babel-loader',
          options: {
            exclude: /node_modules/,
            presets: ['@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
      }
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          // Copy content from `./public/` folder to our output directory
          context: './public/',
          from: '**/*',
          to: 'public'
        }
      ],
    }),
  ],
  optimization: {
    minimize: process.env.NODE_ENV === 'production',
    usedExports: true,
    concatenateModules: true,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
        },
      },
    },
  },
};
