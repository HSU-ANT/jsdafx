import { FunctionGraph, setupAudio, setupPlayerControls } from './common.js';

window.addEventListener('load', async () => {
  const audioProc = await setupAudio('drcproc.js', 'drc-processor');

  setupPlayerControls(audioProc, [
    { type: 'remote', label: 'Funk', url: 'audio/unfinite_function.mp3' },
    { type: 'remote', label: 'Orchestra', url: 'audio/DittersdorfOvid2.ogx' },
  ]);

  const noiseGateKnee = { in: -80, out: -45 };
  const limiterKnee = { in: -10, out: -10 };

  audioProc.proc.bypass = false;
  audioProc.proc.newyorkstyle = false;
  audioProc.proc.parameters.get('limiterThreshold').value = limiterKnee.in;
  audioProc.proc.parameters.get('limiterLevel').value = limiterKnee.out;
  audioProc.proc.parameters.get('noiseThreshold').value = noiseGateKnee.in;
  audioProc.proc.parameters.get('compressionRatio').value =
    (limiterKnee.in - noiseGateKnee.in) / (limiterKnee.out - noiseGateKnee.out);

  const graph = new FunctionGraph(document.getElementById('funccanvas'));
  graph.logx = false;
  graph.xlim = [-90, 0];
  graph.xlabel = 'input level in dB';
  graph.ylim = [-90, 0];
  graph.ylabel = 'output level in dB';

  const drawTransferFunction = () => {
    graph.drawData(
      [noiseGateKnee.in, noiseGateKnee.in, limiterKnee.in, 0],
      [-120, noiseGateKnee.out, limiterKnee.out, limiterKnee.out],
    );
    graph.drawMarkers([
      [noiseGateKnee.in, noiseGateKnee.out],
      [limiterKnee.in, limiterKnee.out],
    ]);
  };

  graph.addEventListener('markermove', (event) => {
    if (event.marker === 0) {
      noiseGateKnee.in = Math.max(Math.min(event.valX, limiterKnee.in), -90);
      noiseGateKnee.out = Math.max(Math.min(event.valY, limiterKnee.out - 0.1), -90);
      audioProc.proc.parameters.get('noiseThreshold').value = noiseGateKnee.in;
      audioProc.proc.parameters.get('compressionRatio').value =
        (limiterKnee.in - noiseGateKnee.in) / (limiterKnee.out - noiseGateKnee.out);
    } else if (event.marker === 1) {
      limiterKnee.in = Math.max(Math.min(event.valX, 0), noiseGateKnee.in);
      limiterKnee.out = Math.max(Math.min(event.valY, 0), noiseGateKnee.out + 0.1);
      audioProc.proc.parameters.get('limiterThreshold').value = limiterKnee.in;
      audioProc.proc.parameters.get('limiterLevel').value = limiterKnee.out;
      audioProc.proc.parameters.get('compressionRatio').value =
        (limiterKnee.in - noiseGateKnee.in) / (limiterKnee.out - noiseGateKnee.out);
    }
    drawTransferFunction();
  });
  drawTransferFunction();

  const inputEnvGraph = new FunctionGraph(document.getElementById('inputenvcanvas'));
  inputEnvGraph.logx = false;
  inputEnvGraph.xlim = [(-256 * 2000) / audioProc.sampleRate, 0];
  inputEnvGraph.xlabel = 'time in s';
  inputEnvGraph.ylim = [-1, 1];
  inputEnvGraph.envelopeMode = true;
  const outputEnvGraph = new FunctionGraph(document.getElementById('outputenvcanvas'));
  outputEnvGraph.logx = false;
  outputEnvGraph.xlim = [(-256 * 2000) / audioProc.sampleRate, 0];
  outputEnvGraph.xlabel = 'time in s';
  outputEnvGraph.ylim = [-1, 1];
  outputEnvGraph.envelopeMode = true;
  audioProc.proc.envelopeSubsampling = 2000;
  const envTime = new Float32Array(256);
  for (let n = 0; n < envTime.length; n++) {
    envTime[n] = ((n - 256 + 1) * 2000) / audioProc.sampleRate;
  }

  const drawEnvelopes = (inputEnvelope, outputEnvelope) => {
    inputEnvGraph.drawData(envTime, inputEnvelope);
    outputEnvGraph.drawData(envTime, outputEnvelope);
  };
  audioProc.proc.port.onmessage = (event) => {
    drawEnvelopes(event.data.inputEnvelope, event.data.outputEnvelope);
  };

  document.getElementById('newyork').onchange = function (event) {
    audioProc.proc.newYorkStyle = event.target.checked;
    document.getElementById('diagram').src = event.target.checked
      ? 'images/drc/diag1.png'
      : 'images/drc/diag2.png';
  };
  document.getElementById('bypass').onchange = function (event) {
    audioProc.proc.bypass = event.target.checked;
  };
});
