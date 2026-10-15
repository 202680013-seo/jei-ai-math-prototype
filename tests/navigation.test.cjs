const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {harness}=require('./helpers/ui-harness.cjs');

test('the outline shows current learning information, topic numbers and accessible status icons',()=>{
  const h=harness();h.evaluate(`
    state=M.create();const topics=state.grades[state.grade];
    topics[0].diagnosis='done';topics[0].programs=M.programs(2);
    topics[1].diagnosis='done';topics[1].programs=[];
    topics[2].diagnosis='done';topics[2].programs=M.programs(1);topics[2].programs[0].status='passed';M.setProgress(topics[2].programs[0],100);
    topics[3].diagnosis='done';topics[3].programs=M.programs(1);topics[3].programs[0].status='failed';M.setProgress(topics[3].programs[0],100);
    render();
  `);
  h.click('groups');const html=h.node('#group-panel').innerHTML;
  assert(!html.includes('data-action="nav-resume"'));assert(html.includes('현재 학습'));assert(!html.includes('완료한 주제'));
  assert(html.includes('class="nav-topic-number" aria-hidden="true">01</span>'));
  assert(html.includes('class="sr-only">완료</span>'));assert(html.includes('fill="currentColor"'));
  assert(!html.includes('지금 보고 있어요'));assert(!html.includes('nav-topic-icon'));
  const visible=html.replace(/<span class="sr-only">.*?<\/span>/gs,'').replace(/<[^>]*>/g,'');
  assert(!visible.includes('복습 필요'));assert(!visible.includes('시작 전'));assert(!visible.includes('학습 중'));
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
  h.evaluate("state.grades[state.grade][1].diagnosis='active';renderPanel()");
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
  h.click('groups');const oldExit=h.evaluate('panelMotionTimer');assert.equal(oldExit.ms,320);
  assert.equal(h.evaluate('mainGuidanceVisible()'),true);assert.equal(h.node('#overlay').hidden,true);
  h.click('groups');assert.equal(panel['data-reveal'],'true');oldReveal.fn();oldExit.fn();
  assert.equal(panel['data-reveal'],'true');assert.equal(panel['data-panel-phase'],'open');assert.equal(panel.hidden,false);
  h.evaluate('groupRevealTimer').fn();assert.equal(panel['data-reveal'],'false');
  h.media.matches=true;h.click('groups');assert.equal(panel.hidden,true);assert.equal(h.evaluate('panelMotionTimer'),null);
  h.click('groups');assert.equal(h.evaluate('groupRevealTimer'),null);assert.equal(panel['data-reveal'],'false');
});

test('the current-learning summary remains informational when browsing another grade and reflects the actual program',()=>{
  const h=harness();h.evaluate('M.preset(state,4);render()');const before=h.data('current().programs[0]');
  h.click('groups');const summary=h.node('#group-panel').innerHTML.match(/<section class="grade-summary[\s\S]*?<\/section>/)[0];
  assert(summary.includes(before.name));assert(!summary.includes('<button'));
  h.click('next-grade');assert.notEqual(h.evaluate('browseGrade'),h.evaluate('state.grade'));
  assert.equal(h.node('#group-panel').innerHTML.match(/<section class="grade-summary[\s\S]*?<\/section>/)[0],summary);
  assert.equal(h.node('#learning').open,false);assert.deepEqual(h.data('current().programs[0]'),before);
});

test('docked grid geometry preserves the closed card width and wraps before any width animation',()=>{
  const h=harness(),metrics=h.data('navigationGridMetrics(1280,940,228)');
  assert.equal(metrics.columns,3);assert.equal(metrics.width,228);assert.equal(metrics.contentWidth,716);
  const wide=h.data('navigationGridMetrics(1440,1100,258)');assert.equal(wide.columns,4);assert.equal(wide.width,258);
  const narrow=h.data('navigationGridMetrics(800,400,220)');assert.equal(narrow.columns,1);assert.equal(narrow.width,220);
});

test('rail reflow uses one short fade without individual travel, cancels interruptions, and honors reduced motion',()=>{
  const h=harness(undefined,{reducedMotion:false}),first=h.node('motion-card-1'),main=h.node('main'),calls=[];
  h.context.innerWidth=1280;h.node('#learning-workspace').getBoundingClientRect=()=>({width:1004});
  first.classList.add('program-card');first.getBoundingClientRect=()=>({width:228,height:232});
  main.animate=(frames,options)=>{const animation={cancelled:false,cancel(){this.cancelled=true;}};calls.push({frames,options,animation});return animation;};
  first.animate=()=>assert.fail('individual cards should not travel when the rail opens');
  h.document.querySelectorAll=()=>[first];h.click('groups');
  assert.equal(h.node('#learning-workspace').style['--navigation-columns'],'3');
  assert.equal(h.node('#learning-workspace').style['--navigation-card-width'],'228px');
  assert.equal(calls.length,1);assert.equal(calls[0].options.duration,240);assert(calls[0].frames.every(frame=>!frame.transform));
  assert.equal(h.node('.groups-trigger').inert,true);assert.equal(h.node('.groups-trigger').tabIndex,-1);
  const previous=calls[0].animation;h.click('close-panel');assert(previous.cancelled);
  assert.equal(h.node('.groups-trigger').inert,false);assert.equal(h.node('.groups-trigger').tabIndex,0);
  const before=calls.length;h.media.matches=true;h.click('groups');assert.equal(calls.length,before);
});

test('long learning lists pin the full guidance area and the 12-card review state remains interactive',()=>{
  const h=harness();
  for(const count of [7,8,12,3]){
    h.evaluate(`current().diagnosis='done';current().programs=M.programs(${count});render()`);
    assert.equal(h.node('body').classList.contains('has-long-learning-list'),count>=8);
  }
  h.context.__JEI_REVIEW__={scenario:'many'};
  vm.runInContext(fs.readFileSync('dist/preview-controls.js','utf8'),h.context);
  assert.equal(h.evaluate('current().programs.length'),12);assert(h.node('body').classList.contains('has-long-learning-list'));
  assert.equal((h.node('#programs').innerHTML.match(/data-action="program"/g)||[]).length,12);
  assert.equal(h.evaluate('current().programs.filter(p=>p.status==="passed").length'),2);
  const active=h.data('current().programs[2]');assert(active.progress>0&&active.progress<100);
  assert.equal(h.evaluate('M.canStudy(current(),current().programs[3])'),false);
  assert.equal(h.node('#recommend').disabled,false);
  h.click('groups');assert(h.node('body').classList.contains('has-long-learning-list'));assert.equal(h.evaluate('navigationCurrentLearning().detail'),active.name);
  h.click('program',2);assert.equal(h.node('#learning').open,true);assert.equal(h.evaluate('current().programs[2].progress'),active.progress);
});

test('unstarted outline topics are disabled and guarded even when a click is dispatched directly',()=>{
  const h=harness();h.evaluate('M.preset(state,4);state.grades[3][2].diagnosis="done";render()');h.click('groups');
  const html=h.node('#group-panel').innerHTML;
  const idle=html.match(/<button data-state="idle"[^>]*data-id="1"[^>]*>/)[0];
  assert(idle.includes('disabled aria-disabled="true"'));assert.equal(h.evaluate('canNavigateTopic(state.grades[3][1])'),false);
  h.click('select-group',1);assert.equal(h.evaluate('state.index'),0);assert.equal(h.evaluate('panel'),'groups');
  h.click('select-group',2);assert.equal(h.evaluate('state.index'),2);assert.equal(h.evaluate('panel'),'groups');
  h.click('select-group',0);assert.equal(h.evaluate('state.index'),0);
  assert.equal(h.evaluate('canNavigateTopic(undefined)'),false);
});

test('the outline reveals in top-to-bottom order without restarting on unchanged renders',()=>{
  const h=harness(undefined,{reducedMotion:false});h.click('groups');const reveal=h.evaluate('groupRevealTimer');
  const delays=[...h.node('#group-panel').innerHTML.matchAll(/--nav-delay:(\d+)ms/g)].map(m=>Number(m[1]));
  assert(delays.length>6);assert(delays.every((value,i)=>!i||value>=delays[i-1]));assert.equal(reveal.ms,1400);
  h.evaluate('renderPanel();render()');assert.equal(h.evaluate('groupRevealTimer'),reveal);
  h.click('close-panel');const reduced=harness();reduced.click('groups');assert.equal(reduced.evaluate('groupRevealTimer'),null);
});

test('the scroll demonstration uses 20 cards in D-grade 모으기와 가르기(10) and keeps other topics intact',()=>{
  const h=harness();h.context.__JEI_REVIEW__={scenario:'scroll20'};vm.runInContext(fs.readFileSync('dist/preview-controls.js','utf8'),h.context);
  assert.equal(h.evaluate('state.grade'),3);assert.equal(h.evaluate('state.index'),1);
  assert.equal(h.evaluate('current().groupName'),'모으기와 가르기(10)');assert.equal(h.evaluate('current().programs.length'),20);
  assert.equal(h.evaluate('M.sourceCount(3,1)'),20);assert.equal(h.evaluate('M.sourceCount(3,0)'),8);
  assert.equal((h.node('#programs').innerHTML.match(/data-action="program"/g)||[]).length,20);
  assert(h.node('body').classList.contains('has-long-learning-list'));h.click('groups');
  assert.equal(h.evaluate('canNavigateTopic(state.grades[3][0])'),true);assert.equal(h.evaluate('canNavigateTopic(state.grades[3][2])'),false);
  h.evaluate('M.preset(state,3);render()');assert.equal(h.evaluate('current().programs.length'),20);
});
