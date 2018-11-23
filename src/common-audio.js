export function workletProcessor(procurl, procid) {
  return {
    init: async (audioCtx) => {
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

      return proc;
    },
    setup: (proc, src, sink) => {
      src.connect(proc);
      proc.connect(sink);
    },
    teardown: (proc) => {
      proc.disconnect();
    },
  };
}

export async function setupAudio(...args) {
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


  const procdef = typeof args[0] === 'object' ? args[0] : workletProcessor(...args);

  const proc = await procdef.init(audioCtx);

  const frequencies = new Float32Array(analyzer.frequencyBinCount);
  for (let i = 0; i < frequencies.length; i++) {
    frequencies[i] = i * audioCtx.sampleRate / 2 / (frequencies.length-1);
  }
  const timeIndices = new Float32Array(analyzer.fftSize);
  for (let i = 0; i < timeIndices.length; i++) {
    timeIndices[i] = i;
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
    procdef.teardown(proc);
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
      procdef.setup(proc, source, analyzer);
    } else if (src.type === 'sine') {
      source = audioCtx.createOscillator();
      source.type = 'sine';
      source.frequency.value = src.frequency;
      source.start();
      gain = audioCtx.createGain();
      gain.gain.value = src.gain;
      source.connect(gain);
      procdef.setup(proc, gain, analyzer);
    }
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
    timeIndices: timeIndices,
    getFrequencyDomainData: getFrequencyDomainData,
    frequencies: frequencies,
    proc: proc,
    get currentTime() { return audioCtx.currentTime; },
    get sampleRate() { return audioCtx.sampleRate; },
  };
}

export function setupPlayerControls(audioProc, sourceconfig) {
  const sources = [];
  let selected_source_idx = null;

  const source_selector_outer = document.getElementById('source-select');
  const itembox = source_selector_outer.children[1];
  source_selector_outer.children[0].addEventListener('click', (e) => {
    e.stopPropagation();
    itembox.style.visibility =
      itembox.style.visibility === 'visible' ? 'hidden' : 'visible';
  }, false);
  document.addEventListener('click', () => {
    itembox.style.visibility = 'hidden';
  }, false);

  const play_button = document.getElementById('play');
  const stop_button = document.getElementById('stop');

  function updateState() {
    if (audioProc.isPlaying()) {
      play_button.disabled = true;
      stop_button.disabled = false;
    } else {
      stop_button.disabled = true;
      play_button.disabled = !sources[selected_source_idx];
    }
  }

  function setSelectedSource(option) {
    function removeSelectedMarker(node) {
      node.classList.remove('selected');
      Array.from(node.children).forEach(removeSelectedMarker);
    }
    selected_source_idx = option.getAttribute('data-source-idx');
    source_selector_outer.children[0].innerText = option.textContent;
    removeSelectedMarker(itembox);
    option.classList.add('selected');
    audioProc.stop();
    updateState();
  }

  function updateSourceText(option, newText) {
    option.innerText = newText;
    if (option.getAttribute('data-source-idx') === selected_source_idx) {
      source_selector_outer.children[0].innerText = newText;
    }
  }

  async function setupSource(src) {
    const new_option = document.createElement('div');
    new_option.setAttribute('data-source-idx', sources.length);
    itembox.children[0].append(new_option);
    const new_source_idx = sources.length;
    new_option.addEventListener('click', (e) => { setSelectedSource(e.target); });
    if (src.type === 'remote') {
      new_option.innerText = `${src.label} (loading...)`;
      sources.push(null);
      const req = await window.fetch(src.url);
      sources[new_source_idx] = await audioProc.createBuffer(await req.arrayBuffer());
      updateSourceText(new_option, src.label);
    } else if (src.type === 'sine') {
      const f = src.frequency || 440;
      new_option.innerText = src.label || `${f} Hz sine`;
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
    audioProc.start(sources[selected_source_idx]);
    updateState();
  };

  const optgroup_local = itembox.children[1];
  const local_file_option = optgroup_local.children[0];
  const file_input = document.createElement('input');
  file_input.type = 'file';
  file_input.accept = 'audio/*';
  file_input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    const new_option = document.createElement('div');
    new_option.setAttribute('data-source-idx', sources.length);
    new_option.innerText = `${file.name} (loading...)`;
    setSelectedSource(new_option);
    optgroup_local.insertBefore(new_option, local_file_option);
    const new_source_idx = sources.length;
    new_option.addEventListener('click', (e) => { setSelectedSource(e.target); });
    sources.push(null);

    const contents = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => { resolve(e.target.result); };
      reader.readAsArrayBuffer(file);
    });
    const buf = await audioProc.createBuffer(contents);
    sources[new_source_idx] = buf;
    updateSourceText(new_option, file.name);
    updateState();
  }, false);

  if (sourceconfig.length === 0) {
    source_selector_outer.children[0].innerText = 'input signal';
  } else {
    setSelectedSource(itembox.children[0].children[0]);
  }

  local_file_option.addEventListener('click', () => {
    file_input.click();
  });
}
