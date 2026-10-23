const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/ui-harness.cjs');
const stage=h=>h.evaluate('diagnosisOutcomeRun?.target.diagnosisOutcome?.stage');
function advance(h){const timer=h.evaluate('diagnosisOutcomeTimer');assert(timer&&!timer.cancelled);timer.fn();}
function reach(h,phase){for(let i=0;stage(h)!==phase&&i<12;i++)advance(h);assert.equal(stage(h),phase);}
function finish(h){for(let i=0;h.evaluate('!!diagnosisOutcomeRun')&&i<12;i++)advance(h);assert.equal(stage(h),undefined);}
function realPass(h){h.click('diagnosis');h.click('diagnosis-begin');for(let i=0;i<3;i++){h.click('diagnosis-answer',h.evaluate(`DEMO[${i}].correct`));h.click('diagnosis-next');}}

test('V6.4 rewards over a complete clover, checks off the current topic, moves selection and then introduces the next topic',()=>{
 const h=harness(undefined,{reducedMotion:false});realPass(h);
 const result=h.data('current().diagnosticResult');
 assert.equal(h.node('#composition-title').textContent,'실력알기를 통과했어요!');
 assert(h.node('#diagnosis-inline-summary').innerHTML.includes('정답 3개 · 오답 0개'));
 assert.equal(h.node('#composition-copy').textContent,'');assert.equal(h.node('#composition-message').hidden,true);
 h.evaluate('diagnosisOutcomeRun.background="<div>old-question-screen</div>"');h.click('diagnosis-outcome-confirm');
 assert.equal(stage(h),'reward');assert(!h.node('#learning').innerHTML.includes('old-question-screen'));
 assert(!h.node('#learning').innerHTML.includes('diagnosis-outcome-background'));
 assert.equal(h.node('#diagnosis-welcome').hidden,false);assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'100');
 assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('data-fill-arrival'),'false');
 assert.equal(h.node('#diagnosis-clover-fill').style['--clover-fill-start'],'0px');
 assert.equal(h.node('#diagnosis-clover-fill').style['--clover-fill-end'],'0px');
 reach(h,'clover-glow');assert.equal(h.node('#learning').open,false);
 assert.equal(h.document.body.getAttribute('data-diagnosis-advance'),'clover-glow');
 assert.equal(h.node('#learning-workspace').inert,true);assert.equal(h.evaluate('state.index'),0);
 advance(h);assert.equal(stage(h),'rail-open');assert.equal(h.evaluate('panel'),'groups');
 assert.equal(h.evaluate('railGradeProgress().completed'),0);assert.equal(h.evaluate('current().diagnosis'),'active');
 advance(h);assert.equal(stage(h),'rail-complete');assert.equal(h.evaluate('railGradeProgress().completed'),1);
 assert.equal(h.evaluate('state.index'),0,'the completed row remains selected while its check appears');
 assert.equal(h.evaluate('current().diagnosis'),'done');
 assert(h.node('#group-panel').innerHTML.includes('완료 <b>1</b> / 19'));
 assert(h.node('#group-panel').innerHTML.includes('rail-passed.svg'));
 advance(h);assert.equal(stage(h),'rail-next');assert.equal(h.evaluate('state.index'),1);
 assert.equal(h.evaluate('current().diagnosis'),'idle');assert.equal(h.node('#group-title').textContent,'비교와 분류');
 assert.equal(h.node('#diagnosis-welcome-title').textContent,'클로버를 완성했어요!');
 assert(h.node('#group-panel').innerHTML.includes('data-id="1" aria-current="true"'));
 advance(h);assert.equal(stage(h),'rail-close');assert.equal(h.evaluate('panel'),null);
 assert.equal(h.node('#group-title').textContent,'비교와 분류');
 advance(h);assert.equal(stage(h),'next-entry');assert.equal(h.node('#group-title').textContent,'모으기와 가르기(10)');
 assert.equal(h.node('#diagnosis-welcome-title').textContent,'나의 실력을 알아볼까요?');advance(h);
 assert.equal(h.evaluate('diagnosisOutcomeRun'),null);assert.equal(h.node('#learning-workspace').inert,false);
 assert.equal(h.node('#learning').open,false);assert.equal(h.evaluate('current().diagnosticSession'),undefined);
 assert.equal(h.node('#diagnosis-welcome-title').textContent,'나의 실력을 알아볼까요?');
 assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'0');
 assert.deepEqual(h.data('state.grades[3][0].diagnosticResult'),result);
 h.evaluate('select(3,0)');h.click('recommend');assert.equal(h.node('#learning').open,false);assert.equal(h.evaluate('state.index'),1);assert.equal(h.evaluate('current().diagnosis'),'idle');
 assert.equal(h.evaluate('skyState().totalPieces'),3);assert.equal(h.evaluate('daily().cleanStreak'),1);
 h.click('diagnosis');assert.equal(h.evaluate('current().diagnosis'),'active');
});

test('every automatic handoff stage resumes after reload, credits only once and cannot advance twice from a stale timer',()=>{
 let h=harness(undefined,{reducedMotion:false});realPass(h);h.click('diagnosis-outcome-confirm');reach(h,'clover-glow');
 for(const expected of ['clover-glow','rail-open','rail-complete','rail-next','rail-close','next-entry']){
  assert.equal(stage(h),expected);const saved=h.saved();h=harness(saved,{reducedMotion:false});
  assert.equal(stage(h),expected);assert.equal(h.node('#learning').open,false);assert.equal(h.evaluate('skyState().totalPieces'),3);
  const stale=h.evaluate('diagnosisOutcomeTimer');advance(h);const next=stage(h);stale.fn();assert.equal(stage(h),next);
 }
 assert.equal(h.evaluate('state.index'),1);assert.equal(h.evaluate('daily().cleanStreak'),1);
 assert.equal(h.evaluate('state.diagnosisAdvance'),undefined);assert.equal(h.evaluate('state.grades[3][0].diagnosisOutcome'),undefined);
});

test('hidden pages pause each handoff step and direct scenario/navigation cancellation releases locks and invalidates pending callbacks',()=>{
 const h=harness(undefined,{reducedMotion:false});h.click('replay-clean-pass');h.click('diagnosis-outcome-confirm');reach(h,'clover-glow');
 for(const expected of ['clover-glow','rail-open','rail-complete','rail-next','rail-close','next-entry']){
  assert.equal(stage(h),expected);const stale=h.evaluate('diagnosisOutcomeTimer');h.document.visibilityState='hidden';h.emitDocument('visibilitychange');
  assert.equal(h.evaluate('diagnosisOutcomeTimer'),null);stale.fn();assert.equal(stage(h),expected);
  assert.equal(h.node('#diagnosis-welcome').getAttribute('data-welcome-motion'),'paused');
  h.document.visibilityState='visible';h.emitDocument('visibilitychange');advance(h);
 }
 for(const phase of ['clover-glow','rail-next']){
  h.click('replay-clean-pass');h.click('diagnosis-outcome-confirm');reach(h,phase);const stale=h.evaluate('diagnosisOutcomeTimer');
  h.click('preset',0);stale.fn();assert.equal(stage(h),undefined);assert.equal(h.evaluate('state.diagnosisAdvance'),undefined);
  assert.equal(h.node('#learning-workspace').inert,false);assert.equal(h.node('#learning').open,false);
 }
 h.click('replay-clean-pass');h.click('diagnosis-outcome-confirm');reach(h,'rail-next');const stale=h.evaluate('diagnosisOutcomeTimer');
 h.evaluate('select(3,4)');stale.fn();assert.equal(h.evaluate('state.index'),4);assert.equal(h.evaluate('state.diagnosisAdvance'),undefined);
});

test('last group advances to the next grade, a final grade stays complete and an existing next program retains its progress',()=>{
 let h=harness();h.evaluate('state.grades[3].forEach(t=>t.diagnosis="done");state.index=state.grades[3].length-1;render()');
 h.click('replay-clean-pass');h.click('diagnosis-outcome-confirm');finish(h);
 assert.equal(h.evaluate('state.grade'),4);assert.equal(h.evaluate('state.index'),0);assert.equal(h.evaluate('current().diagnosis'),'idle');
 h=harness();h.evaluate('state.grade=9;state.grades[9].forEach(t=>t.diagnosis="done");state.index=state.grades[9].length-1;render()');
 h.click('replay-clean-pass');h.click('diagnosis-outcome-confirm');finish(h);
 assert.equal(h.evaluate('state.grade'),9);assert.equal(h.evaluate('current().diagnosis'),'done');
 assert.equal(h.node('#diagnosis-welcome').hidden,false);assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'100');
 h=harness();h.evaluate('const next=state.grades[3][1];next.diagnosis="done";next.programs=M.programs(2,3,1);next.programs[0].status="active";M.setProgress(next.programs[0],40)');
 const programs=h.data('state.grades[3][1].programs');h.click('replay-clean-pass');h.click('diagnosis-outcome-confirm');finish(h);
 assert.equal(h.evaluate('state.index'),1);assert.deepEqual(h.data('current().programs'),programs);assert.equal(h.node('#learning').open,false);
});

test('the resume count precedes the title in the original card and reduced motion disables the completion effects',()=>{
 const html=fs.readFileSync('dist/working/index.html','utf8'),css=fs.readFileSync('dist/working/diagnosis-entry.css','utf8');
 assert(html.indexOf('id="diagnosis-art-count"')<html.indexOf('id="diagnosis-welcome-title"'));
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.match(css,/clover-completion-light 1\.1s/);
 const h=harness(undefined,{reducedMotion:true});h.click('replay-clean-pass');h.click('diagnosis-outcome-confirm');finish(h);
 assert.equal(h.evaluate('current().diagnosis'),'idle');assert.equal(h.evaluate('skyState().totalPieces'),0,'preview never grants pieces');
});

test('the open rail keeps its mounted rows and progress element while the completed/current status changes',()=>{
 const h=harness(undefined,{reducedMotion:false});h.click('replay-clean-pass');h.click('diagnosis-outcome-confirm');reach(h,'rail-complete');
 const host=h.node('#group-panel'),rows=Array.from({length:19},(_,i)=>h.node('rail-row-'+i)),icons=rows.map((_,i)=>h.node('rail-icon-'+i));
 const bar=h.node('mounted-rail-progress'),count=h.node('mounted-rail-count');
 rows.forEach((row,i)=>{row.querySelector=()=>icons[i];row.classList.toggle=(name,on)=>on?row.classList.add(name):row.classList.remove(name);row.setAttribute('data-state',i===0?'active':'idle');});
 host.querySelectorAll=selector=>selector==='.group-item'?rows:[];
 host.querySelector=selector=>selector.includes('progress progress')?bar:count;
 const before=host.innerHTML;advance(h);
 assert.equal(stage(h),'rail-next');assert.equal(host.innerHTML,before,'no full-panel replacement during the status handoff');
 assert.equal(rows[0].getAttribute('data-state'),'clean');assert.equal(rows[1].getAttribute('aria-current'),'true');
 assert.equal(rows[1].getAttribute('data-state'),'active');assert.equal(bar.getAttribute('value'),'1');
 assert.equal(bar.getAttribute('max'),'19');assert(count.innerHTML.includes('<b>1</b>'));
});

test('the selection background uses measured row geometry, moves without changing list scroll, and pauses on hidden pages',()=>{
 const h=harness(undefined,{reducedMotion:false});h.click('replay-clean-pass');h.click('diagnosis-outcome-confirm');reach(h,'rail-complete');
 const layer=h.node('#rail-current-highlight'),list=h.node('#group-panel .group-list'),row=h.node('#group-panel .group-item[aria-current="true"]');
 list.scrollTop=80;list.getBoundingClientRect=()=>({left:20,top:100,width:260,height:500});
 let top=100;row.getBoundingClientRect=()=>({left:20,top,width:260,height:52});
 const motions=[];layer.animate=(frames,options)=>{const motion={frames,options,paused:false,cancelled:false,pause(){this.paused=true;},play(){this.paused=false;},cancel(){this.cancelled=true;}};motions.push(motion);return motion;};
 h.evaluate('clearCleanPassRailSelection();syncCleanPassRailSelection()');assert.equal(layer.style.transform,'translate3d(0px,80px,0)');
 top=168;advance(h);assert.equal(stage(h),'rail-next');assert.equal(list.scrollTop,80);
 assert.equal(motions.length,1);assert.equal(motions[0].frames[0].transform,'translate3d(0px,80px,0)');
 assert.equal(motions[0].frames[1].transform,'translate3d(0px,148px,0)');assert.equal(motions[0].options.duration,760);
 h.evaluate('renderPanel();syncCleanPassRailSelection()');assert.equal(motions.length,1,'stable renders retain the one moving layer');
 h.document.visibilityState='hidden';h.emitDocument('visibilitychange');assert.equal(motions[0].paused,true);
 h.document.visibilityState='visible';h.emitDocument('visibilitychange');assert.equal(motions[0].paused,false);
 h.click('preset',0);assert.equal(motions[0].cancelled,true);
});

test('an older pending fill phase resumes as a complete-clover glow, with no refill or repeated reward',()=>{
 const h=harness();realPass(h);h.click('diagnosis-outcome-confirm');reach(h,'clover-glow');
 const saved=h.saved();saved.grades[3][0].diagnosisOutcome.stage='clover-complete';
 const restored=harness(saved,{reducedMotion:false});assert.equal(stage(restored),'clover-glow');
 assert.equal(restored.node('#diagnosis-welcome-progress').getAttribute('data-fill-arrival'),'false');
 assert.equal(restored.node('#diagnosis-clover-fill').style['--clover-fill-start'],'0px');
 finish(restored);assert.equal(restored.evaluate('skyState().totalPieces'),3);assert.equal(restored.evaluate('daily().cleanStreak'),1);
});
