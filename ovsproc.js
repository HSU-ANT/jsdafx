import { BaseProcessor } from './baseproc.js';
import { Module } from './build/ovsprocimpl.js';

class OVSProcessor extends BaseProcessor {
  constructor() {
    super(['w', 'dithertype', 'noiseshapingfilter', 'oversamplingfactor']);

    this.procimpl = new Module.OvsImpl();
  }

  set w(w) { this.procimpl.q = Math.pow(2, 1-w); }

  set dithertype(type) {
    if (type === 'rect') {
      this.procimpl.dither = 1;
    } else if (type === 'tri') {
      this.procimpl.dither = 2;
    } else if (type === 'hp') {
      this.procimpl.dither = 3;
    } else {
      this.procimpl.dither = 0;
    }
  }

  set noiseshapingfilter(order) { this.procimpl.nsN = order|0; }

  set oversamplingfactor(L) { this.procimpl.L = L|0; }

  process(inputs, outputs, parameters) {
    for (let channel = 0; channel < inputs[0].length; channel++) {
      const inputData = inputs[0][channel];
      const outputData = outputs[0][channel];
      const workbuf = this.procimpl.workbuffer(inputData.length);
      workbuf.set(inputData);
      this.procimpl.processBlock(channel, inputData.length);
      outputData.set(workbuf);
    }

    return true;
  }
}

registerProcessor('ovs-processor', OVSProcessor);
