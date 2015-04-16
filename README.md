PDF Viewer
====
Lightweight PDF viewer using Mozila's [PDF JS](https://github.com/mozilla/pdf.js).

[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]

## Screenshot

!['screenshot'](examples/screenshot.png)

## Usage

  Serve `index.html` using a server, and pass your file through `http://example.com/index.html?file=/path/to/your/file`.

## Examples

  Follow these steps to get a demo:

  1. Run command:
  ```shell
  npm install && node server
  ```

  2. Go to your browser and open:
  ```
  http://localhost:8000/index.html?file=examples/sample.pdf
  ```

## Who's using

+ Teambition: https://www.teambition.com/

[npm-url]: https://npmjs.org/package/pdfviewer
[npm-image]: http://img.shields.io/npm/v/pdfviewer.svg

[travis-url]: https://travis-ci.org/teambition/pdfviewer
[travis-image]: http://img.shields.io/travis/teambition/pdfviewer.svg
