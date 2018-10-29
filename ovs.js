import { SignalGraph, setupAudio, setupPlayerControls } from './common.js';

window.addEventListener('load', async () => {
  const audioProc = await setupAudio('ovsproc.js', 'ovs-processor');
  audioProc.proc.w = 16;
  audioProc.proc.dithertype = 'rect';
  audioProc.proc.noiseshapingfilter = 1;
  audioProc.proc.oversamplingfactor = 4;
  setupPlayerControls(audioProc, [
    { type: 'sine' },
    {type: 'remote', label: 'Music', url: 'audio/unfinite_function.mp3'},
  ]);

  const graph = new SignalGraph(audioProc, document.getElementById('funccanvas'));
  const cblinear = document.getElementById('linear');
  cblinear.checked = false;
  cblinear.onchange = function (event) {
    graph.freqLinear = event.target.checked;
  };
  const setDrawWave = (b) => {
    graph.drawWave = b;
    cblinear.style.visibility = cblinear.labels[0].style.visibility =
      b ? 'hidden' : 'visible';
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
        document.getElementById('diagram').src = 'images/ovs/ns5.png';
      } else {
        document.getElementById('diagram').src = 'images/ovs/ns5b.png';
      }
    } else {
      if (document.getElementById('noiseshaping').checked) {
        document.getElementById('diagram').src = 'images/ovs/ns5c.png';
      } else {
        document.getElementById('diagram').src = 'images/ovs/ns5d.png';
      }
    }
  }
  function setDither(/* event */) {
    if (document.getElementById('dither').checked) {
      audioProc.proc.dithertype = document.getElementById('dithertype').value;
    } else {
      audioProc.proc.dithertype = 'none';
    }
    updateDiagram();
  }
  function setNoiseShaper(/* event */) {
    if (document.getElementById('noiseshaping').checked) {
      audioProc.proc.noiseshapingfilter =
        document.getElementById('noiseshapingfilter').value;
    } else {
      audioProc.proc.noiseshapingfilter = 0;
    }
    updateDiagram();
  }
  document.getElementById('dither').checked = true;
  document.getElementById('dither').onchange = setDither;
  document.getElementById('noiseshaping').checked = true;
  document.getElementById('noiseshaping').onchange = setNoiseShaper;
  document.getElementById('dithertype').value = 'rect';
  document.getElementById('dithertype').onchange = setDither;
  document.getElementById('noiseshapingfilter').value = 1;
  document.getElementById('noiseshapingfilter').onchange = setNoiseShaper;
  document.getElementById('oversamplingfactor').value = 4;
  document.getElementById('oversamplingfactor').onchange = (event) => {
    audioProc.proc.oversamplingfactor = event.target.value;
  };
});
