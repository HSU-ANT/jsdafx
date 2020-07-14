import EventTarget from 'event-target'; // polyfill for Safari

function FunctionGraph_(fgcanvas) {
  const width = fgcanvas.width;
  const height = fgcanvas.height;
  const ctx = fgcanvas.getContext('2d');

  let logx = true;
  let xmax = 20000;
  let xmin = 50;
  let xlabel = null;

  let ymax = 0;
  let ymin = -80;
  let ylabel = null;

  let markers = [];
  let move_marker = null;
  let movedeltaX = null;
  let movedeltaY = null;

  let x_margin_left = 30;
  const x_margin_right = 10;
  let inner_width = width - x_margin_left - x_margin_right;

  const y_margin_top = 10;
  let y_margin_bottom = 17;
  let inner_height = height - y_margin_top - y_margin_bottom;

  let axes_image_data = null;

  const x_pos_to_val_lin = function (x) {
    return (xmax-xmin) * (x-x_margin_left) / inner_width + xmin;
  };

  const x_pos_to_val_log = function (x) {
    return xmin * Math.pow(10, Math.log10(xmax/xmin) * (x-x_margin_left) / inner_width);
  };

  let x_pos_to_val = x_pos_to_val_log;

  const x_val_to_pos_lin = function (x) {
    return (x - xmin) * inner_width / (xmax - xmin) + x_margin_left;
  };

  const x_val_to_pos_log = function (x) {
    return Math.log10(x / xmin) / Math.log10(xmax/xmin) * inner_width + x_margin_left;
  };

  let x_val_to_pos = x_val_to_pos_log;

  const y_val_to_pos = function (y) {
    return y_margin_top + inner_height / (ymin-ymax) * (y-ymax);
  };

  const y_pos_to_val = function (y) {
    return ymax + (y - y_margin_top) * (ymin-ymax) / inner_height;
  };

  const niceCeil = function (x) {
    const f = Math.pow(10, Math.floor(Math.log10(x)));
    x /= f;
    if (x > 5) {
      x = 10;
    } else if (x > 2) {
      x = 5;
    } else if (x > 1) {
      x = 2;
    }
    return x * f;
  };

  const drawAxis = function () {
    ctx.clearRect(0, 0, width, height);
    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'end';
    const xstep = niceCeil((xmax-xmin) / inner_width * 30);
    const ystep = niceCeil((ymax-ymin) / inner_height * 20);
    const ydigits = ystep >= 1 ? 0 : -Math.floor(Math.log10(ystep));
    for (let y=Math.floor(ymax/ystep)*ystep; y >= ymin; y -= ystep) {
      ctx.strokeStyle = 'rgb(0, 0, 0)';
      ctx.fillText(y.toFixed(ydigits), x_margin_left-2, y_val_to_pos(y));
    }
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.setTransform(0, -1, 1, 0, 0, 0);
    if (ylabel) {
      ctx.fillText(ylabel, -(inner_height/2 + y_margin_top), 0);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (logx) {
      ctx.strokeStyle = 'rgb(0, 0, 0)';
      for (let x=Math.pow(10, Math.ceil(Math.log10(xmin))); x <= xmax; x *= 10) {
        ctx.fillText(x, x_val_to_pos(x), height-y_margin_bottom+2);
      }
    } else {
      ctx.strokeStyle = 'rgb(0, 0, 0)';
      const xdigits = xstep >= 1 ? 0 : -Math.floor(Math.log10(xstep));
      for (let x=Math.ceil(xmin/xstep)*xstep; x <= xmax; x += xstep) {
        ctx.fillText(x.toFixed(xdigits), x_val_to_pos(x), height-y_margin_bottom+2);
      }
    }
    if (xlabel) {
      ctx.fillText(
        xlabel,
        x_margin_left+(width-x_margin_left)/2,
        height-y_margin_bottom+16,
      );
    }

    for (let y=Math.floor(ymax/ystep)*ystep; y >= ymin; y -= ystep) {
      ctx.strokeStyle = 'rgb(100, 100, 100)';
      ctx.beginPath();
      ctx.moveTo(x_val_to_pos(xmin), y_val_to_pos(y));
      ctx.lineTo(x_val_to_pos(xmax), y_val_to_pos(y));
      ctx.stroke();
    }
    if (logx) {
      let xbase = Math.pow(10, Math.floor(Math.log10(xmin)));
      let x = Math.ceil(xmin / xbase) * xbase;
      ctx.strokeStyle = 'rgb(100, 100, 100)';
      while (x <= xmax) {
        ctx.beginPath();
        const xc = x_val_to_pos(x);
        ctx.moveTo(xc, y_val_to_pos(ymax));
        ctx.lineTo(xc, y_val_to_pos(ymin));
        ctx.stroke();
        x += xbase;
        if (x >= 9.99 * xbase) {
          xbase *= 10;
        }
      }
    } else {
      for (let x=Math.ceil(xmin/xstep)*xstep; x <= xmax; x += xstep) {
        ctx.beginPath();
        const xc = x_val_to_pos(x);
        ctx.moveTo(xc, y_val_to_pos(ymax));
        ctx.lineTo(xc, y_val_to_pos(ymin));
        ctx.stroke();
      }
    }
    ctx.rect(
      x_val_to_pos(xmin),
      y_val_to_pos(ymin),
      x_val_to_pos(xmax)-x_val_to_pos(xmin),
      y_val_to_pos(ymax)-y_val_to_pos(ymin),
    );
    ctx.stroke();
    axes_image_data = ctx.getImageData(0, 0, width, height);
  };

  this.drawData = function (xdata, ydata) {
    ctx.putImageData(axes_image_data, 0, 0);
    ctx.strokeStyle = 'rgb(0, 0, 0)';
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      x_margin_left,
      y_margin_top,
      width-x_margin_left-x_margin_right,
      height-y_margin_bottom-y_margin_top,
    );
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(x_val_to_pos(xdata[0]), y_val_to_pos(ydata[0]));
    for (let i = 1; i < ydata.length; i++) {
      ctx.lineTo(x_val_to_pos(xdata[i]), y_val_to_pos(ydata[i]));
    }
    ctx.stroke();
    ctx.restore();
  };

  this.drawMarkers = function (_markers) {
    ctx.save();
    ctx.fillStyle = 'rgb(165, 0, 52)';
    markers = [];
    for (const m of _markers) {
      markers.push([x_val_to_pos(m[0]), y_val_to_pos(m[1])]);
      ctx.beginPath();
      ctx.arc(x_val_to_pos(m[0]), y_val_to_pos(m[1]), 4, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();
  };

  Object.defineProperty(this, 'xlim', {
    get() { return [xmin, xmin]; },
    set(xlim) {
      [xmin, xmax] = xlim;
      drawAxis();
    },
  });
  Object.defineProperty(this, 'ylim', {
    get() { return [ymin, ymin]; },
    set(ylim) {
      [ymin, ymax] = ylim;
      drawAxis();
    },
  });
  Object.defineProperty(this, 'logx', {
    get() { return logx; },
    set(_logx) {
      logx = _logx;
      if (logx) {
        x_pos_to_val = x_pos_to_val_log;
        x_val_to_pos = x_val_to_pos_log;
      } else {
        x_pos_to_val = x_pos_to_val_lin;
        x_val_to_pos = x_val_to_pos_lin;
      }
      drawAxis();
    },
  });
  Object.defineProperty(this, 'xlabel', {
    get() { return xlabel; },
    set(_xlabel) {
      xlabel = _xlabel;
      y_margin_bottom = xlabel ? 30 : 16;
      inner_height = height - y_margin_top - y_margin_bottom;
      drawAxis();
    },
  });
  Object.defineProperty(this, 'ylabel', {
    get() { return ylabel; },
    set(_ylabel) {
      ylabel = _ylabel;
      x_margin_left = ylabel ? 44 : 30;
      inner_width = width - x_margin_left - x_margin_right;
      drawAxis();
    },
  });

  const onDown = (x, y, rmax) => {
    move_marker = null;
    let best_d = rmax;
    for (let i=0; i < markers.length; i++) {
      const m = markers[i];
      const d = Math.hypot(x-m[0], y-m[1]);
      if (d <= best_d) {
        move_marker = i;
        best_d = d;
      }
    }
    if (move_marker !== null) {
      movedeltaX = x - markers[move_marker][0];
      movedeltaY = y - markers[move_marker][1];
    }
  };

  fgcanvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) {
      return;
    }
    onDown(event.offsetX, event.offsetY, 6);
  });

  fgcanvas.addEventListener('touchstart', (event) => {
    event.preventDefault();
    if (move_marker !== null) {
      return;
    }
    onDown(
      event.touches.item(0).pageX-event.target.offsetLeft,
      event.touches.item(0).pageY-event.target.offsetTop,
      40,
    );
  });

  fgcanvas.addEventListener('mouseup', (event) => {
    if (event.button !== 0) {
      return;
    }
    move_marker = null;
  });

  fgcanvas.addEventListener('touchend', (event) => {
    event.preventDefault();
    if (event.touches.length === 0) {
      move_marker = null;
    }
  });

  const onMove = (x, y) => {
    if (move_marker === null) {
      return;
    }
    const evt = new Event('markermove');
    evt.marker = move_marker;
    evt.valX = x_pos_to_val(x - movedeltaX);
    evt.valY = y_pos_to_val(y - movedeltaY);
    this.dispatchEvent(evt);
  };

  fgcanvas.addEventListener('mousemove', (event) => {
    if (event.buttons !== 1) {
      return;
    }
    onMove(event.offsetX, event.offsetY);
  });

  fgcanvas.addEventListener('touchmove', (event) => {
    event.preventDefault();
    onMove(
      event.touches.item(0).pageX - event.target.offsetLeft,
      event.touches.item(0).pageY - event.target.offsetTop,
    );
  });
}

export class FunctionGraph extends EventTarget {
  constructor(fgcanvas) {
    super();
    FunctionGraph_.call(this, fgcanvas);
  }
}

export function SignalGraph(audioProc, fgcanvas) {
  const graph = new FunctionGraph(fgcanvas);
  let drawWave = false;
  let freqLinear = false;
  function drawSignal() {
    setTimeout(() => requestAnimationFrame(drawSignal), 40);
    if (drawWave) {
      const data = audioProc.getTimeDomainData();
      graph.drawData(audioProc.timeIndices, data);
    } else {
      const data = audioProc.getFrequencyDomainData();
      graph.drawData(audioProc.frequencies, data);
    }
  }
  Object.defineProperty(this, 'drawWave', {
    get() { return drawWave; },
    set(b) {
      drawWave = b;
      if (b) {
        graph.logx = false;
        graph.ylim = [-1, 1];
        graph.xlim= [0, audioProc.timeIndices.length-1];
        graph.xlabel = 'time in samples';
        graph.ylabel = 'amplitude';
      } else {
        graph.xlim = [50, 20000];
        graph.logx = !freqLinear;
        graph.ylim = [-130, 0];
        graph.xlabel = 'frequency in Hz';
        graph.ylabel = 'magnitude in dB';
      }
    },
  });
  Object.defineProperty(this, 'freqLinear', {
    get() { return freqLinear; },
    set(b) {
      freqLinear = b;
      if (!drawWave) {
        graph.logx = !freqLinear;
      }
    },
  });
  this.drawWave = false;
  drawSignal();
}
