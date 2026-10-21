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
function nativeMotion(h){
  h.document.documentElement=h.node('html');
  const write=h.context.scrollTo;
  h.context.scrollTo=options=>{if(options.behavior==='smooth')h.scrollCalls.push({...options});else write(options);};
  return top=>{h.context.scrollY=top;h.emitWindow('scroll');};
}

function layoutFrames(h){
  nativeMotion(h);
  h.context.requestAnimationFrame=fn=>({fn,cancelled:false});
  h.context.cancelAnimationFrame=frame=>{frame.cancelled=true;};
  return timestamp=>{const run=h.evaluate('mainResumeScrollRun');assert(run?.frame);const frame=run.frame;frame.fn(timestamp);return frame;};
}

test('the real replay button prepares one final fixture, waits once and starts one motion after layout settles',()=>{
  for(const version of ['working','versions/v59',...Array.from({length:7},(_,i)=>'versions/v'+(61+i))]){
    const h=setup(version);h.click('test');const frame=layoutFrames(h),before=h.scrollCalls.length;
    h.evaluate('let replayRenderCount=0;const replayOriginalRender=render;render=function(){replayRenderCount++;return replayOriginalRender();};');
    const listeners=(h.events.get('click')||[]).length;h.click('replay-resume-scroll');releaseDim(h);
    assert.equal(h.evaluate('replayRenderCount'),1,'render only the final fixture');
    assert.equal(h.evaluate('current().programs.length'),20);assert.equal(h.evaluate('M.currentProgram(current()).id'),12);
    assert.deepEqual(h.scrollCalls.slice(before),[{top:0,left:0,behavior:'instant'}],'no intermediate preset scroll');
    const run=h.evaluate('mainResumeScrollRun');assert(run);assert.equal(run.programId,12);
    assert.equal(h.timers.filter(t=>t.ms===600&&!t.cancelled).length,1,'only one live departure timer');
    const queued=run.timer;runScroll(h);assert.equal(run.timer,null);assert.equal(run.phase,'preparing');
    h.evaluate('render();render();syncGuidanceReminders()');assert.equal(h.evaluate('mainResumeScrollRun'),run);
    assert.equal(h.scrollCalls.length,before+1);assert.equal((h.events.get('click')||[]).length,listeners);
    frame();assert.equal(h.scrollCalls.length,before+1,'first layout frame does not scroll');
    h.node(selector).getBoundingClientRect=()=>({top:1330-h.context.scrollY,height:232});
    h.node('.ai').getBoundingClientRect=()=>({height:180});
    const beforeDeparture=h.data('current().programs');frame();
    const timed=version==='versions/v66'||version==='working';
    assert.equal(run.driver,timed?'timed':'native');assert.equal(run.target,956);
    if(timed){
      assert(run.frame);assert.equal(h.scrollCalls.length,before+1,'frame driver starts after the two layout frames');
      frame(100);frame(100+run.travelDuration/2);
      assert(Math.abs(h.context.scrollY-478)<.01);assert.equal(run.finishTimer,null,'no native completion timer competes');
    }else{
      assert.equal(run.frame,null);
      assert.deepEqual(h.scrollCalls.slice(before),[{top:0,left:0,behavior:'instant'},{top:956,left:0,behavior:'smooth'}]);
    }
    const motionCalls=h.scrollCalls.length;
    h.evaluate('render();renderPanel();syncGuidanceReminders()');queued.fn();
    assert.equal(h.scrollCalls.length,motionCalls,'ordinary renders and an old departure callback never repeat the journey');
    assert.deepEqual(h.data('current().programs'),beforeDeparture);
    assert.equal((h.events.get('click')||[]).filter(fn=>fn.name==='syncMainResumeScroll').length,0,'use existing guidance observer');
    if(timed){frame(101+run.duration);assert.equal(h.context.scrollY,956);}
    else{h.context.scrollY=956;h.emitWindow('scrollend');}
    assert.equal(h.evaluate('mainResumeScrollRun'),null);
    const finishedCalls=h.scrollCalls.length;h.emitWindow('scrollend');
    assert.equal(h.scrollCalls.length,finishedCalls,'completion never adds a snap');
  }
});

test('a pending layout frame is cancelled on input, navigation or hiding without leaking a native scroll',()=>{
  for(const stage of [1,2])for(const type of ['wheel','touchstart','pointerdown','keydown','resize','hidden','help']){
    const h=setup('working'),frame=layoutFrames(h),run=runScroll(h);if(stage===2)frame();
    const pending=run.frame,before=h.scrollCalls.length;
    if(type==='resize'){h.context.innerWidth=800;h.emitWindow('resize');}
    else if(type==='hidden'){h.document.visibilityState='hidden';h.emitDocument('visibilitychange');}
    else if(type==='help')h.click('help');
    else h.emitDocument(type,{key:'ArrowDown'});
    assert.equal(h.evaluate('mainResumeScrollRun'),null);assert.equal(pending.cancelled,true);
    pending.fn();assert.equal(h.scrollCalls.length,before);assert.equal(h.evaluate('mainResumeScrollRun'),null);
  }
});

test('height-only resize preserves the queued layout, while reduced motion uses the final measured target',()=>{
  const h=setup('working'),frame=layoutFrames(h),run=runScroll(h);
  h.context.innerHeight=750;h.emitWindow('resize');assert.equal(h.evaluate('mainResumeScrollRun'),run);
  frame();h.media.matches=true;frame();assert.equal(h.scrollCalls.at(-1).behavior,'instant');
  assert.equal(h.scrollCalls.at(-1).top,791);assert.equal(h.evaluate('mainResumeScrollRun'),null);
});

test('closing guidance defers the entry instead of consuming or repeating its request',()=>{
  const h=setup('working');h.click('help');h.click('close-help');
  assert.equal(h.evaluate('guidanceClosing'),true);assert.equal(h.evaluate('mainResumeScrollRun'),null);
  const before=h.scrollCalls.length;h.evaluate('render();render();syncGuidanceReminders()');assert.equal(h.scrollCalls.length,before);
  releaseDim(h);const run=h.evaluate('mainResumeScrollRun');assert(run);assert.equal(run.timer.ms,600);
  h.evaluate('render();syncGuidanceReminders()');assert.equal(h.evaluate('mainResumeScrollRun'),run);assert.equal(h.scrollCalls.length,before+1);
});

test('one native motion request reaches the actual center without frame writes, stale scrollend or a final snap',()=>{
  for(const version of ['working','versions/v59',...Array.from({length:7},(_,i)=>'versions/v'+(61+i))]){
    const h=setup(version),move=nativeMotion(h),before=h.data('current().programs'),run=runScroll(h);
    assert.equal(run.driver,'native');assert.equal(run.target,766);
    assert.deepEqual(h.scrollCalls,[{top:0,left:0,behavior:'instant'},{top:766,left:0,behavior:'smooth'}]);
    assert.equal(h.node('html').getAttribute('data-resume-scrolling'),'true');
    let reads=0;for(const sel of ['.ai',selector]){const node=h.node(sel),get=node.getBoundingClientRect.bind(node);node.getBoundingClientRect=()=>{reads++;return get();};}
    h.emitWindow('scrollend');assert.equal(h.evaluate('mainResumeScrollRun'),run,'ignore the initial top-reset scrollend');
    for(const top of [90,260,470,690]){move(top);h.emitWindow('scrollend');assert.equal(h.evaluate('mainResumeScrollRun'),run);}
    assert.equal(reads,0);assert.equal(h.scrollCalls.length,2,'no script-driven scroll writes during motion');
    move(766);h.emitWindow('scrollend');assert.equal(h.evaluate('mainResumeScrollRun'),null);
    assert.equal(h.scrollCalls.length,2,'completion releases bookkeeping without snapping');
    assert.equal(h.node('html').getAttribute('data-resume-scrolling'),null);assert.deepEqual(h.data('current().programs'),before);
  }
});

test('height-only mobile resize preserves the motion while width, orientation, input and hidden-page changes cancel it',()=>{
  const h=setup('working'),move=nativeMotion(h),run=runScroll(h);move(250);
  h.context.innerHeight=750;h.emitWindow('resize');assert.equal(h.evaluate('mainResumeScrollRun'),run);assert.equal(h.scrollCalls.length,2);
  h.context.innerHeight=820;h.emitWindow('resize');assert.equal(h.evaluate('mainResumeScrollRun'),run);
  for(const type of ['wheel','touchstart','pointerdown','keydown','resize','orientationchange','hidden']){
    const h=setup('working'),move=nativeMotion(h),run=runScroll(h);move(340);const stale=run.finishTimer;
    if(type==='resize'){h.context.innerWidth=800;h.emitWindow('resize');}
    else if(type==='hidden'){h.document.visibilityState='hidden';h.emitDocument('visibilitychange');}
    else if(type==='orientationchange')h.emitWindow(type);
    else h.emitDocument(type,{key:'ArrowDown'});
    assert.equal(h.evaluate('mainResumeScrollRun'),null);assert.equal(stale.cancelled,true);
    assert.equal(h.scrollCalls.at(-1).top,340);assert.equal(h.scrollCalls.at(-1).behavior,'instant');
    assert.equal(h.node('html').getAttribute('data-resume-scrolling'),null);
    const count=h.scrollCalls.length;stale.fn();assert.equal(h.scrollCalls.length,count);
  }
});

test('scroll-event fallback and reduced-motion changes clean up without interrupting native travel',()=>{
  const h=setup('working'),move=nativeMotion(h),run=runScroll(h);move(400);const middle=run.finishTimer;
  move(766);assert.equal(middle.cancelled,true);const settled=run.finishTimer;assert.equal(settled.ms,180);settled.fn();
  assert.equal(h.evaluate('mainResumeScrollRun'),null);assert.equal(h.scrollCalls.length,2);
  const changed=setup('working');nativeMotion(changed);let listener,removed=false;
  changed.media.addEventListener=(type,fn)=>{assert.equal(type,'change');listener=fn;};
  changed.media.removeEventListener=(type,fn)=>{removed=fn===listener;};
  const moving=runScroll(changed);changed.context.scrollY=300;changed.evaluate('render();render();syncGuidanceReminders()');
  assert.equal(changed.evaluate('mainResumeScrollRun'),moving);
  changed.media.matches=true;listener();assert.equal(changed.context.scrollY,766);assert.equal(changed.evaluate('mainResumeScrollRun'),null);assert(removed);
});

test('clamp unreachable targets to the actual scroll range before departure',()=>{
  for(const max of [0,300]){
    const h=setup('working');nativeMotion(h);h.document.scrollingElement={scrollHeight:800+max,clientHeight:800};
    const before=h.scrollCalls.length;runScroll(h);
    if(max===0){assert.equal(h.evaluate('mainResumeScrollRun'),null);assert.equal(h.scrollCalls.length,before);}
    else{assert.equal(h.scrollCalls.at(-1).top,300);assert.equal(h.scrollCalls.at(-1).behavior,'smooth');}
  }
});

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
    assert.equal(h.node('main').style['--resume-scroll-space'],version==='working'?'208px':'228px');
    assert.deepEqual(h.data('current().programs'),before);
  });

  test(version+(version==='working'?' retains V6.2.2 entry and last-opened fallback behavior':' leaves visible active cards, unstarted learning, and completed learning still'),()=>{
    const first=setup(version,{initialScroll:0,rects:{[selector]:{top:250,height:232}}});
    if(version==='working'){
      assert(first.evaluate('mainResumeScrollRun'));assert.equal(first.scrollCalls.length,1);runScroll(first);
      assert.equal(first.evaluate('mainResumeScrollRun'),null,'a zero-distance destination finishes without movement');
      for(const [status,id] of [['idle',12],['passed',13],['failed',13],['locked',11]]){
        const saved=fixture(),p=saved.grades[3][0].programs[12];p.status=status;if(status==='passed'||status==='failed')M.setProgress(p,100);
        const h=setup(version,{saved});assert.equal(h.evaluate('mainResumeScrollRun.programId'),id);assert.equal(h.scrollCalls.length,1);
      }
      return;
    }
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
