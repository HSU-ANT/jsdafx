export function setupAudio(procurl, procid) {
  var audioCtx = new (window.AudioContext || window.webkitAudioContext)({latencyHint: "playback"});

  var source;
  var gain;
  var analyzer = audioCtx.createAnalyser();
  analyzer.smoothingTimeConstant = 0.3;
  analyzer.minDecibels = -130;
  analyzer.fftSize = 1024;
  var timeDomainData = new Float32Array(analyzer.fftSize);
  var frequencyDomainData = new Float32Array(analyzer.frequencyBinCount);
  analyzer.connect(audioCtx.destination);
  var onended = function() {};

  return audioCtx.audioWorklet.addModule(procurl).then(() => {
    var proc = new AudioWorkletNode(audioCtx, procid);

    var receiveMessage = (port) => {
      return new Promise(resolve => {
        var oldhandler = port.onmessage;
        port.onmessage = (event) => {
          port.onmessage = oldhandler;
          resolve(event.data);
        };
      });
    };

    proc.port.postMessage({action: 'list-properties'});
    return receiveMessage(proc.port).then(data => {
      if (data.response == 'list-properties') {
        for (var p of data.properties) {
          (function(p) {
            Object.defineProperty(proc, p, {
              set: function(val) {
                proc.port.postMessage({action: 'set-property', param: p, value: val});
              }
            });
          })(p);
        }
      }
      return proc;
    });
  }).then(proc => {
    var start = function(src) {
      if (source !== undefined) {
        source.disconnect();
        source = undefined;
      }
      if (gain !== undefined) {
        gain.disconnect();
        gain = undefined;
      }
      audioCtx.resume();
      if (src instanceof AudioBuffer) {
        source = audioCtx.createBufferSource();
        source.buffer = src;
        source.onended = function() {
          stop();
          onended();
        }
        source.start();
        source.connect(proc);
      } else {
        source = audioCtx.createOscillator();
        source.type = "sine";
        source.start();
        gain = audioCtx.createGain();
        gain.gain.value = 0.5;
        source.connect(gain);
        gain.connect(proc);
      }
      proc.connect(analyzer);
    }

    var stop = function() {
      if (source !== undefined) {
        source.disconnect();
        source = undefined;
      }
      if (gain !== undefined) {
        gain.disconnect();
        gain = undefined;
      }
      proc.disconnect();
      audioCtx.suspend();
    }

    var getTimeDomainData = function() {
      analyzer.getFloatTimeDomainData(timeDomainData);
      return timeDomainData;
    }

    var getFrequencyDomainData = function() {
      analyzer.getFloatFrequencyData(frequencyDomainData);
      return frequencyDomainData;
    }

    return {
      start: start,
      stop: stop,
      isPlaying: function () {
        return source !== undefined;
      },
      createBuffer: function(contents, onSuccess) {
        audioCtx.decodeAudioData(contents, onSuccess);
      },
      set onended(handler) { onended = handler; },
      getTimeDomainData: getTimeDomainData,
      getFrequencyDomainData: getFrequencyDomainData,
      proc: proc,
    };
  });
};

export function setupPlayerControls(audioProc, bindata1Promise, bindata2Promise) {
  function updatePlayButtonStates() {
    if (audioProc.isPlaying()) {
      document.getElementById("audio1").disabled = true;
      document.getElementById("audio2").disabled = true;
      document.getElementById("start").disabled = true;
      document.getElementById("file-input").disabled = true;
      document.getElementById("stop").disabled = false;
    } else {
      document.getElementById("audio1").disabled =  bindata1Promise !== undefined && audio1data === undefined;
      document.getElementById("audio2").disabled = bindata2Promise !== undefined && audio2data === undefined;
      document.getElementById("start").disabled = audioFileData === undefined;
      document.getElementById("file-input").disabled = false;
      document.getElementById("stop").disabled = true;
    }
  }

  var audio1data;
  var audio2data;
  var audioFileData;
  if (bindata1Promise) {
    bindata1Promise.then((bindata1) => {
      audioProc.createBuffer(bindata1, function(buf) {
        audio1data = buf;
        updatePlayButtonStates();
      });
    });
  }
  if (bindata2Promise) {
    bindata2Promise.then((bindata2) => {
      audioProc.createBuffer(bindata2, function(buf) {
        audio2data = buf;
        updatePlayButtonStates();
      });
    });
  }

  audioProc.onended = updatePlayButtonStates;

  document.getElementById("audio1").onclick = function(event) {
    audioProc.start();
    updatePlayButtonStates();
  }
  document.getElementById("audio2").onclick = function(event) {
    audioProc.start(audio2data);
    updatePlayButtonStates();
  }
  document.getElementById("start").onclick = function(event) {
    audioProc.start(audioFileData);
    updatePlayButtonStates();
  }
  document.getElementById("stop").onclick = function(event) {
    audioProc.stop();
    updatePlayButtonStates();
  }
  document.getElementById('file-input').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) {
      return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
      var contents = e.target.result;
      audioProc.createBuffer(contents, function(buf) {
        audioFileData = buf;
        audioProc.start(audioFileData);
        updatePlayButtonStates();
      });
    };
    reader.readAsArrayBuffer(file);}, false);

  updatePlayButtonStates();
}
