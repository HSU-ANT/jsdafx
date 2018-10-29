module.exports = function(grunt) {

  var resolve = require('rollup-plugin-node-resolve');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    css_img_2_data_uri: {
      options: {
        files: [
          { dest: 'build/jsdafx.datauri.css', src: 'jsdafx.css' },
        ]
      },
    },
    cssmin: {
      dist: {
        files: {
          'build/jsdafx.css': ['build/jsdafx.datauri.css'],
        }
      }
    },
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
          'build/deps.js': ['deps.js'],
          'build/common.js': ['common.js'],
          'build/qdsproc.js': ['qdsproc.js'],
          'build/ovsproc.js': ['ovsproc.js'],
        },
      },
    },
    uglify: {
      dist: {
        options: {
          toplevel: true,
        },
        files: {
          'dist/qdsproc.js': ['build/qdsproc.js'],
          'dist/common.js': [
            'build/common.js',
            'build/deps.js',
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
          { expand: true, src: ['audio/*'], dest: 'dist/' },
          {
            expand: true,
            cwd: 'images',
            src: ['**', '!play*.png', '!stop*.png', '!check.png', '!dropdown.png'],
            dest: 'dist/images',
          },
        ],
      },
    },
    eslint: {
      check: { files: {src: ['*.js']}},
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-htmlmin');
  grunt.loadNpmTasks('grunt-contrib-uglify-es');
  grunt.loadNpmTasks('grunt-css-img-2-data-uri');
  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadNpmTasks('grunt-exec');
  grunt.loadNpmTasks('grunt-processhtml');
  grunt.loadNpmTasks('grunt-rollup');

  grunt.registerTask('default', [
    'css_img_2_data_uri',
    'cssmin',
    'processhtml',
    'htmlmin',
    'exec:compile',
    'concat',
    'rollup',
    'uglify',
    'copy',
  ]);
  grunt.registerTask('test', [
    'eslint',
  ]);
};
