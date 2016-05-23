var PdfViewer = require('../src/pdfviewer.js')

var staticHost = 'http://localhost:9000'
var onError = console.error.bind(console)

// normal case
var config1 = {
  pdfUrl: '/example.pdf',
  staticHost: staticHost,
  onError: onError
}
new PdfViewer(config1).embed(document.getElementById('container1'))

// password: 123456
var config2 = {
  pdfUrl: '/password.pdf',
  staticHost: staticHost,
  onError: onError
}

new PdfViewer(config2).embed(document.getElementById('container2'))

// chinese
var config3 = {
  pdfUrl: '/chinese.pdf',
  staticHost: staticHost,
  onError: onError
}

new PdfViewer(config3).embed(document.getElementById('container3'))

// no file
var config4 = {
  pdfUrl: '/nofile.pdf',
  staticHost: staticHost,
  onError: onError
}

new PdfViewer(config4).embed(document.getElementById('container4'))
