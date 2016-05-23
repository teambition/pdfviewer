'use strict'

const webpack = require('webpack')
const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {

  errorDetails: true,

  delay: 50,

  debug: true,

  devtool: 'eval',

  devServer: {
    stats: 'errors-only'
  },

  entry: {
    'index': [
      './test/index.js',
      'webpack/hot/dev-server',
      'webpack-dev-server/client?http://localhost:9001/'
    ]
  },

  output: {
    filename: '[name].js',
    pathinfo: true
  },

  resolve: {
    extensions: ['', '.js'],
    root: [
      path.resolve('./test')
    ],
    moduleDirectories: ['node_modules']
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: 'test/index.html',
      inject: 'body'
    }),

    new webpack.HotModuleReplacementPlugin(),

    new webpack.NoErrorsPlugin()
  ]
}
