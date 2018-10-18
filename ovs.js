import { makeFunctionGraph, setupAudio, setupPlayerControls } from './common.js';

window.addEventListener("load", () => {

  const graph = makeFunctionGraph("axiscanvas", "funccanvas");
  graph.ylim(-130, 0);

  Promise.all([
    setupAudio('ovsproc.js', 'ovs-processor'),
    window.fetch('audio/unfinite_function.mp3')
  ]).then(function([audioProc, audio2Binary]) {
    audioProc.proc.w = 16;
    audioProc.proc.dithertype = "rect";
    audioProc.proc.noiseshapingfilter = 1;
    audioProc.proc.oversamplingfactor = 4;


    setupPlayerControls(audioProc, undefined, audio2Binary.arrayBuffer());

    const frequencies = new Float32Array(audioProc.getFrequencyDomainData());
    for (let i = 0; i < frequencies.length; i++) {
      frequencies[i] = i * 22050 / (frequencies.length-1);
    }
    const timeindices = new Float32Array(audioProc.getTimeDomainData());
    for (let i = 0; i < timeindices.length; i++) {
      timeindices[i] = i;
    }
    let drawWave = false;
    function drawSignal() {
      setTimeout(() => requestAnimationFrame(drawSignal), 40);
      if (drawWave) {
        graph.drawData(timeindices, audioProc.getTimeDomainData());
      } else {
        graph.drawData(frequencies, audioProc.getFrequencyDomainData());
      }
    }
    drawSignal();

    const cblinear = document.getElementById("linear");
    cblinear.checked = false;
    graph.logx(true);
    cblinear.onchange = function (event) {
      if (!document.getElementById("wave").checked) {
        graph.logx(!event.target.checked);
      }
    };
    const cbwave = document.getElementById("wave");
    cbwave.checked = false;
    cbwave.onchange = function (event) {
      drawWave = event.target.checked;
      if (drawWave) {
        graph.logx(false);
        graph.ylim(-1, 1);
        graph.xlim(0, timeindices.length-1);
      } else {
        graph.xlim(50, 20000);
        graph.logx(!cblinear.checked);
        graph.ylim(-130, 0);
      }
    };
    document.getElementById("wordlength").value = 16;
    document.getElementById("wordlength").onchange = function (event) {
      audioProc.proc.w = event.target.value;
    };
    function updateDiagram() {
      if (document.getElementById("dither").checked) {
        if (document.getElementById("noiseshaping").checked) {
          document.getElementById("diagram").src = "images/ovs/ns5.png";
        } else {
          document.getElementById("diagram").src = "images/ovs/ns5b.png";
        }
      } else {
        if (document.getElementById("noiseshaping").checked) {
          document.getElementById("diagram").src = "images/ovs/ns5c.png";
        } else {
          document.getElementById("diagram").src = "images/ovs/ns5d.png";
        }
      }
    }
    function setDither(event) {
      if (document.getElementById("dither").checked) {
        audioProc.proc.dithertype = document.getElementById("dithertype").value;
      } else {
        audioProc.proc.dithertype = 'none';
      }
      updateDiagram();
    }
    function setNoiseShaper(event) {
      if (document.getElementById("noiseshaping").checked) {
        audioProc.proc.noiseshapingfilter = document.getElementById("noiseshapingfilter").value;
      } else {
        audioProc.proc.noiseshapingfilter = 0;
      }
      updateDiagram();
    }
    document.getElementById("dither").checked = true;
    document.getElementById("dither").onchange = setDither;
    document.getElementById("noiseshaping").checked = true;
    document.getElementById("noiseshaping").onchange = setNoiseShaper;
    document.getElementById("dithertype").value = "rect";
    document.getElementById("dithertype").onchange = setDither;
    document.getElementById("noiseshapingfilter").value = 1;
    document.getElementById("noiseshapingfilter").onchange = setNoiseShaper;
    document.getElementById("oversamplingfactor").value = 4;
    document.getElementById("oversamplingfactor").onchange = function (event) {
      audioProc.proc.oversamplingfactor = event.target.value;
    };
  }).catch(e => console.log(e));
});
