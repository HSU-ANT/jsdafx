import { SignalGraph, setupAudio, setupPlayerControls } from './common.js';

window.addEventListener('load', async () => {
  const maxDepth = {
    tremolo: 0.5,
    vibrato: 0.003,
    flanger: 0.002,
    chorus: 0.015,
  };
  const delayWetGain = {
    tremolo: 0,
    vibrato: 1,
    flanger: 1,
    chorus: 0.3,
  };
  const dryGain = {
    tremolo: 0,
    vibrato: 0,
    flanger: 1,
    chorus: 1,
  };
  const audioProc = await setupAudio({
    init(audioCtx) {
      return {
        audioCtx: audioCtx,
        _type: 'tremolo',
        _bypass: false,
        _modulationFrequency: 1,
        _modulationDepth: 1,
        modulationSourceNode: null,
        modulationGainNode: null,
        modulationNode: null,
        modulationNoiseSourceNodes: null,
        modulationNoiseGainNodes: null,
        delayNodes: null,
        dryGainNode: null,
        tremoloWetGainNode: null,
        delayWetGainNode: null,
        chorusDelayWetGainNode: null,
        updateCoefficients() {
          if (!this.modulationGainNode) {
            // not set up
            return;
          }

          this.tremoloWetGainNode.gain.value =
            this._bypass || this._type !== 'tremolo' ? 0 : 1;
          this.delayWetGainNode.gain.value = this._bypass ? 0 : delayWetGain[this._type];
          this.chorusDelayWetGainNode.gain.value =
            this._bypass || this._type !== 'chorus' ? 0 : 0.3;
          this.dryGainNode.gain.value = this._bypass ? 1 : dryGain[this._type];

          this.modulationGainNode.gain.value =
            this._type !== 'chorus' ? maxDepth[this._type] * this._modulationDepth : 0;
          for (let i = 0; i < 3; i++) {
            this.modulationNoiseGainNodes[i].gain.value =
              this._type === 'chorus' ? maxDepth[this._type] * this._modulationDepth : 0;
          }
          this.modulationSourceNode.frequency.value = this._modulationFrequency;
          for (let i = 0; i < 3; i++) {
            this.modulationNoiseSourceNodes[i].parameters.get('fadePeriod').value =
              0.5 / this._modulationFrequency;
          }

          this.modulationNode.gain.value = 1 - 0.5 * this._modulationDepth;
          for (let i = 0; i < 3; i++) {
            this.delayNodes[i].delayTime.value =
              maxDepth[this._type] * this._modulationDepth + 0.008 * i;
          }
        },
        set type(t) {
          this._type = t;
          this.updateCoefficients();
        },
        set bypass(b) {
          this._bypass = b;
          this.updateCoefficients();
        },
        set modulationFrequency(f) {
          this._modulationFrequency = f;
          this.updateCoefficients();
        },
        set modulationDepth(d) {
          this._modulationDepth = d;
          this.updateCoefficients();
        },
      };
    },
    setup: (proc, src, sink) => {
      proc.modulationSourceNode = proc.audioCtx.createOscillator();
      proc.modulationSourceNode.type = 'sine';
      proc.modulationSourceNode.start();
      proc.modulationGainNode = proc.audioCtx.createGain();
      proc.modulationNode = proc.audioCtx.createGain();
      proc.modulationNoiseSourceNodes = new Array(3);
      proc.modulationNoiseGainNodes = new Array(3);
      proc.delayNodes = new Array(3);
      for (let i = 0; i < 3; i++) {
        proc.modulationNoiseSourceNodes[i] = new AudioWorkletNode(
          proc.audioCtx,
          'noisesource-processor',
          { numberOfInputs: 0, outputChannelCount: [1] },
        );
        proc.modulationNoiseGainNodes[i] = proc.audioCtx.createGain();
        proc.delayNodes[i] = proc.audioCtx.createDelay();
        proc.modulationNoiseSourceNodes[i].connect(proc.modulationNoiseGainNodes[i]);
        proc.modulationNoiseGainNodes[i].connect(proc.delayNodes[i].delayTime);
      }
      proc.dryGainNode = proc.audioCtx.createGain();
      proc.tremoloWetGainNode = proc.audioCtx.createGain();
      proc.delayWetGainNode = proc.audioCtx.createGain();
      proc.chorusDelayWetGainNode = proc.audioCtx.createGain();

      proc.modulationSourceNode.connect(proc.modulationGainNode);
      proc.modulationGainNode.connect(proc.modulationNode.gain);
      src.connect(proc.modulationNode);
      proc.modulationNode.connect(proc.tremoloWetGainNode);
      proc.tremoloWetGainNode.connect(sink);

      proc.modulationGainNode.connect(proc.delayNodes[0].delayTime);
      src.connect(proc.delayNodes[0]);
      src.connect(proc.delayNodes[1]);
      src.connect(proc.delayNodes[2]);
      proc.delayNodes[0].connect(proc.delayWetGainNode);
      proc.delayNodes[1].connect(proc.chorusDelayWetGainNode);
      proc.delayNodes[2].connect(proc.chorusDelayWetGainNode);
      proc.delayWetGainNode.connect(sink);
      proc.chorusDelayWetGainNode.connect(sink);

      src.connect(proc.dryGainNode);
      proc.dryGainNode.connect(sink);
      proc.updateCoefficients();
    },
    teardown: (proc) => {
      if (proc.modulationSourceNode) {
        proc.modulationSourceNode.disconnect();
        proc.modulationSourceNode = null;
      }
      if (proc.modulationGainNode) {
        proc.modulationGainNode.disconnect();
        proc.modulationGainNode = null;
      }
      if (proc.modulationNode) {
        proc.modulationNode.disconnect();
        proc.modulationNode = null;
      }
      if (proc.modulationNoiseSourceNodes) {
        proc.modulationNoiseSourceNodes.forEach((node) => node.disconnect());
        proc.modulationNoiseSourceNodes = null;
      }
      if (proc.modulationNoiseGainNodes) {
        proc.modulationNoiseGainNodes.forEach((node) => node.disconnect());
        proc.modulationNoiseGainNodes = null;
      }
      if (proc.delayNodes) {
        proc.delayNodes.forEach((node) => node.disconnect());
        proc.delayNodes = null;
      }
      if (proc.dryGainNode) {
        proc.dryGainNode.disconnect();
        proc.dryGainNode = null;
      }
      if (proc.tremoloWetGainNode) {
        proc.tremoloWetGainNode.disconnect();
        proc.tremoloWetGainNode = null;
      }
      if (proc.delayWetGainNode) {
        proc.delayWetGainNode.disconnect();
        proc.delayWetGainNode = null;
      }
      if (proc.chorusDelayWetGainNode) {
        proc.chorusDelayWetGainNode.disconnect();
        proc.chorusDelayWetGainNode = null;
      }
    },
  });

  setupPlayerControls(audioProc, [
    { type: 'remote', label: 'Guitar riff 1', url: 'audio/Burns1.wav' },
    { type: 'remote', label: 'Guitar riff 2', url: 'audio/BluesHawk1.wav' },
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
  setDrawWave(true);
  document.getElementById('spectrum').onchange = (event) => {
    setDrawWave(!event.target.checked);
  };
  document.getElementById('waveform').onchange = (event) => {
    setDrawWave(event.target.checked);
  };

  document.getElementById('bypass').checked = false;
  document.getElementById('bypass').onchange = function (event) {
    audioProc.proc.bypass = event.target.checked;
  };

  const maxFrequency = {
    tremolo: 20,
    vibrato: 5,
    flanger: 1,
    chorus: 5,
  };
  document.getElementById('effecttype').value = 'tremolo';
  document.getElementById('effecttype').onchange = function (event) {
    const effectType = event.target.value;
    if (!(effectType in maxFrequency)) {
      // apparently effectType is invalid
      return;
    }
    audioProc.proc.type = effectType;
    document.getElementById('diagram').src = `images/delays/${effectType}1.png`;
    const maxFreq = maxFrequency[effectType];
    const modFreqElem = document.getElementById('modulationfrequency');
    const newFreq = (modFreqElem.value * maxFreq) / modFreqElem.max;
    modFreqElem.max = maxFreq;
    modFreqElem.value = newFreq;
    modFreqElem.labels[0].innerText = `${newFreq} Hz`;
    audioProc.proc.modulationFrequency = newFreq;
  };
  document.getElementById('modulationfrequency').value = 1;
  document.getElementById('modulationfrequency').oninput = function (event) {
    event.target.labels[0].innerText = `${event.target.value} Hz`;
    audioProc.proc.modulationFrequency = event.target.value;
  };
  document.getElementById('modulationdepth').value = 1;
  document.getElementById('modulationdepth').oninput = function (event) {
    event.target.labels[0].innerText = event.target.value;
    audioProc.proc.modulationDepth = event.target.value;
  };
});
