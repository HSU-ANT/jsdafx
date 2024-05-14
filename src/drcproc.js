import { BaseProcessor } from './baseproc.js';

class DRCProcessor extends BaseProcessor {
  constructor() {
    super(['bypass', 'newYorkStyle', 'envelopeSubsampling']);

    this.instantaneousPower = 1;
    this.gain = 1;
    this.inputMaxima = new Float32Array(256);
    this.outputMaxima = new Float32Array(256);
    this.currentInputMax = 0;
    this.currentOutputMax = 0;
    this.maxSampleCount = 0;
    this.envelopeSubsampling = 2000;
    this.bypass = false;
    this.newYorkStyle = false;
  }

  static get parameterDescriptors() {
    return [
      { name: 'limiterThreshold', defaultValue: -10 },
      { name: 'limiterLevel', defaultValue: -10 },
      { name: 'noiseThreshold', defaultValue: -80 },
      { name: 'compressionRatio', defaultValue: 2 },
    ];
  }

  static parameterAt(p, n) {
    return p[p.length === 1 ? 0 : n];
  }

  process(inputs, outputs, parameters) {
    if (inputs[0].length === 0) {
      return true;
    }
    for (let sample = 0; sample < inputs[0][0].length; sample++) {
      let sq = 0;
      for (let channel = 0; channel < inputs[0].length; channel++) {
        const input = inputs[0][channel][sample];
        sq += input * input;
        this.currentInputMax = Math.max(this.currentInputMax, input);
      }
      sq /= inputs[0].length;
      if (sq > this.instantaneousPower) {
        this.instantaneousPower = 0.99 * this.instantaneousPower + 0.01 * sq;
      } else {
        this.instantaneousPower = 0.995 * this.instantaneousPower + 0.005 * sq;
      }
      const inLevel_dB = 10 * Math.log10(this.instantaneousPower);
      const limiterThreshold = DRCProcessor.parameterAt(
        parameters.limiterThreshold,
        sample,
      );
      const limiterLevel = DRCProcessor.parameterAt(parameters.limiterLevel, sample);
      const noiseThreshold = DRCProcessor.parameterAt(parameters.noiseThreshold, sample);
      const compressionRatio = DRCProcessor.parameterAt(
        parameters.compressionRatio,
        sample,
      );
      let gain_dB = -1000;
      if (inLevel_dB > limiterThreshold) {
        gain_dB = limiterLevel - inLevel_dB;
      } else if (inLevel_dB > noiseThreshold) {
        gain_dB =
          limiterLevel - inLevel_dB + (inLevel_dB - limiterThreshold) / compressionRatio;
      }
      this.gain = 0.99 * this.gain + 0.01 * Math.pow(10, gain_dB / 20);

      for (let channel = 0; channel < inputs[0].length; channel++) {
        const inputData = inputs[0][channel];
        const outputData = outputs[0][channel];
        if (this.bypass) {
          outputData[sample] = inputData[sample];
        } else {
          outputData[sample] =
            this.gain * inputData[sample] + (this.newYorkStyle ? inputData[sample] : 0);
        }
        this.currentOutputMax = Math.max(this.currentOutputMax, outputData[sample]);
      }

      if (++this.maxSampleCount >= this.envelopeSubsampling) {
        this.maxSampleCount = 0;
        this.inputMaxima.copyWithin(0, 1);
        this.inputMaxima[this.inputMaxima.length - 1] = this.currentInputMax;
        this.currentInputMax = 0;
        this.outputMaxima.copyWithin(0, 1);
        this.outputMaxima[this.outputMaxima.length - 1] = this.currentOutputMax;
        this.currentOutputMax = 0;
        this.port.postMessage({
          inputEnvelope: new Float32Array(this.inputMaxima),
          outputEnvelope: new Float32Array(this.outputMaxima),
        });
      }
    }

    return true;
  }
}

registerProcessor('drc-processor', DRCProcessor);
