const splash = document.querySelector('#splash');
const login = document.querySelector('#login');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const destination = '/learning.html' + location.search + location.hash;
const memberKey = 'jei-prototype-member-entry';
const memberDay = () => new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Seoul'}).format(new Date());
let member = null;
try { member = JSON.parse(localStorage.getItem(memberKey)); } catch {}
function rememberMember() {
  try { localStorage.setItem(memberKey, JSON.stringify(member)); } catch {}
}
const memberStart = document.querySelector('#member-start');
function enterMember(mode) {
  const url = new URL(destination, location.href);
  url.searchParams.set('memberEntry', mode);
  enter(url.pathname + url.search + url.hash);
}
function showManagementChoice() {
  showEntry('management', '학습 관리 유형 선택', `<fieldset class="management-options" aria-label="학습 관리 유형">
    ${['대면 학습', '비대면 학습', '셀프 학습'].map(label => `<label><input type="radio" name="management" value="${label}"><span>${label}</span></label>`).join('')}
  </fieldset><button type="button" class="submit management-confirm" disabled>확인</button>`);
  const confirm = entryDialog.querySelector('.management-confirm');
  entryDialog.querySelector('.management-options').addEventListener('change', () => { confirm.disabled = false; });
  confirm.addEventListener('click', () => {
    const choice = entryDialog.querySelector('input[name="management"]:checked');
    if (!choice) return;
    member = { management: choice.value, firstDay: memberDay(), signedIn: true };
    rememberMember();
    entryDialog.close();
    enterMember('new');
  });
}
memberStart.querySelector('.submit').addEventListener('click', () => {
  enterMember(memberDay() !== member.firstDay ? 'return-later' : 'return');
});
memberStart.querySelector('.member-logout').addEventListener('click', () => {
  member.signedIn = false;
  rememberMember();
  start();
});
function start() {
  document.body.classList.remove('ready','leaving');
  login.inert = true;
  splash.inert = false;
  memberStart.hidden = !member?.signedIn;
  if (member?.signedIn) return;
  const logo = splash.querySelector('img');
  logo.getAnimations().forEach(animation => { animation.currentTime = 0; });
  setTimeout(() => {
    document.body.classList.add('ready');
    splash.inert = true;
    login.inert = false;
  }, reduced ? 350 : 2050);
}
function enter(url = destination) {
  if (login.inert && splash.inert) return;
  splash.inert = true;
  login.inert = true;
  if (!document.startViewTransition) document.body.classList.add('leaving');
  setTimeout(() => location.assign(url), document.startViewTransition || reduced ? 0 : 400);
}
login.querySelector('form').addEventListener('submit', event => {
  event.preventDefault();
  const userId = document.querySelector('#user-id');
  const password = document.querySelector('#password');
  const error = document.querySelector('.login-error');
  if (userId.value === 'admin' && password.value === '0000') {
    error.textContent = '';
    if (!member?.management) { showManagementChoice(); return; }
    member.signedIn = true;
    rememberMember();
    enterMember(memberDay() !== member.firstDay ? 'return-later' : 'return');
    return;
  }
  error.textContent = '아이디 또는 비밀번호를 확인해 주세요.';
  (userId.value !== 'admin' ? userId : password).focus();
});
document.querySelector('#trial').addEventListener('click', () => openTrial());
document.querySelector('.back').addEventListener('click', start);
if (new URLSearchParams(location.search).has('scenario') || new URLSearchParams(location.search).has('checkpoint')) location.replace(destination);
else window.addEventListener('pageshow', start);
