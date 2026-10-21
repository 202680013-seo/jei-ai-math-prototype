const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/ui-harness.cjs');
const {MathModel:M}=require('../dist/versions/v66/model.js');
const appSource=fs.readFileSync('dist/versions/v66/app.js','utf8');
function fixture(count=20,index=12){
  const state=M.create(),topic=state.grades[3][0];topic.diagnosis='done';topic.programs=M.programs(count);
  topic.programs.slice(0,index).forEach(p=>{p.status='passed';M.setProgress(p,100);});
  if(topic.programs[index]){topic.programs[index].status='active';M.setProgress(topic.programs[index],50);}
  return state;
}
function cardSelector(id,finished=false){return finished?'#programs > .program-card[data-id="'+id+'"]':'#programs [data-action="program"][data-id="'+id+'"]';}
function setup(saved=fixture(),options={}){
  const rects={'.ai':{height:160}};
  for(let id=0;id<30;id++)for(const done of [false,true])rects[cardSelector(id,done)]=c=>({top:500+id*100-c.scrollY,height:232});
  return harness(saved,{reducedMotion:false,initialScroll:840,appSource,rects,...options});
}
function depart(h){const run=h.evaluate('mainResumeScrollRun');assert(run);assert.equal(run.timer.ms,600);run.timer.fn();return run;}
function finish(h){const run=depart(h);h.emitWindow('scrollend');assert.equal(h.evaluate('mainResumeScrollRun'),null);return run;}
function releaseDim(h){const timer=h.evaluate('guidanceClosingTimer');if(timer&&!timer.cancelled)timer.fn();}

test('V6.2.2 chooses active first, otherwise the last eligible start or completed review card',()=>{
  const h=setup(),before=h.data('current()');assert.equal(h.evaluate('mainResumeProgram(current()).id'),12);finish(h);assert.deepEqual(h.data('current()'),before);
  const idle=fixture();idle.grades[3][0].programs[12].status='idle';const ready=setup(idle);assert.equal(ready.evaluate('mainResumeProgram(current()).id'),12);finish(ready);
  const completed=fixture();completed.grades[3][0].programs.forEach(p=>{p.status='passed';M.setProgress(p,100);});
  const last=setup(completed);assert.equal(last.evaluate('mainResumeProgram(current()).id'),19);finish(last);
  assert.equal(last.scrollCalls.at(-1).top,2036,'completed-card geometry is used');
  const locked=fixture();locked.grades[3][0].programs[12].status='locked';const previous=setup(locked);assert.equal(previous.evaluate('mainResumeProgram(current()).id'),11);
  const closed=M.create();closed.grades[3][0].diagnosis='done';closed.grades[3][0].programs=M.programs(3);closed.grades[3][0].programs.forEach(p=>p.status='locked');
  const none=setup(closed);assert.equal(none.evaluate('mainResumeScrollRun'),null);assert.equal(none.scrollCalls.length,0);
});

test('V6.2.2 uses measured sticky header top/card/document dimensions and only missing tail room on PC and mobile',()=>{
  for(const c of [
    {width:1920,height:900,header:220,top:24,cardTop:2100,cardHeight:200,base:120},
    {width:390,height:844,header:196,top:8,cardTop:2400,cardHeight:180,base:116}
  ]){
    const saved=fixture(20,19),natural=c.cardTop+c.cardHeight+c.base;
    const prefix=`
      window.innerWidth=${c.width};
      window.getComputedStyle=element=>element===document.querySelector('.ai')?{position:'sticky',top:'${c.top}px'}:element===document.querySelector('main')?{paddingBottom:(document.body.classList.contains('has-resume-scroll-space')?Math.max(${c.base},parseFloat(element.style['--resume-scroll-space'])||0):${c.base})+'px'}:{transform:'none'};
      document.scrollingElement={clientHeight:${c.height},get scrollHeight(){const main=document.querySelector('main');return ${natural}+(document.body.classList.contains('has-resume-scroll-space')?Math.max(${c.base},parseFloat(main.style['--resume-scroll-space'])||0)-${c.base}:0);}};
    `;
    const h=setup(saved,{viewportHeight:c.height,appSource:prefix+appSource,rects:{'.ai':{height:c.header},[cardSelector(19)]:ctx=>({top:c.cardTop-ctx.scrollY,height:c.cardHeight})}});
    const before=h.data('current().programs'),center=(c.height+c.header+c.top)/2,target=c.cardTop+c.cardHeight/2-center;
    assert.equal(h.scrollCalls.length,1);assert.equal(h.context.scrollY,0);finish(h);
    assert.equal(h.scrollCalls.at(-1).top,target);assert.equal(h.scrollCalls.at(-1).behavior,'smooth');
    const rect=h.node(cardSelector(19)).getBoundingClientRect();assert.equal(rect.top+rect.height/2,center);
    const required=Math.max(0,target+c.height+4-natural);assert.equal(h.evaluate('mainResumeExtra'),Math.ceil(required));
    assert.equal(h.node('main').style['--resume-scroll-space'],Math.ceil(c.base+required)+'px');
    h.evaluate('setMainResumeSpace(mainResumeGeometry(mainResumeProgram(current())))');
    assert.equal(h.node('main').style['--resume-scroll-space'],Math.ceil(c.base+required)+'px','tail does not accumulate');
    assert.deepEqual(h.data('current().programs'),before);
  }
});

test('V6.2.2 does not subtract a header that scrolls normally',()=>{
  const prefix="window.getComputedStyle=()=>({position:'relative',top:'30px',paddingBottom:'100px'});";
  const h=setup(fixture(),{appSource:prefix+appSource});finish(h);assert.equal(h.scrollCalls.at(-1).top,1416);
});

test('V6.2.2 preserves manual position on ordinary updates and requests exactly once when a new card opens',()=>{
  const h=setup();const initial=finish(h);h.context.scrollY=333;const calls=h.scrollCalls.length,listeners=(h.events.get('click')||[]).length;
  h.evaluate('render();render();current().programs[12].progress=70;render();syncGuidanceReminders()');
  assert.equal(h.context.scrollY,333);assert.equal(h.scrollCalls.length,calls);assert.equal(h.evaluate('mainResumeScrollRun'),null);
  h.evaluate("current().programs[12].status='passed';M.setProgress(current().programs[12],100);render()");
  const next=h.evaluate('mainResumeScrollRun');assert(next);assert.equal(next.programId,13);assert.equal(h.context.scrollY,0);assert.equal(h.scrollCalls.length,calls+1);
  h.evaluate('render();render();syncGuidanceReminders()');assert.equal(h.evaluate('mainResumeScrollRun'),next);assert.equal(h.scrollCalls.length,calls+1);
  finish(h);assert.equal((h.events.get('click')||[]).length,listeners);assert.equal(initial.phase,'moving');
  h.evaluate("state.grades[3][1].diagnosis='done';state.grades[3][1].programs=M.programs(20);state.grades[3][1].programs[0].status='active';select(3,1)");
  const topic=h.evaluate('mainResumeScrollRun');assert(topic);assert.equal(topic.programId,0);assert.notEqual(topic,next);
});

test('V6.2.2 cancels a scrollbar/accessibility scroll during the wait and does not re-arm on stable renders',()=>{
  const h=setup(),run=h.evaluate('mainResumeScrollRun'),timer=run.timer,calls=h.scrollCalls.length;
  h.context.scrollY=128;h.emitWindow('scroll');assert.equal(h.evaluate('mainResumeScrollRun'),null);assert.equal(timer.cancelled,true);
  h.evaluate('render();syncGuidanceReminders()');timer.fn();assert.equal(h.context.scrollY,128);assert.equal(h.scrollCalls.length,calls);
  const other=setup(),pending=other.evaluate('mainResumeScrollRun'),stale=pending.timer;other.click('help');assert.equal(other.evaluate('mainResumeScrollRun'),null);stale.fn();assert.equal(other.scrollCalls.length,1);
});

test('V6.2.2 returns from a lesson or my-learning once, retains answers/progress and honors reduced motion',()=>{
  const h=setup(),before=h.data('current().programs');finish(h);h.click('program',12);assert.equal(h.evaluate('mainResumeScrollRun'),null);
  h.click('close-learning');releaseDim(h);const back=h.evaluate('mainResumeScrollRun');assert(back);assert.equal(back.programId,12);finish(h);assert.deepEqual(h.data('current().programs'),before);
  h.click('mypage');const count=h.scrollCalls.length;h.click('back-main');
  assert.equal(h.scrollCalls.length,count+1,'no competing old-position restore');finish(h);
  const reduced=setup(fixture(),{reducedMotion:true});depart(reduced);assert.equal(reduced.scrollCalls.at(-1).behavior,'instant');assert.equal(reduced.evaluate('mainResumeScrollRun'),null);
});

function railGeometry(h,height=216,stride=84,rowHeight=72){
  const list=h.node('#group-panel .group-list'),count=h.evaluate('state.grades[browseGrade].length');let scroll=0;
  list.clientHeight=height;const natural=(count-1)*stride+rowHeight+14;
  Object.defineProperty(list,'scrollHeight',{get:()=>natural+(parseFloat(list.style['--rail-tail-space'])||0)});
  Object.defineProperty(list,'scrollTop',{get:()=>scroll,set:y=>{scroll=Math.max(0,Math.min(y,list.scrollHeight-list.clientHeight));}});
  list.getBoundingClientRect=()=>({top:500,height});
  for(let i=0;i<count;i++)h.node(`#group-panel [data-action="select-group"][data-id="${i}"]`).getBoundingClientRect=()=>({top:500+i*stride-scroll,height:rowHeight});
  h.node('#group-panel .group-list>.group-item:last-child').getBoundingClientRect=()=>({bottom:500+(count-1)*stride+rowHeight-scroll});
  return {list,count};
}

test('V6.2.2 outline prioritizes the active topic over a viewed completed topic without scrolling the document on PC/mobile',()=>{
  for(const width of [390,1920]){
    const saved=M.create();saved.grades[3][0].diagnosis='done';saved.grades[3][2].diagnosis='active';
    const h=setup(saved,{initialScroll:640});h.context.innerWidth=width;const before=h.data('state.grades'),{list}=railGeometry(h);h.click('groups');
    assert.equal(h.evaluate('state.index'),0);assert.equal(h.evaluate('railCurrentTopicIndex()'),2);assert.equal(list.scrollTop,168);
    assert.equal(h.context.scrollY,640);assert.equal(h.scrollCalls.length,0);assert.deepEqual(h.data('state.grades'),before);
    list.scrollTop=84;h.evaluate('render();renderPanel()');assert.equal(list.scrollTop,84);assert.equal(h.context.scrollY,640);
    h.click('close-panel');h.click('groups');assert.equal(list.scrollTop,168);
  }
});

test('V6.2.2 outline aligns the final active topic with measured tail and uses the browsed grade',()=>{
  const saved=M.create(),last=saved.grades[3].length-1;saved.grades[3][0].diagnosis='done';saved.grades[3][last].diagnosis='active';
  const h=setup(saved,{initialScroll:640}),{list}=railGeometry(h);h.context.innerWidth=390;h.click('groups');
  assert.equal(list.scrollTop,last*84);assert.equal(list.style['--rail-tail-space'],'130px');assert.equal(h.context.scrollY,640);
  h.evaluate("state.grades[4][3].diagnosis='active';browseGrade=4;railPositionKey=null;");
  // The DOM geometry now represents the newly rendered grade's numbered rows.
  h.node('#group-panel .group-list>.group-item:last-child').getBoundingClientRect=()=>({bottom:500+(h.evaluate('state.grades[4].length')-1)*84+72-list.scrollTop});
  h.evaluate('renderPanel()');assert.equal(h.evaluate('railCurrentTopicIndex()'),3);assert.equal(list.scrollTop,252);assert.equal(h.context.scrollY,640);
});
