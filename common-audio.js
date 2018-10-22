export async function setupAudio(procurl, procid) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
    latencyHint: 'playback',
  });

  let source = null;
  let gain = null;
  const analyzer = audioCtx.createAnalyser();
  analyzer.smoothingTimeConstant = 0.3;
  analyzer.minDecibels = -130;
  analyzer.fftSize = 1024;
  const timeDomainData = new Float32Array(analyzer.fftSize);
  const frequencyDomainData = new Float32Array(analyzer.frequencyBinCount);
  analyzer.connect(audioCtx.destination);
  let onended = function () { /* no action by default */ };

  await audioCtx.audioWorklet.addModule(procurl);

  const proc = new AudioWorkletNode(audioCtx, procid);

  const receiveMessage = (port) => {
    return new Promise((resolve) => {
      const oldhandler = port.onmessage;
      port.onmessage = (event) => {
        port.onmessage = oldhandler;
        resolve(event.data);
      };
    });
  };

  proc.port.postMessage({action: 'list-properties'});
  const data = await receiveMessage(proc.port);
  if (data.response === 'list-properties') {
    for (const p of data.properties) {
      Object.defineProperty(proc, p, {
        set(val) {
          proc.port.postMessage({action: 'set-property', param: p, value: val});
        },
      });
    }
  }

  const stop = function () {
    if (source !== null) {
      source.disconnect();
      source = null;
    }
    if (gain !== null) {
      gain.disconnect();
      gain = null;
    }
    proc.disconnect();
    audioCtx.suspend();
  };

  const start = function (src) {
    if (source !== null) {
      source.disconnect();
      source = null;
    }
    if (gain !== null) {
      gain.disconnect();
      gain = null;
    }
    audioCtx.resume();
    if (src instanceof AudioBuffer) {
      source = audioCtx.createBufferSource();
      source.buffer = src;
      source.onended = () => {
        stop();
        onended();
      };
      source.start();
      source.connect(proc);
    } else {
      source = audioCtx.createOscillator();
      source.type = 'sine';
      source.start();
      gain = audioCtx.createGain();
      gain.gain.value = 0.5;
      source.connect(gain);
      gain.connect(proc);
    }
    proc.connect(analyzer);
  };

  const getTimeDomainData = function () {
    analyzer.getFloatTimeDomainData(timeDomainData);
    return timeDomainData;
  };
  const getFrequencyDomainData = function () {
    analyzer.getFloatFrequencyData(frequencyDomainData);
    return frequencyDomainData;
  };

  return {
    start: start,
    stop: stop,
    isPlaying() {
      return source !== null;
    },
    createBuffer(contents, onSuccess) {
      audioCtx.decodeAudioData(contents, onSuccess);
    },
    set onended(handler) { onended = handler; },
    getTimeDomainData: getTimeDomainData,
    getFrequencyDomainData: getFrequencyDomainData,
    proc: proc,
  };
}

export function setupPlayerControls(audioProc, bindata1Promise, bindata2Promise) {
  let audio1data = null;
  let audio2data = null;
  let audioFileData = null;

  function updatePlayButtonStates() {
    if (audioProc.isPlaying()) {
      document.getElementById('audio1').disabled = true;
      document.getElementById('audio2').disabled = true;
      document.getElementById('start').disabled = true;
      document.getElementById('file-input').disabled = true;
      document.getElementById('stop').disabled = false;
    } else {
      document.getElementById('audio1').disabled =
        bindata1Promise !== null && audio1data === null;
      document.getElementById('audio2').disabled =
        bindata2Promise !== null && audio2data === null;
      document.getElementById('start').disabled = audioFileData === null;
      document.getElementById('file-input').disabled = false;
      document.getElementById('stop').disabled = true;
    }
  }

  if (bindata1Promise) {
    bindata1Promise.then((bindata1) => {
      audioProc.createBuffer(bindata1, (buf) => {
        audio1data = buf;
        updatePlayButtonStates();
      });
    });
  }
  if (bindata2Promise) {
    bindata2Promise.then((bindata2) => {
      audioProc.createBuffer(bindata2, (buf) => {
        audio2data = buf;
        updatePlayButtonStates();
      });
    });
  }

  audioProc.onended = updatePlayButtonStates;

  document.getElementById('audio1').onclick = function (/* event */) {
    if (audio1data !== null) {
      audioProc.start(audio1data);
    } else {
      audioProc.start();
    }
    updatePlayButtonStates();
  };
  document.getElementById('audio2').onclick = function (/* event */) {
    if (audio2data !== null) {
      audioProc.start(audio2data);
    } else {
      audioProc.start();
    }
    updatePlayButtonStates();
  };
  document.getElementById('start').onclick = function (/* event */) {
    audioProc.start(audioFileData);
    updatePlayButtonStates();
  };
  document.getElementById('stop').onclick = function (/* event */) {
    audioProc.stop();
    updatePlayButtonStates();
  };
  document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const contents = e.target.result;
      audioProc.createBuffer(contents, (buf) => {
        audioFileData = buf;
        audioProc.start(audioFileData);
        updatePlayButtonStates();
      });
    };
    reader.readAsArrayBuffer(file);
  }, false);

  updatePlayButtonStates();
}
