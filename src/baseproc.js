class BaseProcessor extends AudioWorkletProcessor {
  constructor(properties) {
    super();

    const _this = this;
    this.port.onmessage = (event) => {
      if (event.data.action === 'set-property') {
        _this[event.data.param] = event.data.value;
      } else if (event.data.action === 'list-properties') {
        _this.port.postMessage({ response: 'list-properties', properties: properties });
      }
    };
  }
}

export { BaseProcessor };
