class QDSProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.qt = 0.25;
    this.withDither = false;
    this.ditherstate = 0.0;
    this.dithergen = this.rectDither;
    this.withNoiseShaping = true;
    this.h = Float32Array.from([1]);
    this.nsState = new Float32Array(1);

    var _this = this;
    this.port.onmessage = function(event) {
      _this[event.data.param] = event.data.value;
    }
  }

  set w(w) { this.qt = Math.pow(2, 1-w);}

  set dither(b) { this.withDither = b; }

  set dithertype(type) {
    if (type == "rect") {
      this.dithergen = this.rectDither;
    } else if (type == "tri") {
      this.dithergen = this.triDither;
    } else if (type == "hp") {
      this.dithergen = this.hpDither;
      this.ditherstate = 0.0;
    }
  }

  set noiseshaping(b) { this.withNoiseShaping = b; }

  set noiseshapingfilter(order) {
    if (order==1) {
      this.h = Float32Array.from([1]);
    } else if (order==2) {
      this.h = Float32Array.from([2, -1]);
    } else if (order==3) {
      this.h = Float32Array.from([1.623, -0.982, 0.109]);
    } else if (order==5) {
      this.h = Float32Array.from([2.033, -2.165, 1.959, -1.590, 0.6149]);
    } else if (order==9) {
      this.h = Float32Array.from([2.412, -3.370, 3.937, -4.174, 3.353, -2.205, 1.281, -0.569, 0.0847]);
    }
    this.nsState = new Float32Array(this.h.length);
  }

  rectDither() {
    return Math.random() - 0.5;
  }
  triDither() {
    return Math.random() + Math.random() - 1.0;
  }
  hpDither() {
    var rnd = Math.random() - 0.5;
    var d = rnd - this.ditherstate;
    this.ditherstate = rnd;
    return d;
  }

  process(inputs, outputs, parameters) {
    // TODO deal with more than one channel
    var inputData = inputs[0][0];
    var outputData = outputs[0][0];
    for (var sample = 0; sample < inputData.length; sample++) {
      var input = inputData[sample];
      if (this.withNoiseShaping) {
        for (var i = 0; i < this.h.length; i++) {
          input -= this.h[i] * this.nsState[i];
        }
      }
      var d_rand = 0.0;
      if (this.withDither) {
        d_rand = this.dithergen();
      }
      var xr = input;
      var tmpOutput = this.qt * Math.round(xr/this.qt + d_rand);
      for (var i = this.h.length-1; i >= 0; i--) {
        this.nsState[i] = this.nsState[i-1];
      }
      this.nsState[0] = tmpOutput - input;
      outputData[sample] = tmpOutput;
    }

    return true;
  }
}

registerProcessor('qds-processor', QDSProcessor);
