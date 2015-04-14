// **Github:** https://github.com/teambition/pdfviewer
//
// **License:** MIT

/* global module, define, setImmediate */
;(function(root, factory) {
  'use strict';

  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.PdfViewer = factory();
}(typeof window === 'object' ? window : this, function() {
  'use strict';

  function PdfViewer() {}

  return PdfViewer;

}));
