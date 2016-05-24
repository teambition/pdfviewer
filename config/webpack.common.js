'use strict'

const webpack = require('webpack')
const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

module.exports = {

  errorDetails: true,

  entry: {
    'index': './src/index.js',
    'index.worker': 'pdfjs-dist/build/pdf.worker.entry.js'
  },

  output: {
    filename: '[name].js',
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
    new ExtractTextPlugin('[name].css'),

    new CopyWebpackPlugin([{
      from: 'src/pdfviewer.js',
    }]),

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

    new webpack.NoErrorsPlugin()
  ]
}
