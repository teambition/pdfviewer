;(function(root, factory) {
  'use strict';

  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.PdfViewer = factory();
}(typeof window === 'object' ? window : this, function() {
  'use strict';

  function PdfViewer(opts) {
    this.pdfUrl = opts.pdfUrl || '';
    this.onerror = opts.onerror || null;
    this.staticHost = opts.staticHost || '';
  }

  PdfViewer.prototype.embed = function(container) {
    this.container = container;

    var html = [
      '<!DOCTYPE html><html dir="ltr" mozdisallowselectionprint moznomarginboxes><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">',
      '<link rel="stylesheet" href="'+ this.staticHost + '/css/viewer.css"/>',
      '<link rel="resource" type="application/l10n" href="' + this.staticHost + '/locale/locale.properties"/>',
      '<script src="'+ this.staticHost + '/js/compatibility.js"></script>',
      '<script src="'+ this.staticHost + '/js/l10n.js"></script>',
      '<script src="'+ this.staticHost + '/js/pdf.js"></script>',
      '<script src="' + this.staticHost + '/js/viewer.js"></script>',
      '</head><body tabindex="1" class="loadingInProgress"><div id="outerContainer"><div id="mainContainer"><div id="loadingBar"><div class="progress"><div class="glimmer"></div></div></div><div class="toolbar"><div id="toolbarContainer"><div class="splitToolbarButton"><button id="zoomOut" class="toolbarButton zoomOut" title="Zoom Out" tabindex="21" data-l10n-id="zoom_out"><span data-l10n-id="zoom_out_label">Zoom Out</span></button><button id="zoomIn" class="toolbarButton zoomIn" title="Zoom In" tabindex="22" data-l10n-id="zoom_in"><span data-l10n-id="zoom_in_label">Zoom In</span></button><button id="print" class="toolbarButton print" title="Print" tabindex="33" data-l10n-id="print"><span data-l10n-id="print_label">Print</span></button><button id="download" class="toolbarButton download" title="Download" tabindex="34" data-l10n-id="download"><span data-l10n-id="download_label">Download</span></button></div></div></div><div id="viewerContainer" tabindex="0"><div id="viewer" class="pdfViewer"></div></div><div id="errorWrapper" hidden="true"><div id="errorMessageLeft"><span id="errorMessage"></span><button id="errorShowMore" data-l10n-id="error_more_info"> More Information </button><button id="errorShowLess" data-l10n-id="error_less_info" hidden="true"> Less Information </button></div><div id="errorMessageRight"><button id="errorClose" data-l10n-id="error_close"> Close </button></div><div class="clearBoth"></div><textarea id="errorMoreInfo" hidden="true" readonly="readonly"></textarea></div></div><div id="overlayContainer" class="hidden"><div id="passwordOverlay" class="container hidden"><div class="dialog"><div class="row"><p id="passwordText" data-l10n-id="password_label">Enter the password to open this PDF file:</p></div><div class="row"><input type="password" id="password" class="toolbarField" /></div><div class="buttonRow"><button id="passwordCancel" class="overlayButton"><span data-l10n-id="password_cancel">Cancel</span></button><button id="passwordSubmit" class="overlayButton"><span data-l10n-id="password_ok">OK</span></button></div></div></div></div></div><div id="printContainer"></div></body></html>'
    ].join('');

    var iframe = document.createElement('iframe');
    iframe.height = '100%';
    iframe.width = '100%';
    iframe.frameBorder = 'none';
    iframe.src = '';

    container.innerHTML = '';
    container.appendChild(iframe);

    var self =  this;
    // `container` MUST be in the DOM already
    var win  = iframe.contentWindow;
    win.document.open();
    win.document.write(html);
    win.document.close();

    if (typeof self.onerror === 'function') {
      win.onerror = function(err) { self.onerror(err); };
    }

    win.FILE_URL = self.pdfUrl;

    return this;

  };

  PdfViewer.prototype.destroy = function() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  };

  return PdfViewer;

}));
