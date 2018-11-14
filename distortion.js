import { FunctionGraph, setupAudio, setupPlayerControls } from './common.js';

window.addEventListener('load', async () => {
  const audioProc = await setupAudio('distortionproc.js', 'distortion-processor');

  setupPlayerControls(audioProc, [
    { type: 'remote', label: 'Guitar riff 1', url: 'audio/Burns1.wav' },
    { type: 'remote', label: 'Guitar riff 2', url: 'audio/BluesHawk1.wav' },
  ]);

  let ingain = 50;
  let outgain = 1;
  audioProc.proc.parameters.get('inputGain').value = ingain;
  audioProc.proc.parameters.get('outputGain').value = outgain;

  const graph = new FunctionGraph(document.getElementById('funccanvas'));
  graph.logx = false;
  graph.xlim = [-1, 1];
  graph.ylim = [-1, 1];

  const invals = new Float32Array(500);
  const outvals = new Float32Array(500);

  const drawTransferFunction = () => {
    for (let i = 0; i < invals.length; i++) {
      const inval = -1 + 2 * i/(invals.length-1);
      invals[i] = inval;
      let outval = outgain * (2.0 / (1.0 + Math.exp(-inval * ingain)) - 1.0);
      if (outval > 1) {
        outval = 1;
      } else if (outval < -1) {
        outval = -1;
      }
      outvals[i] = outval;
    }
    graph.drawData(invals, outvals);
    graph.drawMarkers([[Math.log(3)/ingain, 0.5*outgain]]);
  };

  const smoothSetParameter = (param, value) => {
    param.cancelAndHoldAtTime(0);
    param.exponentialRampToValueAtTime(value, audioProc.currentTime + 0.050);
  };

  graph.addEventListener('markermove', (event) => {
    ingain = Math.log(3)/event.valX;
    if (ingain > 1000 || ingain < 0) {
      ingain = 1000;
    } else if (ingain < Math.log(3)) {
      ingain = Math.log(3);
    }
    outgain = event.valY * 2;
    if (outgain > 2) {
      outgain = 2;
    } else if (outgain < 0) {
      outgain = 0;
    }
    smoothSetParameter(audioProc.proc.parameters.get('inputGain'), ingain);
    smoothSetParameter(audioProc.proc.parameters.get('outputGain'), outgain);
    drawTransferFunction();
  });

  drawTransferFunction();
});
