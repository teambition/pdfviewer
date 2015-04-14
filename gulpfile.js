'use strict';

var gulp = require('gulp'),
  gulpSequence = require('gulp-sequence'),
  jshint = require('gulp-jshint');

gulp.task('jshint', function () {
  return gulp.src(['index.js', 'gulpfile.js', 'examples/*.js', 'test/*.js'])
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('default', ['test']);

gulp.task('test', gulpSequence('jshint'));
