// Abertura animada: um vídeo curto (1 s) quando o app abre do zero. Toque na tela pula.
// Fica desligada em testes automáticos (navigator.webdriver) e quando a pessoa desliga nos Ajustes.
const KEY = 'calc12c-splash';

export function splashEnabled() {
  try {
    return window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSplashEnabled(on) {
  try {
    window.localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

const seenThisSession = () => {
  try {
    return window.sessionStorage.getItem(KEY) === 'seen';
  } catch {
    return false;
  }
};

export function initSplash() {
  const box = document.getElementById('splash');
  if (!box) return;
  const forced = window.location.search.includes('splash=1');
  const video = box.querySelector('video');
  if (!video || (!forced && (!splashEnabled() || navigator.webdriver || seenThisSession()))) {
    box.remove();
    return;
  }
  try {
    window.sessionStorage.setItem(KEY, 'seen');
  } catch {
    /* ignora */
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    box.classList.add('out');
    window.setTimeout(() => box.remove(), 350);
  };
  box.classList.add('on');
  box.addEventListener('pointerdown', finish);
  video.addEventListener('ended', finish);
  video.addEventListener('error', finish);
  window.setTimeout(finish, 2500); // rede de segurança: nunca prende o app
  const p = video.play();
  if (p && typeof p.catch === 'function') p.catch(finish);
}
