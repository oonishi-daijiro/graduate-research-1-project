const CopyFilePlugin = require("copy-webpack-plugin")
const path = require('path')

module.exports = {
  output: {
    filename: '[name]',
    path: `${path.resolve(__dirname, "../public")}`
  },
  module: {
    rules: [{
      test: /\.tsx?$/,
      use: "ts-loader"
    }]
  },
  plugins: [
    new CopyFilePlugin({
      patterns: [{
        from: './**/*.{css,html}',
        globOptions: {
          ignore: ['**/node_modules/']
        },
        context: './src'
      }]

    })
  ],
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".json"]
  },
  entry: {
    'main.js': './src/main.tsx',
  },
  mode: 'production'
}
