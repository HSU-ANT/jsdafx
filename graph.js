export function FunctionGraph(fgcanvas) {
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

  let x_margin_left = 30;
  const y_margin_top = 10;
  let y_margin_bottom = 17;

  let axes_image_data = null;

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
    if (ylabel) {
      ctx.fillText(ylabel, -((height-y_margin_bottom-y_margin_top)/2 + y_margin_top), 0);
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
    if (xlabel) {
      ctx.fillText(xlabel, x_margin_left+(width-x_margin_left)/2,
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
    axes_image_data = ctx.getImageData(0, 0, width, height);
  };

  this.drawData = function (xdata, ydata) {
    ctx.putImageData(axes_image_data, 0, 0);
    ctx.strokeStyle = 'rgb(0, 0, 0)';
    ctx.save();
    ctx.beginPath();
    ctx.rect(x_margin_left, y_margin_top, width-x_margin_left,
      height-y_margin_bottom-y_margin_top);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(x_val_to_pos(xdata[0]), y_val_to_pos(ydata[0]));
    for (let i = 1; i < ydata.length; i++) {
      ctx.lineTo(x_val_to_pos(xdata[i]), y_val_to_pos(ydata[i]));
    }
    ctx.stroke();
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
      drawAxis();
    },
  });
  Object.defineProperty(this, 'ylabel', {
    get() { return ylabel; },
    set(_ylabel) {
      ylabel = _ylabel;
      x_margin_left = ylabel ? 44 : 30;
      drawAxis();
    },
  });
}
