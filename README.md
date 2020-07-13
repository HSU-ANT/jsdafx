# Digital Audio Effects in JavaScript

A collection of JavaScript/HTML5-based apps to demonstrate various audio effects. Try them
at https://hsu-ant.github.io/jsdafx/.

## Building

For development and building yourself, you need [node.js](https://nodejs.org/en/download/)
and [emscripten](https://emscripten.org/docs/getting_started/downloads.html).
After cloning/downloading jsdafx, change to its directory and run:
```
npm install
```
to acquire all further dependencies. You can then start a local web server serving jsdafx
with
```
npm start
```
After everything is (re-)built (this can take a moment the first time), point your browser
at http://localhost:5000.

To only build, but not start a web server, invoke `npm run build`. The built site is stored
in the `dist` subdirectory. Alternatively, run `npm run watch` to start a task that will
watch the source files and automatically rebuild as needed.
