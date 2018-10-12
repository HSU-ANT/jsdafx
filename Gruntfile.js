module.exports = function(grunt) {

  var resolve = require('rollup-plugin-node-resolve');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    processhtml: {
      dist: {
        files: {
          'build/qds.html': ['qds.html'],
          'build/ovs.html': ['ovs.html'],
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
          'dist/index.html': ['index.html' ],
          'dist/qds.html': ['build/qds.html' ],
          'dist/ovs.html': ['build/ovs.html' ],
        },
      },
    },
    exec: {
      compile: {
        //cmd: "emcc --bind -O2 ovsprocimpl.cc -s SINGLE_FILE=1 -s WASM=0 -o build/ovsprocimpl.js",
        cmd: "emcc --bind -O2 ovsprocimpl.cc -s SINGLE_FILE=1 -s WASM=1 -s BINARYEN_ASYNC_COMPILATION=0 -o build/ovsprocimpl.js",
      },
    },
    concat: {
      addexports: {
        options: {
          banner: 'export { Module };',
        },
        files: {
          'build/ovsprocimpl.js': ['build/ovsprocimpl.js'],
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
          'build/qdsproc.js': ['qdsproc.js'],
          'build/ovsproc.js': ['ovsproc.js'],
        },
      },
    },
    uglify: {
      dist: {
        files: {
          'dist/qdsproc.js': ['build/qdsproc.js'],
          'dist/common.js': [
            'common-polyfill.js',
            'deps_bundle.js',
            'common-audio.js',
            'graph.js',
          ],
          'dist/qds.js': ['qds.js'],
          'dist/ovsproc.js': ['build/ovsproc.js'],
          'dist/ovs.js': ['ovs.js'],
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

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-htmlmin');
  grunt.loadNpmTasks('grunt-contrib-uglify-es');
  grunt.loadNpmTasks('grunt-exec');
  grunt.loadNpmTasks('grunt-processhtml');
  grunt.loadNpmTasks('grunt-rollup');

  grunt.registerTask('default', [
    'processhtml',
    'htmlmin',
    'exec:compile',
    'concat',
    'rollup',
    'uglify',
    'copy',
  ]);
};
