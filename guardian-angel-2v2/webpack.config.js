const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  devtool: 'cheap-module-source-map',
  entry: {
    popup: './src/popup/popup.js',
    content: './src/content/content.js',
    background: './src/background/background.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: './src/manifest.json', to: 'manifest.json' },
        { from: './src/popup/popup.html', to: 'popup.html' },
        { from: './src/popup/popup.css', to: 'popup.css' },
        { from: './src/assets', to: 'assets' },
      ],
    }),
  ],
};
