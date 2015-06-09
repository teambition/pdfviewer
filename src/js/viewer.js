/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

(function(window, document) {

/* default-preferences.js */
var DEFAULT_PREFERENCES = {
  showPreviousViewOnLoad: true,
  defaultZoomValue: '',
  sidebarViewOnLoad: 0,
  enableHandToolOnLoad: false,
  enableWebGL: false,
  pdfBugEnabled: false,
  disableRange: false,
  disableStream: false,
  disableAutoFetch: false,
  disableFontFace: false,
//#if B2G
//disableTextLayer: true,
//useOnlyCssZoom: true
//#else
  disableTextLayer: false,
  useOnlyCssZoom: false
//#endif
};
/* end default_preferences.js */

/* ui_utils.js */
var CSS_UNITS = 96.0 / 72.0;
var DEFAULT_SCALE = 'auto';
var UNKNOWN_SCALE = 0;
var MAX_AUTO_SCALE = 1.25;
var SCROLLBAR_PADDING = 40;
var VERTICAL_PADDING = 5;

// optimised CSS custom property getter/setter
var CustomStyle = (function CustomStyleClosure() {

  // As noted on: http://www.zachstronaut.com/posts/2009/02/17/
  //              animate-css-transforms-firefox-webkit.html
  // in some versions of IE9 it is critical that ms appear in this list
  // before Moz
  var prefixes = ['ms', 'Moz', 'Webkit', 'O'];
  var _cache = {};

  function CustomStyle() {}

  CustomStyle.getProp = function get(propName, element) {
    // check cache only when no element is given
    if (arguments.length === 1 && typeof _cache[propName] === 'string') {
      return _cache[propName];
    }

    element = element || document.documentElement;
    var style = element.style, prefixed, uPropName;

    // test standard property first
    if (typeof style[propName] === 'string') {
      return (_cache[propName] = propName);
    }

    // capitalize
    uPropName = propName.charAt(0).toUpperCase() + propName.slice(1);

    // test vendor specific properties
    for (var i = 0, l = prefixes.length; i < l; i++) {
      prefixed = prefixes[i] + uPropName;
      if (typeof style[prefixed] === 'string') {
        return (_cache[propName] = prefixed);
      }
    }

    //if all fails then set to undefined
    return (_cache[propName] = 'undefined');
  };

  CustomStyle.setProp = function set(propName, element, str) {
    var prop = this.getProp(propName);
    if (prop !== 'undefined') {
      element.style[prop] = str;
    }
  };

  return CustomStyle;
})();

function getFileName(url) {
  var anchor = url.indexOf('#');
  var query = url.indexOf('?');
  var end = Math.min(
    anchor > 0 ? anchor : url.length,
    query > 0 ? query : url.length);
  return url.substring(url.lastIndexOf('/', end) + 1, end);
}

/**
 * Returns scale factor for the canvas. It makes sense for the HiDPI displays.
 * @return {Object} The object with horizontal (sx) and vertical (sy)
                    scales. The scaled property is set to false if scaling is
                    not required, true otherwise.
 */
function getOutputScale(ctx) {
  var devicePixelRatio = window.devicePixelRatio || 1;
  var backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
                          ctx.mozBackingStorePixelRatio ||
                          ctx.msBackingStorePixelRatio ||
                          ctx.oBackingStorePixelRatio ||
                          ctx.backingStorePixelRatio || 1;
  var pixelRatio = devicePixelRatio / backingStoreRatio;
  return {
    sx: pixelRatio,
    sy: pixelRatio,
    scaled: pixelRatio !== 1
  };
}

/**
 * Scrolls specified element into view of its parent.
 * element {Object} The element to be visible.
 * spot {Object} An object with optional top and left properties,
 *               specifying the offset from the top left edge.
 */
function scrollIntoView(element, spot) {
  // Assuming offsetParent is available (it's not available when viewer is in
  // hidden iframe or object). We have to scroll: if the offsetParent is not set
  // producing the error. See also animationStartedClosure.
  var parent = element.offsetParent;
  var offsetY = element.offsetTop + element.clientTop;
  var offsetX = element.offsetLeft + element.clientLeft;
  if (!parent) {
    console.error('offsetParent is not set -- cannot scroll');
    return;
  }
  while (parent.clientHeight === parent.scrollHeight) {
    if (parent.dataset._scaleY) {
      offsetY /= parent.dataset._scaleY;
      offsetX /= parent.dataset._scaleX;
    }
    offsetY += parent.offsetTop;
    offsetX += parent.offsetLeft;
    parent = parent.offsetParent;
    if (!parent) {
      return; // no need to scroll
    }
  }
  if (spot) {
    if (spot.top !== undefined) {
      offsetY += spot.top;
    }
    if (spot.left !== undefined) {
      offsetX += spot.left;
      parent.scrollLeft = offsetX;
    }
  }
  parent.scrollTop = offsetY;
}

/**
 * Helper function to start monitoring the scroll event and converting them into
 * PDF.js friendly one: with scroll debounce and scroll direction.
 */
function watchScroll(viewAreaElement, callback) {
  var debounceScroll = function debounceScroll(evt) {
    if (rAF) {
      return;
    }
    // schedule an invocation of scroll for next animation frame.
    rAF = window.requestAnimationFrame(function viewAreaElementScrolled() {
      rAF = null;

      var currentY = viewAreaElement.scrollTop;
      var lastY = state.lastY;
      if (currentY !== lastY) {
        state.down = currentY > lastY;
      }
      state.lastY = currentY;
      callback(state);
    });
  };

  var state = {
    down: true,
    lastY: viewAreaElement.scrollTop,
    _eventHandler: debounceScroll
  };

  var rAF = null;
  viewAreaElement.addEventListener('scroll', debounceScroll, true);
  return state;
}

/**
 * Use binary search to find the index of the first item in a given array which
 * passes a given condition. The items are expected to be sorted in the sense
 * that if the condition is true for one item in the array, then it is also true
 * for all following items.
 *
 * @returns {Number} Index of the first array element to pass the test,
 *                   or |items.length| if no such element exists.
 */
function binarySearchFirstItem(items, condition) {
  var minIndex = 0;
  var maxIndex = items.length - 1;

  if (items.length === 0 || !condition(items[maxIndex])) {
    return items.length;
  }
  if (condition(items[minIndex])) {
    return minIndex;
  }

  while (minIndex < maxIndex) {
    var currentIndex = (minIndex + maxIndex) >> 1;
    var currentItem = items[currentIndex];
    if (condition(currentItem)) {
      maxIndex = currentIndex;
    } else {
      minIndex = currentIndex + 1;
    }
  }
  return minIndex; /* === maxIndex */
}

/**
 * Generic helper to find out what elements are visible within a scroll pane.
 */
function getVisibleElements(scrollEl, views, sortByVisibility) {
  var top = scrollEl.scrollTop, bottom = top + scrollEl.clientHeight;
  var left = scrollEl.scrollLeft, right = left + scrollEl.clientWidth;

  function isElementBottomBelowViewTop(view) {
    var element = view.div;
    var elementBottom =
      element.offsetTop + element.clientTop + element.clientHeight;
    return elementBottom > top;
  }

  var visible = [], view, element;
  var currentHeight, viewHeight, hiddenHeight, percentHeight;
  var currentWidth, viewWidth;
  var firstVisibleElementInd = (views.length === 0) ? 0 :
    binarySearchFirstItem(views, isElementBottomBelowViewTop);

  for (var i = firstVisibleElementInd, ii = views.length; i < ii; i++) {
    view = views[i];
    element = view.div;
    currentHeight = element.offsetTop + element.clientTop;
    viewHeight = element.clientHeight;

    if (currentHeight > bottom) {
      break;
    }

    currentWidth = element.offsetLeft + element.clientLeft;
    viewWidth = element.clientWidth;
    if (currentWidth + viewWidth < left || currentWidth > right) {
      continue;
    }
    hiddenHeight = Math.max(0, top - currentHeight) +
      Math.max(0, currentHeight + viewHeight - bottom);
    percentHeight = ((viewHeight - hiddenHeight) * 100 / viewHeight) | 0;

    visible.push({
      id: view.id,
      x: currentWidth,
      y: currentHeight,
      view: view,
      percent: percentHeight
    });
  }

  var first = visible[0];
  var last = visible[visible.length - 1];

  if (sortByVisibility) {
    visible.sort(function(a, b) {
      var pc = a.percent - b.percent;
      if (Math.abs(pc) > 0.001) {
        return -pc;
      }
      return a.id - b.id; // ensure stability
    });
  }
  return {first: first, last: last, views: visible};
}

/**
 * Event handler to suppress context menu.
 */
function noContextMenuHandler(e) {
  e.preventDefault();
}

/**
 * Returns the filename or guessed filename from the url (see issue 3455).
 * url {String} The original PDF location.
 * @return {String} Guessed PDF file name.
 */
function getPDFFileNameFromURL(url) {
  var reURI = /^(?:([^:]+:)?\/\/[^\/]+)?([^?#]*)(\?[^#]*)?(#.*)?$/;
  //            SCHEME      HOST         1.PATH  2.QUERY   3.REF
  // Pattern to get last matching NAME.pdf
  var reFilename = /[^\/?#=]+\.pdf\b(?!.*\.pdf\b)/i;
  var splitURI = reURI.exec(url);
  var suggestedFilename = reFilename.exec(splitURI[1]) ||
                           reFilename.exec(splitURI[2]) ||
                           reFilename.exec(splitURI[3]);
  if (suggestedFilename) {
    suggestedFilename = suggestedFilename[0];
    if (suggestedFilename.indexOf('%') !== -1) {
      // URL-encoded %2Fpath%2Fto%2Ffile.pdf should be file.pdf
      try {
        suggestedFilename =
          reFilename.exec(decodeURIComponent(suggestedFilename))[0];
      } catch(e) { // Possible (extremely rare) errors:
        // URIError "Malformed URI", e.g. for "%AA.pdf"
        // TypeError "null has no properties", e.g. for "%2F.pdf"
      }
    }
  }

  return suggestedFilename || 'document.pdf';
}

var ProgressBar = (function ProgressBarClosure() {

  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }

  function ProgressBar(id, opts) {
    this.visible = true;

    // Fetch the sub-elements for later.
    this.div = document.querySelector(id + ' .progress');

    // Get the loading bar element, so it can be resized to fit the viewer.
    this.bar = this.div.parentNode;

    // Get options, with sensible defaults.
    this.height = opts.height || 100;
    this.width = opts.width || 100;
    this.units = opts.units || '%';

    // Initialize heights.
    this.div.style.height = this.height + this.units;
    this.percent = 0;
  }

  ProgressBar.prototype = {

    updateBar: function ProgressBar_updateBar() {
      if (this._indeterminate) {
        this.div.classList.add('indeterminate');
        this.div.style.width = this.width + this.units;
        return;
      }

      this.div.classList.remove('indeterminate');
      var progressSize = this.width * this._percent / 100;
      this.div.style.width = progressSize + this.units;
    },

    get percent() {
      return this._percent;
    },

    set percent(val) {
      this._indeterminate = isNaN(val);
      this._percent = clamp(val, 0, 100);
      this.updateBar();
    },

    setWidth: function ProgressBar_setWidth(viewer) {
      if (viewer) {
        var container = viewer.parentNode;
        var scrollbarWidth = container.offsetWidth - viewer.offsetWidth;
        if (scrollbarWidth > 0) {
          this.bar.setAttribute('style', 'width: calc(100% - ' +
                                         scrollbarWidth + 'px);');
        }
      }
    },

    hide: function ProgressBar_hide() {
      if (!this.visible) {
        return;
      }
      this.visible = false;
      this.bar.classList.add('hidden');
      document.body.classList.remove('loadingInProgress');
    },

    show: function ProgressBar_show() {
      if (this.visible) {
        return;
      }
      this.visible = true;
      document.body.classList.add('loadingInProgress');
      this.bar.classList.remove('hidden');
    }
  };

  return ProgressBar;
})();
/* end ui_utils.js */

/* preferences.js */
/**
 * Preferences - Utility for storing persistent settings.
 *   Used for settings that should be applied to all opened documents,
 *   or every time the viewer is loaded.
 */
var Preferences = {
  prefs: Object.create(DEFAULT_PREFERENCES),
  isInitializedPromiseResolved: false,
  initializedPromise: null,

  /**
   * Initialize and fetch the current preference values from storage.
   * @return {Promise} A promise that is resolved when the preferences
   *                   have been initialized.
   */
  initialize: function preferencesInitialize() {
    return this.initializedPromise =
        this._readFromStorage(DEFAULT_PREFERENCES).then(function(prefObj) {
      this.isInitializedPromiseResolved = true;
      if (prefObj) {
        this.prefs = prefObj;
      }
    }.bind(this));
  },

  /**
   * Stub function for writing preferences to storage.
   * NOTE: This should be overridden by a build-specific function defined below.
   * @param {Object} prefObj The preferences that should be written to storage.
   * @return {Promise} A promise that is resolved when the preference values
   *                   have been written.
   */
  _writeToStorage: function preferences_writeToStorage(prefObj) {
    return Promise.resolve();
  },

  /**
   * Stub function for reading preferences from storage.
   * NOTE: This should be overridden by a build-specific function defined below.
   * @param {Object} prefObj The preferences that should be read from storage.
   * @return {Promise} A promise that is resolved with an {Object} containing
   *                   the preferences that have been read.
   */
  _readFromStorage: function preferences_readFromStorage(prefObj) {
    return Promise.resolve();
  },

  /**
   * Reset the preferences to their default values and update storage.
   * @return {Promise} A promise that is resolved when the preference values
   *                   have been reset.
   */
  reset: function preferencesReset() {
    return this.initializedPromise.then(function() {
      this.prefs = Object.create(DEFAULT_PREFERENCES);
      return this._writeToStorage(DEFAULT_PREFERENCES);
    }.bind(this));
  },

  /**
   * Replace the current preference values with the ones from storage.
   * @return {Promise} A promise that is resolved when the preference values
   *                   have been updated.
   */
  reload: function preferencesReload() {
    return this.initializedPromise.then(function () {
      this._readFromStorage(DEFAULT_PREFERENCES).then(function(prefObj) {
        if (prefObj) {
          this.prefs = prefObj;
        }
      }.bind(this));
    }.bind(this));
  },

  /**
   * Set the value of a preference.
   * @param {string} name The name of the preference that should be changed.
   * @param {boolean|number|string} value The new value of the preference.
   * @return {Promise} A promise that is resolved when the value has been set,
   *                   provided that the preference exists and the types match.
   */
  set: function preferencesSet(name, value) {
    return this.initializedPromise.then(function () {
      if (DEFAULT_PREFERENCES[name] === undefined) {
        throw new Error('preferencesSet: \'' + name + '\' is undefined.');
      } else if (value === undefined) {
        throw new Error('preferencesSet: no value is specified.');
      }
      var valueType = typeof value;
      var defaultType = typeof DEFAULT_PREFERENCES[name];

      if (valueType !== defaultType) {
        if (valueType === 'number' && defaultType === 'string') {
          value = value.toString();
        } else {
          throw new Error('Preferences_set: \'' + value + '\' is a \"' +
                          valueType + '\", expected \"' + defaultType + '\".');
        }
      } else {
        if (valueType === 'number' && (value | 0) !== value) {
          throw new Error('Preferences_set: \'' + value +
                          '\' must be an \"integer\".');
        }
      }
      this.prefs[name] = value;
      return this._writeToStorage(this.prefs);
    }.bind(this));
  },

  /**
   * Get the value of a preference.
   * @param {string} name The name of the preference whose value is requested.
   * @return {Promise} A promise that is resolved with a {boolean|number|string}
   *                   containing the value of the preference.
   */
  get: function preferencesGet(name) {
    return this.initializedPromise.then(function () {
      var defaultValue = DEFAULT_PREFERENCES[name];

      if (defaultValue === undefined) {
        throw new Error('preferencesGet: \'' + name + '\' is undefined.');
      } else {
        var prefValue = this.prefs[name];

        if (prefValue !== undefined) {
          return prefValue;
        }
      }
      return defaultValue;
    }.bind(this));
  }
};


//#if !(FIREFOX || MOZCENTRAL || B2G || CHROME)
Preferences._writeToStorage = function (prefObj) {
  return new Promise(function (resolve) {
    localStorage.setItem('pdfjs.preferences', JSON.stringify(prefObj));
    resolve();
  });
};

Preferences._readFromStorage = function (prefObj) {
  return new Promise(function (resolve) {
    var readPrefs = JSON.parse(localStorage.getItem('pdfjs.preferences'));
    resolve(readPrefs);
  });
};
//#endif
/* end preferences.js */


/* download_manager.js */
var DownloadManager = (function DownloadManagerClosure() {

  function download(blobUrl, filename) {
    var a = document.createElement('a');
    if (a.click) {
      // Use a.click() if available. Otherwise, Chrome might show
      // "Unsafe JavaScript attempt to initiate a navigation change
      //  for frame with URL" and not open the PDF at all.
      // Supported by (not mentioned = untested):
      // - Firefox 6 - 19 (4- does not support a.click, 5 ignores a.click)
      // - Chrome 19 - 26 (18- does not support a.click)
      // - Opera 9 - 12.15
      // - Internet Explorer 6 - 10
      // - Safari 6 (5.1- does not support a.click)
      a.href = blobUrl;
      a.target = '_parent';
      // Use a.download if available. This increases the likelihood that
      // the file is downloaded instead of opened by another PDF plugin.
      if ('download' in a) {
        a.download = filename;
      }
      // <a> must be in the document for IE and recent Firefox versions.
      // (otherwise .click() is ignored)
      (document.body || document.documentElement).appendChild(a);
      a.click();
      a.parentNode.removeChild(a);
    } else {
      if (window.top === window &&
          blobUrl.split('#')[0] === window.location.href.split('#')[0]) {
        // If _parent == self, then opening an identical URL with different
        // location hash will only cause a navigation, not a download.
        var padCharacter = blobUrl.indexOf('?') === -1 ? '?' : '&';
        blobUrl = blobUrl.replace(/#|$/, padCharacter + '$&');
      }
      window.open(blobUrl, '_parent');
    }
  }

  function DownloadManager() {}

  DownloadManager.prototype = {
    downloadUrl: function DownloadManager_downloadUrl(url, filename) {
      if (!PDFJS.isValidUrl(url, true)) {
        return; // restricted/invalid URL
      }

      download(url + '#pdfjs.action=download', filename);
    },

    downloadData: function DownloadManager_downloadData(data, filename,
                                                        contentType) {
      if (navigator.msSaveBlob) { // IE10 and above
        return navigator.msSaveBlob(new Blob([data], { type: contentType }),
                                    filename);
      }

      var blobUrl = PDFJS.createObjectURL(data, contentType);
      download(blobUrl, filename);
    },

    download: function DownloadManager_download(blob, url, filename) {
      if (!URL) {
        // URL.createObjectURL is not supported
        this.downloadUrl(url, filename);
        return;
      }

      if (navigator.msSaveBlob) {
        // IE10 / IE11
        if (!navigator.msSaveBlob(blob, filename)) {
          this.downloadUrl(url, filename);
        }
        return;
      }

      var blobUrl = URL.createObjectURL(blob);
      download(blobUrl, filename);
    }
  };

  return DownloadManager;
})();
/* end download_manager.js */


/* pdf_rendering_queue.js */
var CLEANUP_TIMEOUT = 30000;
var RenderingStates = {
  INITIAL: 0,
  RUNNING: 1,
  PAUSED: 2,
  FINISHED: 3
};
/**
 * Controls rendering of the views for pages and thumbnails.
 * @class
 */
var PDFRenderingQueue = (function PDFRenderingQueueClosure() {
  /**
   * @constructs
   */
  function PDFRenderingQueue() {
    this.pdfViewer = null;
    this.pdfThumbnailViewer = null;
    this.onIdle = null;

    this.highestPriorityPage = null;
    this.idleTimeout = null;
    this.printing = false;
    this.isThumbnailViewEnabled = false;
  }

  PDFRenderingQueue.prototype = /** @lends PDFRenderingQueue.prototype */ {
    /**
     * @param {PDFViewer} pdfViewer
     */
    setViewer: function PDFRenderingQueue_setViewer(pdfViewer) {
      this.pdfViewer = pdfViewer;
    },

    /**
     * @param {PDFThumbnailViewer} pdfThumbnailViewer
     */
    setThumbnailViewer:
        function PDFRenderingQueue_setThumbnailViewer(pdfThumbnailViewer) {
      this.pdfThumbnailViewer = pdfThumbnailViewer;
    },

    /**
     * @param {IRenderableView} view
     * @returns {boolean}
     */
    isHighestPriority: function PDFRenderingQueue_isHighestPriority(view) {
      return this.highestPriorityPage === view.renderingId;
    },

    renderHighestPriority: function
        PDFRenderingQueue_renderHighestPriority(currentlyVisiblePages) {
      if (this.idleTimeout) {
        clearTimeout(this.idleTimeout);
        this.idleTimeout = null;
      }

      // Pages have a higher priority than thumbnails, so check them first.
      if (this.pdfViewer.forceRendering(currentlyVisiblePages)) {
        return;
      }
      // No pages needed rendering so check thumbnails.
      if (this.pdfThumbnailViewer && this.isThumbnailViewEnabled) {
        if (this.pdfThumbnailViewer.forceRendering()) {
          return;
        }
      }

      if (this.printing) {
        // If printing is currently ongoing do not reschedule cleanup.
        return;
      }

      if (this.onIdle) {
        this.idleTimeout = setTimeout(this.onIdle.bind(this), CLEANUP_TIMEOUT);
      }
    },

    getHighestPriority: function
        PDFRenderingQueue_getHighestPriority(visible, views, scrolledDown) {
      // The state has changed figure out which page has the highest priority to
      // render next (if any).
      // Priority:
      // 1 visible pages
      // 2 if last scrolled down page after the visible pages
      // 2 if last scrolled up page before the visible pages
      var visibleViews = visible.views;

      var numVisible = visibleViews.length;
      if (numVisible === 0) {
        return false;
      }
      for (var i = 0; i < numVisible; ++i) {
        var view = visibleViews[i].view;
        if (!this.isViewFinished(view)) {
          return view;
        }
      }

      // All the visible views have rendered, try to render next/previous pages.
      if (scrolledDown) {
        var nextPageIndex = visible.last.id;
        // ID's start at 1 so no need to add 1.
        if (views[nextPageIndex] &&
            !this.isViewFinished(views[nextPageIndex])) {
          return views[nextPageIndex];
        }
      } else {
        var previousPageIndex = visible.first.id - 2;
        if (views[previousPageIndex] &&
          !this.isViewFinished(views[previousPageIndex])) {
          return views[previousPageIndex];
        }
      }
      // Everything that needs to be rendered has been.
      return null;
    },

    /**
     * @param {IRenderableView} view
     * @returns {boolean}
     */
    isViewFinished: function PDFRenderingQueue_isViewFinished(view) {
      return view.renderingState === RenderingStates.FINISHED;
    },

    /**
     * Render a page or thumbnail view. This calls the appropriate function
     * based on the views state. If the view is already rendered it will return
     * false.
     * @param {IRenderableView} view
     */
    renderView: function PDFRenderingQueue_renderView(view) {
      var state = view.renderingState;
      switch (state) {
        case RenderingStates.FINISHED:
          return false;
        case RenderingStates.PAUSED:
          this.highestPriorityPage = view.renderingId;
          view.resume();
          break;
        case RenderingStates.RUNNING:
          this.highestPriorityPage = view.renderingId;
          break;
        case RenderingStates.INITIAL:
          this.highestPriorityPage = view.renderingId;
          var continueRendering = function () {
            this.renderHighestPriority();
          }.bind(this);
          view.draw().then(continueRendering, continueRendering);
          break;
      }
      return true;
    },
  };

  return PDFRenderingQueue;
})();
/* end pdf_rendering_queue.js */

/* pdf_page_view.js */
var TEXT_LAYER_RENDER_DELAY = 200; // ms
/**
 * @class
 * @implements {IRenderableView}
 */
var PDFPageView = (function PDFPageViewClosure() {
  /**
   * @constructs PDFPageView
   * @param {PDFPageViewOptions} options
   */
  function PDFPageView(options) {
    var container = options.container;
    var id = options.id;
    var scale = options.scale;
    var defaultViewport = options.defaultViewport;
    var renderingQueue = options.renderingQueue;
    var textLayerFactory = options.textLayerFactory;

    this.id = id;
    this.renderingId = 'page' + id;

    this.rotation = 0;
    this.scale = scale || 1.0;
    this.viewport = defaultViewport;
    this.pdfPageRotate = defaultViewport.rotation;
    this.hasRestrictedScaling = false;

    this.renderingQueue = renderingQueue;
    this.textLayerFactory = textLayerFactory;

    this.renderingState = RenderingStates.INITIAL;
    this.resume = null;

    this.onBeforeDraw = null;
    this.onAfterDraw = null;

    this.textLayer = null;

    this.zoomLayer = null;

    this.annotationLayer = null;

    var div = document.createElement('div');
    div.id = 'pageContainer' + this.id;
    div.className = 'page';
    div.style.width = Math.floor(this.viewport.width) + 'px';
    div.style.height = Math.floor(this.viewport.height) + 'px';
    div.setAttribute('data-page-number', this.id);
    this.div = div;

    container.appendChild(div);
  }

  PDFPageView.prototype = {
    setPdfPage: function PDFPageView_setPdfPage(pdfPage) {
      this.pdfPage = pdfPage;
      this.pdfPageRotate = pdfPage.rotate;
      var totalRotation = (this.rotation + this.pdfPageRotate) % 360;
      this.viewport = pdfPage.getViewport(this.scale * CSS_UNITS,
                                          totalRotation);
      this.stats = pdfPage.stats;
      this.reset();
    },

    destroy: function PDFPageView_destroy() {
      this.zoomLayer = null;
      this.reset();
      if (this.pdfPage) {
        this.pdfPage.destroy();
      }
    },

    reset: function PDFPageView_reset(keepAnnotations) {
      if (this.renderTask) {
        this.renderTask.cancel();
      }
      this.resume = null;
      this.renderingState = RenderingStates.INITIAL;

      var div = this.div;
      div.style.width = Math.floor(this.viewport.width) + 'px';
      div.style.height = Math.floor(this.viewport.height) + 'px';

      var childNodes = div.childNodes;
      var currentZoomLayer = this.zoomLayer || null;
      var currentAnnotationNode = (keepAnnotations && this.annotationLayer &&
                                   this.annotationLayer.div) || null;
      for (var i = childNodes.length - 1; i >= 0; i--) {
        var node = childNodes[i];
        if (currentZoomLayer === node || currentAnnotationNode === node) {
          continue;
        }
        div.removeChild(node);
      }
      div.removeAttribute('data-loaded');

      if (keepAnnotations) {
        if (this.annotationLayer) {
          // Hide annotationLayer until all elements are resized
          // so they are not displayed on the already-resized page
          this.annotationLayer.hide();
        }
      } else {
        this.annotationLayer = null;
      }

      if (this.canvas) {
        // Zeroing the width and height causes Firefox to release graphics
        // resources immediately, which can greatly reduce memory consumption.
        this.canvas.width = 0;
        this.canvas.height = 0;
        delete this.canvas;
      }

      this.loadingIconDiv = document.createElement('div');
      this.loadingIconDiv.className = 'loadingIcon';
      div.appendChild(this.loadingIconDiv);
    },

    update: function PDFPageView_update(scale, rotation) {
      this.scale = scale || this.scale;

      if (typeof rotation !== 'undefined') {
        this.rotation = rotation;
      }

      var totalRotation = (this.rotation + this.pdfPageRotate) % 360;
      this.viewport = this.viewport.clone({
        scale: this.scale * CSS_UNITS,
        rotation: totalRotation
      });

      var isScalingRestricted = false;
      if (this.canvas && PDFJS.maxCanvasPixels > 0) {
        var ctx = this.canvas.getContext('2d');
        var outputScale = getOutputScale(ctx);
        var pixelsInViewport = this.viewport.width * this.viewport.height;
        var maxScale = Math.sqrt(PDFJS.maxCanvasPixels / pixelsInViewport);
        if (((Math.floor(this.viewport.width) * outputScale.sx) | 0) *
            ((Math.floor(this.viewport.height) * outputScale.sy) | 0) >
            PDFJS.maxCanvasPixels) {
          isScalingRestricted = true;
        }
      }

      if (this.canvas &&
          (PDFJS.useOnlyCssZoom ||
            (this.hasRestrictedScaling && isScalingRestricted))) {
        this.cssTransform(this.canvas, true);
        return;
      } else if (this.canvas && !this.zoomLayer) {
        this.zoomLayer = this.canvas.parentNode;
        this.zoomLayer.style.position = 'absolute';
      }
      if (this.zoomLayer) {
        this.cssTransform(this.zoomLayer.firstChild);
      }
      this.reset(true);
    },

    /**
     * Called when moved in the parent's container.
     */
    updatePosition: function PDFPageView_updatePosition() {
      if (this.textLayer) {
        this.textLayer.render(TEXT_LAYER_RENDER_DELAY);
      }
    },

    cssTransform: function PDFPageView_transform(canvas, redrawAnnotations) {
      // Scale canvas, canvas wrapper, and page container.
      var width = this.viewport.width;
      var height = this.viewport.height;
      var div = this.div;
      canvas.style.width = canvas.parentNode.style.width = div.style.width =
        Math.floor(width) + 'px';
      canvas.style.height = canvas.parentNode.style.height = div.style.height =
        Math.floor(height) + 'px';
      // The canvas may have been originally rotated, rotate relative to that.
      var relativeRotation = this.viewport.rotation - canvas._viewport.rotation;
      var absRotation = Math.abs(relativeRotation);
      var scaleX = 1, scaleY = 1;
      if (absRotation === 90 || absRotation === 270) {
        // Scale x and y because of the rotation.
        scaleX = height / width;
        scaleY = width / height;
      }
      var cssTransform = 'rotate(' + relativeRotation + 'deg) ' +
        'scale(' + scaleX + ',' + scaleY + ')';
      CustomStyle.setProp('transform', canvas, cssTransform);

      if (this.textLayer) {
        // Rotating the text layer is more complicated since the divs inside the
        // the text layer are rotated.
        // TODO: This could probably be simplified by drawing the text layer in
        // one orientation then rotating overall.
        var textLayerViewport = this.textLayer.viewport;
        var textRelativeRotation = this.viewport.rotation -
          textLayerViewport.rotation;
        var textAbsRotation = Math.abs(textRelativeRotation);
        var scale = width / textLayerViewport.width;
        if (textAbsRotation === 90 || textAbsRotation === 270) {
          scale = width / textLayerViewport.height;
        }
        var textLayerDiv = this.textLayer.textLayerDiv;
        var transX, transY;
        switch (textAbsRotation) {
          case 0:
            transX = transY = 0;
            break;
          case 90:
            transX = 0;
            transY = '-' + textLayerDiv.style.height;
            break;
          case 180:
            transX = '-' + textLayerDiv.style.width;
            transY = '-' + textLayerDiv.style.height;
            break;
          case 270:
            transX = '-' + textLayerDiv.style.width;
            transY = 0;
            break;
          default:
            console.error('Bad rotation value.');
            break;
        }
        CustomStyle.setProp('transform', textLayerDiv,
            'rotate(' + textAbsRotation + 'deg) ' +
            'scale(' + scale + ', ' + scale + ') ' +
            'translate(' + transX + ', ' + transY + ')');
        CustomStyle.setProp('transformOrigin', textLayerDiv, '0% 0%');
      }

      if (redrawAnnotations && this.annotationLayer) {
        this.annotationLayer.setupAnnotations(this.viewport);
      }
    },

    get width() {
      return this.viewport.width;
    },

    get height() {
      return this.viewport.height;
    },

    getPagePoint: function PDFPageView_getPagePoint(x, y) {
      return this.viewport.convertToPdfPoint(x, y);
    },

    draw: function PDFPageView_draw() {
      if (this.renderingState !== RenderingStates.INITIAL) {
        console.error('Must be in new state before drawing');
      }

      this.renderingState = RenderingStates.RUNNING;

      var pdfPage = this.pdfPage;
      var viewport = this.viewport;
      var div = this.div;
      // Wrap the canvas so if it has a css transform for highdpi the overflow
      // will be hidden in FF.
      var canvasWrapper = document.createElement('div');
      canvasWrapper.style.width = div.style.width;
      canvasWrapper.style.height = div.style.height;
      canvasWrapper.classList.add('canvasWrapper');

      var canvas = document.createElement('canvas');
      canvas.id = 'page' + this.id;
      canvasWrapper.appendChild(canvas);
      if (this.annotationLayer) {
        // annotationLayer needs to stay on top
        div.insertBefore(canvasWrapper, this.annotationLayer.div);
      } else {
        div.appendChild(canvasWrapper);
      }
      this.canvas = canvas;

      var ctx = canvas.getContext('2d');
      var outputScale = getOutputScale(ctx);

      if (PDFJS.useOnlyCssZoom) {
        var actualSizeViewport = viewport.clone({ scale: CSS_UNITS });
        // Use a scale that will make the canvas be the original intended size
        // of the page.
        outputScale.sx *= actualSizeViewport.width / viewport.width;
        outputScale.sy *= actualSizeViewport.height / viewport.height;
        outputScale.scaled = true;
      }

      if (PDFJS.maxCanvasPixels > 0) {
        var pixelsInViewport = viewport.width * viewport.height;
        var maxScale = Math.sqrt(PDFJS.maxCanvasPixels / pixelsInViewport);
        if (outputScale.sx > maxScale || outputScale.sy > maxScale) {
          outputScale.sx = maxScale;
          outputScale.sy = maxScale;
          outputScale.scaled = true;
          this.hasRestrictedScaling = true;
        } else {
          this.hasRestrictedScaling = false;
        }
      }

      canvas.width = (Math.floor(viewport.width) * outputScale.sx) | 0;
      canvas.height = (Math.floor(viewport.height) * outputScale.sy) | 0;
      canvas.style.width = Math.floor(viewport.width) + 'px';
      canvas.style.height = Math.floor(viewport.height) + 'px';
      // Add the viewport so it's known what it was originally drawn with.
      canvas._viewport = viewport;

      var textLayerDiv = null;
      var textLayer = null;
      if (this.textLayerFactory) {
        textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.width = canvas.style.width;
        textLayerDiv.style.height = canvas.style.height;
        if (this.annotationLayer) {
          // annotationLayer needs to stay on top
          div.insertBefore(textLayerDiv, this.annotationLayer.div);
        } else {
          div.appendChild(textLayerDiv);
        }

        textLayer = this.textLayerFactory.createTextLayerBuilder(textLayerDiv,
                                                                 this.id - 1,
                                                                 this.viewport);
      }
      this.textLayer = textLayer;

      // TODO(mack): use data attributes to store these
      ctx._scaleX = outputScale.sx;
      ctx._scaleY = outputScale.sy;
      if (outputScale.scaled) {
        ctx.scale(outputScale.sx, outputScale.sy);
      }

      var resolveRenderPromise, rejectRenderPromise;
      var promise = new Promise(function (resolve, reject) {
        resolveRenderPromise = resolve;
        rejectRenderPromise = reject;
      });

      // Rendering area

      var self = this;
      function pageViewDrawCallback(error) {
        // The renderTask may have been replaced by a new one, so only remove
        // the reference to the renderTask if it matches the one that is
        // triggering this callback.
        if (renderTask === self.renderTask) {
          self.renderTask = null;
        }

        if (error === 'cancelled') {
          rejectRenderPromise(error);
          return;
        }

        self.renderingState = RenderingStates.FINISHED;

        if (self.loadingIconDiv) {
          div.removeChild(self.loadingIconDiv);
          delete self.loadingIconDiv;
        }

        if (self.zoomLayer) {
          div.removeChild(self.zoomLayer);
          self.zoomLayer = null;
        }

        self.error = error;
        self.stats = pdfPage.stats;
        if (self.onAfterDraw) {
          self.onAfterDraw();
        }
        var event = document.createEvent('CustomEvent');
        event.initCustomEvent('pagerendered', true, true, {
          pageNumber: self.id
        });
        div.dispatchEvent(event);
//#if GENERIC
        // This custom event is deprecated, and will be removed in the future,
        // please use the |pagerendered| event instead.
        var deprecatedEvent = document.createEvent('CustomEvent');
        deprecatedEvent.initCustomEvent('pagerender', true, true, {
          pageNumber: pdfPage.pageNumber
        });
        div.dispatchEvent(deprecatedEvent);
//#endif

        if (!error) {
          resolveRenderPromise(undefined);
        } else {
          rejectRenderPromise(error);
        }
      }

      var renderContinueCallback = null;
      if (this.renderingQueue) {
        renderContinueCallback = function renderContinueCallback(cont) {
          if (!self.renderingQueue.isHighestPriority(self)) {
            self.renderingState = RenderingStates.PAUSED;
            self.resume = function resumeCallback() {
              self.renderingState = RenderingStates.RUNNING;
              cont();
            };
            return;
          }
          cont();
        };
      }

      var renderContext = {
        canvasContext: ctx,
        viewport: this.viewport,
        // intent: 'default', // === 'display'
        continueCallback: renderContinueCallback
      };
      var renderTask = this.renderTask = this.pdfPage.render(renderContext);

      this.renderTask.promise.then(
        function pdfPageRenderCallback() {
          pageViewDrawCallback(null);
          if (textLayer) {
            self.pdfPage.getTextContent().then(
              function textContentResolved(textContent) {
                textLayer.setTextContent(textContent);
                textLayer.render(TEXT_LAYER_RENDER_DELAY);
              }
            );
          }
        },
        function pdfPageRenderError(error) {
          pageViewDrawCallback(error);
        }
      );

      div.setAttribute('data-loaded', true);

      if (self.onBeforeDraw) {
        self.onBeforeDraw();
      }
      return promise;
    },

    beforePrint: function PDFPageView_beforePrint() {
      var pdfPage = this.pdfPage;

      var viewport = pdfPage.getViewport(1);
      // Use the same hack we use for high dpi displays for printing to get
      // better output until bug 811002 is fixed in FF.
      var PRINT_OUTPUT_SCALE = 2;
      var canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width) * PRINT_OUTPUT_SCALE;
      canvas.height = Math.floor(viewport.height) * PRINT_OUTPUT_SCALE;
      canvas.style.width = (PRINT_OUTPUT_SCALE * viewport.width) + 'pt';
      canvas.style.height = (PRINT_OUTPUT_SCALE * viewport.height) + 'pt';
      var cssScale = 'scale(' + (1 / PRINT_OUTPUT_SCALE) + ', ' +
                                (1 / PRINT_OUTPUT_SCALE) + ')';
      CustomStyle.setProp('transform' , canvas, cssScale);
      CustomStyle.setProp('transformOrigin' , canvas, '0% 0%');

      var printContainer = document.getElementById('printContainer');
      var canvasWrapper = document.createElement('div');
      canvasWrapper.style.width = viewport.width + 'pt';
      canvasWrapper.style.height = viewport.height + 'pt';
      canvasWrapper.appendChild(canvas);
      printContainer.appendChild(canvasWrapper);

      canvas.mozPrintCallback = function(obj) {
        var ctx = obj.context;

        ctx.save();
        ctx.fillStyle = 'rgb(255, 255, 255)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        ctx.scale(PRINT_OUTPUT_SCALE, PRINT_OUTPUT_SCALE);

        var renderContext = {
          canvasContext: ctx,
          viewport: viewport,
          intent: 'print'
        };

        pdfPage.render(renderContext).promise.then(function() {
          // Tell the printEngine that rendering this canvas/page has finished.
          obj.done();
        }, function(error) {
          console.error(error);
          // Tell the printEngine that rendering this canvas/page has failed.
          // This will make the print proces stop.
          if ('abort' in obj) {
            obj.abort();
          } else {
            obj.done();
          }
        });
      };
    },
  };

  return PDFPageView;
})();
/* end pdf_page_view.js */

/* text_layer_builder.js */
var MAX_TEXT_DIVS_TO_RENDER = 100000;

var NonWhitespaceRegexp = /\S/;

function isAllWhitespace(str) {
  return !NonWhitespaceRegexp.test(str);
}

/**
 * TextLayerBuilder provides text-selection functionality for the PDF.
 * It does this by creating overlay divs over the PDF text. These divs
 * contain text that matches the PDF text they are overlaying. This object
 * also provides a way to highlight text that is being searched for.
 * @class
 */
var TextLayerBuilder = (function TextLayerBuilderClosure() {

  function TextLayerBuilder(options) {
    this.textLayerDiv = options.textLayerDiv;
    this.renderingDone = false;
    this.divContentDone = false;
    this.pageIdx = options.pageIndex;
    this.pageNumber = this.pageIdx + 1;
    this.matches = [];
    this.viewport = options.viewport;
    this.textDivs = [];
    this.findController = options.findController || null;
  }

  TextLayerBuilder.prototype = {
    _finishRendering: function TextLayerBuilder_finishRendering() {
      this.renderingDone = true;

      var event = document.createEvent('CustomEvent');
      event.initCustomEvent('textlayerrendered', true, true, {
        pageNumber: this.pageNumber
      });
      this.textLayerDiv.dispatchEvent(event);
    },

    renderLayer: function TextLayerBuilder_renderLayer() {
      var textLayerFrag = document.createDocumentFragment();
      var textDivs = this.textDivs;
      var textDivsLength = textDivs.length;
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');

      // No point in rendering many divs as it would make the browser
      // unusable even after the divs are rendered.
      if (textDivsLength > MAX_TEXT_DIVS_TO_RENDER) {
        this._finishRendering();
        return;
      }

      var lastFontSize;
      var lastFontFamily;
      for (var i = 0; i < textDivsLength; i++) {
        var textDiv = textDivs[i];
        if (textDiv.dataset.isWhitespace !== undefined) {
          continue;
        }

        var fontSize = textDiv.style.fontSize;
        var fontFamily = textDiv.style.fontFamily;

        // Only build font string and set to context if different from last.
        if (fontSize !== lastFontSize || fontFamily !== lastFontFamily) {
          ctx.font = fontSize + ' ' + fontFamily;
          lastFontSize = fontSize;
          lastFontFamily = fontFamily;
        }

        var width = ctx.measureText(textDiv.textContent).width;
        if (width > 0) {
          textLayerFrag.appendChild(textDiv);
          var transform;
          if (textDiv.dataset.canvasWidth !== undefined) {
            // Dataset values come of type string.
            var textScale = textDiv.dataset.canvasWidth / width;
            transform = 'scaleX(' + textScale + ')';
          } else {
            transform = '';
          }
          var rotation = textDiv.dataset.angle;
          if (rotation) {
            transform = 'rotate(' + rotation + 'deg) ' + transform;
          }
          if (transform) {
            CustomStyle.setProp('transform' , textDiv, transform);
          }
        }
      }

      this.textLayerDiv.appendChild(textLayerFrag);
      this._finishRendering();
      this.updateMatches();
    },

    /**
     * Renders the text layer.
     * @param {number} timeout (optional) if specified, the rendering waits
     *   for specified amount of ms.
     */
    render: function TextLayerBuilder_render(timeout) {
      if (!this.divContentDone || this.renderingDone) {
        return;
      }

      if (this.renderTimer) {
        clearTimeout(this.renderTimer);
        this.renderTimer = null;
      }

      if (!timeout) { // Render right away
        this.renderLayer();
      } else { // Schedule
        var self = this;
        this.renderTimer = setTimeout(function() {
          self.renderLayer();
          self.renderTimer = null;
        }, timeout);
      }
    },

    appendText: function TextLayerBuilder_appendText(geom, styles) {
      var style = styles[geom.fontName];
      var textDiv = document.createElement('div');
      this.textDivs.push(textDiv);
      if (isAllWhitespace(geom.str)) {
        textDiv.dataset.isWhitespace = true;
        return;
      }
      var tx = PDFJS.Util.transform(this.viewport.transform, geom.transform);
      var angle = Math.atan2(tx[1], tx[0]);
      if (style.vertical) {
        angle += Math.PI / 2;
      }
      var fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));
      var fontAscent = fontHeight;
      if (style.ascent) {
        fontAscent = style.ascent * fontAscent;
      } else if (style.descent) {
        fontAscent = (1 + style.descent) * fontAscent;
      }

      var left;
      var top;
      if (angle === 0) {
        left = tx[4];
        top = tx[5] - fontAscent;
      } else {
        left = tx[4] + (fontAscent * Math.sin(angle));
        top = tx[5] - (fontAscent * Math.cos(angle));
      }
      textDiv.style.left = left + 'px';
      textDiv.style.top = top + 'px';
      textDiv.style.fontSize = fontHeight + 'px';
      textDiv.style.fontFamily = style.fontFamily;

      textDiv.textContent = geom.str;
      // |fontName| is only used by the Font Inspector. This test will succeed
      // when e.g. the Font Inspector is off but the Stepper is on, but it's
      // not worth the effort to do a more accurate test.
      if (PDFJS.pdfBug) {
        textDiv.dataset.fontName = geom.fontName;
      }
      // Storing into dataset will convert number into string.
      if (angle !== 0) {
        textDiv.dataset.angle = angle * (180 / Math.PI);
      }
      // We don't bother scaling single-char text divs, because it has very
      // little effect on text highlighting. This makes scrolling on docs with
      // lots of such divs a lot faster.
      if (textDiv.textContent.length > 1) {
        if (style.vertical) {
          textDiv.dataset.canvasWidth = geom.height * this.viewport.scale;
        } else {
          textDiv.dataset.canvasWidth = geom.width * this.viewport.scale;
        }
      }
    },

    setTextContent: function TextLayerBuilder_setTextContent(textContent) {
      this.textContent = textContent;

      var textItems = textContent.items;
      for (var i = 0, len = textItems.length; i < len; i++) {
        this.appendText(textItems[i], textContent.styles);
      }
      this.divContentDone = true;
    },

    convertMatches: function TextLayerBuilder_convertMatches(matches) {
      var i = 0;
      var iIndex = 0;
      var bidiTexts = this.textContent.items;
      var end = bidiTexts.length - 1;
      var queryLen = (this.findController === null ?
                      0 : this.findController.state.query.length);
      var ret = [];

      for (var m = 0, len = matches.length; m < len; m++) {
        // Calculate the start position.
        var matchIdx = matches[m];

        // Loop over the divIdxs.
        while (i !== end && matchIdx >= (iIndex + bidiTexts[i].str.length)) {
          iIndex += bidiTexts[i].str.length;
          i++;
        }

        if (i === bidiTexts.length) {
          console.error('Could not find a matching mapping');
        }

        var match = {
          begin: {
            divIdx: i,
            offset: matchIdx - iIndex
          }
        };

        // Calculate the end position.
        matchIdx += queryLen;

        // Somewhat the same array as above, but use > instead of >= to get
        // the end position right.
        while (i !== end && matchIdx > (iIndex + bidiTexts[i].str.length)) {
          iIndex += bidiTexts[i].str.length;
          i++;
        }

        match.end = {
          divIdx: i,
          offset: matchIdx - iIndex
        };
        ret.push(match);
      }

      return ret;
    },

    renderMatches: function TextLayerBuilder_renderMatches(matches) {
      // Early exit if there is nothing to render.
      if (matches.length === 0) {
        return;
      }

      var bidiTexts = this.textContent.items;
      var textDivs = this.textDivs;
      var prevEnd = null;
      var pageIdx = this.pageIdx;
      var isSelectedPage = (this.findController === null ?
        false : (pageIdx === this.findController.selected.pageIdx));
      var selectedMatchIdx = (this.findController === null ?
                              -1 : this.findController.selected.matchIdx);
      var highlightAll = (this.findController === null ?
                          false : this.findController.state.highlightAll);
      var infinity = {
        divIdx: -1,
        offset: undefined
      };

      function beginText(begin, className) {
        var divIdx = begin.divIdx;
        textDivs[divIdx].textContent = '';
        appendTextToDiv(divIdx, 0, begin.offset, className);
      }

      function appendTextToDiv(divIdx, fromOffset, toOffset, className) {
        var div = textDivs[divIdx];
        var content = bidiTexts[divIdx].str.substring(fromOffset, toOffset);
        var node = document.createTextNode(content);
        if (className) {
          var span = document.createElement('span');
          span.className = className;
          span.appendChild(node);
          div.appendChild(span);
          return;
        }
        div.appendChild(node);
      }

      var i0 = selectedMatchIdx, i1 = i0 + 1;
      if (highlightAll) {
        i0 = 0;
        i1 = matches.length;
      } else if (!isSelectedPage) {
        // Not highlighting all and this isn't the selected page, so do nothing.
        return;
      }

      for (var i = i0; i < i1; i++) {
        var match = matches[i];
        var begin = match.begin;
        var end = match.end;
        var isSelected = (isSelectedPage && i === selectedMatchIdx);
        var highlightSuffix = (isSelected ? ' selected' : '');

        if (this.findController) {
          this.findController.updateMatchPosition(pageIdx, i, textDivs,
                                                  begin.divIdx, end.divIdx);
        }

        // Match inside new div.
        if (!prevEnd || begin.divIdx !== prevEnd.divIdx) {
          // If there was a previous div, then add the text at the end.
          if (prevEnd !== null) {
            appendTextToDiv(prevEnd.divIdx, prevEnd.offset, infinity.offset);
          }
          // Clear the divs and set the content until the starting point.
          beginText(begin);
        } else {
          appendTextToDiv(prevEnd.divIdx, prevEnd.offset, begin.offset);
        }

        if (begin.divIdx === end.divIdx) {
          appendTextToDiv(begin.divIdx, begin.offset, end.offset,
                          'highlight' + highlightSuffix);
        } else {
          appendTextToDiv(begin.divIdx, begin.offset, infinity.offset,
                          'highlight begin' + highlightSuffix);
          for (var n0 = begin.divIdx + 1, n1 = end.divIdx; n0 < n1; n0++) {
            textDivs[n0].className = 'highlight middle' + highlightSuffix;
          }
          beginText(end, 'highlight end' + highlightSuffix);
        }
        prevEnd = end;
      }

      if (prevEnd) {
        appendTextToDiv(prevEnd.divIdx, prevEnd.offset, infinity.offset);
      }
    },

    updateMatches: function TextLayerBuilder_updateMatches() {
      // Only show matches when all rendering is done.
      if (!this.renderingDone) {
        return;
      }

      // Clear all matches.
      var matches = this.matches;
      var textDivs = this.textDivs;
      var bidiTexts = this.textContent.items;
      var clearedUntilDivIdx = -1;

      // Clear all current matches.
      for (var i = 0, len = matches.length; i < len; i++) {
        var match = matches[i];
        var begin = Math.max(clearedUntilDivIdx, match.begin.divIdx);
        for (var n = begin, end = match.end.divIdx; n <= end; n++) {
          var div = textDivs[n];
          div.textContent = bidiTexts[n].str;
          div.className = '';
        }
        clearedUntilDivIdx = match.end.divIdx + 1;
      }

      if (this.findController === null || !this.findController.active) {
        return;
      }

      // Convert the matches on the page controller into the match format
      // used for the textLayer.
      this.matches = this.convertMatches(this.findController === null ?
        [] : (this.findController.pageMatches[this.pageIdx] || []));
      this.renderMatches(this.matches);
    }
  };
  return TextLayerBuilder;
})();

/**
 * @constructor
 * @implements IPDFTextLayerFactory
 */
function DefaultTextLayerFactory() {}
DefaultTextLayerFactory.prototype = {
  /**
   * @param {HTMLDivElement} textLayerDiv
   * @param {number} pageIndex
   * @param {PageViewport} viewport
   * @returns {TextLayerBuilder}
   */
  createTextLayerBuilder: function (textLayerDiv, pageIndex, viewport) {
    return new TextLayerBuilder({
      textLayerDiv: textLayerDiv,
      pageIndex: pageIndex,
      viewport: viewport
    });
  }
};
/* end text_layer_builder.js */

/* pdf_viewer.js */
var PresentationModeState = {
  UNKNOWN: 0,
  NORMAL: 1,
  CHANGING: 2,
  FULLSCREEN: 3,
};

var IGNORE_CURRENT_POSITION_ON_ZOOM = false;
var DEFAULT_CACHE_SIZE = 10;

var PDFViewer = (function pdfViewer() {
  function PDFPageViewBuffer(size) {
    var data = [];
    this.push = function cachePush(view) {
      var i = data.indexOf(view);
      if (i >= 0) {
        data.splice(i, 1);
      }
      data.push(view);
      if (data.length > size) {
        data.shift().destroy();
      }
    };
    this.resize = function (newSize) {
      size = newSize;
      while (data.length > size) {
        data.shift().destroy();
      }
    };
  }

  /**
   * @constructs PDFViewer
   * @param {PDFViewerOptions} options
   */
  function PDFViewer(options) {
    this.container = options.container;
    this.viewer = options.viewer || options.container.firstElementChild;
    this.linkService = options.linkService || new SimpleLinkService(this);
    this.removePageBorders = options.removePageBorders || false;

    this.defaultRenderingQueue = !options.renderingQueue;
    if (this.defaultRenderingQueue) {
      // Custom rendering queue is not specified, using default one
      this.renderingQueue = new PDFRenderingQueue();
      this.renderingQueue.setViewer(this);
    } else {
      this.renderingQueue = options.renderingQueue;
    }

    this.scroll = watchScroll(this.container, this._scrollUpdate.bind(this));
    this.updateInProgress = false;
    this.presentationModeState = PresentationModeState.UNKNOWN;
    this._resetView();

    if (this.removePageBorders) {
      this.viewer.classList.add('removePageBorders');
    }
  }

  PDFViewer.prototype = /** @lends PDFViewer.prototype */{
    get pagesCount() {
      return this.pages.length;
    },

    getPageView: function (index) {
      return this.pages[index];
    },

    get currentPageNumber() {
      return this._currentPageNumber;
    },

    set currentPageNumber(val) {
      if (!this.pdfDocument) {
        this._currentPageNumber = val;
        return;
      }

      var event = document.createEvent('UIEvents');
      event.initUIEvent('pagechange', true, true, window, 0);
      event.updateInProgress = this.updateInProgress;

      if (!(0 < val && val <= this.pagesCount)) {
        event.pageNumber = this._currentPageNumber;
        event.previousPageNumber = val;
        this.container.dispatchEvent(event);
        return;
      }

      event.previousPageNumber = this._currentPageNumber;
      this._currentPageNumber = val;
      event.pageNumber = val;
      this.container.dispatchEvent(event);
    },

    /**
     * @returns {number}
     */
    get currentScale() {
      return this._currentScale;
    },

    /**
     * @param {number} val - Scale of the pages in percents.
     */
    set currentScale(val) {
      if (isNaN(val))  {
        throw new Error('Invalid numeric scale');
      }
      if (!this.pdfDocument) {
        this._currentScale = val;
        this._currentScaleValue = val.toString();
        return;
      }
      this._setScale(val, false);
    },

    /**
     * @returns {string}
     */
    get currentScaleValue() {
      return this._currentScaleValue;
    },

    /**
     * @param val - The scale of the pages (in percent or predefined value).
     */
    set currentScaleValue(val) {
      if (!this.pdfDocument) {
        this._currentScale = isNaN(val) ? UNKNOWN_SCALE : val;
        this._currentScaleValue = val;
        return;
      }
      this._setScale(val, false);
    },

    /**
     * @returns {number}
     */
    get pagesRotation() {
      return this._pagesRotation;
    },

    /**
     * @param {number} rotation - The rotation of the pages (0, 90, 180, 270).
     */
    set pagesRotation(rotation) {
      this._pagesRotation = rotation;

      for (var i = 0, l = this.pages.length; i < l; i++) {
        var page = this.pages[i];
        page.update(page.scale, rotation);
      }

      this._setScale(this._currentScaleValue, true);
    },

    /**
     * @param pdfDocument {PDFDocument}
     */
    setDocument: function (pdfDocument) {
      if (this.pdfDocument) {
        this._resetView();
      }

      this.pdfDocument = pdfDocument;
      if (!pdfDocument) {
        return;
      }

      var pagesCount = pdfDocument.numPages;
      var pagesRefMap = this.pagesRefMap = {};
      var self = this;

      var resolvePagesPromise;
      var pagesPromise = new Promise(function (resolve) {
        resolvePagesPromise = resolve;
      });
      this.pagesPromise = pagesPromise;
      pagesPromise.then(function () {
        var event = document.createEvent('CustomEvent');
        event.initCustomEvent('pagesloaded', true, true, {
          pagesCount: pagesCount
        });
        self.container.dispatchEvent(event);
      });

      var isOnePageRenderedResolved = false;
      var resolveOnePageRendered = null;
      var onePageRendered = new Promise(function (resolve) {
        resolveOnePageRendered = resolve;
      });
      this.onePageRendered = onePageRendered;

      var bindOnAfterAndBeforeDraw = function (pageView) {
        pageView.onBeforeDraw = function pdfViewLoadOnBeforeDraw() {
          // Add the page to the buffer at the start of drawing. That way it can
          // be evicted from the buffer and destroyed even if we pause its
          // rendering.
          self._buffer.push(this);
        };
        // when page is painted, using the image as thumbnail base
        pageView.onAfterDraw = function pdfViewLoadOnAfterDraw() {
          if (!isOnePageRenderedResolved) {
            isOnePageRenderedResolved = true;
            resolveOnePageRendered();
          }
        };
      };

      var firstPagePromise = pdfDocument.getPage(1);
      this.firstPagePromise = firstPagePromise;

      // Fetch a single page so we can get a viewport that will be the default
      // viewport for all pages
      return firstPagePromise.then(function(pdfPage) {
        var scale = this._currentScale || 1.0;
        var viewport = pdfPage.getViewport(scale * CSS_UNITS);
        this.viewportWidth = viewport.width;
        for (var pageNum = 1; pageNum <= pagesCount; ++pageNum) {
          var textLayerFactory = null;
          if (!PDFJS.disableTextLayer) {
            textLayerFactory = this;
          }
          var pageView = new PDFPageView({
            container: this.viewer,
            id: pageNum,
            scale: scale,
            defaultViewport: viewport.clone(),
            renderingQueue: this.renderingQueue,
            textLayerFactory: textLayerFactory,
            annotationsLayerFactory: this
          });
          bindOnAfterAndBeforeDraw(pageView);
          this.pages.push(pageView);
        }

        // Fetch all the pages since the viewport is needed before printing
        // starts to create the correct size canvas. Wait until one page is
        // rendered so we don't tie up too many resources early on.
        onePageRendered.then(function () {
          if (!PDFJS.disableAutoFetch) {
            var getPagesLeft = pagesCount;
            for (var pageNum = 1; pageNum <= pagesCount; ++pageNum) {
              pdfDocument.getPage(pageNum).then(function (pageNum, pdfPage) {
                var pageView = self.pages[pageNum - 1];
                if (!pageView.pdfPage) {
                  pageView.setPdfPage(pdfPage);
                }
                var refStr = pdfPage.ref.num + ' ' + pdfPage.ref.gen + ' R';
                pagesRefMap[refStr] = pageNum;
                getPagesLeft--;
                if (!getPagesLeft) {
                  resolvePagesPromise();
                }
              }.bind(null, pageNum));
            }
          } else {
            // XXX: Printing is semi-broken with auto fetch disabled.
            resolvePagesPromise();
          }
        });

        var event = document.createEvent('CustomEvent');
        event.initCustomEvent('pagesinit', true, true, null);
        self.container.dispatchEvent(event);

        if (this.defaultRenderingQueue) {
          this.update();
        }

        if (this.findController) {
          this.findController.resolveFirstPage();
        }
      }.bind(this));
    },

    _resetView: function () {
      this.pages = [];
      this._currentPageNumber = 1;
      this._currentScale = UNKNOWN_SCALE;
      this._currentScaleValue = null;
      this._buffer = new PDFPageViewBuffer(DEFAULT_CACHE_SIZE);
      this.location = null;
      this._pagesRotation = 0;
      this._pagesRequests = [];

      var container = this.viewer;
      while (container.hasChildNodes()) {
        container.removeChild(container.lastChild);
      }
    },

    _scrollUpdate: function () {
      if (this.pagesCount === 0) {
        return;
      }
      this.update();
      for (var i = 0, ii = this.pages.length; i < ii; i++) {
        this.pages[i].updatePosition();
      }
    },

    _setScaleDispatchEvent: function pdfViewer_setScaleDispatchEvent(
        newScale, newValue, preset) {
      var event = document.createEvent('UIEvents');
      event.initUIEvent('scalechange', true, true, window, 0);
      event.scale = newScale;
      if (preset) {
        event.presetValue = newValue;
      }
      this.container.dispatchEvent(event);
    },

    _setScaleUpdatePages: function pdfViewer_setScaleUpdatePages(
        newScale, newValue, noScroll, preset) {
      this._currentScaleValue = newValue;
      if (newScale === this._currentScale) {
        if (preset) {
          this._setScaleDispatchEvent(newScale, newValue, true);
        }
        return;
      }

      for (var i = 0, ii = this.pages.length; i < ii; i++) {
        this.pages[i].update(newScale);
      }
      this._currentScale = newScale;

      if (!noScroll) {
        var page = this._currentPageNumber, dest;
        var inPresentationMode =
          this.presentationModeState === PresentationModeState.CHANGING ||
          this.presentationModeState === PresentationModeState.FULLSCREEN;
        if (this.location && !inPresentationMode &&
            !IGNORE_CURRENT_POSITION_ON_ZOOM) {
          page = this.location.pageNumber;
          dest = [null, { name: 'XYZ' }, this.location.left,
            this.location.top, null];
        }
        this.scrollPageIntoView(page, dest);
      }

      this._setScaleDispatchEvent(newScale, newValue, preset);
    },

    _setScale: function pdfViewer_setScale(value, noScroll) {
      if (value === 'custom') {
        return;
      }
      var scale = parseFloat(value);

      if (scale > 0) {
        this._setScaleUpdatePages(scale, value, noScroll, false);
      } else {
        var currentPage = this.pages[this._currentPageNumber - 1];
        if (!currentPage) {
          return;
        }
        var inPresentationMode =
          this.presentationModeState === PresentationModeState.FULLSCREEN;
        var hPadding = (inPresentationMode || this.removePageBorders) ?
          0 : SCROLLBAR_PADDING;
        var vPadding = (inPresentationMode || this.removePageBorders) ?
          0 : VERTICAL_PADDING;
        var pageWidthScale = (this.container.clientWidth - hPadding) /
                             currentPage.width * currentPage.scale;
        var pageHeightScale = (this.container.clientHeight - vPadding) /
                              currentPage.height * currentPage.scale;
        switch (value) {
          case 'page-actual':
            scale = 1;
            break;
          case 'page-width':
            scale = pageWidthScale;
            break;
          case 'page-height':
            scale = pageHeightScale;
            break;
          case 'page-fit':
            scale = Math.min(pageWidthScale, pageHeightScale);
            break;
          case 'auto':
            var isLandscape = (currentPage.width > currentPage.height);
            // For pages in landscape mode, fit the page height to the viewer
            // *unless* the page would thus become too wide to fit horizontally.
            var horizontalScale = isLandscape ?
              Math.min(pageHeightScale, pageWidthScale) : pageWidthScale;
            scale = Math.min(MAX_AUTO_SCALE, horizontalScale);
            break;
          default:
            console.error('pdfViewSetScale: \'' + value +
              '\' is an unknown zoom value.');
            return;
        }
        this._setScaleUpdatePages(scale, value, noScroll, true);
      }
    },

    /**
     * Scrolls page into view.
     * @param {number} pageNumber
     * @param {Array} dest - (optional) original PDF destination array:
     *   <page-ref> </XYZ|FitXXX> <args..>
     */
    scrollPageIntoView: function PDFViewer_scrollPageIntoView(pageNumber,
                                                              dest) {
      var pageView = this.pages[pageNumber - 1];

      if (this.presentationModeState ===
        PresentationModeState.FULLSCREEN) {
        if (this.linkService.page !== pageView.id) {
          // Avoid breaking getVisiblePages in presentation mode.
          this.linkService.page = pageView.id;
          return;
        }
        dest = null;
        // Fixes the case when PDF has different page sizes.
        this._setScale(this.currentScaleValue, true);
      }
      if (!dest) {
        scrollIntoView(pageView.div);
        return;
      }

      var x = 0, y = 0;
      var width = 0, height = 0, widthScale, heightScale;
      var changeOrientation = (pageView.rotation % 180 === 0 ? false : true);
      var pageWidth = (changeOrientation ? pageView.height : pageView.width) /
        pageView.scale / CSS_UNITS;
      var pageHeight = (changeOrientation ? pageView.width : pageView.height) /
        pageView.scale / CSS_UNITS;
      var scale = 0;
      switch (dest[1].name) {
        case 'XYZ':
          x = dest[2];
          y = dest[3];
          scale = dest[4];
          // If x and/or y coordinates are not supplied, default to
          // _top_ left of the page (not the obvious bottom left,
          // since aligning the bottom of the intended page with the
          // top of the window is rarely helpful).
          x = x !== null ? x : 0;
          y = y !== null ? y : pageHeight;
          break;
        case 'Fit':
        case 'FitB':
          scale = 'page-fit';
          break;
        case 'FitH':
        case 'FitBH':
          y = dest[2];
          scale = 'page-width';
          break;
        case 'FitV':
        case 'FitBV':
          x = dest[2];
          width = pageWidth;
          height = pageHeight;
          scale = 'page-height';
          break;
        case 'FitR':
          x = dest[2];
          y = dest[3];
          width = dest[4] - x;
          height = dest[5] - y;
          var viewerContainer = this.container;
          var hPadding = this.removePageBorders ? 0 : SCROLLBAR_PADDING;
          var vPadding = this.removePageBorders ? 0 : VERTICAL_PADDING;

          widthScale = (viewerContainer.clientWidth - hPadding) /
            width / CSS_UNITS;
          heightScale = (viewerContainer.clientHeight - vPadding) /
            height / CSS_UNITS;
          scale = Math.min(Math.abs(widthScale), Math.abs(heightScale));
          break;
        default:
          return;
      }

      if (scale && scale !== this.currentScale) {
        this.currentScaleValue = scale;
      } else if (this.currentScale === UNKNOWN_SCALE) {
        this.currentScaleValue = DEFAULT_SCALE;
      }

      if (scale === 'page-fit' && !dest[4]) {
        scrollIntoView(pageView.div);
        return;
      }

      var boundingRect = [
        pageView.viewport.convertToViewportPoint(x, y),
        pageView.viewport.convertToViewportPoint(x + width, y + height)
      ];
      var left = Math.min(boundingRect[0][0], boundingRect[1][0]);
      var top = Math.min(boundingRect[0][1], boundingRect[1][1]);

      scrollIntoView(pageView.div, { left: left, top: top });
    },

    _updateLocation: function (firstPage) {
      var currentScale = this._currentScale;
      var currentScaleValue = this._currentScaleValue;
      var normalizedScaleValue =
        parseFloat(currentScaleValue) === currentScale ?
        Math.round(currentScale * 10000) / 100 : currentScaleValue;

      var pageNumber = firstPage.id;
      var pdfOpenParams = '#page=' + pageNumber;
      pdfOpenParams += '&zoom=' + normalizedScaleValue;
      var currentPageView = this.pages[pageNumber - 1];
      var container = this.container;
      var topLeft = currentPageView.getPagePoint(
        (container.scrollLeft - firstPage.x),
        (container.scrollTop - firstPage.y));
      var intLeft = Math.round(topLeft[0]);
      var intTop = Math.round(topLeft[1]);
      pdfOpenParams += ',' + intLeft + ',' + intTop;

      this.location = {
        pageNumber: pageNumber,
        scale: normalizedScaleValue,
        top: intTop,
        left: intLeft,
        pdfOpenParams: pdfOpenParams
      };
    },

    update: function () {
      var visible = this._getVisiblePages();
      var visiblePages = visible.views;
      if (visiblePages.length === 0) {
        return;
      }

      this.updateInProgress = true;

      var suggestedCacheSize = Math.max(DEFAULT_CACHE_SIZE,
          2 * visiblePages.length + 1);
      this._buffer.resize(suggestedCacheSize);

      this.renderingQueue.renderHighestPriority(visible);

      var currentId = this.currentPageNumber;
      var firstPage = visible.first;

      for (var i = 0, ii = visiblePages.length, stillFullyVisible = false;
           i < ii; ++i) {
        var page = visiblePages[i];

        if (page.percent < 100) {
          break;
        }
        if (page.id === currentId) {
          stillFullyVisible = true;
          break;
        }
      }

      if (!stillFullyVisible) {
        currentId = visiblePages[0].id;
      }

      if (this.presentationModeState !== PresentationModeState.FULLSCREEN) {
        this.currentPageNumber = currentId;
      }

      this._updateLocation(firstPage);

      this.updateInProgress = false;

      var event = document.createEvent('UIEvents');
      event.initUIEvent('updateviewarea', true, true, window, 0);
      this.container.dispatchEvent(event);
    },

    containsElement: function (element) {
      return this.container.contains(element);
    },

    focus: function () {
      this.container.focus();
    },

    blur: function () {
      this.container.blur();
    },

    get isHorizontalScrollbarEnabled() {
      return (this.presentationModeState === PresentationModeState.FULLSCREEN ?
        false : (this.container.scrollWidth > this.container.clientWidth));
    },

    _getVisiblePages: function () {
      if (this.presentationModeState !== PresentationModeState.FULLSCREEN) {
        return getVisibleElements(this.container, this.pages, true);
      } else {
        // The algorithm in getVisibleElements doesn't work in all browsers and
        // configurations when presentation mode is active.
        var visible = [];
        var currentPage = this.pages[this._currentPageNumber - 1];
        visible.push({ id: currentPage.id, view: currentPage });
        return { first: currentPage, last: currentPage, views: visible };
      }
    },

    cleanup: function () {
      for (var i = 0, ii = this.pages.length; i < ii; i++) {
        if (this.pages[i] &&
          this.pages[i].renderingState !== RenderingStates.FINISHED) {
          this.pages[i].reset();
        }
      }
    },

    /**
     * @param {PDFPageView} pageView
     * @returns {PDFPage}
     * @private
     */
    _ensurePdfPageLoaded: function (pageView) {
      if (pageView.pdfPage) {
        return Promise.resolve(pageView.pdfPage);
      }
      var pageNumber = pageView.id;
      if (this._pagesRequests[pageNumber]) {
        return this._pagesRequests[pageNumber];
      }
      var promise = this.pdfDocument.getPage(pageNumber).then(
          function (pdfPage) {
        pageView.setPdfPage(pdfPage);
        this._pagesRequests[pageNumber] = null;
        return pdfPage;
      }.bind(this));
      this._pagesRequests[pageNumber] = promise;
      return promise;
    },

    forceRendering: function (currentlyVisiblePages) {
      var visiblePages = currentlyVisiblePages || this._getVisiblePages();
      var pageView = this.renderingQueue.getHighestPriority(visiblePages,
                                                            this.pages,
                                                            this.scroll.down);
      if (pageView) {
        this._ensurePdfPageLoaded(pageView).then(function () {
          this.renderingQueue.renderView(pageView);
        }.bind(this));
        return true;
      }
      return false;
    },

    getPageTextContent: function (pageIndex) {
      return this.pdfDocument.getPage(pageIndex + 1).then(function (page) {
        return page.getTextContent();
      });
    },

    /**
     * @param {HTMLDivElement} textLayerDiv
     * @param {number} pageIndex
     * @param {PageViewport} viewport
     * @returns {TextLayerBuilder}
     */
    createTextLayerBuilder: function (textLayerDiv, pageIndex, viewport) {
      var isViewerInPresentationMode =
        this.presentationModeState === PresentationModeState.FULLSCREEN;
      return new TextLayerBuilder({
        textLayerDiv: textLayerDiv,
        pageIndex: pageIndex,
        viewport: viewport,
        findController: isViewerInPresentationMode ? null : this.findController
      });
    },

    /**
     * @param {HTMLDivElement} pageDiv
     * @param {PDFPage} pdfPage
     * @returns {AnnotationsLayerBuilder}
     */
    //createAnnotationsLayerBuilder: function (pageDiv, pdfPage) {
    //  return new AnnotationsLayerBuilder({
    //    pageDiv: pageDiv,
    //    pdfPage: pdfPage,
    //    linkService: this.linkService
    //  });
    //},

    setFindController: function (findController) {
      this.findController = findController;
    },
  };

  return PDFViewer;
})();

var SimpleLinkService = (function SimpleLinkServiceClosure() {
  function SimpleLinkService(pdfViewer) {
    this.pdfViewer = pdfViewer;
  }
  SimpleLinkService.prototype = {
    /**
     * @returns {number}
     */
    get page() {
      return this.pdfViewer.currentPageNumber;
    },
    /**
     * @param {number} value
     */
    set page(value) {
      this.pdfViewer.currentPageNumber = value;
    },
    /**
     * @param dest - The PDF destination object.
     */
    navigateTo: function (dest) {},
    /**
     * @param dest - The PDF destination object.
     * @returns {string} The hyperlink to the PDF object.
     */
    getDestinationHash: function (dest) {
      return '#';
    },
    /**
     * @param hash - The PDF parameters/hash.
     * @returns {string} The hyperlink to the PDF object.
     */
    getAnchorUrl: function (hash) {
      return '#';
    },
    /**
     * @param {string} hash
     */
    setHash: function (hash) {},
    /**
     * @param {string} action
     */
    executeNamedAction: function (action) {},
  };
  return SimpleLinkService;
})();
/* end pdf_viewer.js */

/* overlay_manager.js */
var OverlayManager = {
  overlays: {},
  active: null,

  /**
   * @param {string} name The name of the overlay that is registered. This must
   *                 be equal to the ID of the overlay's DOM element.
   * @param {function} callerCloseMethod (optional) The method that, if present,
   *                   will call OverlayManager.close from the Object
   *                   registering the overlay. Access to this method is
   *                   necessary in order to run cleanup code when e.g.
   *                   the overlay is force closed. The default is null.
   * @param {boolean} canForceClose (optional) Indicates if opening the overlay
   *                  will close an active overlay. The default is false.
   * @returns {Promise} A promise that is resolved when the overlay has been
   *                    registered.
   */
  register: function overlayManagerRegister(name,
                                            callerCloseMethod, canForceClose) {
    return new Promise(function (resolve) {
      var element, container;
      if (!name || !(element = document.getElementById(name)) ||
          !(container = element.parentNode)) {
        throw new Error('Not enough parameters.');
      } else if (this.overlays[name]) {
        throw new Error('The overlay is already registered.');
      }
      this.overlays[name] = { element: element,
                              container: container,
                              callerCloseMethod: (callerCloseMethod || null),
                              canForceClose: (canForceClose || false) };
      resolve();
    }.bind(this));
  },

  /**
   * @param {string} name The name of the overlay that is unregistered.
   * @returns {Promise} A promise that is resolved when the overlay has been
   *                    unregistered.
   */
  unregister: function overlayManagerUnregister(name) {
    return new Promise(function (resolve) {
      if (!this.overlays[name]) {
        throw new Error('The overlay does not exist.');
      } else if (this.active === name) {
        throw new Error('The overlay cannot be removed while it is active.');
      }
      delete this.overlays[name];

      resolve();
    }.bind(this));
  },

  /**
   * @param {string} name The name of the overlay that should be opened.
   * @returns {Promise} A promise that is resolved when the overlay has been
   *                    opened.
   */
  open: function overlayManagerOpen(name) {
    return new Promise(function (resolve) {
      if (!this.overlays[name]) {
        throw new Error('The overlay does not exist.');
      } else if (this.active) {
        if (this.overlays[name].canForceClose) {
          this._closeThroughCaller();
        } else if (this.active === name) {
          throw new Error('The overlay is already active.');
        } else {
          throw new Error('Another overlay is currently active.');
        }
      }
      this.active = name;
      this.overlays[this.active].element.classList.remove('hidden');
      this.overlays[this.active].container.classList.remove('hidden');

      window.addEventListener('keydown', this._keyDown);
      resolve();
    }.bind(this));
  },

  /**
   * @param {string} name The name of the overlay that should be closed.
   * @returns {Promise} A promise that is resolved when the overlay has been
   *                    closed.
   */
  close: function overlayManagerClose(name) {
    return new Promise(function (resolve) {
      if (!this.overlays[name]) {
        throw new Error('The overlay does not exist.');
      } else if (!this.active) {
        throw new Error('The overlay is currently not active.');
      } else if (this.active !== name) {
        throw new Error('Another overlay is currently active.');
      }
      this.overlays[this.active].container.classList.add('hidden');
      this.overlays[this.active].element.classList.add('hidden');
      this.active = null;

      window.removeEventListener('keydown', this._keyDown);
      resolve();
    }.bind(this));
  },

  /**
   * @private
   */
  _keyDown: function overlayManager_keyDown(evt) {
    var self = OverlayManager;
    if (self.active && evt.keyCode === 27) { // Esc key.
      self._closeThroughCaller();
      evt.preventDefault();
    }
  },

  /**
   * @private
   */
  _closeThroughCaller: function overlayManager_closeThroughCaller() {
    if (this.overlays[this.active].callerCloseMethod) {
      this.overlays[this.active].callerCloseMethod();
    }
    if (this.active) {
      this.close(this.active);
    }
  }
};
/* end overlay_manager.js */

/* overlay_manager.js */
var PasswordPrompt = {
  overlayName: null,
  updatePassword: null,
  reason: null,
  passwordField: null,
  passwordText: null,
  passwordSubmit: null,
  passwordCancel: null,

  initialize: function secondaryToolbarInitialize(options) {
    this.overlayName = options.overlayName;
    this.passwordField = options.passwordField;
    this.passwordText = options.passwordText;
    this.passwordSubmit = options.passwordSubmit;
    this.passwordCancel = options.passwordCancel;

    // Attach the event listeners.
    this.passwordSubmit.addEventListener('click',
      this.verifyPassword.bind(this));

    this.passwordCancel.addEventListener('click', this.close.bind(this));

    this.passwordField.addEventListener('keydown', function (e) {
      if (e.keyCode === 13) { // Enter key
        this.verifyPassword();
      }
    }.bind(this));

    OverlayManager.register(this.overlayName, this.close.bind(this), true);
  },

  open: function passwordPromptOpen() {
    OverlayManager.open(this.overlayName).then(function () {
      this.passwordField.focus();

      var promptString = mozL10n.get('password_label', null,
        'Enter the password to open this PDF file.');

      if (this.reason === PDFJS.PasswordResponses.INCORRECT_PASSWORD) {
        promptString = mozL10n.get('password_invalid', null,
          'Invalid password. Please try again.');
      }

      this.passwordText.textContent = promptString;
    }.bind(this));
  },

  close: function passwordPromptClose() {
    OverlayManager.close(this.overlayName).then(function () {
      this.passwordField.value = '';
    }.bind(this));
  },

  verifyPassword: function passwordPromptVerifyPassword() {
    var password = this.passwordField.value;
    if (password && password.length > 0) {
      this.close();
      return this.updatePassword(password);
    }
  }
};
/* end overlay_manager.js */




var DEFAULT_SCALE_DELTA = 1.1;
var MIN_SCALE = 0.25;
var MAX_SCALE = 10.0;
var DISABLE_AUTO_FETCH_LOADING_BAR_TIMEOUT = 5000;

var mozL10n = document.mozL10n || document.webL10n;

PDFJS.cMapUrl = window.staticHost + '/bcmaps/';
PDFJS.cMapPacked = true;

//#include ui_utils.js
//#include preferences.js

//#if !(FIREFOX || MOZCENTRAL || B2G)
//#include mozPrintCallback_polyfill.js
//#endif

//#if GENERIC || CHROME
//#include download_manager.js
//#endif
//#if B2G
//var DownloadManager = (function DownloadManagerClosure() {
//  return function DownloadManager() {};
//})();
//#endif

//#if FIREFOX || MOZCENTRAL
//#include firefoxcom.js
//#endif

//#if CHROME
//#include chromecom.js
//#endif

//#include overlay_manager.js
//#include password_prompt.js
//#include pdf_viewer.js
//#include pdf_outline_view.js

var PDFViewerApplication = {
  initialized: false,
  fellback: false,
  pdfDocument: null,
  sidebarOpen: false,
  printing: false,
  /** @type {PDFViewer} */
  pdfViewer: null,
  /** @type {PDFRenderingQueue} */
  pdfRenderingQueue: null,
  updateScaleControls: true,
  isInitialViewSet: false,
  animationStartedPromise: null,
  mouseScrollTimeStamp: 0,
  mouseScrollDelta: 0,
  preferencePdfBugEnabled: false,
  preferenceShowPreviousViewOnLoad: true,
  preferenceDefaultZoomValue: '',
  isViewerEmbedded: (window.parent !== window),
  url: '',

  // called once when the document is loaded
  initialize: function pdfViewInitialize() {
    var pdfRenderingQueue = new PDFRenderingQueue();
    pdfRenderingQueue.onIdle = this.cleanup.bind(this);
    this.pdfRenderingQueue = pdfRenderingQueue;

    var container = document.getElementById('viewerContainer');
    var viewer = document.getElementById('viewer');
    this.pdfViewer = new PDFViewer({
      container: container,
      viewer: viewer,
      renderingQueue: pdfRenderingQueue,
      linkService: this
    });
    pdfRenderingQueue.setViewer(this.pdfViewer);

    Preferences.initialize();

    PasswordPrompt.initialize({
      overlayName: 'passwordOverlay',
      passwordField: document.getElementById('password'),
      passwordText: document.getElementById('passwordText'),
      passwordSubmit: document.getElementById('passwordSubmit'),
      passwordCancel: document.getElementById('passwordCancel')
    });

    var self = this;
    var initializedPromise = Promise.all([
      Preferences.get('enableWebGL').then(function resolved(value) {
        PDFJS.disableWebGL = !value;
      }),
      Preferences.get('sidebarViewOnLoad').then(function resolved(value) {
        self.preferenceSidebarViewOnLoad = value;
      }),
      Preferences.get('pdfBugEnabled').then(function resolved(value) {
        self.preferencePdfBugEnabled = value;
      }),
      Preferences.get('showPreviousViewOnLoad').then(function resolved(value) {
        self.preferenceShowPreviousViewOnLoad = value;
      }),
      Preferences.get('defaultZoomValue').then(function resolved(value) {
        self.preferenceDefaultZoomValue = value;
      }),
      Preferences.get('disableTextLayer').then(function resolved(value) {
        if (PDFJS.disableTextLayer === true) {
          return;
        }
        PDFJS.disableTextLayer = value;
      }),
      Preferences.get('disableRange').then(function resolved(value) {
        if (PDFJS.disableRange === true) {
          return;
        }
        PDFJS.disableRange = value;
      }),
      Preferences.get('disableAutoFetch').then(function resolved(value) {
        PDFJS.disableAutoFetch = value;
      }),
      Preferences.get('disableFontFace').then(function resolved(value) {
        if (PDFJS.disableFontFace === true) {
          return;
        }
        PDFJS.disableFontFace = value;
      }),
      Preferences.get('useOnlyCssZoom').then(function resolved(value) {
        PDFJS.useOnlyCssZoom = value;
      })
      // TODO move more preferences and other async stuff here
    ]).catch(function (reason) { });

    return initializedPromise.then(function () {
      PDFViewerApplication.initialized = true;
    });
  },

  zoomIn: function pdfViewZoomIn(ticks) {
    var newScale = this.pdfViewer.currentScale;
    do {
      newScale = (newScale * DEFAULT_SCALE_DELTA).toFixed(2);
      newScale = Math.ceil(newScale * 10) / 10;
      newScale = Math.min(MAX_SCALE, newScale);
    } while (--ticks && newScale < MAX_SCALE);
    this.setScale(newScale, true);
    updateViewarea();
  },

  zoomOut: function pdfViewZoomOut(ticks) {
    var newScale = this.pdfViewer.currentScale;
    do {
      newScale = (newScale / DEFAULT_SCALE_DELTA).toFixed(2);
      newScale = Math.floor(newScale * 10) / 10;
      newScale = Math.max(MIN_SCALE, newScale);
    } while (--ticks && newScale > MIN_SCALE);
    this.setScale(newScale, true);
    updateViewarea();
  },

  get currentScaleValue() {
    return this.pdfViewer.currentScaleValue;
  },

  get pagesCount() {
    return this.pdfDocument.numPages;
  },

  set page(val) {
    this.pdfViewer.currentPageNumber = val;
  },

  get page() {
    return this.pdfViewer.currentPageNumber;
  },

  get supportsPrinting() {
    var canvas = document.createElement('canvas');
    var value = 'mozPrintCallback' in canvas;

    //return PDFJS.shadow(this, 'supportsPrinting', value);
    return true
  },


  get supportsDocumentColors() {
    var support = true;
//#if (FIREFOX || MOZCENTRAL)
//  support = FirefoxCom.requestSync('supportsDocumentColors');
//#endif

    return PDFJS.shadow(this, 'supportsDocumentColors', support);
  },

  get loadingBar() {
    var bar = new ProgressBar('#loadingBar', {});

    return PDFJS.shadow(this, 'loadingBar', bar);
  },

  setTitleUsingUrl: function pdfViewSetTitleUsingUrl(url) {
    this.url = url;
    try {
      this.setTitle(decodeURIComponent(getFileName(url)) || url);
    } catch (e) {
      // decodeURIComponent may throw URIError,
      // fall back to using the unprocessed url in that case
      this.setTitle(url);
    }
  },

  setTitle: function pdfViewSetTitle(title) {
    if (this.isViewerEmbedded) {
      // Embedded PDF viewers should not be changing their parent page's title.
      return;
    }
    document.title = title;
//#if B2G
//  document.getElementById('activityTitle').textContent = title;
//#endif
  },

  close: function pdfViewClose() {
    var errorWrapper = document.getElementById('errorWrapper');
    errorWrapper.setAttribute('hidden', 'true');

    if (!this.pdfDocument) {
      return;
    }

    this.pdfDocument.destroy();
    this.pdfDocument = null;

    this.pdfViewer.setDocument(null);

    if (typeof PDFBug !== 'undefined') {
      PDFBug.cleanup();
    }
  },

  // TODO(mack): This function signature should really be pdfViewOpen(url, args)
  open: function pdfViewOpen(file, scale, password,
                             pdfDataRangeTransport, args) {
    if (this.pdfDocument) {
      // Reload the preferences if a document was previously opened.
      Preferences.reload();
    }
    this.close();

    var parameters = {password: password};
    if (typeof file === 'string') { // URL
      this.setTitleUsingUrl(file);
      parameters.url = file;
    } else if (file && 'byteLength' in file) { // ArrayBuffer
      parameters.data = file;
    } else if (file.url && file.originalUrl) {
      this.setTitleUsingUrl(file.originalUrl);
      parameters.url = file.url;
    }
    if (args) {
      for (var prop in args) {
        parameters[prop] = args[prop];
      }
    }

    var self = this;
    self.loading = true;
    self.downloadComplete = false;

    var passwordNeeded = function passwordNeeded(updatePassword, reason) {
      PasswordPrompt.updatePassword = updatePassword;
      PasswordPrompt.reason = reason;
      PasswordPrompt.open();
    };

    function getDocumentProgress(progressData) {
      self.progress(progressData.loaded / progressData.total);
    }

    PDFJS.getDocument(parameters, pdfDataRangeTransport, passwordNeeded,
                      getDocumentProgress).then(
      function getDocumentCallback(pdfDocument) {
        self.load(pdfDocument, scale);
        self.loading = false;
      },
      function getDocumentError(exception) {
        var message = exception && exception.message;
        var loadingErrorMessage = mozL10n.get('loading_error', null,
          'An error occurred while loading the PDF.');

        if (exception instanceof PDFJS.InvalidPDFException) {
          // change error message also for other builds
          loadingErrorMessage = mozL10n.get('invalid_file_error', null,
                                            'Invalid or corrupted PDF file.');
        } else if (exception instanceof PDFJS.MissingPDFException) {
          // special message for missing PDF's
          loadingErrorMessage = mozL10n.get('missing_file_error', null,
                                            'Missing PDF file.');
        } else if (exception instanceof PDFJS.UnexpectedResponseException) {
          loadingErrorMessage = mozL10n.get('unexpected_response_error', null,
                                            'Unexpected server response.');
        }
//#if B2G
//      window.alert(loadingErrorMessage);
//      return window.close();
//#endif

        var moreInfo = {
          message: message
        };
        if (typeof window.onerror == 'function') {
          window.onerror();
        } else {
          /* DO NOT SHOW ERROR MESSAGE */
          self.error(loadingErrorMessage, moreInfo);
          self.loading = false;
        }
      }
    );

  },

  download: function pdfViewDownload() {
    function downloadByUrl() {
      downloadManager.downloadUrl(url, filename);
    }

    var url = this.url.split('#')[0];
    var filename = getPDFFileNameFromURL(url);
    var downloadManager = new DownloadManager();
    downloadManager.onerror = function (err) {
      // This error won't really be helpful because it's likely the
      // fallback won't work either (or is already open).
      PDFViewerApplication.error('PDF failed to download.');
    };

    if (!this.pdfDocument) { // the PDF is not ready yet
      downloadByUrl();
      return;
    }

    if (!this.downloadComplete) { // the PDF is still downloading
      downloadByUrl();
      return;
    }

    this.pdfDocument.getData().then(
      function getDataSuccess(data) {
        var blob = PDFJS.createBlob(data, 'application/pdf');
        downloadManager.download(blob, url, filename);
      },
      downloadByUrl // Error occurred try downloading with just the url.
    ).then(null, downloadByUrl);
  },

  fallback: function pdfViewFallback(featureId) {
  },

  /**
   * Prefix the full url on anchor links to make sure that links are resolved
   * relative to the current URL instead of the one defined in <base href>.
   * @param {String} anchor The anchor hash, including the #.
   */
  getAnchorUrl: function getAnchorUrl(anchor) {
    return anchor;
  },

  /**
   * Show the error box.
   * @param {String} message A message that is human readable.
   * @param {Object} moreInfo (optional) Further information about the error
   *                            that is more technical.  Should have a 'message'
   *                            and optionally a 'stack' property.
   */
  error: function pdfViewError(message, moreInfo) {
    var moreInfoText = mozL10n.get('error_version_info',
      {version: PDFJS.version || '?', build: PDFJS.build || '?'},
      'PDF.js v{{version}} (build: {{build}})') + '\n';
    if (moreInfo) {
      moreInfoText +=
        mozL10n.get('error_message', {message: moreInfo.message},
        'Message: {{message}}');
      if (moreInfo.stack) {
        moreInfoText += '\n' +
          mozL10n.get('error_stack', {stack: moreInfo.stack},
          'Stack: {{stack}}');
      } else {
        if (moreInfo.filename) {
          moreInfoText += '\n' +
            mozL10n.get('error_file', {file: moreInfo.filename},
            'File: {{file}}');
        }
        if (moreInfo.lineNumber) {
          moreInfoText += '\n' +
            mozL10n.get('error_line', {line: moreInfo.lineNumber},
            'Line: {{line}}');
        }
      }
    }

//#if !(FIREFOX || MOZCENTRAL)
    var errorWrapper = document.getElementById('errorWrapper');
    errorWrapper.removeAttribute('hidden');

    var errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;

    var closeButton = document.getElementById('errorClose');
    closeButton.onclick = function() {
      errorWrapper.setAttribute('hidden', 'true');
    };

    var errorMoreInfo = document.getElementById('errorMoreInfo');
    var moreInfoButton = document.getElementById('errorShowMore');
    var lessInfoButton = document.getElementById('errorShowLess');
    moreInfoButton.onclick = function() {
      errorMoreInfo.removeAttribute('hidden');
      moreInfoButton.setAttribute('hidden', 'true');
      lessInfoButton.removeAttribute('hidden');
      errorMoreInfo.style.height = errorMoreInfo.scrollHeight + 'px';
    };
    lessInfoButton.onclick = function() {
      errorMoreInfo.setAttribute('hidden', 'true');
      moreInfoButton.removeAttribute('hidden');
      lessInfoButton.setAttribute('hidden', 'true');
    };
    moreInfoButton.oncontextmenu = noContextMenuHandler;
    lessInfoButton.oncontextmenu = noContextMenuHandler;
    closeButton.oncontextmenu = noContextMenuHandler;
    moreInfoButton.removeAttribute('hidden');
    lessInfoButton.setAttribute('hidden', 'true');
    errorMoreInfo.value = moreInfoText;
  },

  progress: function pdfViewProgress(level) {
    var percent = Math.round(level * 100);
    // When we transition from full request to range requests, it's possible
    // that we discard some of the loaded data. This can cause the loading
    // bar to move backwards. So prevent this by only updating the bar if it
    // increases.
    if (percent > this.loadingBar.percent || isNaN(percent)) {
      this.loadingBar.percent = percent;

      // When disableAutoFetch is enabled, it's not uncommon for the entire file
      // to never be fetched (depends on e.g. the file structure). In this case
      // the loading bar will not be completely filled, nor will it be hidden.
      // To prevent displaying a partially filled loading bar permanently, we
      // hide it when no data has been loaded during a certain amount of time.
      if (PDFJS.disableAutoFetch && percent) {
        if (this.disableAutoFetchLoadingBarTimeout) {
          clearTimeout(this.disableAutoFetchLoadingBarTimeout);
          this.disableAutoFetchLoadingBarTimeout = null;
        }
        this.loadingBar.show();

        this.disableAutoFetchLoadingBarTimeout = setTimeout(function () {
          this.loadingBar.hide();
          this.disableAutoFetchLoadingBarTimeout = null;
        }.bind(this), DISABLE_AUTO_FETCH_LOADING_BAR_TIMEOUT);
      }
    }
  },

  load: function pdfViewLoad(pdfDocument, scale) {
    var self = this;
    scale = scale || UNKNOWN_SCALE;

    this.pdfDocument = pdfDocument;

    var downloadedPromise = pdfDocument.getDownloadInfo().then(function() {
      self.downloadComplete = true;
      self.loadingBar.hide();
      document.querySelector('.toolbar').style.opacity = 1;
    });

    var pagesCount = pdfDocument.numPages;

    var id = this.documentFingerprint = pdfDocument.fingerprint;

    var pdfViewer = this.pdfViewer;
    pdfViewer.currentScale = scale;
    pdfViewer.setDocument(pdfDocument);
    var firstPagePromise = pdfViewer.firstPagePromise;
    var pagesPromise = pdfViewer.pagesPromise;
    var onePageRendered = pdfViewer.onePageRendered;

    this.isInitialViewSet = false;
    this.pagesRefMap = pdfViewer.pagesRefMap;

    firstPagePromise.then(function(pdfPage) {
      downloadedPromise.then(function () {
        var event = document.createEvent('CustomEvent');
        event.initCustomEvent('documentload', true, true, {});
        window.dispatchEvent(event);
      });

      self.loadingBar.setWidth(document.getElementById('viewer'));

      self.setInitialView(null, scale);
    });

    pagesPromise.then(function() {
      if (self.supportsPrinting) {
        pdfDocument.getJavaScript().then(function(javaScript) {
          if (javaScript.length) {
            console.warn('Warning: JavaScript is not supported');
            self.fallback(PDFJS.UNSUPPORTED_FEATURES.javaScript);
          }
          // Hack to support auto printing.
          var regex = /\bprint\s*\(/g;
          for (var i = 0, ii = javaScript.length; i < ii; i++) {
            var js = javaScript[i];
            if (js && regex.test(js)) {
              setTimeout(function() {
                window.print();
              });
              return;
            }
          }
        });
      }
    });

    pdfDocument.getMetadata().then(function(data) {
      var info = data.info, metadata = data.metadata;
      self.documentInfo = info;
      self.metadata = metadata;

      // Provides some basic debug information
      console.log('PDF ' + pdfDocument.fingerprint + ' [' +
                  info.PDFFormatVersion + ' ' + (info.Producer || '-').trim() +
                  ' / ' + (info.Creator || '-').trim() + ']' +
                  ' (PDF.js: ' + (PDFJS.version || '-') +
                  (!PDFJS.disableWebGL ? ' [WebGL]' : '') + ')');

      var pdfTitle;
      if (metadata && metadata.has('dc:title')) {
        var title = metadata.get('dc:title');
        // Ghostscript sometimes return 'Untitled', sets the title to 'Untitled'
        if (title !== 'Untitled') {
          pdfTitle = title;
        }
      }

      if (!pdfTitle && info && info['Title']) {
        pdfTitle = info['Title'];
      }

      if (pdfTitle) {
        self.setTitle(pdfTitle + ' - ' + document.title);
      }

      if (info.IsAcroFormPresent) {
        console.warn('Warning: AcroForm/XFA is not supported');
        self.fallback(PDFJS.UNSUPPORTED_FEATURES.forms);
      }

    });
  },

  setInitialView: function pdfViewSetInitialView(storedHash, scale) {
    this.isInitialViewSet = true;

    this.setScale(scale, true);
    this.page = 1;

    // Set scale based on container width, if given
    if (!!window.containerWidth) {
      var newScale = window.containerWidth / this.pdfViewer.viewportWidth;
      this.setScale(newScale, true);
    }

    if (this.pdfViewer.currentScale === UNKNOWN_SCALE) {
      // Scale was not initialized: invalid bookmark or scale was not specified.
      // Setting the default one.
      this.setScale(DEFAULT_SCALE, true);
    }
  },

  cleanup: function pdfViewCleanup() {
    this.pdfViewer.cleanup();
    this.pdfDocument.cleanup();
  },

  forceRendering: function pdfViewForceRendering() {
    this.pdfRenderingQueue.printing = this.printing;
    this.pdfRenderingQueue.isThumbnailViewEnabled = this.sidebarOpen;
    this.pdfRenderingQueue.renderHighestPriority();
  },

  // Helper function to parse query string (e.g. ?param1=value&parm2=...).
  parseQueryString: function pdfViewParseQueryString(query) {
    var parts = query.split('&');
    var params = {};
    for (var i = 0, ii = parts.length; i < ii; ++i) {
      var param = parts[i].split('=');
      var key = param[0].toLowerCase();
      var value = param.length > 1 ? param[1] : null;
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
    return params;
  },

  beforePrint: function pdfViewSetupBeforePrint() {
    if (!this.supportsPrinting) {
      var printMessage = mozL10n.get('printing_not_supported', null,
          'Warning: Printing is not fully supported by this browser.');
      this.error(printMessage);
      return;
    }

    var alertNotReady = false;
    var i, ii;
    if (!this.pagesCount) {
      alertNotReady = true;
    } else {
      for (i = 0, ii = this.pagesCount; i < ii; ++i) {
        if (!this.pdfViewer.getPageView(i).pdfPage) {
          alertNotReady = true;
          break;
        }
      }
    }
    if (alertNotReady) {
      var notReadyMessage = mozL10n.get('printing_not_ready', null,
          'Warning: The PDF is not fully loaded for printing.');
      window.alert(notReadyMessage);
      return;
    }

    this.printing = true;
    this.forceRendering();

    var body = document.querySelector('body');
    body.setAttribute('data-mozPrintCallback', true);
    for (i = 0, ii = this.pagesCount; i < ii; ++i) {
      this.pdfViewer.getPageView(i).beforePrint();
    }

  },

  afterPrint: function pdfViewSetupAfterPrint() {
    var div = document.getElementById('printContainer');
    while (div.hasChildNodes()) {
      div.removeChild(div.lastChild);
    }

    this.printing = false;
    this.forceRendering();
  },

  setScale: function (value, resetAutoSettings) {
    this.updateScaleControls = !!resetAutoSettings;
    this.pdfViewer.currentScaleValue = value;
    this.updateScaleControls = true;
  },

  /**
   * This function flips the page in presentation mode if the user scrolls up
   * or down with large enough motion and prevents page flipping too often.
   *
   * @this {PDFView}
   * @param {number} mouseScrollDelta The delta value from the mouse event.
   */
  mouseScroll: function pdfViewMouseScroll(mouseScrollDelta) {
    var MOUSE_SCROLL_COOLDOWN_TIME = 50;

    var currentTime = (new Date()).getTime();
    var storedTime = this.mouseScrollTimeStamp;

    // In case one page has already been flipped there is a cooldown time
    // which has to expire before next page can be scrolled on to.
    if (currentTime > storedTime &&
        currentTime - storedTime < MOUSE_SCROLL_COOLDOWN_TIME) {
      return;
    }

    // In case the user decides to scroll to the opposite direction than before
    // clear the accumulated delta.
    if ((this.mouseScrollDelta > 0 && mouseScrollDelta < 0) ||
        (this.mouseScrollDelta < 0 && mouseScrollDelta > 0)) {
      this.clearMouseScrollState();
    }

    this.mouseScrollDelta += mouseScrollDelta;

    var PAGE_FLIP_THRESHOLD = 120;
    if (Math.abs(this.mouseScrollDelta) >= PAGE_FLIP_THRESHOLD) {

      var PageFlipDirection = {
        UP: -1,
        DOWN: 1
      };

      // In presentation mode scroll one page at a time.
      var pageFlipDirection = (this.mouseScrollDelta > 0) ?
                                PageFlipDirection.UP :
                                PageFlipDirection.DOWN;
      this.clearMouseScrollState();
      var currentPage = this.page;

      // In case we are already on the first or the last page there is no need
      // to do anything.
      if ((currentPage === 1 && pageFlipDirection === PageFlipDirection.UP) ||
          (currentPage === this.pagesCount &&
           pageFlipDirection === PageFlipDirection.DOWN)) {
        return;
      }

      this.page += pageFlipDirection;
      this.mouseScrollTimeStamp = currentTime;
    }
  },

  /**
   * This function clears the member attributes used with mouse scrolling in
   * presentation mode.
   *
   * @this {PDFView}
   */
  clearMouseScrollState: function pdfViewClearMouseScrollState() {
    this.mouseScrollTimeStamp = 0;
    this.mouseScrollDelta = 0;
  }
};

function webViewerLoad() {
  PDFViewerApplication.initialize().then(webViewerInitialized);
}

function webViewerInitialized(file) {
//#if (GENERIC || B2G)
  var file = decodeURIComponent(window.FILE_URL || '');

//#if !(FIREFOX || MOZCENTRAL)
  var locale = PDFJS.locale || navigator.language;
//#endif

//#if !(FIREFOX || MOZCENTRAL)
  mozL10n.setLanguage(locale);

  if (!PDFViewerApplication.supportsPrinting) {
    document.getElementById('print').classList.add('hidden');
  }

  // Listen for unsupported features to trigger the fallback UI.
  PDFJS.UnsupportedManager.listen(
    PDFViewerApplication.fallback.bind(PDFViewerApplication));

  var mainContainer = document.getElementById('mainContainer');
  var outerContainer = document.getElementById('outerContainer');
  mainContainer.addEventListener('transitionend', function(e) {
    if (e.target === mainContainer) {
      var event = document.createEvent('UIEvents');
      event.initUIEvent('resize', false, false, window, 0);
      window.dispatchEvent(event);
      outerContainer.classList.remove('sidebarMoving');
    }
  }, true);

  document.getElementById('zoomIn').addEventListener('click',
    function() {
      PDFViewerApplication.zoomIn();
    });

  document.getElementById('zoomOut').addEventListener('click',
    function() {
      PDFViewerApplication.zoomOut();
    });

  document.getElementById('print').addEventListener('click',
    function() {
      window.print();
    });

  document.getElementById('download').addEventListener('click',
    PDFViewerApplication.download.bind(PDFViewerApplication));

//#if GENERIC
  if (file && file.lastIndexOf('file:', 0) === 0) {
    // file:-scheme. Load the contents in the main thread because QtWebKit
    // cannot load file:-URLs in a Web Worker. file:-URLs are usually loaded
    // very quickly, so there is no need to set up progress event listeners.
    PDFViewerApplication.setTitleUsingUrl(file);
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
      PDFViewerApplication.open(new Uint8Array(xhr.response), 0);
    };
    try {
      xhr.open('GET', file);
      xhr.responseType = 'arraybuffer';
      xhr.send();
    } catch (e) {
      PDFViewerApplication.error(mozL10n.get('loading_error', null,
        'An error occurred while loading the PDF.'), e);
    }
    return;
  }
//#endif

//#if !B2G && !CHROME
  if (file) {
    PDFViewerApplication.open(file, DEFAULT_SCALE_DELTA);
  }
}

document.addEventListener('pagerendered', function (e) {
  var pageNumber = e.detail.pageNumber;
  var pageIndex = pageNumber - 1;
  var pageView = PDFViewerApplication.pdfViewer.getPageView(pageIndex);

  if (PDFJS.pdfBug && Stats.enabled && pageView.stats) {
    Stats.add(pageNumber, pageView.stats);
  }

  if (pageView.error) {
    PDFViewerApplication.error(mozL10n.get('rendering_error', null,
      'An error occurred while rendering the page.'), pageView.error);
  }

}, true);

document.addEventListener('textlayerrendered', function (e) {
  var pageIndex = e.detail.pageNumber - 1;
  var pageView = PDFViewerApplication.pdfViewer.getPageView(pageIndex);

}, true);

function updateViewarea() {
  if (!PDFViewerApplication.initialized) {
    return;
  }
  PDFViewerApplication.pdfViewer.update();
}

window.addEventListener('updateviewarea', function () {
  if (!PDFViewerApplication.initialized) {
    return;
  }

  var location = PDFViewerApplication.pdfViewer.location;

  var currentPage =
    PDFViewerApplication.pdfViewer.getPageView(PDFViewerApplication.page - 1);

}, true);

window.addEventListener('resize', function webViewerResize(evt) {
  if (PDFViewerApplication.initialized) {
    PDFViewerApplication.setScale(1, false);
  }
  updateViewarea();
});

//#if !(FIREFOX || MOZCENTRAL || CHROME)
window.addEventListener('change', function webViewerChange(evt) {
  var files = evt.target.files;
  if (!files || files.length === 0) {
    return;
  }
  var file = files[0];

  if (!PDFJS.disableCreateObjectURL &&
      typeof URL !== 'undefined' && URL.createObjectURL) {
    PDFViewerApplication.open(URL.createObjectURL(file), 0);
  } else {
    // Read the local file into a Uint8Array.
    var fileReader = new FileReader();
    fileReader.onload = function webViewerChangeFileReaderOnload(evt) {
      var buffer = evt.target.result;
      var uint8Array = new Uint8Array(buffer);
      PDFViewerApplication.open(uint8Array, 0);
    };
    fileReader.readAsArrayBuffer(file);
  }

  PDFViewerApplication.setTitleUsingUrl(file.name);

  document.getElementById('download').setAttribute('hidden', 'true');
}, true);

window.addEventListener('localized', function localized(evt) {
  document.getElementsByTagName('html')[0].dir = mozL10n.getDirection();
}, true);

window.addEventListener('scalechange', function scalechange(evt) {
  document.getElementById('zoomOut').disabled = (evt.scale === MIN_SCALE);
  document.getElementById('zoomIn').disabled = (evt.scale === MAX_SCALE);

}, true);

window.addEventListener('pagechange', function pagechange(evt) {
  var page = evt.pageNumber;
  var numPages = PDFViewerApplication.pagesCount;

  // we need to update stats
  if (PDFJS.pdfBug && Stats.enabled) {
    var pageView = PDFViewerApplication.pdfViewer.getPageView(page - 1);
    if (pageView.stats) {
      Stats.add(page, pageView.stats);
    }
  }

  // checking if the this.page was called from the updateViewarea function
  if (evt.updateInProgress) {
    return;
  }
  // Avoid scrolling the first page during loading
  if (this.loading && page === 1) {
    return;
  }
  PDFViewerApplication.pdfViewer.scrollPageIntoView(page);
}, true);

function handleMouseWheel(evt) {
  var MOUSE_WHEEL_DELTA_FACTOR = 40;
  var ticks = (evt.type === 'DOMMouseScroll') ? -evt.detail :
              evt.wheelDelta / MOUSE_WHEEL_DELTA_FACTOR;
  var direction = (ticks < 0) ? 'zoomOut' : 'zoomIn';

}

window.addEventListener('DOMMouseScroll', handleMouseWheel);
window.addEventListener('mousewheel', handleMouseWheel);

window.addEventListener('beforeprint', function beforePrint(evt) {
  PDFViewerApplication.beforePrint();
});

window.addEventListener('afterprint', function afterPrint(evt) {
  PDFViewerApplication.afterPrint();
});

(function animationStartedClosure() {
  // The offsetParent is not set until the pdf.js iframe or object is visible.
  // Waiting for first animation.
  PDFViewerApplication.animationStartedPromise = new Promise(
      function (resolve) {
    window.requestAnimationFrame(resolve);
  });
})();

window.addEventListener('DOMContentLoaded', webViewerLoad, true);

})(window, document);
