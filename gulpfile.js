'use strict';

var path = require('path');
var gulp = require('gulp');
var merge2 = require('merge2');
var clean = require('gulp-rimraf');
var uglify = require('gulp-uglify');
var jshint = require('gulp-jshint');
var minifyCss = require('gulp-minify-css');
var minifyHtml = require('gulp-minify-html');
var gulpSequence = require('gulp-sequence');

gulp.task('clean', function() {
  return gulp.src('dist', {read: false})
  .pipe(clean({force: true}));
});

gulp.task('jshint', function () {
  return gulp.src(['src/*.js', 'gulpfile.js', 'examples/*.js', 'test/*.js'])
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('pdfjs', function(){
  return merge2(
    gulp.src('bower_components/pdf.js/build/generic/build/*.js'),
    gulp.src([
      'bower_components/pdf.js/build/generic/web/compatibility.js',
      'bower_components/pdf.js/build/generic/web/l10n.js',
      'src/js/viewer.js'
    ])
  ).pipe(uglify()).pipe(gulp.dest('dist/js'));
});

gulp.task('bcmaps', function(){
  return gulp.src('bower_components/pdf.js/external/bcmaps/*.bcmap')
    .pipe(gulp.dest('dist/bcmaps'))
});

gulp.task('others', function(){
  return merge2([
    gulp.src(['src/locale/**', 'src/images/**'], {base: 'src'}),
    gulp.src('src/css/*.css', {base: 'src'}).pipe(minifyCss({rebase: false})),
    gulp.src('src/index.html', {base: 'src'}).pipe(minifyHtml()),
    gulp.src('src/pdfviewer.js' , {base: 'src'}).pipe(uglify())
  ]).pipe(gulp.dest('dist'));
});

gulp.task('default', ['build']);

gulp.task('test', gulpSequence('jshint'));
gulp.task('build', gulpSequence('clean', 'pdfjs', 'bcmaps', 'others'));
