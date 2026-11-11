const entryDialog = document.querySelector('#entry-dialog');
const gradeArrowIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const gradeTopics = [
  '5까지 수를 알아요.', '9까지의 수', '20까지 수를 알아요', '10까지의 덧셈과 뺄셈',
  '(두 자리 수) + (두 자리 수)<br>(두 자리 수) − (두 자리 수)',
  '곱셈구구', '분모가 같은 분수의 덧셈과 뺄셈', '분수의 사칙연산',
  '(소수) ÷ (소수)', '유리수의 사칙연산'
];
const gradeLetters = 'ABCDEFGHIJ';
let birthYear = '';
let recommendation = { center: 0, lower: -1, upper: -1 };
let selectedGrade = 0;
let entryStep = '';
const trialDate = new Intl.DateTimeFormat('en', {year: 'numeric', month: 'numeric', timeZone: 'Asia/Seoul'});

const gradeAgeRanges = [
  '만 2.5세 – 3.5세', '만 3.5세 – 4.5세', '만 4.5세 – 5.5세',
  '만 5.5세 – 초등학교 1학년 1학기',
  '초등학교 1학년 2학기 – 초등학교 2학년 1학기',
  '초등학교 2학년 2학기 – 초등학교 3학년 1학기',
  '초등학교 3학년 2학기 – 초등학교 4학년 1학기',
  '초등학교 4학년 2학기 – 초등학교 5학년 1학기',
  '초등학교 5학년 2학기 – 초등학교 6학년 1학기',
  '초등학교 6학년 2학기 – 중학교 1학년'
];
const ageDialog = document.createElement('dialog');
ageDialog.id = 'grade-age-dialog';
ageDialog.setAttribute('aria-labelledby', 'grade-age-title');
ageDialog.innerHTML = `<form method="dialog"><button class="entry-close" aria-label="닫기">×</button></form>
  <h2 id="grade-age-title">등급별 적정 연령</h2>
  <table>
    <thead><tr><th scope="col">등급</th><th scope="col">대상 연령</th></tr></thead>
    <tbody>${gradeAgeRanges.map((range, index) => `<tr><th scope="row"><span>${gradeLetters[index]}</span></th><td>${range}</td></tr>`).join('')}</tbody>
  </table>`;
entryDialog.after(ageDialog);

function recommendGrades(age, month) {
  if (age <= 2) return { center: 0, lower: -1, upper: -1 };
  const late = month >= 9;
  if (age >= 13) return { center: 9, lower: late ? -1 : 8, upper: -1 };
  const center = age <= 6 ? age - 3 : age - 4 + Number(late);
  return { center, lower: center - 1, upper: center + 1 };
}

function showEntry(step, title, content) {
  entryStep = step;
  entryDialog.dataset.step = step;
  entryDialog.innerHTML = `<button class="entry-close" data-entry="close" aria-label="닫기">×</button><h1 id="entry-title" tabindex="-1">${title}</h1>${content}`;
  if (!entryDialog.open) entryDialog.showModal();
  entryDialog.querySelector('h1').focus();
}

function openTrial() {
  birthYear = '';
  showEntry('year', '출생연도 확인', `<p>학습자의 출생연도를 입력해 주세요.<br>체험 등급 추천에만 사용해요.</p>
    <div class="year-digits" aria-label="입력한 출생연도" aria-live="polite"><span></span><span></span><span></span><span></span></div>
    <p class="year-error" role="alert"></p>
    <div class="year-keypad">${[1,2,3,4,5,6,7,8,9].map(n => `<button data-digit="${n}">${n}</button>`).join('')}<span></span><button data-digit="0">0</button><button data-entry="erase" aria-label="한 자리 지우기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-7-7z"/><path d="m11 9 6 6m0-6-6 6"/></svg></button></div>`);
  updateYear();
}

function updateYear(message = '') {
  entryDialog.querySelectorAll('.year-digits span').forEach((slot, index) => {
    slot.textContent = birthYear[index] ?? '·';
  });
  entryDialog.querySelector('.year-error').textContent = message;
}

function addYearDigit(digit) {
  birthYear += digit;
  if (birthYear.length < 4) return updateYear();
  const year = Number(birthYear);
  birthYear = '';
  const date = trialDate.formatToParts(new Date());
  const now = Number(date.find(part => part.type === 'year').value);
  const month = Number(date.find(part => part.type === 'month').value);
  if (year > now || year < 1900) return updateYear('올바른 출생연도를 입력해 주세요.');
  recommendation = recommendGrades(now - year, month);
  selectedGrade = recommendation.center;
  showEntry('grades', '체험 등급 선택', `<button class="entry-back" data-entry="year" aria-label="출생연도 다시 입력" title="출생연도 다시 입력"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 12H3m0 0 6-6m-6 6 6 6" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <button type="button" class="grade-info" data-entry="age-info" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="7.5" r="1" fill="currentColor"/><path d="M12 11v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>등급별 적정 연령 정보</button>
    <div class="grade-picker"><button data-entry="prev" aria-label="이전 등급">${gradeArrowIcon}</button><div class="grade-cards" role="group" aria-label="체험 등급"><div class="grade-track"></div></div><button data-entry="next" aria-label="다음 등급">${gradeArrowIcon}</button></div>
    <div class="grade-progress" role="group" aria-label="등급 범위 바로 선택"></div>`);
  mountGrades();
}

function mountGrades() {
  const track = entryDialog.querySelector('.grade-track');
  const spacer = '<span aria-hidden="true"></span>';
  track.innerHTML = spacer + gradeTopics.map((topic, i) => {
    const recommended = i === recommendation.center;
    const badge = recommended ? '<span class="grade-note">추천</span>' : '';
    return `<div class="grade-tile" data-grade="${i}">
      <button class="grade-option" data-grade="${i}" aria-pressed="false">
        ${badge}<strong>${gradeLetters[i]}<small>등급</small></strong><span>${topic}</span>
      </button>
      <button class="grade-tile-confirm" data-entry="confirm" disabled>확인</button>
    </div>`;
  }).join('') + spacer;
  entryDialog.querySelector('.grade-progress').innerHTML = Array.from({length: 5}, (_, page) =>
    `<button data-grade-page="${page}" aria-label="${gradeLetters[page * 2]}~${gradeLetters[page * 2 + 1]}등급" aria-pressed="false"><span></span></button>`
  ).join('');
  updateGradeSelection();
}

function updateGradeSelection(slide = false) {
  const track = entryDialog.querySelector('.grade-track');
  track.toggleAttribute('data-slide', slide);
  track.style.setProperty('--grade-index', selectedGrade);
  track.querySelectorAll('.grade-tile').forEach(card => {
    const grade = Number(card.dataset.grade);
    const selected = grade === selectedGrade;
    const visible = Math.abs(grade - selectedGrade) <= 1;
    card.inert = !visible;
    card.querySelector('.grade-option').setAttribute('aria-pressed', String(selected));
    card.querySelector('.grade-tile-confirm').disabled = !selected;
  });
  entryDialog.querySelectorAll('[data-grade-page]').forEach(button => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.gradePage) === Math.floor(selectedGrade / 2)));
  });
  entryDialog.querySelector('[data-entry="prev"]').disabled = selectedGrade === 0;
  entryDialog.querySelector('[data-entry="next"]').disabled = selectedGrade === gradeTopics.length - 1;
}

document.querySelector('#member').addEventListener('click', () => {
  showEntry('member', '재능회원 가입 안내', '<img class="entry-member-image" src="/entry/figma-member-guide.png?r=fefaae81dccadf03" width="1005" height="698" alt="지금, 재능회원이 되어보세요! 원하는 학습 플랜 선택과 체계적인 진단 시스템을 이용할 수 있어요. 학습 상담은 재능교육 고객센터 1588-1132로 문의하세요.">');
});
function selectGrade(grade) {
  if (grade < 0 || grade >= gradeTopics.length || grade === selectedGrade) return;
  const slide = Math.abs(grade - selectedGrade) === 1;
  selectedGrade = grade;
  updateGradeSelection(slide);
}

let gradeSwipe = null;
let suppressGradeClickUntil = 0;
entryDialog.addEventListener('pointerdown', event => {
  gradeSwipe = event.pointerType === 'touch' && event.target.closest('.grade-cards')
    ? {id: event.pointerId, x: event.clientX, y: event.clientY} : null;
});
entryDialog.addEventListener('pointercancel', () => { gradeSwipe = null; });
entryDialog.addEventListener('pointerup', event => {
  const start = gradeSwipe;
  gradeSwipe = null;
  if (!start || start.id !== event.pointerId || entryStep !== 'grades') return;
  const dx = event.clientX - start.x;
  if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(event.clientY - start.y) * 1.3) return;
  suppressGradeClickUntil = performance.now() + 350;
  selectGrade(selectedGrade - Math.sign(dx));
});
entryDialog.addEventListener('close', () => { birthYear = ''; });
entryDialog.addEventListener('click', event => {
  if (event.target === entryDialog) {
    const bounds = entryDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) entryDialog.close();
    return;
  }
  const button = event.target.closest('button');
  if (!button) return;
  if (event.detail && performance.now() < suppressGradeClickUntil && button.closest('.grade-cards')) return;
  if (button.dataset.digit !== undefined) return addYearDigit(button.dataset.digit);
  if (button.dataset.gradePage !== undefined) {
    const page = Number(button.dataset.gradePage);
    if (page !== Math.floor(selectedGrade / 2)) selectGrade(page * 2);
    entryDialog.querySelector(`button[data-grade-page="${page}"]`).focus();
    return;
  }
  if (button.dataset.grade !== undefined) {
    selectGrade(Number(button.dataset.grade));
    entryDialog.querySelector(`.grade-cards button[data-grade="${selectedGrade}"]`).focus({preventScroll:true});
    return;
  }
  switch (button.dataset.entry) {
    case 'close': entryDialog.close(); break;
    case 'age-info': ageDialog.showModal(); break;
    case 'year': openTrial(); break;
    case 'erase': birthYear = birthYear.slice(0,-1); updateYear(); break;
    case 'prev':
    case 'next':
      selectGrade(selectedGrade + (button.dataset.entry === 'next' ? 1 : -1));
      if (button.disabled) entryDialog.querySelector(`button[data-grade="${selectedGrade}"]`).focus({preventScroll:true});
      break;
    case 'confirm': location.assign(`/learning.html?trialGrade=${selectedGrade}&trialWelcome=1`); break;
  }
  if (button.id === 'scenario-mode' && entryStep === 'grades') {
    location.assign(`/learning.html?trialGrade=${selectedGrade}&entryScenario=1`);
  }
});
entryDialog.addEventListener('keydown', event => {
  if (entryStep !== 'year' || event.ctrlKey || event.metaKey || event.altKey) return;
  if (/^\d$/.test(event.key)) { event.preventDefault(); addYearDigit(event.key); }
  if (event.key === 'Backspace') { event.preventDefault(); birthYear = birthYear.slice(0,-1); updateYear(); }
});
