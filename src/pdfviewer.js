'use strict'

var PdfViewer = function(opts) {
  this.pdfUrl = opts.pdfUrl || ''
  this.onerror = opts.onerror || null
  this.staticHost = opts.staticHost || ''
  this.download = opts.download || ''
}

PdfViewer.prototype.embed = function(container) {
  this.container = container

  var iframe = document.createElement('iframe')
  iframe.height = '100%'
  iframe.width = '100%'
  iframe.frameBorder = 'none'
  iframe.src = this.staticHost + '?file=' + encodeURIComponent(this.pdfUrl) + '&width=' + container.clientWidth + '&download=' + this.download

  container.innerHTML = ''
  container.appendChild(iframe)

  var self =  this, receiveMessage

  if (typeof self.onerror !== 'function') { return }

  this.receiveMessage = receiveMessage = function (event) {
    var origin = event.origin
    var error  = event.data
    if(self.staticHost.indexOf(origin) == -1) { return }
    self.onerror(error)
    window.removeEventListener('message', receiveMessage, false)
  }

  window.addEventListener('message', receiveMessage, false)

  return this

}

PdfViewer.prototype.destroy = function() {
  if (this.container) {
    this.container.innerHTML = ''
  }
  if (this.receiveMessage) {
    window.removeEventListener('message', this.receiveMessage, false)
  }
}

module.exports = PdfViewer
