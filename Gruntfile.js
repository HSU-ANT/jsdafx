module.exports = function(grunt) {

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
    uglify: {
      dist: {
        files: {
          'dist/qdsproc.js': ['qdsproc.js'],
          'dist/common.js': [
            'common-polyfill.js',
            'node_modules/audioworklet-polyfill/dist/audioworklet-polyfill.js',
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

  grunt.registerTask('default', [
    'processhtml',
    'htmlmin',
    'uglify',
    'copy',
  ]);
};
