export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '?';

export function injectVersion() {
  const el = document.createElement('span');
  el.className = 'app-version';
  el.textContent = `v${APP_VERSION}`;

  const topnav = document.querySelector('.topnav');
  if (topnav) {
    topnav.appendChild(el);
  } else {
    el.classList.add('app-version-fixed');
    document.body.appendChild(el);
  }
}
