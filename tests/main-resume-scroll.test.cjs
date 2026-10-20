const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/ui-harness.cjs');
const {MathModel:M}=require('../dist/working/model.js');
const selector='#programs [data-action="program"][data-id="12"]';
function fixture(){
  const state=M.create(),topic=state.grades[3][0];topic.diagnosis='done';topic.programs=M.programs(20);
  topic.programs.slice(0,12).forEach(p=>{p.status='passed';M.setProgress(p,100);});
  topic.programs[12].status='active';M.setProgress(topic.programs[12],50);
  return state;
}
function setup(version,options={}){
  const rects={'.ai':{height:160},[selector]:c=>({top:1130-c.scrollY,height:232}),...options.rects};
  return harness(options.saved||fixture(),{reducedMotion:false,appSource:fs.readFileSync(`dist/${version}/app.js`,'utf8'),initialScroll:900,...options,rects});
}
function runScroll(h){const run=h.evaluate('mainResumeScrollRun');assert(run);assert.equal(run.timer.ms,600);run.timer.fn();return run;}
function releaseDim(h){const timer=h.evaluate('guidanceClosingTimer');if(timer&&!timer.cancelled)timer.fn();}

for(const version of ['working','versions/v59','versions/v61']){
  test(version+' shows the overview top once, waits 600ms and centers the active card below the sticky header',()=>{
    const h=setup(version),before=h.data('current().programs'),run=h.evaluate('mainResumeScrollRun');
    assert.equal(h.context.scrollY,0);assert.deepEqual(h.scrollCalls,[{top:0,left:0,behavior:'instant'}]);
    assert.equal(run.phase,'waiting');assert.equal(run.timer.ms,600);
    h.evaluate('render();render();syncGuidanceReminders()');assert.equal(h.evaluate('mainResumeScrollRun'),run);
    assert.equal(h.scrollCalls.length,1);runScroll(h);
    assert.deepEqual(h.scrollCalls[1],{top:766,left:0,behavior:'smooth'});
    const rect=h.node(selector).getBoundingClientRect();assert.equal(rect.top+rect.height/2,(800+160)/2);
    assert(h.node('body').classList.contains('has-resume-scroll-space'));
    assert.equal(h.node('main').style['--resume-scroll-space'],'228px');
    assert.deepEqual(h.data('current().programs'),before);
  });

  test(version+' leaves visible active cards, unstarted learning, and completed learning still',()=>{
    const first=setup(version,{initialScroll:0,rects:{[selector]:{top:250,height:232}}});
    assert.equal(first.evaluate('mainResumeScrollRun'),null);assert.equal(first.scrollCalls.length,0);
    for(const status of ['idle','passed','failed','locked']){
      const saved=fixture(),p=saved.grades[3][0].programs[12];p.status=status;if(status==='passed'||status==='failed')M.setProgress(p,100);
      const h=setup(version,{saved});assert.equal(h.evaluate('mainResumeScrollRun'),null);assert.equal(h.scrollCalls.length,0);
    }
  });

  test(version+' yields to user input and ignores stale work after leaving or changing the main screen',()=>{
    for(const type of ['wheel','touchstart','pointerdown','keydown']){
      const h=setup(version),run=h.evaluate('mainResumeScrollRun');h.emitDocument(type,{key:'PageDown'});
      assert.equal(h.evaluate('mainResumeScrollRun'),null);assert.equal(run.timer.cancelled,true);
      h.evaluate('render()');run.timer.fn();assert.equal(h.scrollCalls.length,1);
    }
    const h=setup(version),old=h.evaluate('mainResumeScrollRun');h.click('program',12);
    assert.equal(h.evaluate('mainResumeScrollRun'),null);old.timer.fn();assert.equal(h.scrollCalls.length,1);
    h.click('close-learning');releaseDim(h);const fresh=h.evaluate('mainResumeScrollRun');
    assert(fresh);assert.notEqual(fresh,old);old.timer.fn();assert.equal(h.scrollCalls.length,2);
    runScroll(h);assert.equal(h.scrollCalls.at(-1).behavior,'smooth');
    h.emitDocument('touchstart');assert.equal(h.scrollCalls.at(-1).behavior,'instant');
    assert.equal(h.evaluate('mainResumeScrollRun'),null);
  });

  test(version+' recalculates geometry at departure and respects reduced motion and hidden pages',()=>{
    const h=setup(version),run=h.evaluate('mainResumeScrollRun');h.context.innerHeight=900;
    h.node(selector).getBoundingClientRect=()=>({top:1200-h.context.scrollY,height:232});runScroll(h);
    assert.equal(h.scrollCalls.at(-1).top,786); // 1316 - (900 + 160) / 2
    const reduced=setup(version,{reducedMotion:true});runScroll(reduced);
    assert.equal(reduced.scrollCalls.at(-1).behavior,'instant');assert.equal(reduced.evaluate('mainResumeScrollRun'),null);
    const hidden=setup(version),stale=hidden.evaluate('mainResumeScrollRun');hidden.document.visibilityState='hidden';hidden.emitDocument('visibilitychange');
    assert.equal(hidden.evaluate('mainResumeScrollRun'),null);stale.timer.fn();assert.equal(hidden.scrollCalls.length,1);
    hidden.document.visibilityState='visible';hidden.emitDocument('visibilitychange');
    assert(hidden.evaluate('mainResumeScrollRun'));assert.notEqual(hidden.evaluate('mainResumeScrollRun'),stale);
  });

  test(version+' re-enters from my learning and keeps a docked rail open without restarting the scroll',()=>{
    const h=setup(version);h.click('mypage');assert.equal(h.evaluate('mainResumeScrollRun'),null);
    h.context.scrollY=700;h.click('back-main');assert.equal(h.context.scrollY,0);const run=h.evaluate('mainResumeScrollRun');assert(run);
    h.click('groups');assert.equal(h.evaluate('panel'),'groups');assert.equal(h.evaluate('mainResumeScrollRun'),run);
    h.evaluate('render();renderPanel()');assert.equal(h.evaluate('mainResumeScrollRun'),run);
    runScroll(h);assert.equal(h.evaluate('panel'),'groups');assert.equal(h.scrollCalls.at(-1).behavior,'smooth');
  });

  test(version+' provides an explicit bottom-card validation scenario without changing another topic',()=>{
    const h=setup(version);h.evaluate("state.grades[3][1].diagnosis='active'");const other=h.data('state.grades[3][1]');
    h.click('test');assert.match(h.node('#test-panel').innerHTML,/replay-resume-scroll/);
    h.click('replay-resume-scroll');releaseDim(h);
    assert.equal(h.evaluate('panel'),null);assert.equal(h.evaluate('current().programs.length'),20);
    assert.equal(h.evaluate('M.currentProgram(current()).id'),12);assert(h.evaluate('mainResumeScrollRun'));
    assert.deepEqual(h.data('state.grades[3][1]'),other);assert.equal(h.evaluate('diagnosisOutcomeRun'),null);
  });
}
