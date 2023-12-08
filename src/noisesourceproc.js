/* global sampleRate */

class NoiseSourceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._idx = 0;
    this._statesFrom = new Float32Array(0);
    this._statesTo = new Float32Array(0);
  }

  static get parameterDescriptors() {
    return [{ name: 'fadePeriod', defaultValue: 0 }];
  }

  static parameterAt(p, n) {
    return p[p.length === 1 ? 0 : n];
  }

  setChannelCount(nc) {
    if (this._statesFrom.length !== nc) {
      this._statesFrom = new Float32Array(nc);
    }
    if (this._statesTo.length !== nc) {
      this._statesTo = new Float32Array(nc);
    }
  }

  process(inputs, outputs, parameters) {
    this.setChannelCount(outputs[0].length);
    for (let sample = 0; sample < outputs[0][0].length; sample++) {
      let fadePeriod = Math.round(
        NoiseSourceProcessor.parameterAt(parameters.fadePeriod, sample) * sampleRate,
      );
      if (fadePeriod < 1) {
        fadePeriod = 1;
      }
      const wt = this._idx / fadePeriod;
      for (let channel = 0; channel < outputs[0].length; channel++) {
        outputs[0][channel][sample] =
          (1 - wt) * this._statesFrom[channel] + wt * this._statesTo[channel];
      }
      this._idx++;
      if (this._idx >= fadePeriod) {
        for (let channel = 0; channel < outputs[0].length; channel++) {
          this._statesFrom[channel] = this._statesTo[channel];
          this._statesTo[channel] = 2 * Math.random() - 1;
        }
        this._idx = 0;
      }
    }
    return true;
  }
}

registerProcessor('noisesource-processor', NoiseSourceProcessor);

export {};
