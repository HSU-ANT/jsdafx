import { BaseProcessor } from './baseproc.js';

class DistortionProcessor extends BaseProcessor {
  constructor() {
    super([]);
  }

  static get parameterDescriptors() {
    return [
      { name: 'inputGain', defaultValue: 1 },
      { name: 'outputGain', defaultValue: 1 },
    ];
  }

  static parameterAt(p, n) {
    return p[p.length === 1 ? 0 : n];
  }

  process(inputs, outputs, parameters) {
    for (let sample = 0; sample < inputs[0][0].length; sample++) {
      for (let channel = 0; channel < inputs[0].length; channel++) {
        const inputData = inputs[0][channel];
        const outputData = outputs[0][channel];
        const ingain = DistortionProcessor.parameterAt(parameters.inputGain, sample);
        const outgain = DistortionProcessor.parameterAt(parameters.outputGain, sample);
        const inval = inputData[sample];
        outputData[sample] = outgain * (2.0 / (1.0 + Math.exp(-inval * ingain)) - 1.0);
      }
    }
    return true;
  }
}

registerProcessor('distortion-processor', DistortionProcessor);
