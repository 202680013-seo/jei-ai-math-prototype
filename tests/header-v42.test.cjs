const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {harness}=require('./helpers/ui-harness.cjs');
const metrics=require('./fixtures/header-font-metrics.json');
const normalize=s=>s.replace(/\s+/g,' ').trim();
const measure=s=>Array.from(s).reduce((sum,char)=>sum+(metrics.mentor.glyphWidths[char]??8),0);
function setup(reducedMotion=false){const h=harness(undefined,{reducedMotion});h.node('.ai-top').getBoundingClientRect=()=>({width:616,height:48});h.node('#mentor-measure').getBoundingClientRect=function(){return {width:measure(this.textContent),height:22};};return h;}
function finishPage(h){if(h.evaluate('bubblePhase')==='thinking')h.evaluate('thinkTimer')?.fn();for(let i=0;i<500&&h.evaluate('aiState')==='반응 중';i++)h.evaluate('animTimer')?.fn();assert.equal(h.evaluate('bubblePhase'),'holding');}

test('all supplied recommendation labels fit the fixed 1440 header with their real Nanum font metrics',()=>{
  const recommendation=metrics.recommendation;
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync('dist/shared/fonts/NanumSquareRoundB.woff2')).digest('hex'),recommendation.fontSha256);
  // 320px outer width: two borders, horizontal padding, two gaps, badge and 18px arrow.
  const available=320-4-24-24-recommendation.badgeWidth-18;
  assert(available>190);
  for(const {label,width}of recommendation.labels)assert(width<=available,label+' would be clipped');
  const h=setup();h.evaluate("setRecommendationText('리포트 확인하며 오늘의 학습 정리하기')");assert.equal(h.node('#recommend-copy').textContent,'오늘의 학습 기록 확인하기');
  h.evaluate("setRecommendationText('오늘의 목표 학습 시간 정하기')");assert.equal(h.node('#recommend-copy').textContent,'목표 학습 시간 조정하기');
  h.evaluate("setRecommendationText('이어하기 · '+'매우 긴 학습 주제명'.repeat(10))");assert.equal(h.node('#recommend-copy').textContent,'오늘의 학습 이어가기');
});

test('1440 header icons have isolated styles and the rail glyph comes from the lighter main-frame node',()=>{
  const html=fs.readFileSync('dist/working/index.html','utf8'),css=fs.readFileSync('dist/working/v4.css','utf8');
  assert(!/<img[^>]+class="my-profile"/.test(html));assert(html.includes('class="shortcut-profile-art"'));
  assert(html.includes('class="shortcut-report-art"'));assert(html.includes('class="constellation-art"'));
  assert(css.includes('grid-template-columns:minmax(0,1fr) 320px'));
  assert(css.includes('body.has-long-learning-list .ai::before{content:none;box-shadow:none}'));
  assert(css.includes('text-overflow:clip;white-space:nowrap'));
  const manifest=JSON.parse(fs.readFileSync('dist/working/assets/figma-v4-1/manifest.json','utf8'));
  const rail=manifest.assets.find(x=>x.name==='rail-report');assert.equal(rail.nodeId,'3:87');
  assert.equal(rail.ink,'#8492a7');
});

test('normal long mentor copy is split into two whole clauses that fit the actual font width',()=>{
  const h=setup();h.context.fontMeasure=measure;
  for(const copy of metrics.mentor.examples){
    h.context.copy=copy;const pages=h.data('splitMentorMessage(copy,248,fontMeasure)');
    assert.equal(normalize(pages.join(' ')),normalize(copy));assert(pages.every(page=>measure(page)<=248));
    assert.equal(pages.length,measure(copy)<=248?1:2);
  }
});

test('mentor gives the first clause a reading hold, pauses briefly, then shows the second without scrolling',()=>{
  const h=setup(),copy=metrics.mentor.examples.at(-1);h.context.copy=copy;h.evaluate('animateMessage(true,copy)');finishPage(h);
  const pages=h.data('mentorRun.pages');assert.equal(pages.length,2);assert.equal(h.node('#ai-message').textContent,pages[0]);
  assert.equal(h.node('#ai-message').scrollLeft,0);assert.equal(h.node('#mentor-read-controls').hidden,true);
  const width=h.node('#mentor-bubble').style.width,hold=h.evaluate('bubbleTimer');assert(hold.ms>=2400);hold.fn();
  assert.equal(h.evaluate('bubblePhase'),'paging');assert.equal(h.node('#ai-message').textContent,pages[0]);
  const gap=h.evaluate('mentorReadTimer');assert(gap.ms>=300&&gap.ms<=500);gap.fn();finishPage(h);
  assert.equal(h.node('#ai-message').textContent,pages[1]);assert.equal(h.node('#ai-message').scrollLeft,0);
  assert.equal(h.node('#mentor-bubble').style.width,width);assert.equal(h.evaluate('mentorTargetText'),copy);
  h.evaluate('bubbleTimer').fn();assert.equal(h.evaluate('bubblePhase'),'rest');
});

test('a stale second clause cannot appear under a dim or after the learning context has changed',()=>{
  const h=setup();h.context.copy=metrics.mentor.examples.at(-1);h.evaluate('animateMessage(true,copy)');finishPage(h);h.evaluate('bubbleTimer').fn();
  const stale=h.evaluate('mentorReadTimer'),visible=h.node('#ai-message').textContent;
  h.click('test');stale.fn();assert.equal(h.node('#ai-message').textContent,visible);
  h.evaluate('M.preset(state,4);render()');stale.fn();assert.equal(h.node('#ai-message').textContent,visible);
  h.click('close-panel');stale.fn();assert.equal(h.node('#ai-message').textContent,'');
  assert.equal(h.evaluate('mentorTargetText'),'풀던 학습을 이어서 해볼까요?');finishPage(h);
  assert.notEqual(h.node('#ai-message').textContent,h.data('splitMentorMessage(copy)')[1]);
});

test('hover pauses automatic page changes and reduced motion still makes both clauses readable',()=>{
  for(const reduced of [false,true]){
    const h=setup(reduced);h.context.copy=metrics.mentor.examples.at(-1);h.evaluate('animateMessage(true,copy)');finishPage(h);
    const first=h.node('#ai-message').textContent,stale=h.evaluate('bubbleTimer');h.node('#mentor-bubble').emit('pointerenter',{pointerType:'mouse'});
    assert.equal(h.evaluate('bubbleTimer'),null);stale.fn();assert.equal(h.node('#ai-message').textContent,first);
    h.node('#mentor-bubble').emit('pointerleave');h.evaluate('bubbleTimer').fn();h.evaluate('mentorReadTimer').fn();finishPage(h);
    assert.notEqual(h.node('#ai-message').textContent,first);assert.equal(h.node('#ai-message').scrollLeft,0);
  }
});
