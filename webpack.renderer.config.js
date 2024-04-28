const rules = require('./webpack.rules');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  // Put your normal webpack config below here
  target: 'electron-renderer',
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
  ]
};
