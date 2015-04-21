'use strict';

var path = require('path'),
  pack = require('./package'),
  gulp = require('gulp'),
  cssmin = require('gulp-cssmin'),
  uglify = require('gulp-uglify'),
  gulpSequence = require('gulp-sequence'),
  jshint = require('gulp-jshint');

var dest = path.join('dist', pack.version)

gulp.task('jshint', function () {
  return gulp.src(['src/*.js', 'gulpfile.js', 'examples/*.js', 'test/*.js'])
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('copy', function(){
  return gulp.src(['src/locale/**/*', 'src/css/images/*', 'src/js/pdf.js', 'src/js/pdf.worker.js'], {base: 'src'})
    .pipe(gulp.dest(dest));
})

gulp.task('style', function(){
  return gulp.src('src/css/*.css', {base: 'src'})
    .pipe(cssmin())
    .pipe(gulp.dest(dest));
});

gulp.task('script', function(){
  return gulp.src(['src/index.js', 'src/js/compatibility.js', 'src/js/viewer.js'], {base: 'src'})
    .pipe(uglify())
    .pipe(gulp.dest(dest));
});

gulp.task('default', ['test']);

gulp.task('test', gulpSequence('jshint'));
gulp.task('build', gulpSequence(['copy', 'style', 'script']))
