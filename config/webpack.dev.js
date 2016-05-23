'use strict'

const webpack = require('webpack')
const merge = require('webpack-merge')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

const commonConfig = require('./webpack.common.js')

module.exports = merge(commonConfig, {
  delay: 50,

  debug: true,

  devtool: 'eval',

  devServer: {
    stats: 'errors-only'
  },

  entry: {
    'index': [
      './src/index.js',
      'webpack/hot/dev-server',
      'webpack-dev-server/client?http://localhost:8080/'
    ]
  },

  output: {
    filename: '[name].js',
    pathinfo: true
  },

  plugins: [
    new ExtractTextPlugin('[name].css'),

    new webpack.HotModuleReplacementPlugin(),

    new CopyWebpackPlugin([{
      from: 'src/compressed.tracemonkey-pldi-09.pdf'
    }]),
  ]

})
