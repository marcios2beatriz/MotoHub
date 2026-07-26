// Web Worker para manter a captura do GPS ativa no celular mesmo em segundo plano
let timer = null;

self.onmessage = function (e) {
  if (e.data === 'start') {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      self.postMessage('tick');
    }, 2000);
  } else if (e.data === 'stop') {
    if (timer) clearInterval(timer);
    timer = null;
  }
};