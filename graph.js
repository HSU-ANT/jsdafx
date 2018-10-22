export function makeFunctionGraph(axisid, funcid) {
  const fgcanvas = document.getElementById(funcid);
  const width = fgcanvas.width;
  const height = fgcanvas.height;
  const fgctx = fgcanvas.getContext('2d');

  let logx = true;
  let xmax = 20000;
  let xmin = 50;
  let _xlabel = null;

  let ymax = 0;
  let ymin = -80;
  let _ylabel = null;

  let x_margin_left = 30;
  const y_margin_top = 10;
  let y_margin_bottom = 17;

  const x_pos_to_val_lin = function (x) {
    return (xmax-xmin) * (x-x_margin_left) / (width-x_margin_left) + xmin;
  };

  const x_pos_to_val_log = function (x) {
    return xmin * Math.pow(10, Math.log10(xmax/xmin) *
                               (x-x_margin_left) / (width-x_margin_left));
  };

  let x_pos_to_val = x_pos_to_val_log; // eslint-disable-line no-unused-vars

  const x_val_to_pos_lin = function (x) {
    return (x - xmin) * (width-x_margin_left) / xmax + x_margin_left;
  };

  const x_val_to_pos_log = function (x) {
    return Math.log10(x / xmin) / Math.log10(xmax/xmin) * (width-x_margin_left) +
           x_margin_left;
  };

  let x_val_to_pos = x_val_to_pos_log;

  const y_val_to_pos = function (y) {
    return y_margin_top + (height-y_margin_top-y_margin_bottom) / (ymin-ymax) * (y-ymax);
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
    const canvas = document.getElementById(axisid);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'end';
    const xstep = niceCeil((xmax-xmin) / (width-x_margin_left) * 30);
    const ystep = niceCeil((ymax-ymin) / (height-y_margin_bottom-y_margin_top) * 20);
    for (let y=Math.floor(ymax/ystep)*ystep; y >= ymin; y -= ystep) {
      ctx.strokeStyle = 'rgb(0, 0, 0)';
      ctx.fillText(y, x_margin_left-2, y_val_to_pos(y));
    }
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.setTransform(0, -1, 1, 0, 0, 0);
    if (_ylabel) {
      ctx.fillText(_ylabel, -((height-y_margin_bottom-y_margin_top)/2 + y_margin_top), 0);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (logx) {
      ctx.strokeStyle = 'rgb(0, 0, 0)';
      for (let x=Math.pow(10, Math.ceil(Math.log10(xmin))); x <= xmax; x *= 10) {
        ctx.fillText(x, x_val_to_pos(x), height-y_margin_bottom+2);
      }
    } else {
      ctx.strokeStyle = 'rgb(0, 0, 0)';
      for (let x=Math.ceil(xmin/xstep)*xstep; x <= xmax; x += xstep) {
        ctx.fillText(x, x_val_to_pos(x), height-y_margin_bottom+2);
      }
    }
    if (_xlabel) {
      ctx.fillText(_xlabel, x_margin_left+(width-x_margin_left)/2,
        height-y_margin_bottom+16);
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
    ctx.rect(x_val_to_pos(xmin), y_val_to_pos(ymin),
      x_val_to_pos(xmax)-x_val_to_pos(xmin), y_val_to_pos(ymax)-y_val_to_pos(ymin));
    ctx.stroke();
  };

  const drawData = function (xdata, ydata) {
    fgctx.clearRect(0, 0, width, height);
    fgctx.strokeStyle = 'rgb(0, 0, 0)';
    fgctx.save();
    fgctx.beginPath();
    fgctx.rect(x_margin_left, y_margin_top, width-x_margin_left,
      height-y_margin_bottom-y_margin_top);
    fgctx.clip();
    fgctx.beginPath();
    fgctx.moveTo(x_val_to_pos(xdata[0]), y_val_to_pos(ydata[0]));
    for (let i = 1; i < ydata.length; i++) {
      fgctx.lineTo(x_val_to_pos(xdata[i]), y_val_to_pos(ydata[i]));
    }
    fgctx.stroke();
    fgctx.restore();
  };

  const set_logx = function (_logx) {
    logx = _logx;
    if (logx) {
      x_pos_to_val = x_pos_to_val_log;
      x_val_to_pos = x_val_to_pos_log;
    } else {
      x_pos_to_val = x_pos_to_val_lin;
      x_val_to_pos = x_val_to_pos_lin;
    }
    drawAxis();
  };

  return {
    drawData: drawData,
    xlim(_xmin, _xmax) {
      xmin = _xmin;
      xmax = _xmax;
      drawAxis();
    },
    ylim(_ymin, _ymax) {
      ymin = _ymin;
      ymax = _ymax;
      drawAxis();
    },
    logx(_logx) {
      set_logx(_logx);
    },
    get xlabel() { return _xlabel; },
    set xlabel(xlabel) {
      _xlabel = xlabel;
      y_margin_bottom = _xlabel ? 30 : 16;
      drawAxis();
    },
    get ylabel() { return _ylabel; },
    set ylabel(ylabel) {
      _ylabel = ylabel;
      x_margin_left = _ylabel ? 44 : 30;
      drawAxis();
    },
  };
}
