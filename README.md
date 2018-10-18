# Digital Audio Effects in JavaScript

A collection of JavaScript/HTML5-based apps to demonstrate various audio effects. Try them
at https://hsu-ant.github.io/jsdafx/.

## Building

For development and building yourself, you need [node.js](https://nodejs.org/en/download/)
and Python 2.7.12 or newer. After cloning/downloading jsdafx, change to its directory and
run:
```
npm install
```
to acquire all further dependencies. Then build with:
```
npm run build
```
The built site is stored in the `dist` subdirectory. Note that to try it, you will likely
need to serve it through a local webserver, as most browsers will apply access restrictions
that prevent the scripts from running properly when accessed through the local file system.
