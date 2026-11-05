const splash = document.querySelector('#splash');
const login = document.querySelector('#login');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const destination = '/learning.html' + location.search + location.hash;
function start() {
  document.body.classList.remove('ready','leaving');
  login.inert = true;
  splash.inert = false;
  const logo = splash.querySelector('img');
  logo.getAnimations().forEach(animation => { animation.currentTime = 0; });
  setTimeout(() => {
    document.body.classList.add('ready');
    splash.inert = true;
    login.inert = false;
  }, reduced ? 350 : 2050);
}
function enter() {
  if (login.inert) return;
  login.inert = true;
  if (!document.startViewTransition) document.body.classList.add('leaving');
  setTimeout(() => location.assign(destination), document.startViewTransition || reduced ? 0 : 400);
}
document.querySelector('form').addEventListener('submit', event => {
  event.preventDefault();
  const userId = document.querySelector('#user-id');
  const password = document.querySelector('#password');
  const error = document.querySelector('.login-error');
  if (userId.value === 'admin' && password.value === '0000') {
    error.textContent = '';
    enter();
    return;
  }
  error.textContent = '아이디 또는 비밀번호를 확인해 주세요.';
  (userId.value !== 'admin' ? userId : password).focus();
});
document.querySelector('#trial').addEventListener('click', enter);
document.querySelector('.back').addEventListener('click', start);
if (new URLSearchParams(location.search).has('scenario') || new URLSearchParams(location.search).has('checkpoint')) location.replace(destination);
else window.addEventListener('pageshow', start);
