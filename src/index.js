require('./viewer.css')

var pdfjsLib = require('pdfjs-dist')
window.pdfjsDistBuildPdf = pdfjsLib
window.pdfjsDistBuildPdf.PDFJS.workerSrc = './index.worker.js'
window.pdfjsDistBuildPdf.PDFJS.cMapUrl = './cmaps/'

require('pdfjs-dist/web/compatibility')
require('webl10n')
require('./viewer')
