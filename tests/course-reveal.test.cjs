const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/ui-harness.cjs');

function setup(version,{reducedMotion=false,count=8}={}){
  const h=harness(undefined,{reducedMotion,appSource:fs.readFileSync('dist/versions/'+version+'/app.js','utf8')}),grid=h.node('#programs');
  const cards=Array.from({length:count},(_,i)=>{const card=h.node('course-card-'+i);card.classList.add('program-card');card.disabled=i>0;return card;});
  grid.querySelectorAll=selector=>selector==='.program-card'?cards:[];
  h.click('diagnosis');h.click('diagnosis-begin');
  for(const answer of [0,0,0]){h.click('diagnosis-answer',answer);h.click('diagnosis-next');}
  const preparingAsPopup=h.node('#learning').classList.contains('diagnosis-post-flow');
  // Exercise the existing replay path for courses larger than this topic's normal eight cards.
  if(count!==8){h.evaluate(`cancelComposition();beginComposition(${count},'first')`);}
  h.evaluate('composeTimers.find(t=>t.ms===8000)').fn();
  return {h,grid,cards,preparingAsPopup};
}

for(const version of ['v48','v49']){
  test(version+' forms the course after the dim, preserves stable renders, and releases each real card after arrival',()=>{
    const {h,grid,cards,preparingAsPopup}=setup(version),run=h.evaluate('cardRevealRun'),end=h.evaluate('cardRevealTimer');
    assert.equal(preparingAsPopup,version==='v49');assert.equal(h.node('#learning').open,false);
    assert(grid.classList.contains('reveal'));assert.equal(grid.getAttribute('aria-busy'),'true');
    assert.equal(grid.style['--course-reveal-wait'],'440ms');assert(h.evaluate('COURSE_REVEAL.wait')>400);
    assert.equal(cards.every(card=>card.inert),true);assert.equal(h.evaluate('current().programs.length'),8);
    assert(grid.innerHTML.includes('--prescription-delay:735ms'));
    h.evaluate('render();daily().variant++;render();render()');assert.equal(h.evaluate('cardRevealRun'),run);assert.equal(h.evaluate('cardRevealTimer'),end);
    grid.emit('animationend',{target:cards[0],animationName:'unrelated'});assert.equal(cards[0].inert,true);
    grid.emit('animationend',{target:cards[0],animationName:'prescription-card-arrive'});
    assert.equal(cards[0].inert,false);assert.equal(cards[0].style.animation,'none');assert.equal(cards[1].inert,true);
    assert.equal(cards[1].disabled,true,'animation never unlocks a locked lesson');
    assert(h.evaluate('cardRevealRun.inviteAt')>h.evaluate('COURSE_REVEAL.wait+7*COURSE_REVEAL.stagger+COURSE_REVEAL.card'));
    end.fn();assert.equal(h.evaluate('cardRevealRun'),null);assert.equal(grid.getAttribute('aria-busy'),'false');
    assert.equal(cards.every(card=>!card.inert&&card.style.animation===''),true);
    assert.equal(h.node('#learning-context').classList.contains('is-course-revealing'),false);
    h.evaluate('render()');assert.equal(h.evaluate('cardRevealRun'),null);
  });

  test(version+' pauses its course while hidden and ignores stale endings after resume or a new prescription',()=>{
    const {h,grid,cards}=setup(version),oldEnd=h.evaluate('cardRevealTimer');
    h.document.visibilityState='hidden';h.emitDocument('visibilitychange');
    assert.equal(grid.getAttribute('data-course-paused'),'true');assert.equal(h.evaluate('cardRevealTimer'),null);
    oldEnd.fn();assert(grid.classList.contains('reveal'));
    h.document.visibilityState='visible';h.emitDocument('visibilitychange');const resumed=h.evaluate('cardRevealTimer');
    assert.equal(grid.getAttribute('data-course-paused'),'false');assert(resumed);oldEnd.fn();assert(grid.classList.contains('reveal'));
    h.evaluate("beginComposition(8,'repeat')");assert.equal(cards.every(card=>!card.inert),true);
    h.evaluate('composeTimers.find(t=>t.ms===7000)').fn();const latest=h.evaluate('cardRevealRun');
    resumed.fn();assert.equal(h.evaluate('cardRevealRun'),latest);assert(grid.classList.contains('reveal'));
    h.evaluate('select(3,1)');assert.equal(h.evaluate('cardRevealRun'),null);assert.equal(grid.getAttribute('aria-busy'),'false');
    assert.equal(cards.every(card=>!card.inert),true);
  });

  test(version+' shows the complete course immediately with reduced motion and cancels reveal when learning starts',()=>{
    const reduced=setup(version,{reducedMotion:true});assert.equal(reduced.h.evaluate('cardRevealRun'),null);
    assert.equal(reduced.h.evaluate('current().programs.length'),8);assert.equal(reduced.grid.classList.contains('reveal'),false);
    const {h,grid,cards}=setup(version);h.click('program',0);
    assert.equal(h.evaluate('cardRevealRun'),null);assert.equal(cards.every(card=>!card.inert),true);
    assert.equal(grid.classList.contains('reveal'),false);assert.equal(h.evaluate('editing.intro'),true);
    assert.equal(h.evaluate('current().programs[0].status'),'idle');
  });

  test(version+' keeps a large course reveal bounded and does not replay after real progress updates',()=>{
    const {h,grid,cards}=setup(version,{count:20});
    assert.equal(h.evaluate('current().programs.length'),20);assert(grid.innerHTML.includes('--prescription-delay:1575ms'));
    assert(h.evaluate('cardRevealRun.remaining')<3700);
    h.evaluate("current().programs[0].status='active';M.setProgress(current().programs[0],50);render()");
    assert.equal(h.evaluate('cardRevealRun'),null);assert.equal(cards.every(card=>!card.inert),true);
    const progress=h.evaluate('current().programs[0].progress');h.evaluate('render()');
    assert.equal(h.evaluate('cardRevealRun'),null);assert.equal(h.evaluate('current().programs[0].progress'),progress);
  });
}
