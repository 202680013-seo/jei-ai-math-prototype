const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/ui-harness.cjs');
const {MathModel:M}=require('../dist/versions/v66/model.js');
const appSource=fs.readFileSync('dist/versions/v66/app.js','utf8');
const selector='#programs [data-action="program"][data-id="12"]';
function setup(distance=766){
  const state=M.create(),topic=state.grades[3][0];topic.diagnosis='done';topic.programs=M.programs(20);
  topic.programs.slice(0,12).forEach(p=>{p.status='passed';M.setProgress(p,100);});
  topic.programs[12].status='active';M.setProgress(topic.programs[12],50);
  const h=harness(state,{reducedMotion:false,appSource,rects:{'.ai':{height:160},[selector]:ctx=>({top:distance+364-ctx.scrollY,height:232})}});
  h.document.documentElement=h.node('html');
  const pending=new Set();let last;
  h.context.requestAnimationFrame=fn=>{const frame={fn,cancelled:false};pending.add(frame);last=frame;return frame;};
  h.context.cancelAnimationFrame=frame=>{frame.cancelled=true;pending.delete(frame);};
  const frame=time=>{assert.equal(pending.size,1,'only one outstanding frame');const callback=pending.values().next().value;pending.delete(callback);callback.fn(time);return callback;};
  const run=h.evaluate('mainResumeScrollRun');run.timer.fn();
  frame(0);frame(16); // The existing two layout frames precede motion.
  return {h,run,frame,pending,last:()=>last};
}

test('V6.2.2 travels in about a second with a gentle start/end at 30, 60 and 120Hz and no layout reads',()=>{
  for(const hz of [30,60,120]){
    const {h,run,frame,pending}=setup();const before=h.data('current().programs');
    assert.equal(run.driver,'timed');assert(run.travelDuration>1000&&run.travelDuration<1030);assert.equal(run.duration,run.travelDuration+180);assert.equal(run.finishTimer,null);
    const geometry=new Map();
    for(const sel of ['.ai',selector]){const node=h.node(sel);geometry.set(node,node.getBoundingClientRect);node.getBoundingClientRect=()=>{throw Error('motion must not read layout');};}
    const origin=1000,positions=[];frame(origin);
    for(let elapsed=1000/hz;elapsed<run.travelDuration;elapsed+=1000/hz){
      frame(origin+elapsed);positions.push(h.context.scrollY);
      h.emitWindow('scroll');h.emitWindow('scrollend');
      assert.equal(h.evaluate('mainResumeScrollRun'),run,'scrollend events must not end the timed driver');
    }
    frame(origin+run.travelDuration);assert.equal(h.context.scrollY,766);
    frame(origin+run.travelDuration+90);assert.equal(h.context.scrollY,763);
    frame(origin+run.duration+1);
    assert.equal(h.context.scrollY,766);assert.equal(h.evaluate('mainResumeScrollRun'),null);assert.equal(pending.size,0);
    assert.equal(h.node('html').getAttribute('data-resume-scrolling'),null);assert.deepEqual(h.data('current().programs'),before);
    assert(positions.every((y,i)=>!i||y>=positions[i-1]));
    assert(positions[0]<3,'gentle departure');assert(766-positions.at(-1)<3,'gentle arrival');
    assert(h.scrollCalls.every(call=>call.behavior==='instant'),'no competing native smooth request');
    for(const [node,read] of geometry)node.getBoundingClientRect=read;
    const calls=h.scrollCalls.length;h.emitWindow('scrollend');h.evaluate('render();syncGuidanceReminders()');assert.equal(h.scrollCalls.length,calls);
  }
});

test('V6.2.2 uses real elapsed time through a missed frame instead of stretching the clock',()=>{
  const {h,run,frame}=setup();frame(500);frame(500+run.travelDuration*.1);
  assert(h.context.scrollY<30);
  frame(500+run.travelDuration*.5);assert(Math.abs(h.context.scrollY-383)<.001);
  // A slow frame does not create another duration or an extra completion snap.
  frame(500+run.duration+50);assert.equal(h.context.scrollY,766);assert.equal(h.evaluate('mainResumeScrollRun'),null);
});

test('V6.2.2 bounds short/long trips and clamps the destination before easing',()=>{
  for(const distance of [40,4000]){
    const {h,run,frame}=setup(distance);assert(run.travelDuration>=900&&run.travelDuration<=1120);assert.equal(run.duration,run.travelDuration+180);
    frame(0);frame(run.duration);assert.equal(h.context.scrollY,distance);assert.equal(h.evaluate('mainResumeScrollRun'),null);
  }
  const {h,frame}=setup(2000);h.evaluate('cancelMainResumeScroll();mainResumeVisible=false');
  h.document.scrollingElement={scrollHeight:1100,clientHeight:800};h.evaluate('syncMainResumeScroll()');
  const run=h.evaluate('mainResumeScrollRun');run.timer.fn();frame(0);frame(16);
  assert.equal(run.target,300);frame(32);frame(32+run.duration);
  assert.equal(h.context.scrollY,300);assert(h.scrollCalls.every(call=>call.top<=300));
});

test('V6.2.2 arrival rebounds once by at most 3px inside the scroll range, including both boundaries',()=>{
  for(const [start,target] of [[0,300],[300,0],[0,40]]){
    const {h,frame}=setup(300);
    h.evaluate('cancelMainResumeScroll()');h.context.scrollY=start;
    h.document.scrollingElement={scrollHeight:1100,clientHeight:800};
    h.evaluate(`mainResumeScrollRun={phase:'preparing'};animateMainResumeScroll(mainResumeScrollRun,${target})`);
    const run=h.evaluate('mainResumeScrollRun'),before=h.scrollCalls.length;
    frame(100);frame(100+run.travelDuration);
    assert.equal(h.context.scrollY,target,'original travel still reaches the same target at the same time');
    const positions=[];
    for(const t of [.1,.25,.5,.75,.9]){frame(100+run.travelDuration+run.settleDuration*t);positions.push(h.context.scrollY);}
    assert(Math.abs(positions[2]-target)<=3);assert(Math.abs(positions[2]-target)>0);
    assert.equal(positions[2],target+run.rebound);
    assert(Math.abs(positions[0]-target)<Math.abs(positions[1]-target));
    assert(Math.abs(positions[4]-target)<Math.abs(positions[3]-target));
    frame(101+run.duration);assert.equal(h.context.scrollY,target);assert.equal(h.evaluate('mainResumeScrollRun'),null);
    assert(h.scrollCalls.slice(before).every(call=>call.top>=0&&call.top<=300),'no clipping or extra bottom space');
  }
});

test('V6.2.2 cancels one moving frame on input/navigation, ignores stale callbacks and preserves manual position',()=>{
  for(const type of ['wheel','touchstart','pointerdown','keydown','resize','orientationchange','hidden','help','mypage','pagehide']){
    const {h,run,frame,pending,last}=setup();frame(100);frame(100+run.duration*.4);
    const stale=last(),position=h.context.scrollY,calls=h.scrollCalls.length;
    if(type==='resize'){h.context.innerWidth=800;h.emitWindow(type);}
    else if(type==='hidden'){h.document.visibilityState='hidden';h.emitDocument('visibilitychange');}
    else if(type==='help'||type==='mypage')h.click(type);
    else if(type==='orientationchange'||type==='pagehide')h.emitWindow(type);
    else h.emitDocument(type,{key:'ArrowDown'});
    assert.equal(h.evaluate('mainResumeScrollRun'),null,type);assert(stale.cancelled);assert.equal(pending.size,0);
    const afterAction=h.context.scrollY,afterCalls=h.scrollCalls.length;
    if(type!=='mypage'){assert.equal(afterAction,position,type);assert.equal(afterCalls,calls,type);}
    stale.fn(100+run.duration);assert.equal(h.context.scrollY,afterAction,type);assert.equal(h.scrollCalls.length,afterCalls,type);
    if(type!=='pagehide'){h.evaluate('render();syncGuidanceReminders()');assert.equal(h.scrollCalls.length,afterCalls,type);}
  }
});

test('V6.2.2 retains height-only resize and ordinary rendering, and changing reduced motion ends at the target',()=>{
  const {h,run,frame,pending}=setup();let onChange,removed=false;
  // Restart this motion with an observable preference subscription.
  h.evaluate('cancelMainResumeScroll();mainResumeVisible=false');
  h.media.addEventListener=(type,fn)=>{onChange=fn;};h.media.removeEventListener=(type,fn)=>{removed=fn===onChange;};
  h.evaluate('syncMainResumeScroll()');const fresh=h.evaluate('mainResumeScrollRun');fresh.timer.fn();frame(0);frame(16);frame(32);frame(32+fresh.duration/2);
  const position=h.context.scrollY,calls=h.scrollCalls.length;
  h.context.innerHeight=750;h.emitWindow('resize');h.evaluate('render();renderPanel();syncGuidanceReminders()');
  assert.equal(h.evaluate('mainResumeScrollRun'),fresh);assert.equal(h.context.scrollY,position);assert.equal(h.scrollCalls.length,calls);
  h.media.matches=true;onChange();assert.equal(h.context.scrollY,766);assert.equal(h.evaluate('mainResumeScrollRun'),null);assert.equal(pending.size,0);assert(removed);
});
