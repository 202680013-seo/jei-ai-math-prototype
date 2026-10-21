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
    assert.equal(run.driver,'timed');assert(run.travelDuration>1000&&run.travelDuration<1030);assert(run.duration>run.travelDuration&&run.duration<run.travelDuration*1.4);assert.equal(run.finishTimer,null);
    const geometry=new Map();
    for(const sel of ['.ai',selector]){const node=h.node(sel);geometry.set(node,node.getBoundingClientRect);node.getBoundingClientRect=()=>{throw Error('motion must not read layout');};}
    const origin=1000,positions=[];frame(origin);
    for(let elapsed=1000/hz;elapsed<run.duration;elapsed+=1000/hz){
      frame(origin+elapsed);positions.push(h.context.scrollY);
      h.emitWindow('scroll');h.emitWindow('scrollend');
      assert.equal(h.evaluate('mainResumeScrollRun'),run,'scrollend events must not end the timed driver');
    }
    frame(origin+run.duration+1);
    assert.equal(h.context.scrollY,766);assert.equal(h.evaluate('mainResumeScrollRun'),null);assert.equal(pending.size,0);
    assert.equal(h.node('html').getAttribute('data-resume-scrolling'),null);assert.deepEqual(h.data('current().programs'),before);
    assert(Math.max(...positions)>768.8&&Math.max(...positions)<769.001,'one microscopic overshoot');
    const peak=positions.indexOf(Math.max(...positions));
    assert(positions.slice(0,peak+1).every((y,i,a)=>!i||y>=a[i-1]));
    assert(positions.slice(peak).every((y,i,a)=>!i||y<=a[i-1]));
    assert(positions[0]<3,'gentle departure');assert(Math.abs(766-positions.at(-1))<.1,'gentle arrival');
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
    const {h,run,frame}=setup(distance);assert(run.travelDuration>=900&&run.travelDuration<=1120);assert(run.duration>run.travelDuration&&run.duration<run.travelDuration*1.4);
    frame(0);frame(run.duration);assert.equal(h.context.scrollY,distance);assert.equal(h.evaluate('mainResumeScrollRun'),null);
  }
  const {h,frame}=setup(2000);h.evaluate('cancelMainResumeScroll();mainResumeVisible=false');
  h.document.scrollingElement={scrollHeight:1100,clientHeight:800};h.evaluate('syncMainResumeScroll()');
  const run=h.evaluate('mainResumeScrollRun');run.timer.fn();frame(0);frame(16);
  assert.equal(run.target,300);frame(32);frame(32+run.duration);
  assert.equal(h.context.scrollY,300);assert(h.scrollCalls.every(call=>call.top<=300));
});

test('V6.2.2 merges deceleration into the rebound with continuous position, velocity and acceleration',()=>{
  const {h,run,frame}=setup();const origin=100,join=origin+run.arrival.join*run.travelDuration,step=.1;
  frame(origin);const y=[];
  for(const offset of [-2,-1,0,1,2]){frame(join+offset*step);y.push(h.context.scrollY);}
  const leftVelocity=(y[2]-y[1])/step,rightVelocity=(y[3]-y[2])/step;
  const leftAcceleration=(y[2]-2*y[1]+y[0])/step**2,rightAcceleration=(y[4]-2*y[3]+y[2])/step**2;
  assert(Math.abs(leftVelocity-rightVelocity)<.001,'no velocity seam');
  assert(Math.abs(leftAcceleration-rightAcceleration)<.00001,'no acceleration seam');
  assert(leftVelocity>0&&rightVelocity>0,'no stop at the blend point');
  let previous=h.context.scrollY,crossed=false,peak=previous,negativeSteps=0;
  for(let t=join+5;t<origin+run.duration;t+=5){
    frame(t);const top=h.context.scrollY;peak=Math.max(peak,top);
    if(previous<766&&top>=766){crossed=true;assert(top-previous>.01,'pass through the destination without a pause');}
    if(top<previous)negativeSteps++;previous=top;
  }
  assert(crossed);assert(Math.abs(peak-769)<.001);assert(negativeSteps>10,'gentle easing has time to settle');
  frame(origin+run.duration-1);const almost=h.context.scrollY;assert(Math.abs(almost-766)<.0001);
  frame(origin+run.duration+1);assert.equal(h.context.scrollY,766);assert.equal(h.evaluate('mainResumeScrollRun'),null);
});

test('V6.2.2 last-row overshoot has measured headroom and is never clipped into a pause',()=>{
  const {h,frame}=setup(300);h.evaluate('cancelMainResumeScroll();mainResumeVisible=false;mainResumeSpaceKey=null;mainResumeExtra=0');
  h.node('main').style['--resume-scroll-space']='100px';
  h.context.getComputedStyle=element=>element===h.node('.ai')?{position:'sticky',top:'0px'}:{paddingBottom:h.node('main').style['--resume-scroll-space']};
  h.document.scrollingElement={clientHeight:800,get scrollHeight(){return 896+parseFloat(h.node('main').style['--resume-scroll-space']);}};
  h.evaluate('syncMainResumeScroll()');const run=h.evaluate('mainResumeScrollRun');run.timer.fn();frame(0);frame(16);
  assert.equal(run.target,300);assert.equal(h.document.scrollingElement.scrollHeight-800,304);
  assert.equal(run.overshoot,3);assert(run.arrival);
  const write=h.context.scrollTo;
  h.context.scrollTo=options=>write({...options,top:Math.min(h.document.scrollingElement.scrollHeight-800,Math.max(0,options.top))});
  frame(100);const positions=[];
  for(let elapsed=5;elapsed<run.duration;elapsed+=5){frame(100+elapsed);positions.push(h.context.scrollY);}
  frame(101+run.duration);assert.equal(h.context.scrollY,300);
  assert(Math.max(...positions)>302.99&&Math.max(...positions)<303.01);
  assert(!positions.includes(304),'curve never hits the physical scroll limit');
  const noRoom=setup(300);noRoom.h.evaluate('cancelMainResumeScroll()');noRoom.h.context.scrollY=300;
  noRoom.h.document.scrollingElement={scrollHeight:1100,clientHeight:800};
  noRoom.h.evaluate('mainResumeScrollRun={phase:"preparing"};animateMainResumeScroll(mainResumeScrollRun,0)');
  assert.equal(noRoom.h.evaluate('mainResumeScrollRun.arrival'),null,'use monotone easing when an external range cannot allow overshoot');
  const fallback=noRoom.h.evaluate('mainResumeScrollRun');noRoom.frame(0);noRoom.frame(fallback.duration+1);assert.equal(noRoom.h.context.scrollY,0);
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
