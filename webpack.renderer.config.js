const rules = require('./webpack.rules');

module.exports = {
  // Put your normal webpack config below here
  target: 'electron-renderer',
  resolve:{
    extensions:['.js','.jsx','.json']
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
};
