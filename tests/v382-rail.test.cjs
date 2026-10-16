const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/ui-harness.cjs');
const appSource=fs.readFileSync('dist/versions/v48/app.js','utf8');
const setup=(reducedMotion=false)=>harness(undefined,{reducedMotion,appSource});
function finish(h,pass=false){
  h.click('diagnosis');h.click('diagnosis-begin');
  for(let i=0;i<3;i++){const correct=h.evaluate(`DEMO[${i}].correct`);h.click('diagnosis-answer',pass?correct:(correct+1)%3);h.click('diagnosis-next');}
}
function finishCourse(h){
  finish(h);const total=h.evaluate('composing.total');h.evaluate(`composeTimers.find(t=>t.ms===${total})`).fn();
  h.evaluate('guidanceClosingTimer')?.fn();h.evaluate('cardRevealTimer')?.fn();
}

test('V3.8.2 always shows grade arrows, disables unavailable directions, and keeps the selected study unchanged',()=>{
  const h=setup();h.click('groups');
  assert.deepEqual(h.data('availableRailGrades()'),[3]);
  const arrows=[...h.node('#group-panel').innerHTML.matchAll(/<button class="nav-grade-arrow"[^>]*>/g)].map(m=>m[0]);
  assert.equal(arrows.length,2);assert(arrows.every(arrow=>arrow.includes('disabled')));
  h.click('next-grade');assert.equal(h.evaluate('browseGrade'),3);
  h.evaluate("state.grades[1][0].diagnosis='done';state.grades[4][0].diagnosis='active';renderPanel()");
  assert.deepEqual(h.data('availableRailGrades()'),[1,3,4]);
  h.click('prev-grade');assert.equal(h.evaluate('browseGrade'),1);assert.equal(h.evaluate('state.grade'),3);
  h.click('prev-grade');assert.equal(h.evaluate('browseGrade'),1);
  h.click('next-grade');assert.equal(h.evaluate('browseGrade'),3);
  h.click('next-grade');assert.equal(h.evaluate('browseGrade'),4);h.click('next-grade');assert.equal(h.evaluate('browseGrade'),4);
  assert.equal(h.evaluate('state.index'),0);assert.equal(h.node('#learning').open,false);
});

function motionSetup({reducedMotion=false,width=1280,count=12}={}){
  const h=setup(reducedMotion),calls=[];h.context.innerWidth=width;
  h.node('#learning-workspace').getBoundingClientRect=()=>({width:width-276});
  const cards=Array.from({length:count},(_,i)=>{
    const card=h.node('moving-card-'+i);
    card.getBoundingClientRect=()=>{
      if(card.visual)return card.visual;
      const open=h.node('body').classList.contains('learning-navigation-open'),columns=open?3:4;
      const left=(open?342:110)+i%columns*244,top=240+Math.floor(i/columns)*248;
      return {left,top,width:228,height:232,right:left+228,bottom:top+232};
    };
    card.animate=(frames,options)=>{
      let finish;const animation={cancelled:false,finished:new Promise(resolve=>{finish=resolve;}),cancel(){this.cancelled=true;card.visual=null;}};
      calls.push({i,frames,options,animation,finish});return animation;
    };return card;
  });
  h.document.querySelectorAll=selector=>selector==='#programs>.program-card'?cards:[];
  h.node('main').animate=()=>assert.fail('the main should not flash during card movement');
  return {h,cards,calls};
}

test('V3.8.2 carries cards into three columns on a shared smooth timeline and retains card width',()=>{
  const {h,cards,calls}=motionSetup({count:20});h.evaluate('M.preset(state,4);render()');const before=h.data('current()');h.click('groups');
  assert.equal(h.node('#learning-workspace').style['--navigation-columns'],'3');
  assert.equal(h.node('#learning-workspace').style['--navigation-card-width'],'228px');
  assert(calls.length>4);assert(calls.length<cards.length,'offscreen-only cards do not animate');
  const wrapped=calls.find(call=>call.i===3);
  assert.equal(wrapped.frames[0].transform,'translate3d(500px,-248px,0)');
  assert.equal(wrapped.frames[1].transform,'none');assert.equal(wrapped.options.duration,600);
  assert.deepEqual(calls.map(c=>c.options.delay),calls.map((_,i)=>Math.min(i,4)*14));
  assert(calls.every(c=>c.options.fill==='both'&&!('opacity' in c.frames[0])));
  assert.deepEqual(h.data('current()'),before);assert.equal(h.node('#overlay').hidden,true);
  assert.equal(h.node('#programs').getAttribute('data-layout-motion'),'true');
});

test('reflow batches all style reads, moves headings with the cards, and synchronizes native start times',async()=>{
  const {h,calls}=motionSetup(),events=[],headings=[];
  h.document.timeline={currentTime:1234};
  h.context.getComputedStyle=()=>{events.push('read');return {transform:'none'};};
  for(const selector of ['.ai','.heading','#learning-context']){
    const element=h.node(selector);element.hidden=false;
    element.getBoundingClientRect=()=>{const left=h.node('body').classList.contains('learning-navigation-open')?342:110;return {left,top:50,width:920,height:50,right:left+920,bottom:100};};
    element.animate=(frames,options)=>{events.push('animate');let finish;const animation={finished:new Promise(resolve=>{finish=resolve;}),cancel(){}};headings.push({frames,options,animation,finish});return animation;};
  }
  h.click('groups');assert.equal(headings.length,3);
  assert(headings.every(c=>c.options.delay===0&&c.frames[0].transform==='translate3d(-232px,0px,0)'));
  assert([...headings,...calls].every(c=>c.animation.startTime===1234));
  assert(!events.slice(events.indexOf('animate')).includes('read'),'no style read after native animations have started');
  [...headings,...calls].forEach(c=>c.finish());await Promise.resolve();
  assert.equal(h.node('#programs').getAttribute('data-layout-motion'),null);
});

test('V3.8.2 reflow resumes from an interrupted visual position and releases animations after completion or content replacement',async()=>{
  const {h,cards,calls}=motionSetup();h.click('groups');const first=calls.slice();
  cards[3].visual={left:600,top:340,width:228,height:232,right:828,bottom:572};
  h.click('close-panel');assert(first.every(c=>c.animation.cancelled));
  const reverse=calls.slice(first.length),wrapped=reverse.find(c=>c.i===3);
  assert.equal(wrapped.frames[0].transform,'translate3d(-242px,100px,0)');
  first.forEach(c=>c.finish());await Promise.resolve();assert(reverse.every(c=>!c.animation.cancelled),'stale finishes leave the new run alone');
  reverse.forEach(c=>c.finish());await Promise.resolve();
  assert(reverse.every(c=>c.animation.cancelled));assert.equal(h.evaluate('studyLayoutAnimations.length'),0);
  assert.equal(h.node('#programs').getAttribute('data-layout-motion'),null);
  h.click('groups');const mounted=calls.filter(c=>!c.animation.cancelled);
  h.evaluate('current().diagnosis="done";current().programs=M.programs(8);render()');
  assert(mounted.every(c=>c.animation.cancelled));assert.equal(h.evaluate('studyLayoutAnimations.length'),0);
});

test('V3.8.2 keeps FHD stationary, respects reduced motion, and preserves the separate course reveal',()=>{
  for(const options of [{width:1920},{width:650},{reducedMotion:true}]){
    const {h,calls}=motionSetup(options);h.click('groups');h.click('close-panel');assert.equal(calls.length,0);
  }
  const {h,calls}=motionSetup();
  h.evaluate('cardRevealRun={target:current(),cards:[],remaining:500}');h.evaluate('changeNavigationDock(true)');
  assert.equal(calls.length,0);assert(h.evaluate('!!cardRevealRun'));
});

test('mentor bubbles no longer advertise the retiring help feature, including legacy unread-answer states',()=>{
  const h=setup();
  for(let preset=0;preset<=9;preset++){
    h.evaluate(`M.preset(state,${preset});daily().unreadAnswers=2;render()`);
    const lines=h.data('[mentorOverviewLine(),...mentorReminderLines()]');
    assert(lines.length>1);assert(lines.every(line=>!line.includes('도와줘요')&&!line.includes('새 답변')));
  }
});

test('the pinned grade progress counts completed diagnoses, including prescriptions still being studied, rather than finished cards',()=>{
  const h=setup();h.evaluate(`
    const topics=state.grades[3];topics[0].diagnosis='done';topics[0].programs=M.programs(8);topics[1].diagnosis='done';
    topics[2].diagnosis='active';topics[2].diagnosticSession={index:1,answers:[0]};render();
  `);h.click('groups');
  assert.deepEqual(h.data('railGradeProgress()'),{total:19,completed:2,percent:11});
  const html=h.node('#group-panel').innerHTML;
  assert.match(html,/<\/div><\/div><footer class="nav-grade-progress/);
  assert.match(html,/<progress max="19" value="2" aria-label="D등급 실력 알기 진행률"/);
  assert.match(html,/전체 19개 중 2개 완료, 11%/);
  const visibleFooter=html.slice(html.indexOf('<footer')).replace(/<[^>]+>/g,'').replace(/\s+/g,' ');
  assert.match(visibleFooter,/D등급 실력알기완료 2 \/ 19/);assert(!visibleFooter.includes('진행률'));assert(!visibleFooter.includes('%'));
  h.evaluate("state.grades[3][2].diagnosis='done';renderPanel()");assert.equal(h.evaluate('railGradeProgress().completed'),3);
  h.evaluate("state.grades[4][0].diagnosis='active';renderPanel()");h.click('next-grade');
  assert.deepEqual(h.data('railGradeProgress()'),{total:27,completed:0,percent:0});
  assert.match(h.node('#group-panel').innerHTML,/E등급 실력알기/);assert.equal(h.evaluate('state.grade'),3);
  assert.deepEqual(h.data('railGradeProgress(99)'),{total:0,completed:0,percent:0});
});

test('the rail help explains status icons; blank study space closes the rail while interactive study controls keep working',()=>{
  const h=setup(true);h.click('groups');h.click('help');assert.equal(h.node('#help').open,true);
  assert.match(h.node('#help').innerHTML,/실력 알기 또는 맞춤 학습/);assert.match(h.node('#help').innerHTML,/아직 실력 알기를 시작하지/);
  h.emitDocument('click',{target:{closest(){return null;}}});assert.equal(h.evaluate('panel'),'groups');
  h.click('close-help');h.click('mentor-repeat');assert.equal(h.evaluate('panel'),'groups');
  const blank={closest(selector){return selector==='#learning-workspace'?h.node('#learning-workspace'):null;}};
  h.emitDocument('click',{target:blank});assert.equal(h.evaluate('panel'),null);assert.equal(h.node('#group-panel').hidden,true);
  h.click('groups');h.click('select-group',1);assert.equal(h.evaluate('state.index'),0,'unstarted topics remain disabled');
});

test('the result cue waits for both the dim exit and the actual card reveal, appears once, and does not restart on stable renders or reload',()=>{
  const h=setup();finish(h);
  assert.equal(h.node('#diagnosis-result-hint').hidden,true);
  h.evaluate('composeTimers.find(t=>t.ms===8000)').fn();assert.equal(h.evaluate('state.ui.diagnosisResultHintSeen'),undefined);
  assert.equal(h.node('#diagnosis-result-hint').hidden,true);h.evaluate('guidanceClosingTimer').fn();
  assert.equal(h.node('#diagnosis-result-hint').hidden,true,'cards are still arriving');
  h.evaluate('cardRevealTimer').fn();assert.equal(h.node('#diagnosis-result-hint').hidden,false);
  assert.equal(h.node('#diagnosis-result-hint').textContent,'실력알기 결과를 확인해보세요!');
  assert(h.node('#diagnostic').innerHTML.includes('<strong>실력알기 결과 확인</strong>'));
  assert.equal(h.node('#diagnostic').getAttribute('aria-describedby'),'diagnosis-result-hint');
  assert.equal(h.evaluate('state.ui.diagnosisResultHintSeen'),true);
  const timer=h.evaluate('diagnosisResultHintTimer');h.evaluate('render();render()');assert.equal(h.evaluate('diagnosisResultHintTimer'),timer);
  timer.fn();assert.equal(h.node('#diagnosis-result-hint').hidden,true);h.evaluate('render()');assert.equal(h.node('#diagnosis-result-hint').hidden,true);
  const restored=harness(h.saved(),{appSource});assert.equal(restored.node('#diagnosis-result-hint').hidden,true);
  h.evaluate('select(3,1)');finishCourse(h);assert.equal(h.node('#diagnosis-result-hint').hidden,true);
});

test('opening the result before the cue counts as discovery; modal or hidden states never keep the cue over another screen',()=>{
  const h=setup();finish(h);h.evaluate('composeTimers.find(t=>t.ms===8000)').fn();
  h.click('diagnosis');assert.equal(h.evaluate('editing.kind'),'diagnosis-result');assert.equal(h.evaluate('state.ui.diagnosisResultHintSeen'),true);
  assert.equal(h.node('#diagnosis-result-hint').hidden,true);h.click('close-learning');h.evaluate('guidanceClosingTimer').fn();
  assert.equal(h.node('#diagnosis-result-hint').hidden,true);
  const next=setup();finishCourse(next);assert.equal(next.node('#diagnosis-result-hint').hidden,false);
  next.click('test');assert.equal(next.node('#diagnosis-result-hint').hidden,true);next.click('close-panel');assert.equal(next.node('#diagnosis-result-hint').hidden,true);
});

test('validation cases deliberately re-arm the result cue, stale cue timers cannot hide the new cue, and clean passes have no cue',()=>{
  const h=setup(true);h.click('preset',3);assert.equal(h.node('#diagnosis-result-hint').hidden,false);
  const old=h.evaluate('diagnosisResultHintTimer');h.click('preset',3);const current=h.evaluate('diagnosisResultHintRun');
  old.fn();assert.equal(h.evaluate('diagnosisResultHintRun'),current);assert.equal(h.node('#diagnosis-result-hint').hidden,false);
  h.click('preset',0);assert.equal(h.node('#diagnosis-result-hint').hidden,true);finish(h,true);
  assert.equal(h.evaluate('current().programs.length'),0);assert.equal(h.node('#diagnosis-result-hint').hidden,true);
  assert.equal(h.node('#learning').classList.contains('diagnosis-post-flow'),false);
});


test('the rail retains all topics and uses scroll overflow for its fading list and accessible hint without a down-arrow',()=>{
  const h=setup(),list=h.node('#group-panel .group-list');let bindings=0;
  const subscribe=list.addEventListener.bind(list);list.addEventListener=(type,fn,options)=>{if(type==='scroll')bindings++;subscribe(type,fn,options);};
  Object.assign(list,{scrollHeight:1300,clientHeight:470,scrollTop:0});h.click('groups');
  assert.equal(bindings,1);assert.equal(h.node('#rail-scroll-hint').hidden,false);assert.equal(list.getAttribute('data-has-more'),'true');
  assert.equal(list.getAttribute('aria-describedby'),'rail-scroll-hint');
  const html=h.node('#group-panel').innerHTML;
  assert(!html.includes('rail-list-more'));assert(!appSource.includes('rail-list-more'));
  assert.equal((html.match(/class="nav-topic-number"/g)||[]).length,19);assert(html.includes('>08</span>'));assert(html.includes('>19</span>'));
  assert(html.includes('aria-labelledby="nav-topic-heading" tabindex="0"'));
  list.scrollTop=400;list.emit('scroll');h.evaluate('renderPanel();renderPanel()');assert.equal(bindings,1);assert.equal(list.scrollTop,400);
  assert.equal(h.node('#rail-scroll-hint').hidden,false);
  list.scrollTop=830;list.emit('scroll');assert.equal(h.node('#rail-scroll-hint').hidden,true);assert.equal(list.getAttribute('data-has-more'),'false');assert.equal(list.getAttribute('aria-describedby'),null);
  list.scrollTop=0;list.emit('scroll');assert.equal(h.node('#rail-scroll-hint').hidden,false);
  list.clientHeight=1500;h.evaluate('syncRailOverflow()');assert.equal(h.node('#rail-scroll-hint').hidden,true);
  list.clientHeight=0;h.evaluate('syncRailOverflow()');assert.equal(h.node('#rail-scroll-hint').hidden,true);
  assert.equal(h.evaluate('railHasMoreBelow(500,500,0)'),false);assert.equal(h.evaluate('railHasMoreBelow(1000,400,-5)'),true);
});
