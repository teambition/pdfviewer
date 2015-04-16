'use strict';

var gulp = require('gulp'),
  cssmin = require('gulp-cssmin'),
  uglify = require('gulp-uglify'),
  gulpSequence = require('gulp-sequence'),
  jshint = require('gulp-jshint');

gulp.task('jshint', function () {
  return gulp.src(['src/*.js', 'gulpfile.js', 'examples/*.js', 'test/*.js'])
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('copy', function(){
  gulp.src('src/locale/**/*', {base: 'src'})
    .pipe(gulp.dest('dist'))

  gulp.src('src/styles/images/*', {base: 'src'})
    .pipe(gulp.dest('dist'))
})

gulp.task('style', function(){
  return gulp.src('src/styles/*.css', {base: 'src'})
    .pipe(cssmin())
    .pipe(gulp.dest('dist'))
})

gulp.task('script', function(){
  return gulp.src('src/*.js')
    .pipe(uglify())
    .pipe(gulp.dest('dist'))
})


gulp.task('default', ['test']);

gulp.task('test', gulpSequence('jshint'));
gulp.task('default', gulpSequence(['copy', 'style', 'script']))
