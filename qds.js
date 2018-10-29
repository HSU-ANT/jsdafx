import { FunctionGraph, setupAudio, setupPlayerControls } from './common.js';

window.addEventListener('load', async () => {
  const graph = new FunctionGraph(document.getElementById('funccanvas'));
  graph.ylim = [-130, 0];

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

  const frequencies = new Float32Array(audioProc.getFrequencyDomainData());
  for (let i = 0; i < frequencies.length; i++) {
    frequencies[i] = i * 22050 / (frequencies.length-1);
  }
  const timeindices = new Float32Array(audioProc.getTimeDomainData());
  for (let i = 0; i < timeindices.length; i++) {
    timeindices[i] = i;
  }
  let drawWave = false;
  function drawSignal() {
    setTimeout(() => requestAnimationFrame(drawSignal), 40);
    if (drawWave) {
      const data = audioProc.getTimeDomainData();
      graph.drawData(timeindices, data);
    } else {
      const data = audioProc.getFrequencyDomainData();
      graph.drawData(frequencies, data);
    }
  }
  drawSignal();
  const cblinear = document.getElementById('linear');
  cblinear.checked = false;
  cblinear.onchange = function (event) {
    if (!drawWave) {
      graph.logx = !event.target.checked;
    }
  };
  function setDrawWave(b) {
    drawWave = b;
    if (b) {
      graph.logx = false;
      graph.ylim = [-1, 1];
      graph.xlim= [0, timeindices.length-1];
      graph.xlabel = 'time in samples';
      graph.ylabel = 'amplitude';
      cblinear.style.visibility = 'hidden';
      cblinear.labels[0].style.visibility = 'hidden';
    } else {
      graph.xlim = [50, 20000];
      graph.logx = !cblinear.checked;
      graph.ylim = [-130, 0];
      graph.xlabel = 'frequency in Hz';
      graph.ylabel = 'magnitude in dB';
      cblinear.style.visibility = 'visible';
      cblinear.labels[0].style.visibility = 'visible';
    }
  }
  document.getElementById('spectrum').onchange = (event) => {
    setDrawWave(!event.target.checked);
  };
  document.getElementById('waveform').onchange = (event) => {
    setDrawWave(event.target.checked);
  };
  setDrawWave(false);
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
