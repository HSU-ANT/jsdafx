import { BaseProcessor } from './baseproc.js';

class EQProcessor extends BaseProcessor {
  constructor() {
    super(['type', 'bypass']);

    this.type = 'lowpass';
    this.state = new Array(0);
    this.a0 = 1;
    this.a1 = 0;
    this.a2 = 0;
    this.b0 = 1;
    this.b1 = 0;
    this.b2 = 0;
    this.bypass = false;
  }

  static get parameterDescriptors() {
    return [
      { name: 'omegaC', defaultValue: 1 },
      { name: 'gain', defaultValue: 1 },
      { name: 'Q', defaultValue: 1 },
    ];
  }

  setChannelCount(nc) {
    if (this.state.length !== nc) {
      this.state = new Array(nc);
      for (let i = 0; i < this.state.length; i++) {
        this.state[i] = new Float32Array(2);
      }
    }
  }

  set type(type) {
    this.coeffcalc = EQProcessor.coeffcalc[type];
  }

  static parameterAt(p, n) {
    return p[p.length === 1 ? 0 : n];
  }

  process(inputs, outputs, parameters) {
    this.setChannelCount(inputs[0].length);
    let needParamUpdate = true;
    if (parameters.omegaC.length === 1 && parameters.gain.length === 1 &&
      parameters.Q.length === 1) {
      const k = Math.tan(parameters.omegaC[0] / 2);
      this.coeffcalc(k, parameters.gain[0], parameters.Q[0]);
      needParamUpdate = false;
    }
    if (inputs[0].length === 0) {
      return true;
    }
    for (let sample = 0; sample < inputs[0][0].length; sample++) {
      for (let channel = 0; channel < inputs[0].length; channel++) {
        const inputData = inputs[0][channel];
        const outputData = outputs[0][channel];
        const state = this.state[channel];
        if (needParamUpdate) {
          const k = Math.tan(EQProcessor.parameterAt(parameters.omegaC, sample) / 2);
          this.coeffcalc(
            k,
            EQProcessor.parameterAt(parameters.gain, sample),
            EQProcessor.parameterAt(parameters.Q, sample),
          );
        }
        const tmp = (inputData[sample] - this.a1 * state[0] - this.a2 * state[1]) / this.a0;
        if (this.bypass) {
          outputData[sample] = inputData[sample];
        } else {
          outputData[sample] = this.b0 * tmp + this.b1 * state[0] + this.b2 * state[1];
        }
        state[1] = state[0];
        state[0] = tmp;
      }
    }

    return true;
  }
}

EQProcessor.coeffcalc = {
  lowpass(k) {
    const k2 = k*k;
    this.b0 = k2;
    this.b1 = 2 * k2;
    this.b2 = k2;
    this.a0 = 1 + Math.SQRT2 * k + k2;
    this.a1 = 2 * (k2 - 1);
    this.a2 = 1 - Math.SQRT2 * k + k2;
  },
  highpass(k) {
    const k2 = k*k;
    this.b0 = 1;
    this.b1 = -2;
    this.b2 = 1;
    this.a0 = 1 + Math.SQRT2 * k + k2;
    this.a1 = 2 * (k2 - 1);
    this.a2 = 1 - Math.SQRT2 * k + k2;
  },
  lowshelving(k, gain) {
    const k2 = k*k; // Auxiliary variable for different filter types
    if (gain >= 1) {
      const v = gain;
      this.b0 = 1 + Math.sqrt(2 * v) * k + v * k2;
      this.b1 = 2 * (-1 + v * k2);
      this.b2 = 1 - Math.sqrt(2 * v) * k + v * k2;
      this.a0 = 1 + Math.SQRT2 * k + k2;
      this.a1 = 2 * (-1 + k2);
      this.a2 = 1 - Math.SQRT2 * k + k2;
    } else {
      const v = 1/gain;
      this.b0 = 1 + Math.SQRT2 * k + k2;
      this.b1 = 2 * (-1 + k2);
      this.b2 = 1 - Math.SQRT2 * k + k2;
      this.a0 = 1 + Math.sqrt(2 * v) * k + v * k2;
      this.a1 = 2 * (-1 + v * k2);
      this.a2 = 1 - Math.sqrt(2 * v) * k + v * k2;
    }
  },
  highshelving(k, gain) {
    const k2 = k*k;
    if (gain >= 1) {
      const v = gain;
      this.b0 = v + Math.sqrt(2 * v) * k + k2;
      this.b1 = 2 * (-v + k2);
      this.b2 = v - Math.sqrt(2 * v) * k + k2;
      this.a0 = 1 + Math.SQRT2 * k + k2;
      this.a1 = 2 * (-1 + k2);
      this.a2 = 1 - Math.SQRT2 * k + k2;
    } else {
      const v = 1/gain;
      this.b0 = 1 + Math.SQRT2 * k + k2;
      this.b1 = 2 * (-1 + k2);
      this.b2 = 1 - Math.SQRT2 * k + k2;
      this.a0 = v + Math.sqrt(2 * v) * k + k2;
      this.a1 = 2 * (-v + k2);
      this.a2 = v - Math.sqrt(2 * v) * k + k2;
    }
  },
  peak(k, gain, Q) {
    const k2 = k*k;
    if (gain >= 1) {
      const v = gain;
      this.b0 = 1 + v/Q*k + k2;
      this.b1 = 2 * (-1 + k2);
      this.b2 = 1 - v/Q*k + k2;
      this.a0 = 1 + 1/Q*k + k2;
      this.a1 = 2 * (-1 + k2);
      this.a2 = 1 - 1/Q*k + k2;
    } else {
      const v = 1/gain;
      this.b0 = 1 + 1/Q*k + k2;
      this.b1 = 2 * (-1 + k2);
      this.b2 = 1 - 1/Q*k + k2;
      this.a0 = 1 + v/Q*k + k2;
      this.a1 = 2 * (-1 + k2);
      this.a2 = 1 - v/Q*k + k2;
    }
  },
};

registerProcessor('eq-processor', EQProcessor);
