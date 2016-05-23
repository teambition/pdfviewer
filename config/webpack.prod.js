'use strict'

const webpack = require('webpack')
const merge = require('webpack-merge')
const path = require ('path')
const CleanWebpackPlugin = require('clean-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin')

const commonConfig = require('./webpack.common.js')

module.exports = merge(commonConfig, {
  output: {
    filename: '[name].[hash:8].js'
  },

  plugins: [
    new ExtractTextPlugin('[name].[hash:8].css'),

    new CleanWebpackPlugin(['dist'], {
      root: path.resolve(__dirname, '../'),
      verbose: true,
      dry: false
    }),

    new webpack.optimize.UglifyJsPlugin({
      compress: {warnings: false},
      sourceMap: false
    }),

    new webpack.optimize.DedupePlugin()
  ]

})
