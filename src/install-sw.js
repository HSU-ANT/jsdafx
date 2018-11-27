if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('sw.js', { type: 'module' });
    } catch (err) {
      console.warn('ServiceWorker registration failed: ', err);
    }
  });
}

export {};
