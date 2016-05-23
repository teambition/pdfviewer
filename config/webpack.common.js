'use strict'

const webpack = require('webpack')
const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {

  errorDetails: true,

  entry: {
    'index': ['./src/index.js']
  },

  output: {
    path: path.resolve('./dist'),
  },

  resolve: {
    extensions: ['', '.js'],
    root: [
      path.resolve('./src')
    ],
    moduleDirectories: ['node_modules']
  },

  module: {
    loaders: [
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract('css')
      },
      {
        test: /\.(png|gif|cur)/,
        loader: 'url'
      }
    ]
  },

  plugins: [
    new CopyWebpackPlugin([{
      from: 'src/locale',
      to: 'locale'
    }]),
    new CopyWebpackPlugin([{
      from: 'src/images',
      to: 'images'
    }]),
    new CopyWebpackPlugin([{
      from: 'node_modules/pdfjs-dist/cmaps',
      to: 'cmaps'
    }]),
    new HtmlWebpackPlugin({
      template: 'src/index.html',
      inject: 'head'
    }),
    new webpack.NoErrorsPlugin()
  ]
}
