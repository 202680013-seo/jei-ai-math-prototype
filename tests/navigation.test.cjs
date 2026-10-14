const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/ui-harness.cjs');

test('topic completion includes required learning instead of counting diagnosis alone',()=>{
  const h=harness();h.evaluate(`
    state=M.create();const topics=state.grades[state.grade];
    topics[0].diagnosis='done';topics[0].programs=M.programs(2);
    topics[1].diagnosis='done';topics[1].programs=[];
    topics[2].diagnosis='done';topics[2].programs=M.programs(1);topics[2].programs[0].status='passed';M.setProgress(topics[2].programs[0],100);
    topics[3].diagnosis='done';topics[3].programs=M.programs(1);topics[3].programs[0].status='failed';M.setProgress(topics[3].programs[0],100);
    render();
  `);
  const summary=h.data('navigationSummary(state.grades[state.grade])');assert.equal(summary.complete,2);assert.equal(summary.review,1);
  h.click('groups');const html=h.node('#group-panel').innerHTML;
  assert(html.includes(`value="2" aria-label="학습을 완료한 주제"`));
  assert(html.indexOf('nav-summary')<html.indexOf('group-nav'));
  assert(!html.includes('진단 그룹'));assert(!html.includes('진단 완료율'));assert(html.includes('복습 필요'));
  const arrows=[...html.matchAll(/<button class="nav-grade-arrow"[^>]*>(.*?)<\/button>/g)].map(m=>m[1]);
  assert.equal(arrows.length,2);assert(arrows.every(x=>x.startsWith('<svg')&&!x.includes('이전')&&!x.includes('다음')));
  h.evaluate('browseGrade=0;renderPanel()');assert(h.node('#group-panel').innerHTML.includes('title="이전 등급" disabled'));
  h.click('prev-grade');assert.equal(h.evaluate('browseGrade'),0);
  h.evaluate('browseGrade=9;renderPanel()');h.click('next-grade');assert.equal(h.evaluate('browseGrade'),9);
});

test('the non-modal outline leaves main guidance, keyboard navigation and program state usable',()=>{
  const h=harness(undefined,{reducedMotion:false});h.evaluate('M.preset(state,4);render()');
  const before=h.data('current().programs[0]');
  h.evaluate("animateMessage(true,'열어둔 목차와 함께 공부해요.')");h.evaluate('thinkTimer').fn();h.evaluate('animTimer').fn();
  const letter=h.evaluate('animTimer'),visible=h.node('#ai-message').textContent;
  h.click('groups');assert.equal(h.node('#overlay').hidden,true);assert(!h.node('body').classList.contains('panel-open'));
  assert(h.node('body').classList.contains('learning-navigation-open'));assert.equal(h.evaluate('mainGuidanceVisible()'),true);
  assert.equal(h.evaluate('animTimer'),letter);letter.fn();assert(h.node('#ai-message').textContent.length>visible.length);
  let prevented=false;h.emitDocument('keydown',{key:'Tab',shiftKey:true,preventDefault(){prevented=true;}});assert.equal(prevented,false);
  h.click('program',0);assert.equal(h.node('#learning').open,true);assert.equal(h.evaluate('panel'),'groups');
  assert.equal(h.evaluate('current().programs[0].progress'),before.progress);assert.equal(h.evaluate('mainGuidanceVisible()'),false);
  h.node('#learning').close();h.evaluate('guidanceClosingTimer').fn();assert.equal(h.evaluate('mainGuidanceVisible()'),true);
  h.click('select-group',1);assert.equal(h.evaluate('state.index'),1);assert.equal(h.evaluate('panel'),'groups');
  assert.equal(h.node('#group-panel')['data-panel-phase'],'open');assert.equal(h.evaluate('panelMotionTimer'),null);
  assert.equal(h.evaluate('state.grades[state.grade][0].programs[0].progress'),before.progress);
  const source=fs.readFileSync('dist/working/index.html','utf8'),aside=source.match(/<aside id="group-panel"[^>]*>/)[0];
  assert(aside.includes('role="navigation"'));assert(!aside.includes('aria-modal'));
});

test('stable panel renders retain the mounted content and stale reveal or exit timers cannot affect a reopened outline',()=>{
  const h=harness(undefined,{reducedMotion:false}),panel=h.node('#group-panel');let markup='',writes=0;
  Object.defineProperty(panel,'innerHTML',{get:()=>markup,set:value=>{markup=value;writes++;},configurable:true});
  h.click('groups');const firstWrites=writes,oldReveal=h.evaluate('groupRevealTimer');
  h.evaluate('render();renderPanel()');assert.equal(writes,firstWrites);
  h.click('groups');const oldExit=h.evaluate('panelMotionTimer');assert.equal(oldExit.ms,600);
  assert.equal(h.evaluate('mainGuidanceVisible()'),true);assert.equal(h.node('#overlay').hidden,true);
  h.click('groups');assert.equal(panel['data-reveal'],'true');oldReveal.fn();oldExit.fn();
  assert.equal(panel['data-reveal'],'true');assert.equal(panel['data-panel-phase'],'open');assert.equal(panel.hidden,false);
  h.evaluate('groupRevealTimer').fn();assert.equal(panel['data-reveal'],'false');
  h.media.matches=true;h.click('groups');assert.equal(panel.hidden,true);assert.equal(h.evaluate('panelMotionTimer'),null);
  h.click('groups');assert.equal(h.evaluate('groupRevealTimer'),null);assert.equal(panel['data-reveal'],'false');
});
