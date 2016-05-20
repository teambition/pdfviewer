const webpack = require('webpack')
const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
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
    path: path.join(__dirname, './dist'),
    publicPath: '',
    filename: '[name].[hash:8].js',
    pathinfo: true
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
    new ExtractTextPlugin('[name].[hash:8].css'),

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

		new CopyWebpackPlugin([{
			from: 'src/compressed.tracemonkey-pldi-09.pdf'
		}]),

    new HtmlWebpackPlugin({
      template: 'src/index.html',
      inject: 'head'
    }),

    new webpack.HotModuleReplacementPlugin()
  ]
}
