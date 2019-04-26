const apps = [
  {
    title: 'Quantization, Dithering, and Noise Shaping',
    contentfile: 'qds.html',
    scriptfile: 'qds.js',
    processorfile: 'qdsproc.js',
  },
  {
    title: 'Oversampling',
    contentfile: 'ovs.html',
    scriptfile: 'ovs.js',
    processorfile: 'ovsproc.js',
    procimplfile: 'ovsprocimpl.cc',
  },
  {
    title: 'Audio Filters',
    contentfile: 'eq.html',
    scriptfile: 'eq.js',
    processorfile: 'eqproc.js',
  },
  {
    title: 'Distortion',
    contentfile: 'distortion.html',
    scriptfile: 'distortion.js',
    processorfile: 'distortionproc.js',
  },
  {
    title: 'Audio Coding Psychoacoustics - Masking effect',
    contentfile: 'masking.html',
    scriptfile: 'masking.js',
  },
];

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const util = require('util');
const minify = require('html-minifier').minify;
const _rollup = require('rollup');
const resolve = require('rollup-plugin-node-resolve');
const Terser = require('terser');
const CleanCSS = require('clean-css');
const mime = require('mime');
const Handlebars = require('handlebars');
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
    return writeFile(dest, result.output[0].code, { encoding: 'utf8' });
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
    const result = Terser.minify(orig, { toplevel: true, ie8: false });
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
css_data_uri('build/jsdafx.datauri.css', 'src/jsdafx.css', imgs_to_embed);

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
  'dist/noisesourceproc.js',
  'dist/common.js',
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

let apptemplate = null;
let csscontents = null;

function buildapp(app) {
  const htmlcontentfile = path.join('src', app.contentfile);
  const outfile = path.join('build', app.contentfile);
  file(outfile, [htmlcontentfile, 'src/apptemplate.html', 'build/jsdafx.css'], async () => {
    jake.logger.log(`expand ${htmlcontentfile} into ${outfile}`);
    if (!apptemplate) {
      apptemplate = Handlebars.compile(
        await readFile('src/apptemplate.html', { encoding: 'utf8' }),
        { strict: true }
      );
    }
    if (!csscontents) {
      csscontents = await readFile('build/jsdafx.css');
    }
    await writeFile(outfile, apptemplate({
      styletag: `<style>${csscontents}</style>`,
      appscripttag: `<script type="module" src="${app.scriptfile}"></script>`,
      title: app.title,
      content: await readFile(htmlcontentfile),
    }));
  });
  htmlminify(path.join('dist', app.contentfile), outfile);
  uglify(path.join('dist', app.scriptfile), path.join('src', app.scriptfile));
  if (app.processorfile) {
    const rollup_deps = ['src/baseproc.js'];
    if (app.procimplfile) {
      const impljsfile = path.format({
        dir: 'build',
        name: path.basename(app.procimplfile, 'cc'),
        ext: 'js',
      });
      emcc(impljsfile, path.join('src', app.procimplfile));
      rollup_deps.push(impljsfile);
    }
    rollup(path.join('build', app.processorfile), path.join('src', app.processorfile),
      rollup_deps);
    uglify(path.join('dist', app.processorfile), path.join('build', app.processorfile));
    filesToCache.push(path.join('dist', app.processorfile));
  }
  filesToCache.push(...[app.contentfile, app.scriptfile].map(
    (f) => path.join('dist', f)
  ));
}

for (const app of apps) {
  buildapp(app);
}

file('build/index.html', ['src/index.html'], async () => {
  const template = Handlebars.compile(
    await readFile('src/index.html', { encoding: 'utf8' }),
    { strict: true }
  );
  await writeFile('build/index.html', template({apps: apps}));
});

htmlminify('dist/index.html', 'build/index.html');

rollup('build/deps.js', 'src/deps.js');
rollup('build/sw.js', 'src/sw.js', ['build/cacheconfig.js']);
rollup('build/noisesourceproc.js', 'src/noisesourceproc.js');
rollup('build/common.js', 'src/common.js',
  ['src/graph.js', 'src/common-audio.js', 'src/common-polyfill.js']);

uglify('dist/noisesourceproc.js', 'build/noisesourceproc.js');
uglify('dist/common.js', ['build/common.js', 'build/deps.js']);
uglify('dist/sw.js', 'build/sw.js');
uglify('dist/install-sw.js', 'src/install-sw.js');

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
  const report = engine.executeOnFiles(['*.js', 'src/*.js']);
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
  this.watchFiles.include(['src/*']);
});
