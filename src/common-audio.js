import EventTarget from 'event-target'; // polyfill for Safari

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

      proc.port.postMessage({ action: 'list-properties' });
      const data = await receiveMessage(proc.port);
      if (data.response === 'list-properties') {
        for (const p of data.properties) {
          Object.defineProperty(proc, p, {
            set(val) {
              proc.port.postMessage({ action: 'set-property', param: p, value: val });
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
  let filter = null;
  const analyzer = audioCtx.createAnalyser();
  analyzer.smoothingTimeConstant = 0.3;
  analyzer.minDecibels = -130;
  analyzer.fftSize = 1024;
  const timeDomainData = new Float32Array(analyzer.fftSize);
  const frequencyDomainData = new Float32Array(analyzer.frequencyBinCount);
  analyzer.connect(audioCtx.destination);
  let startTime = null;
  let startPos = 0;

  await audioCtx.audioWorklet.addModule('noisesourceproc.js');

  const procdef = typeof args[0] === 'object' ? args[0] : workletProcessor(...args);

  const proc = await procdef.init(audioCtx);

  const frequencies = new Float32Array(analyzer.frequencyBinCount);
  for (let i = 0; i < frequencies.length; i++) {
    frequencies[i] = (i * audioCtx.sampleRate) / 2 / (frequencies.length - 1);
  }
  const timeIndices = new Float32Array(analyzer.fftSize);
  for (let i = 0; i < timeIndices.length; i++) {
    timeIndices[i] = i;
  }

  const stop = function () {
    startTime = null;
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

  const start = function (src, _startPos, endPos) {
    stop();
    audioCtx.resume();
    startTime = audioCtx.currentTime;
    if (src instanceof AudioBuffer) {
      source = audioCtx.createBufferSource();
      source.buffer = src;
      startPos = typeof _startPos === 'undefined' ? 0 : _startPos;
      if (typeof endPos !== 'undefined') {
        source.loopStart = startPos;
        source.loopEnd = endPos;
      }
      source.loop = true;
      source.start(0, startPos);
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
    } else if (src.type === 'noise') {
      gain = audioCtx.createGain();
      gain.gain.value = src.gain;
      source = new AudioWorkletNode(audioCtx, 'noisesource-processor', {
        numberOfInputs: 0,
        outputChannelCount: [1],
      });
      if (src.filter && src.filter.length !== 0) {
        filter = audioCtx.createConvolver();
        const hbuf = audioCtx.createBuffer(1, src.filter.length, audioCtx.sampleRate);
        hbuf.getChannelData(0).set(src.filter);
        filter.normalize = false;
        filter.buffer = hbuf;
        source.connect(filter);
        filter.connect(gain);
      } else {
        source.connect(gain);
      }
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
      return new Promise((resolve) => {
        audioCtx.decodeAudioData(contents, resolve);
      });
    },
    getTimeDomainData: getTimeDomainData,
    timeIndices: timeIndices,
    getFrequencyDomainData: getFrequencyDomainData,
    frequencies: frequencies,
    proc: proc,
    get currentTime() {
      return audioCtx.currentTime;
    },
    get sampleRate() {
      return audioCtx.sampleRate;
    },
    get position() {
      if (startTime === null) {
        return null;
      }
      let pos = this.currentTime - startTime;
      if (source instanceof AudioBufferSourceNode) {
        if (source.loopEnd !== 0) {
          pos = (pos % (source.loopEnd - source.loopStart)) + source.loopStart;
        } else {
          pos = (pos + startPos) % source.buffer.duration;
        }
      }
      return pos;
    },
  };
}

class TimeLine extends EventTarget {
  constructor(canvas) {
    super();
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const maxima = Array(width);
    const minima = Array(width);

    let signal = null;
    let down_x = null;
    let up_x = null;
    let range_start = null;
    let range_end = null;
    let playbackPosition = null;

    const draw = () => {
      ctx.fillStyle = 'rgb(221, 218, 215)';
      ctx.strokeStyle = 'rgb(186, 180, 175)';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeRect(0, 0, width, height);
      if (signal instanceof AudioBuffer) {
        ctx.fillStyle = 'rgb(186, 180, 175)';
        if (up_x !== null) {
          if (down_x !== null) {
            ctx.fillRect(up_x, 0, down_x - up_x, height);
          } else {
            ctx.beginPath();
            ctx.moveTo(up_x, 0);
            ctx.lineTo(up_x, height);
            ctx.stroke();
          }
        }
        if (range_start !== null && range_end !== null) {
          ctx.fillRect(range_start, 0, range_end - range_start, height);
        }
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        for (let x = 0; x < width; x++) {
          ctx.lineTo(x, ((maxima[x] + 1) * height) / 2);
        }
        for (let x = width - 1; x >= 0; x--) {
          ctx.lineTo(x, ((minima[x] + 1) * height) / 2);
        }
        ctx.fill();
        if (playbackPosition !== null) {
          const x = Math.round((playbackPosition / signal.duration) * width);
          ctx.lineWidth = 1.0;
          ctx.strokeStyle = 'rgb(165, 0, 52)';
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
          ctx.strokeStyle = 'white';
          ctx.beginPath();
          ctx.moveTo(x, ((minima[x] + 1) * height) / 2);
          ctx.lineTo(x, ((maxima[x] + 1) * height) / 2);
          ctx.stroke();
        }
      }
    };

    const onDown = (x) => {
      down_x = x;
      up_x = null;
      range_start = null;
      range_end = null;
    };

    const onMove = (x) => {
      up_x = x;
      draw();
    };

    const onUp = () => {
      if (down_x === null) {
        return;
      }
      if (signal instanceof AudioBuffer) {
        if (up_x !== null && up_x !== down_x) {
          if (down_x > up_x) {
            [down_x, up_x] = [up_x, down_x];
          }
          const evt = new Event('selected');
          evt.startPos = (down_x * signal.length) / width / signal.sampleRate;
          evt.endPos = (up_x * signal.length) / width / signal.sampleRate;
          this.dispatchEvent(evt);
          range_start = down_x;
          range_end = up_x;
        } else {
          const evt = new Event('clicked');
          evt.position = (down_x * signal.length) / width / signal.sampleRate;
          this.dispatchEvent(evt);
        }
      }
      down_x = null;
      up_x = null;
      draw();
    };

    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        onDown(event.offsetX);
      }
    });
    canvas.addEventListener('touchstart', (event) => {
      event.preventDefault();
      onDown(event.touches.item(0).pageX - event.target.offsetLeft);
    });

    canvas.addEventListener('mousemove', (event) => {
      onMove(event.offsetX);
    });
    canvas.addEventListener('touchmove', (event) => {
      event.preventDefault();
      onMove(event.touches.item(0).pageX - event.target.offsetLeft);
    });

    canvas.addEventListener('mouseup', (event) => {
      if (event.button === 0) {
        onUp();
      }
    });
    canvas.addEventListener('touchend', (event) => {
      event.preventDefault();
      if (event.touches.length === 0) {
        onUp();
      }
    });

    canvas.addEventListener('mouseleave', (/* event */) => {
      if (down_x === null) {
        up_x = null;
        draw();
      }
    });

    Object.defineProperty(this, 'signal', {
      set(_signal) {
        if (_signal instanceof AudioBuffer) {
          signal = _signal;
          maxima.fill(-1.0);
          minima.fill(1.0);
          for (let c = 0; c < signal.numberOfChannels; c++) {
            const data = signal.getChannelData(c);
            for (let n = 0; n < data.length; n++) {
              const x = Math.round((n * width) / data.length);
              if (data[n] > maxima[x]) {
                maxima[x] = data[n];
              }
              if (data[n] < minima[x]) {
                minima[x] = data[n];
              }
            }
          }
        } else {
          signal = null;
        }
        range_start = null;
        range_end = null;
        draw();
      },
    });

    Object.defineProperty(this, 'selection', {
      get() {
        if (range_start !== null && range_end !== null) {
          return {
            start: (range_start * signal.length) / width / signal.sampleRate,
            end: (range_end * signal.length) / width / signal.sampleRate,
          };
        }
        return null;
      },
    });

    Object.defineProperty(this, 'playbackPosition', {
      set(pos) {
        playbackPosition = pos;
        draw();
      },
    });
  }
}

export function setupPlayerControls(audioProc, sourceconfig) {
  const sources = [];
  let selected_source_idx = null;

  const source_selector_outer = document.getElementById('source-select');
  const itembox = source_selector_outer.children[1];
  source_selector_outer.children[0].addEventListener(
    'click',
    (e) => {
      e.stopPropagation();
      itembox.style.visibility =
        itembox.style.visibility === 'visible' ? 'hidden' : 'visible';
    },
    false,
  );
  document.addEventListener(
    'click',
    () => {
      itembox.style.visibility = 'hidden';
    },
    false,
  );

  const play_button = document.getElementById('play');
  const stop_button = document.getElementById('stop');

  const timeline = new TimeLine(document.getElementById('timelinecanvas'));

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
    selected_source_idx = Number(option.getAttribute('data-source-idx'));
    source_selector_outer.children[0].innerText = option.textContent;
    removeSelectedMarker(itembox);
    option.classList.add('selected');
    audioProc.stop();
    updateState();
    timeline.signal = sources[selected_source_idx];
  }

  function updateSourceText(option, newText) {
    option.innerText = newText;
    if (Number(option.getAttribute('data-source-idx')) === selected_source_idx) {
      source_selector_outer.children[0].innerText = newText;
    }
  }

  async function setupSource(src) {
    const new_option = document.createElement('div');
    new_option.setAttribute('data-source-idx', sources.length);
    itembox.children[0].append(new_option);
    new_option.addEventListener('click', (e) => {
      setSelectedSource(e.target);
    });
    if (src.type === 'remote') {
      new_option.innerText = `${src.label} (loading...)`;
      const new_source_idx = sources.length;
      sources.push(null);
      const req = await window.fetch(src.url);
      // eslint-disable-next-line require-atomic-updates --- no other access at that index
      sources[new_source_idx] = await audioProc.createBuffer(await req.arrayBuffer());
      updateSourceText(new_option, src.label);
      if (new_source_idx === selected_source_idx) {
        timeline.signal = sources[new_source_idx];
      }
    } else if (src.type === 'sine') {
      const f = src.frequency || 440;
      new_option.innerText = src.label || `${f} Hz sine`;
      sources.push({ type: 'sine', frequency: f, gain: src.gain || 0.5 });
    } else if (src.type === 'noise') {
      new_option.innerText = src.label || 'Noise';
      sources.push({
        type: 'noise',
        filter: src.filter || [],
        gain: src.gain || 0.5,
      });
    }
    updateState();
  }

  sourceconfig.forEach(setupSource);

  stop_button.onclick = function (/* event */) {
    audioProc.stop();
    updateState();
  };
  play_button.onclick = function (/* event */) {
    const range = timeline.selection;
    if (range !== null) {
      audioProc.start(sources[selected_source_idx], range.start, range.end);
    } else {
      audioProc.start(sources[selected_source_idx]);
    }
    updateState();
  };

  const optgroup_local = itembox.children[1];
  const local_file_option = optgroup_local.children[0];
  const file_input = document.createElement('input');
  file_input.type = 'file';
  file_input.accept = 'audio/*';
  file_input.addEventListener(
    'change',
    async (e) => {
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
      new_option.addEventListener('click', (e) => {
        setSelectedSource(e.target);
      });
      sources.push(null);

      const contents = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve(e.target.result);
        };
        reader.readAsArrayBuffer(file);
      });
      // eslint-disable-next-line require-atomic-updates --- no other access at that index
      sources[new_source_idx] = await audioProc.createBuffer(contents);
      updateSourceText(new_option, file.name);
      updateState();
    },
    false,
  );

  if (sourceconfig.length === 0) {
    source_selector_outer.children[0].innerText = 'input signal';
  } else {
    setSelectedSource(itembox.children[0].children[0]);
  }

  local_file_option.addEventListener('click', () => {
    file_input.click();
  });

  timeline.addEventListener('clicked', (event) => {
    audioProc.stop();
    audioProc.start(sources[selected_source_idx], event.position);
    updateState();
  });
  timeline.addEventListener('selected', (event) => {
    audioProc.stop();
    audioProc.start(sources[selected_source_idx], event.startPos, event.endPos);
    updateState();
  });

  const updatePlaybackPosition = () => {
    timeline.playbackPosition = audioProc.position;
    setTimeout(() => requestAnimationFrame(updatePlaybackPosition), 40);
  };
  updatePlaybackPosition();
}
