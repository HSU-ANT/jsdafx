"use strict";

if (Math.log10 === undefined) {
  Math.log10 = function(x) { return  Math.LOG10E * Math.log(x); };
}

if (AnalyserNode.prototype.getFloatTimeDomainData === undefined) {
  AnalyserNode.prototype.getFloatTimeDomainData = function(array) {
    var byteArray = new Uint8Array(array.length);
    this.getByteTimeDomainData(byteArray);
    for (var i = 0; i < array.length; i++) {
      array[i] = (byteArray[i]-128) / 128;
    }
  }
}
