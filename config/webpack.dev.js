'use strict'

const webpack = require('webpack')
const merge = require('webpack-merge')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

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
      'webpack-dev-server/client?http://localhost:9000/'
    ]
  },

  output: {
    pathinfo: true
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/index.html',
      inject: 'head'
    }),

    new webpack.DefinePlugin({
      __PROD__: false
    }),

    new CopyWebpackPlugin([{
      from: 'pdf'
    }]),

    new webpack.HotModuleReplacementPlugin()
  ]

})
