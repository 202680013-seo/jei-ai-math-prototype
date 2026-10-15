const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/ui-harness.cjs');

test('the outline shows the current learning shortcut, topic numbers and accessible status icons',()=>{
  const h=harness();h.evaluate(`
    state=M.create();const topics=state.grades[state.grade];
    topics[0].diagnosis='done';topics[0].programs=M.programs(2);
    topics[1].diagnosis='done';topics[1].programs=[];
    topics[2].diagnosis='done';topics[2].programs=M.programs(1);topics[2].programs[0].status='passed';M.setProgress(topics[2].programs[0],100);
    topics[3].diagnosis='done';topics[3].programs=M.programs(1);topics[3].programs[0].status='failed';M.setProgress(topics[3].programs[0],100);
    render();
  `);
  h.click('groups');const html=h.node('#group-panel').innerHTML;
  assert(html.includes('data-action="nav-resume"'));assert(html.includes('현재 학습'));assert(!html.includes('완료한 주제'));
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

test('the current-learning shortcut resumes the exact frame and keeps the clean-pass achievement step',()=>{
  const h=harness();h.evaluate('M.preset(state,4);render()');const before=h.data('current().programs[0]');
  h.click('groups');h.click('next-grade');assert.notEqual(h.evaluate('browseGrade'),h.evaluate('state.grade'));
  h.click('nav-resume');assert.equal(h.evaluate('browseGrade'),h.evaluate('state.grade'));assert.equal(h.node('#learning').open,true);
  assert.equal(h.evaluate('current().programs[0].progress'),before.progress);
  assert(h.node('#learning').innerHTML.includes(`문항 ${before.completedFrames+1} /`));
  const clean=harness();clean.evaluate('M.preset(state,2);render()');const grade=clean.evaluate('state.grade'),index=clean.evaluate('state.index');
  clean.click('groups');assert(clean.node('#group-panel').innerHTML.includes('통과 안내 보기'));
  clean.click('nav-resume');assert.equal(clean.node('#learning').open,true);
  assert.equal(clean.evaluate('state.grade'),grade);assert.equal(clean.evaluate('state.index'),index);
});

test('docked grid geometry preserves the closed card width and wraps before any width animation',()=>{
  const h=harness(),metrics=h.data('navigationGridMetrics(1280,940,228)');
  assert.equal(metrics.columns,3);assert.equal(metrics.width,228);assert.equal(metrics.contentWidth,716);
  const wide=h.data('navigationGridMetrics(1440,1100,258)');assert.equal(wide.columns,4);assert.equal(wide.width,258);
  const narrow=h.data('navigationGridMetrics(800,400,220)');assert.equal(narrow.columns,1);assert.equal(narrow.width,220);
});

test('card reflow moves existing elements between rows, cancels interrupted motion, and honors reduced motion',()=>{
  const h=harness(undefined,{reducedMotion:false}),first=h.node('motion-card-1'),fourth=h.node('motion-card-4'),calls=[];
  h.context.innerWidth=1280;h.node('#learning-workspace').getBoundingClientRect=()=>({width:1004});
  for(const [node,oldLeft,newLeft,oldTop,newTop] of [[first,160,420,210,260],[fourth,892,420,210,508]]){
    node.classList.add('program-card');node.getBoundingClientRect=()=>({left:h.node('body').classList.contains('learning-navigation-open')?newLeft:oldLeft,top:h.node('body').classList.contains('learning-navigation-open')?newTop:oldTop,width:228,height:232});
    node.animate=(frames,options)=>{const animation={cancelled:false,cancel(){this.cancelled=true;}};calls.push({node,frames,options,animation});return animation;};
  }
  h.document.querySelectorAll=()=>[first,fourth];h.click('groups');
  assert.equal(h.node('#learning-workspace').style['--navigation-columns'],'3');
  assert.equal(h.node('#learning-workspace').style['--navigation-card-width'],'228px');
  const wrap=calls.find(x=>x.node===fourth);assert(wrap.frames[0].transform.includes('-298px'));assert(wrap.frames.every(x=>!x.transform.includes('scale')));
  assert.equal(h.node('.groups-trigger').inert,true);assert.equal(h.node('.groups-trigger').tabIndex,-1);
  const animations=calls.map(x=>x.animation);h.click('close-panel');assert(animations.every(x=>x.cancelled));
  assert.equal(h.node('.groups-trigger').inert,false);assert.equal(h.node('.groups-trigger').tabIndex,0);
  const before=calls.length;h.media.matches=true;h.click('groups');assert.equal(calls.length,before);
});
