if (typeof Math.log10 === 'undefined') {
  Math.log10 = function (x) { return Math.LOG10E * Math.log(x); };
}

if (typeof AnalyserNode.prototype.getFloatTimeDomainData === 'undefined') {
  AnalyserNode.prototype.getFloatTimeDomainData = function (array) {
    const byteArray = new Uint8Array(array.length);
    this.getByteTimeDomainData(byteArray);
    for (let i = 0; i < array.length; i++) {
      array[i] = (byteArray[i]-128) / 128;
    }
  };
}
