import { makeFunctionGraph, setupAudio, setupPlayerControls } from './common.js';

window.onload = () => {
  var graph = makeFunctionGraph("axiscanvas", "funccanvas");
  graph.ylim(-130, 0);

  Promise.all([
    setupAudio('qdsproc.js', 'qds-processor'),
    window.fetch('audio/unfinite_function.mp3')
  ]).then(function([audioProc, audio2Binary]) {
    audioProc.proc.w = 16;
    audioProc.proc.dither = true;
    audioProc.proc.dithertype = "rect";
    audioProc.proc.noiseshaping = true;
    audioProc.proc.noiseshapingfilter = 1;

    setupPlayerControls(audioProc, undefined, audio2Binary.arrayBuffer());

    var frequencies = new Float32Array(audioProc.getFrequencyDomainData());
    for (var i = 0; i < frequencies.length; i++) {
      frequencies[i] = i * 22050 / (frequencies.length-1);
    }
    var timeindices = new Float32Array(audioProc.getTimeDomainData());
    for (var i = 0; i < timeindices.length; i++) {
      timeindices[i] = i;
    }
    var drawWave = false;
    function drawSignal() {
      setTimeout(() => requestAnimationFrame(drawSignal), 40);
      if (drawWave) {
        var data = audioProc.getTimeDomainData();
        graph.drawData(timeindices, data);
      } else {
        var data = audioProc.getFrequencyDomainData();
        graph.drawData(frequencies, data);
      }
    }
    drawSignal();

    var cblinear = document.getElementById("linear");
    cblinear.checked = false;
    graph.logx(true);
    cblinear.onchange = function (event) {
      if (!document.getElementById("wave").checked) {
        graph.logx(!event.target.checked);
      }
    };
    var cbwave = document.getElementById("wave");
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
          document.getElementById("diagram").src = "images/qds/ns5.png";
        } else {
          document.getElementById("diagram").src = "images/qds/ns5b.png";
        }
      } else {
        if (document.getElementById("noiseshaping").checked) {
          document.getElementById("diagram").src = "images/qds/ns5c.png";
        } else {
          document.getElementById("diagram").src = "images/qds/ns5d.png";
        }
      }
    }
    document.getElementById("dither").checked = true;
    document.getElementById("dither").onchange = function (event) {
      audioProc.proc.dither = event.target.checked;
      updateDiagram();
    };
    document.getElementById("noiseshaping").checked = true;
    document.getElementById("noiseshaping").onchange = function (event) {
      audioProc.proc.noiseshaping = event.target.checked;
      updateDiagram();
    };
    document.getElementById("dithertype").value = "rect";
    document.getElementById("dithertype").onchange = function (event) {
      audioProc.proc.dithertype = event.target.value;
    };
    document.getElementById("noiseshapingfilter").value = 1;
    document.getElementById("noiseshapingfilter").onchange = function (event) {
      audioProc.proc.noiseshapingfilter = event.target.value;
    };
  });
}
