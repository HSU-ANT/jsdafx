import { BaseProcessor } from './baseproc.js';

class QDSProcessor extends BaseProcessor {
  constructor() {
    super(['w', 'dither', 'dithertype', 'noiseshaping', 'noiseshapingfilter']);

    this.qt = 0.25;
    this.withDither = false;
    this.ditherstate = new Float32Array(0);
    this.dithergen = this.rectDither;
    this.withNoiseShaping = true;
    this.h = Float32Array.from([1]);
    this.nsState = new Array(0);
  }

  setChannelCount(nc) {
    if (this.ditherstate.length !== nc) {
      this.ditherstate = new Float32Array(nc);
    }
    if (this.nsState.length !== nc) {
      this.nsState = new Array(nc);
      for (let i = 0; i < this.nsState.length; i++) {
        this.nsState[i] = new Float32Array(this.h.length);
      }
    }
  }

  set w(w) { this.qt = Math.pow(2, 1-w); }

  set dither(b) { this.withDither = b; }

  set dithertype(type) {
    if (type === 'rect') {
      this.dithergen = this.rectDither;
    } else if (type === 'tri') {
      this.dithergen = this.triDither;
    } else if (type === 'hp') {
      this.dithergen = this.hpDither;
      this.ditherstate = 0.0;
    }
  }

  set noiseshaping(b) { this.withNoiseShaping = b; }

  set noiseshapingfilter(order) {
    order = Number(order);
    if (order === 1) {
      this.h = Float32Array.from([1]);
    } else if (order === 2) {
      this.h = Float32Array.from([2, -1]);
    } else if (order === 3) {
      this.h = Float32Array.from([1.623, -0.982, 0.109]);
    } else if (order === 5) {
      this.h = Float32Array.from([2.033, -2.165, 1.959, -1.590, 0.6149]);
    } else if (order === 9) {
      this.h = Float32Array.from([
        2.412, -3.370, 3.937, -4.174, 3.353, -2.205, 1.281, -0.569, 0.0847,
      ]);
    }
    for (let i = 0; i < this.nsState.length; i++) {
      this.nsState[i] = new Float32Array(this.h.length);
    }
  }

  rectDither(/* channel*/) {
    return Math.random() - 0.5;
  }

  triDither(/* channel */) {
    return Math.random() + Math.random() - 1.0;
  }

  hpDither(channel) {
    const rnd = Math.random() - 0.5;
    const d = rnd - this.ditherstate[channel];
    this.ditherstate[channel] = rnd;
    return d;
  }

  process(inputs, outputs /*, parameters*/) {
    this.setChannelCount(inputs[0].length);
    for (let channel = 0; channel < inputs[0].length; channel++) {
      const inputData = inputs[0][channel];
      const outputData = outputs[0][channel];
      for (let sample = 0; sample < inputData.length; sample++) {
        let input = inputData[sample];
        if (this.withNoiseShaping) {
          for (let i = 0; i < this.h.length; i++) {
            input -= this.h[i] * this.nsState[channel][i];
          }
        }
        let d_rand = 0.0;
        if (this.withDither) {
          d_rand = this.dithergen(channel);
        }
        const tmpOutput = this.qt * Math.round(input/this.qt + d_rand);
        for (let i = this.h.length-1; i >= 0; i--) {
          this.nsState[channel][i] = this.nsState[channel][i-1];
        }
        this.nsState[channel][0] = tmpOutput - input;
        outputData[sample] = tmpOutput;
      }
    }

    return true;
  }
}

registerProcessor('qds-processor', QDSProcessor);
