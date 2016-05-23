var PdfViewer = require('../dist/pdfviewer.js')
var container1 = document.getElementById('container1')
var container2 = document.getElementById('container2')

var onError = function(err) {
  console.error(error)
}

var config1 = {
  pdfUrl: '/example.pdf',
  staticHost: '/dist',
  onError: onError
}

new PdfViewer(config1).embed(container1)

var config2 = {
  pdfUrl: '/test.pdf', // no file
  staticHost: '/dist',
  onError: onError
}

new PdfViewer(config2).embed(container2)
