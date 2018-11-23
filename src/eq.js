import { FunctionGraph, setupAudio, setupPlayerControls } from './common.js';

window.addEventListener('load', async () => {
  const audioProc = await setupAudio('eqproc.js', 'eq-processor');

  setupPlayerControls(audioProc, [
    { type: 'remote', label: 'Funk', url: 'audio/unfinite_function.mp3' },
    { type: 'remote', label: 'Orchestra', url: 'audio/captain-pretzel_ghost-gulping.wav' },
  ]);

  let omegaC = 1;
  let gain = 1;
  let Q = 1;
  audioProc.proc.type = 'lowpass';
  audioProc.proc.bypass = false;
  audioProc.proc.parameters.get('omegaC').value = omegaC;
  audioProc.proc.parameters.get('gain').value = gain;
  audioProc.proc.parameters.get('Q').value = Q;

  const graph = new FunctionGraph(document.getElementById('funccanvas'));
  graph.xlim = [20, 20000];
  graph.ylim = [-20, 20];

  const cutoffMarkers = () => [[omegaC/2/Math.PI*audioProc.sampleRate, -3]];
  const shelvingMarkers = () => [[
    omegaC/2/Math.PI*audioProc.sampleRate,
    10*Math.log10(gain >= 1 ? (1 + gain*gain) / 2 : 2 / (1 + 1/(gain*gain))),
  ]];

  const passGain = () => 1;
  const shelvingGain = (m) => {
    if (m >= 0) {
      return Math.sqrt(2*Math.pow(10, m/10)-1);
    }
    return 1/Math.sqrt(2/Math.pow(10, m/10)-1);
  };

  const filterCharacteristics = {
    lowpass: {
      magnitudeSquared(cw, k2) {
        const num = k2*(1 + cw);
        return num*num/(num*num+(1-cw)*(1-cw));
      },
      get markers() { return cutoffMarkers(); },
      gainFromMarker: passGain,
    },
    highpass: {
      magnitudeSquared(cw, k2) {
        const num = 1 - cw;
        return num*num/(num*num+k2*(1 + cw)*k2*(1 + cw));
      },
      get markers() { return cutoffMarkers(); },
      gainFromMarker: passGain,
    },
    lowshelving: {
      magnitudeSquared(cw, k2) {
        const a = (1-cw)*(1-cw);
        const b = k2*k2*(1+cw)*(1+cw);
        return gain >= 1 ? (a + gain*gain*b) / (a + b) : (a + b) / (a + b/(gain*gain));
      },
      get markers() { return shelvingMarkers(); },
      gainFromMarker: shelvingGain,
    },
    highshelving: {
      magnitudeSquared(cw, k2) {
        const a = (1-cw)*(1-cw);
        const b = k2*k2*(1+cw)*(1+cw);
        return gain >= 1 ? (gain*gain*a + b) / (a + b) : (a + b) / (a/(gain*gain) + b);
      },
      get markers() { return shelvingMarkers(); },
      gainFromMarker: shelvingGain,
    },
    peak: {
      magnitudeSquared(cw, k2) {
        const sw2 = 1 - cw*cw;
        const a = (1-cw)*(1-cw) + k2*k2*(1+cw)*(1+cw);
        const b = k2*sw2;
        const Q2 = Q*Q;
        return gain >= 1 ?
          (a + (gain*gain/Q2-2) * b) / (a + (1/Q2-2) * b) :
          (a + (1/Q2-2) * b) / (a + (1/(gain*gain*Q2)-2) * b);
      },
      get markers() {
        const mg = 10*Math.log10(gain >= 1 ? (1 + gain*gain) / 2 : 2 / (1 + 1/(gain*gain)));
        const k = Math.tan(omegaC/2);
        const a = 1/(2*Q) + Math.sqrt(1+1/(4*Q*Q));
        const fu = Math.atan(k*a) * audioProc.sampleRate/Math.PI;
        const fl = Math.atan(k/a) * audioProc.sampleRate/Math.PI;
        const markers = [[omegaC/2/Math.PI*audioProc.sampleRate, 20*Math.log10(gain)]];
        if (fl >= 20) {
          markers.push([fl, mg]);
        }
        if (fu <= 20000) {
          markers.push([fu, mg]);
        }
        return markers;
      },
      gainFromMarker: (m) => Math.pow(10, m/20),
    },
  };

  let currentCharateristic = filterCharacteristics.lowpass;

  const drawTransferFunction = () => {
    const k = Math.tan(omegaC/2);
    const k2 = k*k;
    const frequencies = new Float32Array(500);
    const mag = new Float32Array(500);
    for (let i = 0; i < frequencies.length; i++) {
      const f = 20*Math.pow(10, i/(frequencies.length-1)*3);
      frequencies[i] = f;
      const omega = 2*Math.PI*f/audioProc.sampleRate;
      mag[i] = 10*Math.log10(currentCharateristic.magnitudeSquared(Math.cos(omega), k2));
    }
    graph.drawData(frequencies, mag);
    graph.drawMarkers(currentCharateristic.markers);
  };

  const smoothSetParameter = (param, value) => {
    param.cancelAndHoldAtTime(0);
    param.exponentialRampToValueAtTime(value, audioProc.currentTime + 0.050);
  };

  graph.addEventListener('markermove', (event) => {
    const f = event.valX < 20 ? 20 : event.valX;
    if (event.marker === 0) {
      omegaC = 2*Math.PI*f/audioProc.sampleRate;
      smoothSetParameter(audioProc.proc.parameters.get('omegaC'), omegaC);
      gain = currentCharateristic.gainFromMarker(event.valY);
      if (gain > 10) {
        gain = 10;
      } else if (gain < 0.1) {
        gain = 0.1;
      }
      smoothSetParameter(audioProc.proc.parameters.get('gain'), gain);
    } else if (event.marker === 1 | event.marker === 2) {
      const k = Math.tan(omegaC/2);
      const alpha = Math.tan(Math.PI*f/audioProc.sampleRate)/k;
      Q = Math.abs(1/(alpha - 1/alpha));
      smoothSetParameter(audioProc.proc.parameters.get('Q'), Q);
    }
    drawTransferFunction();
  });

  drawTransferFunction();

  const cblinear = document.getElementById('linear');
  cblinear.checked = false;
  cblinear.onchange = function (event) {
    graph.logx = !event.target.checked;
    drawTransferFunction();
  };

  document.getElementById('bypass').onchange = function (event) {
    audioProc.proc.bypass = event.target.checked;
  };
  document.getElementById('type').onchange = function (event) {
    audioProc.proc.type = event.target.value;
    currentCharateristic = filterCharacteristics[event.target.value];
    drawTransferFunction();
  };
});
