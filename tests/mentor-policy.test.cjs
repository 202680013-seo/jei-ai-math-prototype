const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../dist/working/model.js').MathModel;
const Policy=require('../dist/working/mentor-policy.js');
const {harness}=require('./helpers/ui-harness.cjs');
function setup(){const state=M.create();M.ensureDaily(state,'2026-10-19');state.daily.entry='activity';state.mentorPolicy={seen:{'SB-006:2026-10-19':true},rotations:{},queue:[],completedByDate:{}};const tracker=Policy.createTracker(),ctx={entry:1,now:1000};tracker.observe(state,ctx);return {state,tracker,ctx,topic:state.grades[state.grade][state.index]};}
function drain(x){const out=[];for(let i=0;i<30;i++){const next=x.tracker.next(x.state,x.ctx);if(!next)break;out.push(next);}return out;}

test('the CSV catalog preserves all 49 IDs, three copy variants, and priorities without placeholders leaking',()=>{
 assert.equal(Policy.rules.length,49);assert.equal(new Set(Policy.rules.map(x=>x.id)).size,49);
 assert.equal(Policy.rules[0].messages.length,1);assert.equal(Policy.rules.at(-1).priority,3);
 const x=setup();x.state.profile.name='의정';x.state.daily.entry='first';delete x.state.mentorPolicy;x.tracker.reset();x.tracker.observe(x.state,x.ctx);
 assert.equal(x.tracker.next(x.state,x.ctx).text,'의정 친구, 처음 만나서 반가워요! 오늘부터 함께 학습해 봐요!');
 assert(!drain(x).some(x=>x.id==='SB-001'));
});
test('a new prescription waits in the queue without consuming its one-time display until the main is visible',()=>{
 const x=setup();x.topic.diagnosis='active';x.tracker.observe(x.state,x.ctx);x.topic.diagnosis='done';x.topic.programs=M.programs(8);x.tracker.observe(x.state,x.ctx);
 assert(x.tracker.pending(x.state));assert(!Object.keys(x.state.mentorPolicy.seen).some(k=>k.startsWith('SB-031:')));
 const line=x.tracker.next(x.state,x.ctx);assert.equal(line.id,'SB-031');assert.equal(line.text,'새로운 학습 8개가 열렸어요!');
});
test('time brackets use exact boundaries and trial ten minutes is distinct from a member goal',()=>{
 for(const [minutes,id]of [[1,'SB-011'],[5,'SB-012'],[10,'SB-013'],[15,'SB-014'],[20,'SB-009'],[30,'SB-019']]){
  const x=setup();x.state.daily.target=20;x.tracker.observe(x.state,x.ctx);drain(x);x.state.daily.minutes=minutes;x.tracker.observe(x.state,x.ctx);
  const lines=drain(x);assert(lines.some(x=>x.id===id),id);assert(!lines.some(x=>x.id===id+'bad'));
  x.tracker.observe(x.state,x.ctx);assert(!drain(x).some(x=>x.id===id),'daily interval does not repeat');
 }
 const x=setup();x.state.profile.memberType='trial';x.state.daily.minutes=10;x.tracker.observe(x.state,x.ctx);assert.equal(x.tracker.next(x.state,x.ctx).id,'SB-010');
});
test('clean-pass achievement precedes the newly opened diagnosis and historical selection uses its own copy',()=>{
 const x=setup();x.topic.diagnosis='active';x.tracker.observe(x.state,x.ctx);x.topic.diagnosis='done';x.tracker.observe(x.state,x.ctx);
 const lines=drain(x);assert(lines.findIndex(x=>x.id==='SB-030')<lines.findIndex(x=>x.id==='SB-048'));
 x.state.index=1;x.tracker.observe(x.state,{entry:2});x.state.index=0;x.tracker.observe(x.state,{entry:3});
 assert.equal(x.tracker.next(x.state,{entry:3}).id,'SB-045');
});
test('a grade half milestone requires fully passed topics, not merely completed diagnoses',()=>{
 const x=setup(),grade=x.state.grades[x.state.grade];
 for(let i=0;i<Math.ceil(grade.length/2);i++){grade[i].diagnosis='done';grade[i].programs=M.programs(1);grade[i].programs[0].status='failed';M.setProgress(grade[i].programs[0],100);}
 x.tracker.observe(x.state,x.ctx);assert(!drain(x).some(x=>x.id==='SB-033'));
 grade.slice(0,Math.ceil(grade.length/2)).forEach(t=>t.programs[0].status='passed');x.tracker.observe(x.state,x.ctx);
 assert.equal(x.tracker.next(x.state,x.ctx).id,'SB-033');
});
test('completing programs counts actual transitions, excludes interrupted first-try praise, and does not fire on result views',()=>{
 const x=setup();x.topic.diagnosis='done';x.topic.programs=M.programs(4);x.topic.programs[0].status='active';M.setProgress(x.topic.programs[0],50);x.state.mentorPolicy.interrupted[x.state.grade+':'+x.state.index+':0']=true;x.tracker.observe(x.state,x.ctx);drain(x);
 const p=x.topic.programs[0];p.status='passed';M.setProgress(p,100);x.tracker.observe(x.state,x.ctx);const lines=drain(x);
 assert(lines.some(x=>x.id==='SB-034'));assert(!lines.some(x=>['SB-028','SB-029'].includes(x.id)));
 x.tracker.observe(x.state,x.ctx);assert(!drain(x).some(x=>['SB-028','SB-029','SB-034'].includes(x.id)));
});
test('review praise starts only after actual passed-card review progress and a failed retry uses the correct achievement',()=>{
 const x=setup();x.topic.diagnosis='done';x.topic.programs=M.programs(3);const p=x.topic.programs[0];p.status='passed';M.setProgress(p,100);x.tracker.observe(x.state,x.ctx);drain(x);
 p.reviewSession={index:0,answers:[],wrongFrames:[]};x.tracker.observe(x.state,x.ctx);assert(!drain(x).some(x=>x.id==='SB-047'));
 p.reviewSession.index=1;p.reviewSession.answers=[1];x.tracker.observe(x.state,x.ctx);assert(drain(x).some(x=>x.id==='SB-047'));
 p.status='failed';x.tracker.observe(x.state,x.ctx);p.status='passed';x.tracker.observe(x.state,x.ctx);assert(drain(x).some(x=>x.id==='SB-027'));
});
test('UI consumes the CSV event only after dim release and can divide the longest source copy into readable pages',()=>{
 const h=harness(undefined,{reducedMotion:false});h.click('preset',1);h.click('diagnosis');
 h.evaluate("current().diagnosis='done';current().programs=M.programs(8);render()");assert(h.evaluate("state.mentorPolicy.queue.some(x=>x.id==='SB-031')"));
 h.evaluate("editing=null;closeSurface('#learning')");const release=h.evaluate('guidanceClosingTimer');assert(release);release.fn();
 assert.equal(h.evaluate('mentorCurrentId'),'SB-031');assert.equal(h.evaluate('mentorTargetText'),'새로운 학습 8개가 열렸어요!');
 const copy=Policy.rules.flatMap(x=>x.messages).sort((a,b)=>b.length-a.length)[0].replace(/\[[^\]]+\]/g,'12');h.context.copy=copy;
 const pages=h.data('splitMentorMessage(copy,330,s=>Array.from(s).length*17)');assert(pages.length>=2&&pages.length<=3);assert.equal(pages.join('').replace(/\s/g,''),copy.replace(/\s/g,''));
});
test('a blocked grade reports remaining failed programs on retry and announces the next grade only after the last pass',()=>{
 const x=setup();const a=x.topic,b=x.state.grades[x.state.grade][1];x.state.grades[x.state.grade]=[a,b];x.tracker.observe(x.state,x.ctx);
 a.diagnosis=b.diagnosis='done';a.programs=M.programs(2);a.programs.forEach(p=>{p.status='failed';M.setProgress(p,100);});b.programs=[];
 x.tracker.observe(x.state,x.ctx);assert(drain(x).some(x=>x.id==='SB-046'));
 a.programs[0].status='passed';x.tracker.observe(x.state,x.ctx);let lines=drain(x);assert(lines.some(x=>x.id==='SB-049'&&x.text.includes('1개')));assert(!lines.some(x=>x.id==='SB-038'));
 a.programs[1].status='passed';x.tracker.observe(x.state,x.ctx);const line=x.tracker.next(x.state,x.ctx);assert.equal(line.id,'SB-038');assert(line.text.startsWith('E등급'));
});
test('birthday precedes a regular greeting and milestone dates are used only when explicitly supplied',()=>{
 const x=setup();x.state.profile.birthday='2019-10-19';delete x.state.mentorPolicy;x.tracker.reset();x.tracker.observe(x.state,x.ctx);assert.equal(x.tracker.next(x.state,x.ctx).id,'SB-002');
 const y=setup();y.state.profile.startDate='2026-10-10';y.state.profile.meetingMilestones=[10];delete y.state.mentorPolicy;y.tracker.reset();y.tracker.observe(y.state,y.ctx);assert.equal(y.tracker.next(y.state,y.ctx).id,'SB-004');
});
test('ten-minute idle nudge is not early, and a new day clears queued time guidance before the new greeting',()=>{
 const x=setup();x.tracker.observe(x.state,{...x.ctx,now:600999});assert(!x.state.mentorPolicy.queue.some(x=>x.id==='SB-040'));
 x.tracker.observe(x.state,{...x.ctx,now:601000});assert.equal(x.tracker.next(x.state,x.ctx).id,'SB-040');
 x.state.daily.target=20;x.state.daily.minutes=20;x.tracker.observe(x.state,x.ctx);M.ensureDaily(x.state,'2026-10-20');x.tracker.observe(x.state,{entry:2,now:602000});assert.equal(x.tracker.next(x.state,{entry:2}).id,'SB-006');assert(!drain(x).some(x=>x.id==='SB-009'));
});
