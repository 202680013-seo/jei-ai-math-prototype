(function(root){
const Catalog=typeof module==='object'?require('./catalog.js').MathCatalog:root.MathCatalog;
const COUNTS=Catalog.grades.map(g=>g.groups.length);
const labels={idle:'미진행',active:'진행 중',passed:'통과',failed:'미통과',clean:'처방 없이 통과',locked:'잠금'};
const defaults={prescribed:'active',unfinished:'active',recommendation:'active'};
const topics=['수의 크기 비교하기','덧셈의 원리 이해하기','뺄셈의 관계 알아보기','곱셈의 의미 이해하기','나눗셈의 원리 적용하기','분수의 크기와 관계를 이해하고 문제에 적용하기'];
function group(g,i){return Catalog.grades[g]?.groups[i];}
function sourcePrograms(g,i){const x=group(g,i);return x?.mapped===false?Catalog.grades[g].programPool:x?.programs||[];}
function sourceCount(g,i){const x=group(g,i);return x?.mapped===false?Math.min(8,sourcePrograms(g,i).length):x?.programs.length||8;}
function programs(n,g=3,i=0){const source=sourcePrograms(g,i);return Array.from({length:n},(_,j)=>{const p=source[j];return {id:j,programId:p?.programId||'TEST-'+(j+1),name:p?.name||'테스트 학습 '+(j+1),frames:p?.frames||[],sample:!p,status:'idle',progress:0,completedFrames:0,reviewed:false};});}
function setProgress(p,value){const n=p.frames?.length||0,percent=Math.max(0,Math.min(100,Number(value)||0));p.completedFrames=n?Math.round(percent*n/100):0;p.progress=n?Math.round(p.completedFrames/n*100):percent;}
function blank(g,i){const source=group(g,i);return {grade:g,index:i,groupId:source?.groupId||'TEST-'+String.fromCharCode(65+g)+String(i+1).padStart(2,'0'),groupName:source?.name||'테스트 그룹 '+(i+1),testOnly:!source,diagnosis:'idle',programs:[],recent:'',reviewHistory:false};}
function create(){return {schema:'diagnosis-v1',grade:3,index:0,policy:{...defaults},grades:COUNTS.map((n,g)=>Array.from({length:n},(_,i)=>blank(g,i)))};}
function status(s,p=defaults){if(s.diagnosis==='idle')return 'idle';if(s.diagnosis==='active')return 'active';if(!s.programs.length)return 'clean';if(s.programs.every(x=>x.status==='passed'))return 'passed';if(s.programs.every(x=>['passed','failed'].includes(x.status)))return 'failed';if(s.programs.every(x=>['idle','locked'].includes(x.status)))return p.prescribed;return p.unfinished;}
const presetNames=['첫 진입 · 처방 없음','진단 진행 중','진단 통과 · 처방 없음','처방 발생 · 학습 미시작','프로그램 학습 진행 중','처방 프로그램 전체 통과','모든 풀이 완료 · 미통과 존재','복습 후 모든 프로그램 통과','처방 프로그램 1개','처방 프로그램 52개','진단 그룹 78개 · J등급'];
function preset(state,k){if(k===10){state.grade=9;state.index=0;}const s=blank(state.grade,state.index);if(k>1&&k<10)s.diagnosis='done';if(k===1)s.diagnosis='active';if(k>=3&&k<10)s.programs=programs(k===8?1:k===9?52:sourceCount(state.grade,state.index),state.grade,state.index);if(k===4){s.programs[0].status='active';setProgress(s.programs[0],45);}if([5,6,7].includes(k))s.programs.forEach(x=>{x.status='passed';setProgress(x,100);});if(k===6)s.programs[Math.min(2,s.programs.length-1)].status='failed';if(k===7){s.programs[Math.min(2,s.programs.length-1)].reviewed=true;s.reviewHistory=true;}s.recent='프리셋: '+presetNames[k];state.grades[state.grade][state.index]=s;return s;}
// Sequence is gated by completion percentage, never by pass/fail outcome.
function canStudy(s,p){if(!p||p.status==='locked')return false;const i=s.programs.indexOf(p);return i>=0&&(p.progress>=100||s.programs.slice(0,i).every(x=>x.progress>=100));}
function currentProgram(s){return s.programs.find(p=>p.status==='active'&&p.progress<100&&canStudy(s,p));}
function canStart(s,p){const active=currentProgram(s);return canStudy(s,p)&&(!active||active.id===p.id);}
function learningRecommend(state){const s=state.grades[state.grade][state.index];if(s.diagnosis!=='done')return {kind:'diagnosis',text:s.diagnosis==='active'?'실력알기 이어하기':'실력알기 시작하기'};
const active=currentProgram(s),failed=s.programs.find(p=>p.status==='failed'&&canStart(s,p)),next=s.programs.find(p=>p.status==='idle'&&canStart(s,p)),pending=s.programs.find(p=>p.status==='active'&&p.progress>=100&&canStudy(s,p));
const x=state.policy.recommendation==='failed'?(active||failed||next||pending):(active||next||failed||pending);
if(x)return {kind:'program',id:x.id,text:(x.progress>=100&&x.status==='active'?'결과 확인':x.status==='failed'?'복습하기':x.status==='active'?'이어하기':'시작하기')+' · '+x.name};
if(s.programs.some(p=>p.progress<100||p.status==='locked'))return {kind:'locked',text:'이전 학습을 완료하면 다음 학습이 열려요'};
if(state.index+1<state.grades[state.grade].length)return {kind:'next',text:'다음 진단 그룹으로 이동'};if(state.grade<9)return {kind:'grade',text:'다음 등급의 첫 진단 그룹으로 이동'};return {kind:'done',text:'마지막 진단 그룹까지 완료했어요'};}
function learningMessage(state){const s=state.grades[state.grade][state.index],st=status(s,state.policy);if(st==='idle')return '실력알기로 지금 알고 있는 내용을 확인해 볼까요? 진단 후 필요한 학습만 제안할게요.';if(s.diagnosis==='active')return '진행 중인 실력알기가 있어요. 이어서 진단을 마쳐 볼까요?';if(st==='clean')return '진단을 통과했어요. 부족한 학습 목표가 없어 처방 프로그램이 없습니다.';if(st==='passed')return s.reviewHistory?'복습까지 마쳤어요. 모든 처방 프로그램을 통과했어요!':'모든 처방 프로그램을 통과했어요. 다음 진단 그룹을 확인해 볼까요?';if(st==='failed')return '풀이를 모두 마쳤지만 미통과 프로그램이 있어요. 복습으로 다시 도전해 볼까요?';if(s.programs.some(x=>x.status==='failed'))return '미통과 프로그램과 남은 학습이 있어요. 추천 활동을 확인해 주세요.';if(currentProgram(s))return '학습을 이어가고 있어요. 진행 중인 프로그램부터 마쳐 볼까요?';if(s.programs.some(x=>x.status==='active'&&x.progress>=100))return '풀이를 완료했어요. 다음 학습을 시작하거나 결과를 확인해 주세요.';return '진단을 마쳤어요. 필요한 처방 프로그램 '+s.programs.length+'개를 차근차근 시작해 볼까요?';}
function ensureDaily(state,date){state.profile??={name:'재능'};state.history??={};if(state.daily&&state.daily.date!==date)state.history[state.daily.date]=JSON.parse(JSON.stringify(state.daily));if(!state.daily||state.daily.date!==date){state.daily={date,target:null,minutes:0,started:false,entry:state.everVisited?'today':'first',variant:0,unreadAnswers:0,frameAttempts:{},cleanStreak:0,timerRunning:false};}state.everVisited=true;return state.daily;}
function wrongEntries(state){return state.grades.flatMap((sets,g)=>sets.flatMap((s,i)=>s.programs.filter(p=>p.status==='failed').map(p=>({grade:g,index:i,id:p.id,programId:p.programId,name:p.name,groupName:s.groupName}))));}
function dailyRecommend(state){const d=state.daily;if(!d)return learningRecommend(state);if(d.unreadAnswers>0)return {kind:'answers',text:'도와줘요 답변 보기'};if(wrongEntries(state).length>=3)return {kind:'wrongnotes',text:'오답노트 속 문제 풀기'};if(d.target&&d.minutes>=d.target)return {kind:'report',text:'리포트 확인하며 오늘의 학습 정리하기'};if(state.sky?.newPieces)return {kind:'constellation',text:'새로 모은 별로 하늘 꾸미기'};if(!d.target&&!d.started)return {kind:'goal',text:'오늘의 목표 학습 시간 정하기'};const next=learningRecommend(state);if(['locked','done'].includes(next.kind))return next;return {kind:'today',text:'오늘의 학습 문제 풀기'};}
function draftMessage(state){const d=state.daily,s=state.grades[state.grade][state.index];if(!d)return learningMessage(state);const name=(state.profile?.name||'재능')+' 친구, ',variant=d.variant%3;
const active=currentProgram(s),retryKey=active?s.groupId+':'+active.programId+':'+(active.completedFrames||0):null;
if(retryKey&&(d.frameAttempts[retryKey]||0)>=5)return name+'차분하게 다시 해 봐요!';
if((s.attempts||0)>=5&&s.programs.some(p=>p.status==='failed'))return name+'조금 더 해 봐요!';
if(d.cleanStreak>=2&&s.diagnosis==='done'&&!s.programs.length)return name+'실력이 완벽해요!';
if(d.target&&d.minutes>=d.target)return name+['오늘의 목표 시간 달성!','오늘 목표를 해냈어요!','오늘도 수고했어요.'][variant];
if(state.sky?.newPieces)return name+'별 조각을 모았어요. 나의 별자리 하늘을 확인해 볼까요?';
const diagnosed=state.grades[state.grade].filter(x=>x.diagnosis==='done').length;
if(state.grades[state.grade].length>=40&&diagnosed>=Math.ceil(state.grades[state.grade].length/2))return name+'지금 등급 반 이상 성공!';
if(s.programs.length>=20){const finished=s.programs.filter(p=>p.progress>=100).length,ratio=finished/s.programs.length;if(ratio>=.75)return name+'마지막까지 힘내요!';if(ratio>=.25)return name+'순조로운 출발이에요!';}
if(d.started&&d.target&&d.minutes<d.target)return name+['잘하고 있어요!','계속 힘내볼까요?','조금만 더 힘내요!'][variant];
if(d.entry==='first'&&!d.started&&s.diagnosis==='idle')return name+'만나서 반가워요!';
if(d.entry==='today'&&!d.started&&s.diagnosis==='idle')return name+'오늘도 반가워요!';
return name+learningMessage(state);
}
const draftPresetNames=['최초 진입','당일 첫 진입','목표 시간 미달성 · 학습 중','목표 시간 달성','같은 그룹 5회 이상 · 미통과','같은 프레임 5회 이상 · 미완료','연속 처방 없이 통과 2회','40개 이상 그룹 · 절반 진단 완료','처방 20개 이상 · 1/4 완료','처방 20개 이상 · 3/4 완료','미확인 도와줘요 답변','오답노트 3개 프로그램'];
function draftPreset(state,k){ensureDaily(state,state.daily?.date||'test');const d=state.daily;if(state.sky)state.sky.newPieces=false;state.grades=COUNTS.map((n,g)=>Array.from({length:n},(_,i)=>blank(g,i)));Object.assign(d,{target:null,minutes:0,started:false,entry:'activity',variant:0,unreadAnswers:0,frameAttempts:{},cleanStreak:0,timerRunning:false});
if(k===0||k===1){preset(state,0);d.entry=k===0?'first':'today';}
if(k===2||k===3){preset(state,4);Object.assign(d,{target:20,minutes:k===2?5:20,started:true});}
if(k===4){preset(state,6);state.grades[state.grade][state.index].attempts=5;}
if(k===5){preset(state,4);const s=state.grades[state.grade][state.index],p=currentProgram(s);d.frameAttempts[s.groupId+':'+p.programId+':'+(p.completedFrames||0)]=5;}
if(k===6){preset(state,2);d.cleanStreak=2;}
if(k===7){state.grade=9;state.index=0;const a=state.grades[9];for(let i=0;i<Math.ceil(a.length/2);i++){a[i]=blank(9,i);a[i].diagnosis='done';}}
if(k===8||k===9){preset(state,9);const s=state.grades[state.grade][state.index];s.programs=programs(24,state.grade,state.index);for(let i=0;i<(k===8?6:18);i++){s.programs[i].status='passed';setProgress(s.programs[i],100);}}
if(k===10)d.unreadAnswers=1;
if(k===11){preset(state,6);const s=state.grades[state.grade][state.index];s.programs.slice(0,3).forEach(p=>{p.status='failed';setProgress(p,100);});}
}
root.MathModel={COUNTS,labels,defaults,create,status,preset,presetNames,programs,recommend:dailyRecommend,message:draftMessage,learningRecommend,learningMessage,ensureDaily,wrongEntries,draftPreset,draftPresetNames,canStudy,currentProgram,canStart,Catalog,group,sourceCount,sourcePrograms,setProgress,blank};
})(typeof module==='object'?module.exports:window);
