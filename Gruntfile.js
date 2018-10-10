module.exports = function(grunt) {

  var resolve = require('rollup-plugin-node-resolve');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    processhtml: {
      dist: {
        files: {
          'build/qds.html': ['qds.html'],
        },
      },
    },
    htmlmin: {
      dist: {
        options: {
          collapseWhitespace: true,
          conservativeCollapse: true
        },
        files: {
          'dist/qds.html': ['build/qds.html' ],
        },
      },
    },
    rollup: {
      dist: {
        options: {
          plugins: [ resolve() ],
        },
        files: {
          'deps_bundle.js': ['deps.js'],
        },
      },
    },
    uglify: {
      dist: {
        files: {
          'dist/qdsproc.js': ['qdsproc.js'],
          'dist/common.js': [
            'common-polyfill.js',
            'deps_bundle.js',
            'common-audio.js',
            'graph.js',
          ],
          'dist/qds.js': ['qds.js'],
        },
      },
    },
    copy: {
      dist: {
        files: [
          { expand: true, src: ['audio/*', 'images/**'], dest: 'dist/' },
        ],
      },
    },
  });

  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-htmlmin');
  grunt.loadNpmTasks('grunt-contrib-uglify-es');
  grunt.loadNpmTasks('grunt-processhtml');
  grunt.loadNpmTasks('grunt-rollup');

  grunt.registerTask('default', [
    'processhtml',
    'htmlmin',
    'rollup',
    'uglify',
    'copy',
  ]);
};
