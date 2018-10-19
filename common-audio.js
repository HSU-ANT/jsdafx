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
    stop();
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
    } else if (src.type === 'sine') {
      source = audioCtx.createOscillator();
      source.type = 'sine';
      source.frequency.value = src.frequency;
      source.start();
      gain = audioCtx.createGain();
      gain.gain.value = src.gain;
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

  stop();

  return {
    start: start,
    stop: stop,
    isPlaying() {
      return source !== null;
    },
    createBuffer(contents) {
      return new Promise((resolve) => { audioCtx.decodeAudioData(contents, resolve); });
    },
    set onended(handler) { onended = handler; },
    getTimeDomainData: getTimeDomainData,
    getFrequencyDomainData: getFrequencyDomainData,
    proc: proc,
  };
}

export function setupPlayerControls(audioProc, sourceconfig) {
  const sources = [];
  const source_selector = document.getElementById('source-selector');
  const optgroup_internal = document.createElement('optgroup');
  optgroup_internal.label = 'Predefined';
  source_selector.append(optgroup_internal);
  const optgroup_local = document.createElement('optgroup');
  optgroup_local.label = 'Local files';
  source_selector.append(optgroup_local);
  const play_button = document.getElementById('play');
  const stop_button = document.getElementById('stop');

  function updateState() {
    if (audioProc.isPlaying()) {
      play_button.disabled = true;
      stop_button.disabled = false;
    } else {
      stop_button.disabled = true;
      play_button.disabled = !sources[source_selector.value];
    }
  }

  async function setupSource(src) {
    const new_option = document.createElement('option');
    optgroup_internal.append(new_option);
    if (src.type === 'remote') {
      new_option.text = `${src.label} (loading...)`;
      new_option.value = sources.length;
      sources.push(null);
      const req = await window.fetch(src.url);
      sources[new_option.value] = await audioProc.createBuffer(await req.arrayBuffer());
      new_option.text = src.label;
    } else if (src.type === 'sine') {
      const f = src.frequency || 440;
      new_option.text = src.label || `${f} Hz sine`;
      new_option.value = sources.length;
      sources.push({ type: 'sine', frequency: f, gain: src.gain || 0.5 });
    }
    updateState();
  }

  sourceconfig.forEach(setupSource);

  audioProc.onended = updateState;

  stop_button.onclick = function (/* event */) {
    audioProc.stop();
    updateState();
  };
  play_button.onclick = function (/* event */) {
    audioProc.start(sources[source_selector.value]);
    updateState();
  };

  const local_file_option = document.createElement('option');
  local_file_option.text = 'Browse...';
  local_file_option.value = 'local file chooser';
  optgroup_local.append(local_file_option);
  const file_input = document.createElement('input');
  file_input.type = 'file';
  file_input.accept = 'audio/*';
  file_input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    const new_option = document.createElement('option');
    new_option.text = `${file.name} (loading...)`;
    new_option.value = sources.length;
    sources.push(null);

    optgroup_local.insertBefore(new_option, local_file_option);
    source_selector.value = new_option.value;
    updateState();
    const contents = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => { resolve(e.target.result); };
      reader.readAsArrayBuffer(file);
    });
    const buf = await audioProc.createBuffer(contents);
    sources[new_option.value] = buf;
    new_option.text = file.name;
    updateState();
  }, false);

  if (sourceconfig.length === 0) {
    // prevent "Browse..." from being pre-selected
    source_selector.value = '';
  }
  source_selector.addEventListener('input', (e) => {
    if (e.target.value === 'local file chooser') {
      file_input.click();
      source_selector.value = '';
    }
    audioProc.stop();
    updateState();
  }, false);
}
