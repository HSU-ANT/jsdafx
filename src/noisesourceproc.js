class NoiseSourceProcessor extends AudioWorkletProcessor {
  process(inputs, outputs /*, parameters*/) {
    for (let channel = 0; channel < outputs[0].length; channel++) {
      for (let sample = 0; sample < outputs[0][0].length; sample++) {
        outputs[0][channel][sample] = 2*Math.random() - 1;
      }
    }
    return true;
  }
}

registerProcessor('noisesource-processor', NoiseSourceProcessor);

export {};
