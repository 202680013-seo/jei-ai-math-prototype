const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/ui-harness.cjs');

test('mentor typing and stale callbacks cannot update under an open or closing drawer',()=>{
  const h=harness(undefined,{reducedMotion:false});
  h.evaluate("animateMessage(true,'이전 메시지를 읽어요.')");
  h.evaluate('thinkTimer').fn();h.evaluate('animTimer').fn();
  const visible=h.node('#ai-message').textContent,oldLetter=h.evaluate('animTimer');
  h.click('groups');
  assert.equal(h.evaluate('mentorNeedsResume'),true);
  h.evaluate('M.preset(state,4);render()');oldLetter.fn();
  assert.equal(h.node('#ai-message').textContent,visible);
  h.click('groups');
  const exit=h.evaluate('panelMotionTimer');assert.equal(exit.ms,420);
  oldLetter.fn();assert.equal(h.node('#ai-message').textContent,visible);
  assert.equal(h.evaluate('mainGuidanceVisible()'),false);
  exit.fn();assert.equal(h.evaluate('mainGuidanceVisible()'),true);
  assert.equal(h.node('#ai-message').textContent,'');
  assert.equal(h.evaluate('mentorTargetText'),'풀던 학습을 이어서 해볼까요?');
  oldLetter.fn();assert.equal(h.node('#ai-message').textContent,'');
  assert.equal(h.evaluate('thinkTimer').ms,450);
});

test('native dialog dismissal waits for the dim fade before showing the latest context',()=>{
  const h=harness(undefined,{reducedMotion:false});
  h.evaluate("animateMessage(true,'지금 읽던 내용')");h.evaluate('thinkTimer').fn();h.evaluate('animTimer').fn();
  h.click('diagnosis');const frozen=h.node('#ai-message').textContent;
  h.evaluate('M.preset(state,2);render()');
  assert.equal(h.node('#ai-message').textContent,frozen);
  h.node('#learning').close();
  const release=h.evaluate('guidanceClosingTimer');assert.equal(release.ms,420);
  assert.equal(h.evaluate('mainGuidanceVisible()'),false);
  assert.equal(h.node('#ai-message').textContent,frozen);
  release.fn();
  assert.equal(h.evaluate('mainGuidanceVisible()'),true);
  assert.equal(h.node('#ai-message').textContent,'진단을 통과했어요!');
});

test('a new dim cancels a pending post-close announcement and only resumes after its own exit',()=>{
  const h=harness(undefined,{reducedMotion:false});
  h.click('help');h.click('close-help');const oldRelease=h.evaluate('guidanceClosingTimer');
  h.click('groups');const frozen=h.node('#ai-message').textContent;
  oldRelease.fn();assert.equal(h.node('#ai-message').textContent,frozen);
  assert.equal(h.evaluate('mainGuidanceVisible()'),false);
  h.click('groups');h.evaluate('panelMotionTimer').fn();
  assert.equal(h.evaluate('mainGuidanceVisible()'),true);
  assert(h.evaluate('thinkTimer'));
});

test('prescription completion keeps mentor copy frozen until its dim transition has finished',()=>{
  const h=harness(undefined,{reducedMotion:false});
  h.evaluate("animateMessage(true,'준비할까요?')");h.evaluate('thinkTimer').fn();h.evaluate('animTimer').fn();
  const frozen=h.node('#ai-message').textContent;
  h.evaluate("beginComposition(1,'first')");
  h.evaluate('composeTimers.find(t=>t.ms===8000)').fn();
  assert.equal(h.node('#ai-message').textContent,frozen);
  assert.equal(h.evaluate('mainGuidanceVisible()'),false);
  h.evaluate('guidanceClosingTimer').fn();
  assert.equal(h.evaluate('mentorTargetText'),'맞춤 학습이 준비됐어요.');
  assert.equal(h.node('#ai-message').textContent,'');assert(h.evaluate('thinkTimer'));
});

test('mentor width leaves reserved space and remains capped on desktop and narrow screens',()=>{
  const h=harness(undefined,{reducedMotion:true});
  h.node('.ai-top').getBoundingClientRect=()=>({width:1000,height:44});
  h.node('#mentor-measure').getBoundingClientRect=()=>({width:2000,height:22});
  h.evaluate("animateMessage(true,'학습 안내 '.repeat(100))");
  assert.equal(h.node('#mentor-bubble').style.width,'320px');
  h.context.innerWidth=375;h.node('.ai-top').getBoundingClientRect=()=>({width:220,height:44});
  h.evaluate('fitMentorBubble()');
  assert.equal(h.node('#mentor-bubble').style.width,'148px');
  assert.equal(h.node('#mentor-bubble').style.height,'44px');
  assert(h.node('#ai-message').textContent.length>100); // manual overflow retains all content
});

test('recommendation loading keeps both label and content layers mounted without restarting on a stable render',()=>{
  const h=harness(undefined,{reducedMotion:false}),html=fs.readFileSync('dist/working/index.html','utf8');
  const button=html.match(/<button id="recommend"[^>]*>(.*?)<\/button>/)[1];
  assert(button.includes('<span class="recommend-label">AI 추천</span><span class="recommend-content">'));
  assert(button.includes('class="recommend-loader"'));assert(button.includes('id="recommend-copy"'));
  const pending=h.evaluate('recommendationTimer');h.evaluate('render()');
  assert.equal(h.evaluate('recommendationTimer'),pending);
  pending.fn();assert.equal(h.node('.recommend')['data-recommend-state'],'ready');
  assert.equal(h.node('.recommend-loader').hidden,false);
  const reminder=h.evaluate('recommendationReminderTimer');reminder.fn();
  assert.equal(h.node('.recommend')['data-recommend-state'],'loading');
  assert.equal(h.node('.recommend-loader').hidden,false);
  assert.equal(h.node('#recommend').disabled,true);
});
