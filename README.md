PDF Viewer
====
Lightweight PDF viewer using Mozilla's [PDF JS](https://github.com/mozilla/pdf.js).

[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]

## Screenshot

!['screenshot'](examples/screenshot.png)

## Pre-requirments

  ```
  npm install
  npm run build
  ```

  Deploy `dist` to your own static server.

## Usage

  See example in [test](./test) directory

## Options

  The options `PdfViewer` accepts are:

  1. **pdfUrl**(required):
    URL to your pdf file, can be relative or absolute. If it is a cross-domain path, the remote server must support [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS).

  2. **staticHost**(required):
    Static files host, PdfViewer dependents on Mozila's `PDF.js` and our `viewer.js`, which must be served.

  3. **onerror**(optional):
    A custom `onerror` callback function, if error occurs when reading or rendering your pdf file, this function will be called.
    If omitted, our viewer's default error handler will be used.

## Examples

  To get a demo:

  1. Run command:
  ```shell
  npm start
  ```

  2. Test viewer.js:
  ```
  http://localhost:9000
  ```

  3. Test pdfviewer.js (viewer.js in iframe):
  ```
  http://localhost:9001
  ```

## Who's using

+ Teambition: https://www.teambition.com/

[npm-url]: https://npmjs.org/package/pdfviewer
[npm-image]: http://img.shields.io/npm/v/pdfviewer.svg

[travis-url]: https://travis-ci.org/teambition/pdfviewer
[travis-image]: http://img.shields.io/travis/teambition/pdfviewer.svg
