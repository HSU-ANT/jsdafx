export function makeFunctionGraph(axisid, funcid) {
  const fgcanvas = document.getElementById(funcid);
  const width = fgcanvas.width;
  const height = fgcanvas.height;
  const fgctx = fgcanvas.getContext('2d');

  let logx = true;
  let xmax = 20000;
  let xmin = 50;

  let ymax = 0;
  let ymin = -80;

  const xoffset = 25;
  const yoffset = 25;

  const x_pos_to_val_lin = function (x) {
    return (xmax-xmin) * (x-xoffset) / (width-xoffset) + xmin;
  };

  const x_pos_to_val_log = function (x) {
    return xmin * Math.pow(10, Math.log10(xmax/xmin) * (x-xoffset) / (width-xoffset));
  };

  let x_pos_to_val = x_pos_to_val_log;

  const x_val_to_pos_lin = function (x) {
    return (x - xmin) * (width-xoffset) / xmax + xoffset;
  };

  const x_val_to_pos_log = function (x) {
    return Math.log10(x / xmin) / Math.log10(xmax/xmin) * (width-xoffset) + xoffset;
  };

  let x_val_to_pos = x_val_to_pos_log;

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
  }

  const y_val_to_pos = function (y) {
    return 10 + (height-10-yoffset) / (ymin-ymax) * (y-ymax);
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
  }

  const drawAxis = function () {
    const canvas = document.getElementById(axisid);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    //ctx.font = '10px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'end';
    const xstep = niceCeil((xmax-xmin) / (width-xoffset) * 30);
    const ystep = niceCeil((ymax-ymin) / (height-yoffset-10) * 20);
    for (let y=Math.floor(ymax/ystep)*ystep; y >= ymin; y -= ystep) {
      ctx.strokeStyle = 'rgb(0, 0, 0)';
      ctx.strokeText(y, xoffset-2, y_val_to_pos(y));
      ctx.strokeStyle = 'rgb(100, 100, 100)';
    }
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    if (logx) {
      ctx.strokeStyle = 'rgb(0, 0, 0)';
      for (let x=Math.pow(10, Math.ceil(Math.log10(xmin))); x <= xmax; x *= 10) {
        ctx.strokeText(x, x_val_to_pos(x), height-yoffset+2);
      }
    } else {
      ctx.strokeStyle = 'rgb(0, 0, 0)';
      for (let x=Math.ceil(xmin/xstep)*xstep; x <= xmax; x += xstep) {
        ctx.strokeText(x, x_val_to_pos(x), height-yoffset+2);
      }
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
    ctx.rect(x_val_to_pos(xmin), y_val_to_pos(ymin), x_val_to_pos(xmax)-x_val_to_pos(xmin), y_val_to_pos(ymax)-y_val_to_pos(ymin));
    ctx.stroke();
  }

  fgctx.rect(xoffset, 10, width-xoffset, height-yoffset-10);
  fgctx.clip();

  const drawData = function (xdata, ydata) {
    fgctx.clearRect(0, 0, width, height);
    fgctx.strokeStyle = 'rgb(0, 0, 0)';
    fgctx.beginPath();
    fgctx.moveTo(x_val_to_pos(xdata[0]), y_val_to_pos(ydata[0]));
    for (let i = 1; i < ydata.length; i++) {
      fgctx.lineTo(x_val_to_pos(xdata[i]), y_val_to_pos(ydata[i]));
    }
    fgctx.stroke();
  }

  return {
    drawData: drawData,
    xlim: function(_xmin, _xmax) {
      xmin = _xmin;
      xmax = _xmax;
      drawAxis();
    },
    ylim: function(_ymin, _ymax) {
      ymin = _ymin;
      ymax = _ymax;
      drawAxis();
    },
    logx: function(_logx) {
      set_logx(_logx);
    },
  }
};
