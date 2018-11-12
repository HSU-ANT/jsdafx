const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const util = require('util');
const HTMLProcessor = require('htmlprocessor');
const minify = require('html-minifier').minify;
const _rollup = require('rollup');
const resolve = require('rollup-plugin-node-resolve');
const UglifyJS = require('uglify-es');
const CleanCSS = require('clean-css');
const mime = require('mime');
const eslint = require('eslint');

const copyFile = util.promisify(fs.copyFile);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

function fileDataTask(dest, src, extradeps, func) {
  let deps = [src, path.dirname(dest)];
  if (extradeps) {
    deps = deps.concat(extradeps);
  }
  file(dest, deps, async () => {
    const orig = await readFile(src, { encoding: 'utf8' });
    return writeFile(dest, await func(orig), { encoding: 'utf8' });
  });
}

function css_data_uri(dest, src, imgs) {
  fileDataTask(dest, src, imgs, (orig) => {
    jake.logger.log(`css_data_uri ${src} into ${dest}`);
    return orig.replace(/url\((['"])(.*)\1\)/g, (match, p1, p2) => {
      if (!imgs.includes(p2)) {
        return match;
      }
      const data = fs.readFileSync(p2);
      const mimetype = mime.getType(p2);
      return `url('data:${mimetype};base64,${data.toString('base64')}')`;
    });
  });
}

function cleancss(dest, src) {
  if (typeof src === 'string') {
    src = [src];
  }
  file(dest, src.concat(path.dirname(dest)), () => {
    jake.logger.log(`cleancss ${src} into ${dest}`);
    const result = new CleanCSS({}).minify(src);
    if (result.errors.length) {
      throw result.errors.toString();
    }

    if (result.warnings.length) {
      jake.logger.log(result.warnings.toString());
    }

    return writeFile(dest, result.styles, { encoding: 'utf8' });
  });
}

function htmlminify(dest, src) {
  fileDataTask(dest, src, [], (orig) => {
    jake.logger.log(`html-minify ${src} into ${dest}`);
    return minify(orig, {
      collapseWhitespace: true,
      conservativeCollapse: true,
      removeComments: true,
    });
  });
}

function htmlprocess(dest, src, extradeps) {
  fileDataTask(dest, src, extradeps, (orig) => {
    jake.logger.log(`html-process ${src} into ${dest}`);
    const proc = new HTMLProcessor({});
    return proc.processContent(orig, src);
  });
}

function emcc(dest, src) {
  const deps = [src, path.dirname(dest)];
  file(dest, deps, async () => {
    const cmd = `emcc --bind -O2 ${src} -s SINGLE_FILE=1 -s WASM=1 ` +
      `-s BINARYEN_ASYNC_COMPILATION=0 -o ${dest}`;
    jake.logger.log(cmd);
    await new Promise((resolve) => { jake.exec(cmd, resolve); });
    let compiled = await readFile(dest, { encoding: 'utf8' });
    compiled += 'export { Module };';
    return writeFile(dest, compiled, { encoding: 'utf8' });
  });
}

function rollup(dest, src, extradeps) {
  let deps = [src, path.dirname(dest)];
  if (extradeps) {
    deps = deps.concat(extradeps);
  }
  file(dest, deps, async () => {
    jake.logger.log(`rollup ${src} into ${dest}`);
    const bundle = await _rollup.rollup({
      input: src,
      plugins: [resolve()],
    });
    const result = await bundle.generate({
      output: { format: 'es' },
    });
    return writeFile(dest, result.code, { encoding: 'utf8' });
  });
}

function uglify(dest, src) {
  if (typeof src === 'string') {
    src = [src];
  }
  file(dest, src.concat(path.dirname(dest)), async () => {
    jake.logger.log(`uglify ${src} into ${dest}`);
    const orig = {};
    for (const f of src) {
      orig[f] = await readFile(f, { encoding: 'utf8' });
    }
    const result = UglifyJS.minify(orig, { toplevel: true, ie8: false });
    if (result.error) {
      throw result.error;
    }
    return writeFile(dest, result.code, { encoding: 'utf8' });
  });
}

directory('build');
directory('dist');

const imgs_to_embed = [
  'images/dropdown.png',
  'images/play.png',
  'images/play_disabled.png',
  'images/stop.png',
  'images/stop_disabled.png',
  'images/check.png',
];
css_data_uri('build/jsdafx.datauri.css', 'jsdafx.css', imgs_to_embed);

const copied_targets = [];
for (const dirname of ['audio', 'images']) {
  const excludes = dirname === 'images' ? imgs_to_embed : null;
  for (const filename of jake.readdirR(dirname)) {
    if (fs.statSync(filename).isFile() && (!excludes || !excludes.includes(filename))) {
      const destname = path.join('dist', filename);
      const pathname = path.dirname(destname);
      directory(pathname);
      copied_targets.push(destname);
      file(destname, [filename, pathname], () => {
        jake.logger.log(`cp ${filename} ${destname}`);
        return copyFile(filename, destname);
      });
    }
  }
}

const filesToCache = [
  'dist/index.html',
  'dist/common.js',
  'dist/qds.html',
  'dist/qds.js',
  'dist/qdsproc.js',
  'dist/ovs.html',
  'dist/ovs.js',
  'dist/ovsproc.js',
  'dist/eq.html',
  'dist/eq.js',
  'dist/eqproc.js',
  'dist/install-sw.js',
  ...copied_targets,
];

file('build/cacheconfig.js', filesToCache, async () => {
  jake.logger.log('generate build/cacheconfig.js');
  const hash = crypto.createHash('sha256');
  for (const f of filesToCache) {
    hash.update(await readFile(f));
  }
  const urlsToCache = filesToCache.map((f) => `'${f.replace(/^dist\//, '')}'`);
  return writeFile(
    'build/cacheconfig.js',
    `export const CACHE_NAME = 'jsdafx-${hash.digest('hex')}';\n` +
    `export const urlsToCache = [${urlsToCache}];`,
    { encoding: 'utf8' },
  );
});


cleancss('build/jsdafx.css', 'build/jsdafx.datauri.css');

htmlprocess('build/qds.html', 'qds.html',
  ['playback_control_buttons.html', 'build/jsdafx.css']);
htmlprocess('build/ovs.html', 'ovs.html',
  ['playback_control_buttons.html', 'build/jsdafx.css']);
htmlprocess('build/eq.html', 'eq.html',
  ['playback_control_buttons.html', 'build/jsdafx.css']);

htmlminify('dist/index.html', 'index.html');
htmlminify('dist/qds.html', 'build/qds.html');
htmlminify('dist/ovs.html', 'build/ovs.html');
htmlminify('dist/eq.html', 'build/eq.html');

emcc('build/ovsprocimpl.js', 'ovsprocimpl.cc');

rollup('build/deps.js', 'deps.js');
rollup('build/sw.js', 'sw.js', ['build/cacheconfig.js']);
rollup('build/common.js', 'common.js',
  ['graph.js', 'common-audio.js', 'common-polyfill.js']);
rollup('build/qdsproc.js', 'qdsproc.js', ['baseproc.js']);
rollup('build/ovsproc.js', 'ovsproc.js', ['baseproc.js', 'build/ovsprocimpl.js']);
rollup('build/eqproc.js', 'eqproc.js', ['baseproc.js']);

uglify('dist/qdsproc.js', 'build/qdsproc.js');
uglify('dist/common.js', ['build/common.js', 'build/deps.js']);
uglify('dist/qds.js', 'qds.js');
uglify('dist/ovsproc.js', 'build/ovsproc.js');
uglify('dist/ovs.js', 'ovs.js');
uglify('dist/eqproc.js', 'build/eqproc.js');
uglify('dist/eq.js', 'eq.js');
uglify('dist/sw.js', 'build/sw.js');
uglify('dist/install-sw.js', 'install-sw.js');

task('all', [
  'dist/sw.js',
], () => { jake.logger.log('build complete'); });

task('test', ['all'], () => {
  const engine = new eslint.CLIEngine({
    outputFile: false,
    quiet: false,
    maxWarnings: -1,
    failOnError: true,
  });
  const report = engine.executeOnFiles(['*.js']);
  const formatter = eslint.CLIEngine.getFormatter();
  jake.logger.log(formatter(report.results));
  if (report.errorCount > 0) {
    throw Error('ESLint found errors');
  }
});

task('clean', () => {
  jake.rmRf('build');
  jake.rmRf('dist');
});

task('default', ['all']);

watchTask('watch', ['all'], function () {
  this.throttle = 500;
  this.watchFiles.include(['*.html', '*.cc']);
});
