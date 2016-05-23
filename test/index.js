var PdfViewer = require('../dist/pdfviewer.js')

var onError = console.error.bind(console)

// normal case
var config1 = {
  pdfUrl: '/example.pdf',
  staticHost: '/dist',
  onError: onError
}
new PdfViewer(config1).embed(document.getElementById('container1'))

// password: 123456
var config2 = {
  pdfUrl: '/password.pdf',
  staticHost: '/dist',
  onError: onError
}

new PdfViewer(config2).embed(document.getElementById('container2'))

// no file
var config3 = {
  pdfUrl: '/nofile.pdf',
  staticHost: '/dist',
  onError: onError
}

new PdfViewer(config3).embed(document.getElementById('container3'))
