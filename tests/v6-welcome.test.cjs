const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/ui-harness.cjs');
const {MathModel:M}=require('../dist/working/model.js');
const first=h=>h.node('#diagnosis-welcome').getAttribute('data-welcome-first');
const guide=h=>h.node('#diagnosis-welcome-guide');
function activeState(answers=[0],index=1){
  const state=M.create(),topic=state.grades[3][0];topic.diagnosis='active';
  topic.diagnosticSession={answers,index,started:Date.now(),notes:'저장된 연습'};
  state.ui={diagnosisWelcomeSeen:true,diagnosisIntroSeen:true};return state;
}

test('V6 shows the full guide once, keeps it steady during that visit, and reloads to a compact start',()=>{
  const h=harness();assert.equal(first(h),'true');assert.equal(guide(h).hidden,false);
  assert.equal(h.saved().ui.diagnosisWelcomeSeen,true);assert.equal(h.evaluate('current().diagnosis'),'idle');
  assert.equal(h.evaluate('current().diagnosticSession'),undefined);assert.equal(h.evaluate('daily().timerRunning'),false);
  h.evaluate('render();render();syncGuidanceReminders()');assert.equal(first(h),'true');assert.equal(guide(h).hidden,false);
  const restored=harness(h.saved());assert.equal(first(restored),'false');assert.equal(guide(restored).hidden,true);
  assert.equal(restored.node('#welcome-dismiss').hidden,true);
  assert.equal(restored.node('#diagnostic').getAttribute('aria-label'),'실력알기 시작하기');
  assert.equal(restored.node('#diagnostic').getAttribute('aria-describedby'),null);
  assert.equal(restored.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'0');
  assert.equal(restored.node('#diagnosis-sheet-count').textContent,'0 / 3문항');
});

test('V6 can fold the first guide without starting diagnosis; returning from another page or topic does not repeat it',()=>{
  const h=harness();h.click('welcome-dismiss-guide');assert.equal(first(h),'false');assert.equal(guide(h).hidden,true);
  assert.equal(h.node('#learning').open,false);assert.equal(h.evaluate('current().diagnosis'),'idle');
  assert.equal(h.saved().ui.diagnosisWelcomeSeen,true);
  const my=harness();my.click('mypage');assert.equal(my.node('#diagnosis-welcome').getAttribute('data-welcome-motion'),'paused');
  my.click('back-main');assert.equal(first(my),'false');assert.equal(guide(my).hidden,true);
  const topic=harness();topic.evaluate('select(3,1)');assert.equal(first(topic),'false');assert.equal(guide(topic).hidden,true);
});

test('V6 preserves the diagnosis intro and a return before beginning becomes a compact start',()=>{
  const h=harness();h.click('diagnosis');assert.equal(h.evaluate('editing.intro'),true);
  assert.match(h.node('#learning').innerHTML,/diagnosis-begin/);
  assert.equal(h.node('#diagnosis-welcome').getAttribute('data-welcome-motion'),'paused');
  h.click('close-learning');assert.equal(first(h),'false');assert.equal(guide(h).hidden,true);
  assert.equal(h.evaluate('current().diagnosis'),'idle');assert.equal(h.evaluate('current().diagnosticSession'),undefined);
  h.click('diagnosis');assert.equal(h.evaluate('editing.intro'),true);
});

test('V6 paper counts saved answer zero, fills the actual question rows and resumes without losing work',()=>{
  const h=harness(activeState()),before=h.data('current().diagnosticSession');
  assert.equal(first(h),'false');assert.equal(guide(h).hidden,true);
  assert.equal(h.node('#diagnosis-welcome-progress').hidden,false);
  assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'33');
  assert.equal(h.node('#diagnosis-sheet-count').textContent,'1 / 3문항');
  assert.equal((h.node('#diagnosis-sheet-items').innerHTML.match(/is-solved/g)||[]).length,1);
  assert.match(h.node('#diagnosis-sheet-items').innerHTML,/is-solved"><i class="sheet-answer">✓/);
  assert.match(h.node('#diagnosis-sheet-items').innerHTML,/is-next"><i class="sheet-answer">2/);
  h.click('diagnosis');assert.equal(h.evaluate('editing.intro'),false);
  assert.deepEqual(h.data('current().diagnosticSession'),before);assert.match(h.node('#learning').innerHTML,/문항 2 \/ 3/);
  h.click('diagnosis-answer',1);h.click('close-learning');h.click('diagnosis-leave');
  assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'67');
  assert.equal(h.node('#diagnosis-sheet-count').textContent,'2 / 3문항');
  const bad=harness(activeState([99,-1,undefined],0));assert.equal(bad.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'0');
});

test('V6 stable renders preserve the mounted start button, paper rows and their motion',()=>{
  const h=harness(activeState());let button=h.node('#diagnostic').innerHTML,rows=h.node('#diagnosis-sheet-items').innerHTML,writes=0,rowWrites=0;
  Object.defineProperty(h.node('#diagnostic'),'innerHTML',{get:()=>button,set:value=>{writes++;button=value;},configurable:true});
  Object.defineProperty(h.node('#diagnosis-sheet-items'),'innerHTML',{get:()=>rows,set:value=>{rowWrites++;rows=value;},configurable:true});
  const parent=h.node('#diagnostic').parent;let mounts=0;const append=parent.append.bind(parent);parent.append=child=>{mounts++;append(child);};
  h.evaluate('render();render();syncGuidanceReminders()');assert.equal(writes,0);assert.equal(rowWrites,0);assert.equal(mounts,0);
});

test('V6 help is available after the initial guide, closes natively, and starts the same real diagnosis flow',()=>{
  const h=harness();h.click('welcome-dismiss-guide');const before=h.data('current()');
  h.click('welcome-help');assert.equal(h.evaluate('activityKind'),'diagnosis-guide');assert.equal(h.node('#activity').open,true);
  assert.match(h.node('#activity').innerHTML,/실력알기를 마치면 나에게 맞는 학습을 준비해요/);
  assert.match(h.node('#activity').innerHTML,/중간에 나가도 이어서 할 수 있어요/);
  assert.deepEqual(h.data('current()'),before);h.node('#activity').close();
  assert.equal(h.evaluate('activityKind'),null);assert.equal(first(h),'false');assert.equal(guide(h).hidden,true);
  h.click('welcome-help');h.click('welcome-help-start');assert.equal(h.node('#activity').open,false);
  assert.equal(h.node('#learning').open,true);assert.equal(h.evaluate('editing.intro'),true);
  assert.equal(h.evaluate('current().diagnosis'),'idle');
  const resume=harness(activeState());resume.click('welcome-help');resume.click('welcome-help-start');
  assert.equal(resume.evaluate('editing.intro'),false);assert.match(resume.node('#learning').innerHTML,/문항 2 \/ 3/);
});

test('V6 hides the paper on prescribed and passed topics and can deliberately replay all three welcome variants',()=>{
  const h=harness();h.evaluate('M.preset(state,3);render()');assert.equal(h.node('#diagnosis-welcome').hidden,true);
  assert.equal(h.node('#diagnostic').parent,h.node('#diagnostic-result-slot'));
  for(const [action,expectedFirst,expectedPercent] of [['welcome-preview-first','true','0'],['welcome-preview-compact','false','0'],['welcome-preview-progress','false','33']]){
    h.click('test');assert.match(h.node('#test-panel').innerHTML,new RegExp(action));h.click(action);
    assert.equal(h.evaluate('panel'),null);assert.equal(h.node('#learning').open,false);
    assert.equal(first(h),expectedFirst);assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),expectedPercent);
    assert.equal(h.evaluate('daily().timerRunning'),false);
  }
  h.evaluate('M.preset(state,2);render()');assert.equal(h.node('#diagnosis-welcome').hidden,true);
  assert.match(h.node('#diagnostic').innerHTML,/진단 통과/);
});

test('V6 standalone entry is independent and preserves the existing V4 and V5 learner links',()=>{
  const registry=JSON.parse(fs.readFileSync('dist/versions.json','utf8')),version=registry.versions.find(v=>v.label==='V6');assert(version);
  const html=fs.readFileSync('dist/v6.html','utf8');assert.match(html,/data-v6-standalone="true"/);
  assert.match(html,new RegExp('data-version="'+version.id+'"'));assert.match(html,/v6\.css/);
  assert.match(html,/NanumSquareRoundR\.woff2/);assert.match(html,/apple-mobile-web-app-capable/);assert(!html.includes('<iframe'));
  assert(!html.includes('workspace.js'));assert(!html.includes('data-v4-standalone'));
  for(const family of ['v4','v5']){const old=fs.readFileSync(`dist/${family}.html`,'utf8');assert(!old.includes('v6.css'));}
  const base=new URL(`/versions/${version.id}/`,'https://example.test');
  for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){const url=new URL(m[1],base);if(url.origin===base.origin)assert(fs.existsSync('dist'+decodeURIComponent(url.pathname)),url.pathname);}
});
