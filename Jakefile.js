const apps = [
  {
    title: 'Quantization, Dithering, and Noise Shaping',
    image: 'qds/ns5.png',
    contentfile: 'qds.html',
    scriptfile: 'qds.js',
    processorfile: 'qdsproc.js',
  },
  {
    title: 'Oversampling',
    image: 'ovs/ns5.png',
    contentfile: 'ovs.html',
    scriptfile: 'ovs.js',
    processorfile: 'ovsproc.js',
    procimplfile: 'ovsprocimpl.cc',
  },
  {
    title: 'Audio Filters',
    image: 'eq.png',
    contentfile: 'eq.html',
    scriptfile: 'eq.js',
    processorfile: 'eqproc.js',
  },
  {
    title: 'Distortion',
    image: 'distortion.png',
    contentfile: 'distortion.html',
    scriptfile: 'distortion.js',
    processorfile: 'distortionproc.js',
  },
  {
    title: 'Audio Coding Psychoacoustics - Masking effect',
    image: 'masking.png',
    contentfile: 'masking.html',
    scriptfile: 'masking.js',
  },
  {
    title: 'Delay-Based Audio Effects',
    image: 'delays/flanger1.png',
    contentfile: 'delays.html',
    scriptfile: 'delays.js',
  },
  {
    title: 'Fast Convolution',
    image: 'fastconv.png',
    contentfile: 'fastconv.html',
    scriptfile: 'fastconv.js',
  },
  {
    title: 'Dynamic Range Control',
    image: 'drc/diag2.png',
    contentfile: 'drc.html',
    scriptfile: 'drc.js',
    processorfile: 'drcproc.js',
  },
];

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const util = require('util');
const { minify } = require('html-minifier');
const _rollup = require('rollup');
const resolve = require('@rollup/plugin-node-resolve').nodeResolve;
const Terser = require('terser');
const CleanCSS = require('clean-css');
const Handlebars = require('handlebars');
const eslint = require('eslint');
const handler = require('serve-handler');
const puppeteer = require('puppeteer');

const copyFile = util.promisify(fs.copyFile);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const stat = util.promisify(fs.stat);

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
  fileDataTask(dest, src, imgs, async (orig) => {
    jake.logger.log(`css_data_uri ${src} into ${dest}`);
    const mime = (await import('mime')).default;
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
    const cmd =
      `emcc --bind -O3 ${src} -s SINGLE_FILE=1 -s WASM=1 ` +
      '-s ENVIRONMENT=web,worker -s WASM_ASYNC_COMPILATION=0 ' +
      '-s INCOMING_MODULE_JS_API=[] ' +
      `-o ${dest}`;
    jake.logger.log(cmd);
    await new Promise((resolve) => {
      jake.exec(cmd, resolve);
    });
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
    const result = await bundle.generate({ format: 'es' });
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
    const result = await Terser.minify(orig, { toplevel: true, ecma: 2016 });
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

const files_to_copy = new jake.FileList();
files_to_copy.include(['audio/**', 'images/**']);
files_to_copy.exclude(imgs_to_embed);
const copied_targets = [];
for (const filename of files_to_copy.toArray()) {
  if (fs.statSync(filename).isFile()) {
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

cleancss('build/jsdafx.css', 'build/jsdafx.datauri.css');

let apptemplatePromise = null;
let csscontentsPromise = null;
const app_targets = ['dist/noisesourceproc.js', 'dist/common.js', ...copied_targets];
const appimages = [];

function buildapp(app) {
  const htmlcontentfile = path.join('src', app.contentfile);
  const outfile = path.join('build', app.contentfile);
  file(outfile, [htmlcontentfile, 'src/apptemplate.html', 'build/jsdafx.css'], async () => {
    jake.logger.log(`expand ${htmlcontentfile} into ${outfile}`);
    if (!apptemplatePromise) {
      apptemplatePromise = (async () =>
        Handlebars.compile(await readFile('src/apptemplate.html', { encoding: 'utf8' }), {
          strict: true,
        }))();
    }
    if (!csscontentsPromise) {
      csscontentsPromise = readFile('build/jsdafx.css');
    }
    await writeFile(
      outfile,
      (await apptemplatePromise)({
        styletag: `<style>${await csscontentsPromise}</style>`,
        appscripttag: `<script type="module" src="${app.scriptfile}"></script>`,
        title: app.title,
        content: await readFile(htmlcontentfile),
      }),
    );
  });
  htmlminify(path.join('dist', app.contentfile), outfile);
  uglify(path.join('dist', app.scriptfile), path.join('src', app.scriptfile));
  if (app.processorfile) {
    const rollup_deps = ['src/baseproc.js'];
    if (app.procimplfile) {
      const impljsfile = path.format({
        dir: 'build',
        name: path.basename(app.procimplfile, '.cc'),
        ext: '.js',
      });
      emcc(impljsfile, path.join('src', app.procimplfile));
      rollup_deps.push(impljsfile);
    }
    rollup(
      path.join('build', app.processorfile),
      path.join('src', app.processorfile),
      rollup_deps,
    );
    uglify(path.join('dist', app.processorfile), path.join('build', app.processorfile));
    app_targets.push(path.join('dist', app.processorfile));
  }
  app_targets.push(...[app.contentfile, app.scriptfile].map((f) => path.join('dist', f)));
  const imgpath = path.join('dist', 'images', app.image);
  if (!copied_targets.includes(imgpath)) {
    appimages.push(imgpath);
  }
}

for (const app of apps) {
  buildapp(app);
}

task('apps', app_targets);

const takescreenhots = async () => {
  const serveconf = require('./serve.json');

  const server = http.createServer((request, response) => {
    return handler(request, response, serveconf);
  });

  await new Promise((resolve /* , reject */) => {
    server.listen(resolve);
  });
  try {
    const browser = await puppeteer.launch();
    try {
      const page = await browser.newPage();
      page.on('console', (msg) => {
        jake.logger.log(`PAGE LOG: ${msg.text()}`);
      });
      page.on('pageerror', (error) => jake.logger.log('PAGE ERROR:', error.message));
      // install a constant-seeded RNG for reproducibility
      // (see https://stackoverflow.com/questions/521295 for the RNG code)
      await page.evaluateOnNewDocument(
        '\
        Math.random = (() => { \
          let m_w = 123456789; \
          let m_z = 987654321; \
          return () => { \
            m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & 0xffffffff; \
            m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & 0xffffffff; \
            return (((m_z << 16) + (m_w & 65535)) >>> 0) / 4294967296; \
          } \
        })(); \
      ',
      );

      const takescreenshot = async (name, prepare) => {
        jake.logger.log(`taking ${name} screenshot`);
        await page.goto(`http://localhost:${server.address().port}/${name}.html`);
        const elem = await prepare();
        const filename = path.join('dist', 'images', `${name}.png`);
        /* For some reason, the screenshots sometimes come out blank. In that
           case, they will be smaller than 1000 bytes. Just retry until we have
           a larger one (up to ten times) */
        let success = false;
        for (let n = 0; n < 10; n++) {
          await elem.screenshot({ path: filename });
          const sz = (await stat(filename)).size;
          if (sz > 1000) {
            success = true;
            break;
          }
          jake.logger.error(`Warning: ${filename} too small (${sz} bytes), retrying`);
          await new Promise((resolve) => {
            setTimeout(resolve, 100);
          });
          await elem.screenshot({ path: filename });
        }
        if (!success) {
          throw new Error('Failed to generate screenshot of plausible size');
        }
      };

      await takescreenshot('fastconv', async () => {
        const elem = await page.$('#funccanvas');
        await elem.evaluate((node) => {
          node.width = 400;
          node.height = 250;
        });
        await new Promise((resolve) => {
          setTimeout(resolve, 250);
        });
        return elem;
      });

      await takescreenshot('eq', async () => {
        const elem = await page.$('#funccanvas');
        await elem.evaluate((node) => {
          node.width = 400;
          node.height = 250;
        });
        await new Promise((resolve) => {
          setTimeout(resolve, 250);
        });
        return elem;
      });

      await takescreenshot('masking', async () => {
        const elem = await page.$('#funccanvas');
        await elem.evaluate((node) => {
          node.width = 400;
        });
        await page.waitForSelector('#masker:checked');
        await (await page.$('#maskeefrequency')).press('PageUp');
        await (await page.$('#maskeefrequency')).press('PageUp');
        await (await page.$('#maskeefrequency')).press('PageUp');
        await page.waitForSelector('#stop[disabled]');
        await (await page.$('#play')).click();
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        await (await page.$('#stop')).click();
        await elem.evaluate((node) => {
          node.width = 400;
        });
        return elem;
      });

      await takescreenshot('distortion', async () => {
        const elem = await page.$('#funccanvas');
        await elem.evaluate((node) => {
          node.width = 400;
          node.height = 250;
        });
        await new Promise((resolve) => {
          setTimeout(resolve, 250);
        });
        return elem;
      });
    } finally {
      await browser.close();
    }
  } finally {
    server.close();
  }
};

appimages.forEach((img) => {
  file(img, app_targets, takescreenhots);
});

const filesToCache = [
  'dist/index.html',
  'dist/install-sw.js',
  ...app_targets,
  ...appimages,
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

file('build/index.html', ['src/index.html', 'Jakefile.js'], async () => {
  const template = Handlebars.compile(
    await readFile('src/index.html', { encoding: 'utf8' }),
    { strict: true },
  );
  await writeFile('build/index.html', template({ apps: apps }));
});

htmlminify('dist/index.html', 'build/index.html');

rollup('build/deps.js', 'src/deps.js');
rollup('build/sw.js', 'src/sw.js', ['build/cacheconfig.js']);
rollup('build/noisesourceproc.js', 'src/noisesourceproc.js');
rollup('build/common.js', 'src/common.js', [
  'src/graph.js',
  'src/common-audio.js',
  'src/common-polyfill.js',
]);

uglify('dist/noisesourceproc.js', 'build/noisesourceproc.js');
uglify('dist/common.js', ['build/common.js', 'build/deps.js']);
uglify('dist/sw.js', 'build/sw.js');
uglify('dist/install-sw.js', 'src/install-sw.js');

task('all', ['dist/sw.js'], () => {
  jake.logger.log('build complete');
});

task('test', ['all'], async () => {
  const engine = new (await eslint.loadESLint())();
  const report = await engine.lintFiles(['*.js', '*.mjs', 'src/*.js']);
  const formatter = await engine.loadFormatter();
  jake.logger.log(formatter.format(report));
  if (report.some((r) => r.errorCount > 0)) {
    throw Error('ESLint found errors');
  }
});

task('clean', () => {
  jake.rmRf('build');
  jake.rmRf('dist');
});

task('default', ['all']);
