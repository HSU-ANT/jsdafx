import { FunctionGraph, setupAudio, setupPlayerControls } from './common.js';

window.addEventListener('load', async () => {
  const IRLENGTH = 200; // length of impulse response in milli seconds
  const audioProc = await setupAudio({
    init(audioCtx) {
      const impulseResponseBuffer = audioCtx.createBuffer(
        2,
        (audioCtx.sampleRate * IRLENGTH) / 1000,
        audioCtx.sampleRate,
      );
      /* the normalization of the ConvolverNode is useful, but contains a weird scaling
      depending on the length of the impulse response which we compensate by the following
      factor */
      const scale =
        ((800 / Math.sqrt(impulseResponseBuffer.length)) * audioCtx.sampleRate) / 44100;
      return {
        audioCtx: audioCtx,
        convolverNode: null,
        dryGainNode: null,
        wetGainNode: null,
        impulseResponseBuffer: impulseResponseBuffer,
        set bypass(bypass) {
          this._bypass = bypass;
          this.updateCoefficients();
        },
        updateCoefficients() {
          if (this.dryGainNode) {
            this.dryGainNode.gain.value = this._bypass ? 1 : 0;
          }
          if (this.wetGainNode) {
            this.wetGainNode.gain.value = this._bypass ? 0 : scale;
          }
        },
        _bypass: false,
      };
    },
    setup(proc, src, sink) {
      proc.convolverNode = proc.audioCtx.createConvolver();
      proc.convolverNode.buffer = proc.impulseResponseBuffer;
      src.connect(proc.convolverNode);
      proc.wetGainNode = proc.audioCtx.createGain();
      proc.convolverNode.connect(proc.wetGainNode);
      proc.wetGainNode.connect(sink);
      proc.dryGainNode = proc.audioCtx.createGain();
      src.connect(proc.dryGainNode);
      proc.dryGainNode.connect(sink);
      proc.updateCoefficients();
    },
    teardown(proc) {
      if (proc.convolverNode) {
        proc.convolverNode.disconnect();
        proc.convolverNode = null;
      }
    },
  });

  setupPlayerControls(audioProc, [
    { type: 'remote', label: 'Drums', url: 'audio/434013__mrpearch__drum-patern.mp3' },
    {
      type: 'remote',
      label: 'Speech',
      url: 'audio/Ada_Lovelace_(As_Told_By_U.S._Chief_Technology_Officer_Megan_Smith).mp3',
    },
  ]);

  const controlPoint1 = { x: 0.15 * IRLENGTH, y: 0.3 };
  const controlPoint2 = { x: 0.25 * IRLENGTH, y: 0.8 };
  let controlPoint3 = IRLENGTH;

  const envelopeAt = (t) => {
    if (t < controlPoint1.x) {
      return ((t - controlPoint1.x) * controlPoint1.y) / controlPoint1.x + controlPoint1.y;
    }
    if (t < controlPoint2.x) {
      const c = (controlPoint2.y - controlPoint1.y) / (controlPoint2.x - controlPoint1.x);
      return (t - controlPoint2.x) * c + controlPoint2.y;
    }
    const T = controlPoint3 - controlPoint2.x;
    if (T <= 0) {
      return 0;
    }
    return controlPoint2.y * Math.pow(2, -(t - controlPoint2.x) / T);
  };

  const computeImpuleResponse = () => {
    for (let c = 0; c < 2; c++) {
      const h = audioProc.proc.impulseResponseBuffer.getChannelData(c);
      for (let i = 0; i < h.length; i++) {
        h[i] = (Math.random() * 2 - 1) * envelopeAt((i / audioProc.sampleRate) * 1000);
      }
    }
    if (audioProc.proc.convolverNode) {
      audioProc.proc.convolverNode.buffer = audioProc.proc.impulseResponseBuffer;
    }
  };

  computeImpuleResponse();

  const graph = new FunctionGraph(document.getElementById('funccanvas'));
  graph.logx = false;
  graph.xlim = [0, IRLENGTH];
  graph.xlabel = 'time in ms';
  graph.ylim = [-1, 1];

  const tvals = new Float32Array(audioProc.proc.impulseResponseBuffer);
  const envvals = new Float32Array(audioProc.proc.impulseResponseBuffer);

  const drawImpulseResponse = () => {
    for (let i = 0; i < tvals.length; i++) {
      const tval = (IRLENGTH * i) / (tvals.length - 1);
      tvals[i] = tval;
      envvals[i] = envelopeAt(tval);
    }
    graph.drawData(
      tvals,
      audioProc.proc.impulseResponseBuffer.getChannelData(0),
      '#00685e',
      tvals,
      envvals,
    );
    graph.drawMarkers([
      [controlPoint1.x, controlPoint1.y],
      [controlPoint2.x, controlPoint2.y],
      [controlPoint3, 0],
    ]);
  };

  graph.addEventListener('markermove', (event) => {
    if (event.marker === 0) {
      controlPoint1.x = Math.max(Math.min(event.valX, controlPoint2.x), 0);
      controlPoint1.y = Math.max(Math.min(event.valY, 1), 0);
    }
    if (event.marker === 1) {
      controlPoint2.x = Math.max(Math.min(event.valX, controlPoint3), controlPoint1.x);
      controlPoint2.y = Math.max(Math.min(event.valY, 1), 0);
    }
    if (event.marker === 2) {
      controlPoint3 = Math.max(Math.min(event.valX, IRLENGTH), controlPoint2.x);
    }
    drawImpulseResponse();
  });

  graph.addEventListener('markermoveend', (/*event*/) => {
    computeImpuleResponse();
    drawImpulseResponse();
  });

  document.getElementById('bypass').onchange = function (event) {
    audioProc.proc.bypass = event.target.checked;
  };

  drawImpulseResponse();
});
