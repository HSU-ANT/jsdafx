import { SignalGraph, setupAudio, setupPlayerControls } from './common.js';

window.addEventListener('load', async () => {
  const audioProc = await setupAudio('qdsproc.js', 'qds-processor');
  audioProc.proc.w = 16;
  audioProc.proc.dither = true;
  audioProc.proc.dithertype = 'rect';
  audioProc.proc.noiseshaping = true;
  audioProc.proc.noiseshapingfilter = 1;

  setupPlayerControls(audioProc, [
    { type: 'sine' },
    { type: 'remote', label: 'Music', url: 'audio/unfinite_function.mp3' },
  ]);

  const graph = new SignalGraph(audioProc, document.getElementById('funccanvas'));
  const cblinear = document.getElementById('linear');
  cblinear.checked = false;
  cblinear.onchange = function (event) {
    graph.freqLinear = event.target.checked;
  };
  const setDrawWave = (b) => {
    graph.drawWave = b;
    cblinear.style.visibility = cblinear.labels[0].style.visibility = b
      ? 'hidden'
      : 'visible';
  };
  document.getElementById('spectrum').onchange = (event) => {
    setDrawWave(!event.target.checked);
  };
  document.getElementById('waveform').onchange = (event) => {
    setDrawWave(event.target.checked);
  };

  document.getElementById('wordlength').value = 16;
  document.getElementById('wordlength').onchange = function (event) {
    audioProc.proc.w = event.target.value;
  };
  function updateDiagram() {
    if (document.getElementById('dither').checked) {
      if (document.getElementById('noiseshaping').checked) {
        document.getElementById('diagram').src = 'images/qds/ns5.png';
      } else {
        document.getElementById('diagram').src = 'images/qds/ns5b.png';
      }
    } else {
      if (document.getElementById('noiseshaping').checked) {
        document.getElementById('diagram').src = 'images/qds/ns5c.png';
      } else {
        document.getElementById('diagram').src = 'images/qds/ns5d.png';
      }
    }
  }
  document.getElementById('dither').checked = true;
  document.getElementById('dither').onchange = function (event) {
    audioProc.proc.dither = event.target.checked;
    updateDiagram();
  };
  document.getElementById('noiseshaping').checked = true;
  document.getElementById('noiseshaping').onchange = function (event) {
    audioProc.proc.noiseshaping = event.target.checked;
    updateDiagram();
  };
  document.getElementById('dithertype').value = 'rect';
  document.getElementById('dithertype').onchange = function (event) {
    audioProc.proc.dithertype = event.target.value;
  };
  document.getElementById('noiseshapingfilter').value = 1;
  document.getElementById('noiseshapingfilter').onchange = function (event) {
    audioProc.proc.noiseshapingfilter = event.target.value;
  };
});
