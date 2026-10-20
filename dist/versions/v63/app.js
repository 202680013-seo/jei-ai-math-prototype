const M=MathModel,$=s=>document.querySelector(s),key='ai-math-prototype-diagnosis-v1';
let composing=null,composeTimers=[],reveal=false,cardRevealTimer=null,cardRevealGeneration=0;
const compositionElement=$('#composition');
let state=M.create(),panel=null,browseGrade=3,editing=null,presetIndex=null,animTimer=null,thinkTimer=null,lastMessage='',aiState='대기';
try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&saved.schema==='diagnosis-v1'&&saved.grades?.length===10&&saved.grades.every((a,i)=>a.length>=M.COUNTS[i]&&a.length<=Math.max(78,M.COUNTS[i]))&&saved.policy&&saved.grade>=0&&saved.grade<10&&saved.index>=0&&saved.index<saved.grades[saved.grade].length)state=saved;}catch{}browseGrade=state.grade;
for(const topics of state.grades)for(const topic of topics)for(const p of topic.programs)for(const clock of Object.values(p.studyTiming||{}))clock.runningSince=null;
let diagnosisResultHintRun=null,diagnosisResultHintTimer=null;
let diagnosisOutcomeRun=null,diagnosisOutcomeTimer=null;
const current=()=>state.grades[state.grade][state.index],grade=g=>String.fromCharCode(65+g),groupName=(i,g=state.grade)=>state.grades[g][i]?.groupName||'학습 주제 '+String(i+1).padStart(2,'0'),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const badge=st=>`<span class="badge ${st}">${M.labels[st]}</span>`;
const options=(values,selected)=>values.map(([v,l])=>`<option value="${v}" ${v===selected?'selected':''}>${l}</option>`).join('');
const gradeOptions=g=>options(state.grades.map((a,i)=>[i,grade(i)+'등급 · '+a.length+'그룹'+(a.length>M.COUNTS[i]?' (테스트 확장)':'')]),g);
const groupOptions=(g,i)=>options(state.grades[g].map((s,j)=>[j,groupName(j,g)]),i);
// Screen motion decorates state changes; it never delays a click, saving, or native dialog focus.
const surfaceMotions=new WeakMap(),dialogViews=new WeakMap();
let overviewViewKey=null;
function softReveal(element){
  if(!element)return null;
  surfaceMotions.get(element)?.cancel?.();surfaceMotions.delete(element);
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||!element.animate)return null;
  const motion=element.animate([{opacity:.35,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:380,easing:'cubic-bezier(.25,.1,.25,1)'});
  if(motion){surfaceMotions.set(element,motion);const finish=()=>{if(surfaceMotions.get(element)===motion)surfaceMotions.delete(element);};motion.finished?.then(finish,finish);}
  return motion||null;
}
function renderDialogView(selector,html,viewKey,sky=false){
  const d=$(selector),previous=dialogViews.get(d),changed=previous?.key!==viewKey,active=document.activeElement;
  if(!changed&&previous.html===html)return;
  const focus=active&&d.contains?.(active)&&active.dataset?.action?{action:active.dataset.action,id:active.dataset.id,tool:active.dataset.tool}:null;
  previous?.motion?.cancel?.();
  d.innerHTML=`<div class="dialog-view${sky?' sky-view':''}">${html}</div>`;
  const view={key:viewKey,html,motion:null};dialogViews.set(d,view);
  // Answer selection and live data updates remain still; animate only a different screen or question.
  if(d.open&&previous&&changed&&!(sky&&skyBusy)&&!(selector==='#learning'&&editing?.outcome))view.motion=softReveal($(selector+' > .dialog-view'));
  if(!changed&&focus){const next=Array.from(d.querySelectorAll('[data-action]')).find(b=>b.dataset.action===focus.action&&b.dataset.id===focus.id&&b.dataset.tool===focus.tool&&!b.disabled);next?.focus({preventScroll:true});}
}
function learningViewKey(){
  const s=current(),base=state.grade+':'+state.index+':'+editing.kind;
  if(editing.kind==='diagnosis')return base+':'+(editing.outcome?'outcome:'+(isDiagnosisPreparation(s.diagnosisOutcome?.stage)?'preparation':s.diagnosisOutcome?.stage):editing.preparing?'preparing':editing.complete?'pass:'+(editing.passStage||s.cleanPassStage):editing.intro?'intro':editing.confirmExit?'exit':'question:'+s.diagnosticSession?.index);
  if(editing.kind==='diagnosis-result')return base+':'+editing.goal+':'+editing.item;
  const p=s.programs.find(p=>p.id===editing.id);
  if(editing.intro)return base+':'+editing.id+':intro';
  if(editing.reviewing&&p?.reviewSession)return base+':review:'+editing.id+':'+(p.reviewSession.complete?'result':p.reviewSession.index);
  return base+':'+editing.id+':'+(editing.showResult||['passed','failed'].includes(p?.status)||p?.progress>=100?'result':'question:'+p?.completedFrames);
}
function skyRevealRadius(cx,cy){return Math.ceil(Math.hypot(Math.max(cx,window.innerWidth-cx),Math.max(cy,window.innerHeight-cy)))+24;}
function todayKey(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');}
function daily(){const d=M.ensureDaily(state,todayKey());K.ensure(state);return d;}
let skyMainScroll=0,skyReturnToLearning=false;
let myOpen=false,myScroll=0,myTimer=false,calendarMonth=null,reportDate=null,skyMode='view',selectedStar=null,skyBusy=false,skyTimer=false;
function archiveDay(){const d=daily();state.history??={};state.history[d.date]=JSON.parse(JSON.stringify(d));state.profile.startDate??=d.date;}
function recordProgram(){
  if(editing?.kind!=='program'||editing.intro||(editing.resultOnly&&!editing.reviewing))return;const p=current().programs.find(x=>x.id===editing.id);if(!p)return;syncProgramStudyClock(p,!!editing.reviewing,daily().timerRunning&&document.visibilityState!=='hidden'&&programStudyActive(p));const d=daily();d.log??={};
  if(editing.reviewing&&p.reviewSession){const r=p.reviewSession;d.log[current().groupId+':'+p.programId+':review']={name:p.name,programId:p.programId,progress:r.complete?100:Math.round(r.index/(p.frames?.length||1)*100),status:r.complete?r.result.status:'active',reviewed:true,kind:'review',groupName:current().groupName};return;}
  d.log[current().groupId+':'+p.programId]={name:p.name,programId:p.programId,progress:p.progress,status:p.status,reviewed:p.reviewed,groupName:current().groupName};
}

function monthParts(){return (calendarMonth||todayKey().slice(0,7)).split('-').map(Number);}
function calendarHTML(){const [year,month]=monthParts(),first=new Date(Date.UTC(year,month-1,1)).getUTCDay(),days=new Date(Date.UTC(year,month,0)).getUTCDate(),history={...state.history,[daily().date]:daily()};let cells='<span></span>'.repeat(first);
for(let day=1;day<=days;day++){const date=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0'),rec=history[date],learned=rec&&(rec.started||rec.minutes>0||Object.keys(rec.log||{}).length),done=learned&&rec.target&&rec.minutes>=rec.target;cells+=`<button data-action="calendar-day" data-date="${date}" class="${date===todayKey()?'is-today':''} ${learned?done?'goal-done':'some-learning':'no-learning'}" ${learned?'':'disabled'} aria-label="${date} ${learned?done?'목표 달성':'학습 기록':'학습 기록 없음'}">${day}</button>`;}
return `<div class="calendar-nav"><button data-action="calendar-prev" aria-label="이전 달">←</button><strong>${year}년 ${month}월</strong><button data-action="calendar-next" ${calendarMonth>=todayKey().slice(0,7)?'disabled':''} aria-label="다음 달">→</button></div><div class="calendar-grid">${['일','월','화','수','목','금','토'].map(x=>`<small>${x}</small>`).join('')}${cells}</div><p class="calendar-key">○ 학습 없음 · ◐ 목표 미달성 · ● 목표 달성<br>테두리: 오늘</p>`;}
function openMy(){if(panel)closePanel();archiveDay();myScroll=window.scrollY||0;myTimer=daily().timerRunning;daily().timerRunning=false;myOpen=true;syncMainResumeScroll();calendarMonth=todayKey().slice(0,7);renderMy();$('main').hidden=true;$('.my-trigger').hidden=true;$('.groups-trigger').hidden=true;$('#mypage').hidden=false;softReveal($('#mypage'));window.scrollTo(0,0);$('#mypage [data-action="back-main"]').focus();save();}
function backMain(){mentorEntry++;myOpen=false;$('#mypage').hidden=true;$('main').hidden=false;$('.my-trigger').hidden=false;$('.groups-trigger').hidden=false;daily().timerRunning=myTimer;window.scrollTo(0,myScroll);render();softReveal($('main'));$('.my-trigger').focus({preventScroll:true});}
function renderMy(){if(!myOpen)return;const d=daily(),a=M.wrongEntries(state),[year,month]=monthParts(),prefix=year+'-'+String(month).padStart(2,'0'),best=Math.max(0,...Object.entries(state.history||{}).filter(([date])=>date.startsWith(prefix)).map(([,rec])=>rec.minutes||0));
$('#mypage').innerHTML=`<div class="my-page-top"><button data-action="back-main">← 학습으로</button><h1>내 학습</h1><button data-action="user-settings" aria-label="학습자 설정">설정</button></div><div class="my-profile"><strong>${esc(state.profile.name)}</strong><span>${grade(state.grade)}등급</span><small>학습 기록 시작 ${state.profile.startDate}</small></div><div class="my-layout"><section class="my-card calendar-card"><h2>학습 캘린더</h2>${calendarHTML()}</section><div class="my-side"><section class="my-card"><h2>학습 도움</h2><button data-action="my-answers">도와줘요 <span>새 답변 ${d.unreadAnswers}</span></button><button data-action="my-wrongnotes">오답노트 <span>남은 학습 ${a.length}</span></button></section><section class="my-card"><h2>일일 학습 시간</h2><strong>${d.minutes}분 ${d.target?'/ 목표 '+d.target+'분':''}</strong><div class="actions"><button data-action="goal">${d.target?'목표 변경':'목표 정하기'}</button><button data-action="report">오늘의 리포트</button></div></section><section class="my-card"><h2>한 달 최고 기록</h2><strong>${best}분</strong></section></div></div>`;}
const K=SkyModel;let skyDetail=null,skyTools=false,skyPictures=false,skySearch=false,skyQuery='',skyZoom=1,skyPan={x:0,y:0},skyRun=null,skyTimers=[],skyToast='',skyDrag=null,skyWasDragged=false;
function skyState(){return K.ensure(state);}
function focusSky(i){const d=K.defs[Math.max(0,Math.min(31,i))];skyPan={x:d.x-500/skyZoom,y:d.y-300/skyZoom};skyState().focus=d.id;}
function skyControls(){const s=skyState();return `<h3>별자리 화면·플로우 테스트</h3><div class="notice">8개 구역 · 32개 샘플 별자리 · 별당 조각 5개.<br>좌표·형태·그림·이야기는 화면 검증용 샘플입니다. 운영용 보상 계산 없이 케이스를 직접 불러옵니다. 메인 학습 상태는 유지됩니다.</div><div class="presets">${K.scenarios.map((n,i)=>`<button data-action="sky-case" data-id="${i}">${n}</button>`).join('')}</div><div class="actions"><button data-action="sky-pieces" data-id="1">정답 시뮬레이션 · 조각 +1</button><button data-action="sky-pieces" data-id="5">특별 활동 · 조각 +5</button></div><small>가이드 중 나가면 다음 진입은 홈으로 이동하는 가정입니다. 30일 안내는 프리셋으로 직접 확인합니다.</small>`;}
function completedZone(s,z){return s.items.slice(z*4,z*4+4).every((x,j)=>x.stars===K.defs[z*4+j].points.length);}
function samplePath(i,scale=1){const d=K.defs[i];return d.points.map(([x,y],j)=>[d.x+(x-100)*scale,d.y+(y-10)*scale]);}
function constellationSVG(i){const s=skyState(),d=K.defs[i],x=s.items[i],st=K.status(s,i),pts=samplePath(i),eligible=st!=='idle',active=st==='active',ring=active?`<ellipse cx="${d.x+10}" cy="${d.y}" rx="165" ry="90" class="active-ring"/>`:st==='unseen'?`<ellipse cx="${d.x+10}" cy="${d.y}" rx="165" ry="90" class="unseen-ring"/>`:'';
const lines=pts.slice(1).map((p,j)=>`<line x1="${pts[j][0]}" y1="${pts[j][1]}" x2="${p[0]}" y2="${p[1]}" class="${j+1<x.stars?'lit':'dim'}"/>`).join('');
return `<g class="sky-const ${st} ${skyRun?.focus===i?'event-focus':''}" data-action="sky-detail" data-id="${i}" ${eligible?'role="button" tabindex="0"':''} aria-label="${d.name} ${st==='active'?'진행 중':st==='seen'?'완성 확인':st==='unseen'?'완성 미확인':'시작 전'}">${ring}${skyPictures&&['seen','unseen'].includes(st)?`<ellipse cx="${d.x+10}" cy="${d.y}" rx="130" ry="75" class="picture-outline ${st}"/>`:''}<g class="const-lines">${lines}</g><g class="const-stars">${pts.map((p,j)=>`<circle cx="${p[0]}" cy="${p[1]}" r="${j===x.stars&&active?8:5}" class="${j<x.stars?'lit':j===x.stars&&active?'collecting':'dim'}" style="--order:${j}"/>`).join('')}</g>${eligible?`<text x="${d.x+10}" y="${d.y+115}" text-anchor="middle">${d.name}</text>`:''}</g>`;}
function skyMapHTML(){const s=skyState(),current=K.current(s),viewZone=Math.min(7,Math.max(0,Math.floor((skyPan.y+300/skyZoom)/650)*4+Math.floor((skyPan.x+500/skyZoom)/800))),busy=!!skyRun,any=s.items.some((x,i)=>x.stars===K.defs[i].points.length);
const guideText={intro:'나만의 별자리 하늘을 완성해 보세요! 학습할수록 더 많은 별자리가 완성돼요.',drag:'1 / 3 · 하늘을 좌우로 드래그해 보세요.',tools:'2 / 3 · 지도 도구를 열어 보세요.',current:'2 / 3 · 현재 위치를 눌러 진행 중인 별자리를 찾아보세요.',select:'3 / 3 · 강조된 별자리를 눌러 상세를 확인해 보세요.'};
return `<div class="sky-top">${busy?'<span>완성 이벤트</span>':'<button data-action="close-activity">← 학습으로</button>'}<div><h2>나의 별자리</h2><small>학습으로 완성해 가는 하늘</small></div>${busy?'':`<button data-action="sky-search">검색</button>`}</div><div class="sky-canvas sample-sky" id="sky-canvas"><svg viewBox="${skyPan.x} ${skyPan.y} ${1000/skyZoom} ${600/skyZoom}" aria-label="샘플 별자리 지도" role="img">${K.defs.map((d,i)=>constellationSVG(i)).join('')}</svg></div>${s.guide?`<div class="sky-coach" data-action="sky-guide-next"><b>${guideText[s.guide]}</b>${s.guide==='intro'?'<small>잠시 후 첫 가이드가 시작됩니다. 눌러서 바로 이어갈 수 있어요.</small>':''}</div>`:''}${skyToast?`<button class="sky-toast" data-action="sky-dismiss">${skyToast}</button>`:''}${skySearch&&!busy?`<div class="sky-search-panel"><input id="sky-query" placeholder="찾고 싶은 별자리 이름을 알려주세요" value="${esc(skyQuery)}" aria-label="별자리 이름 검색"><div id="sky-search-results">${searchResultsHTML()}</div><button data-action="sky-search">닫기</button></div>`:''}<div class="sky-zone-map" aria-label="천구 구역">${Array.from({length:8},(_,z)=>`<button data-action="sky-zone" data-id="${z}" ${busy?'disabled':''} class="${completedZone(s,z)?'complete':''} ${z===viewZone?'looking':''}" title="${z+1}구역${current>=0&&Math.floor(current/4)===z?' · 현재 위치':''}">${z+1}${!busy&&current>=0&&Math.floor(current/4)===z?' ⌖':''}</button>`).join('')}</div>${busy?`<div class="sky-event-bar"><strong>${skyRun.caption}</strong><button data-action="sky-skip">건너뛰기</button></div>`:`<div class="sky-tool-wrap">${skyTools?`<div class="sky-tool-menu"><button data-action="sky-zoom" data-id="1" ${skyZoom>=2?'disabled':''}>＋</button><button data-action="sky-zoom" data-id="-1" ${skyZoom<=.5?'disabled':''}>－</button><button data-action="sky-current" ${current<0?'disabled':''}>현재 위치</button>${any?`<button data-action="sky-pictures">그림 ${skyPictures?'숨기기':'보기'}</button>`:''}<button data-action="sky-help">도움말</button></div>`:''}<button data-action="sky-tools">${skyTools?'도구 닫기':'지도 도구'}</button></div>`}`;}
function searchResultsHTML(){return skyQuery?K.search(skyState(),skyQuery).map(d=>`<button data-action="sky-search-result" data-id="${d.id}">${d.name}</button>`).join(''):'';}
function skyDetailHTML(){const s=skyState(),i=skyDetail,d=K.defs[i],x=s.items[i],done=x.stars===d.points.length,allowed=K.defs.filter((d,j)=>K.status(s,j)!=='idle'),pos=allowed.findIndex(d=>d.id===i),animating=!!skyRun;
return `<div class="sky-top">${animating?'<span>보상 확인</span>':'<button data-action="sky-detail-back">← 별자리 하늘</button>'}<div><h2>${d.name}</h2><small>${d.latin} · 영문명 샘플</small></div><span>${done?'완성':'진행 중'}</span></div><div class="sky-detail-view"><button data-action="sky-detail-prev" ${animating||pos<=0?'disabled':''}>‹</button><div class="detail-disc"><svg viewBox="-150 -130 400 280" role="img" aria-label="${d.name}">${d.points.slice(1).map((p,j)=>`<line x1="${d.points[j][0]-100}" y1="${d.points[j][1]}" x2="${p[0]-100}" y2="${p[1]}" class="${j+1<x.stars?'lit':'dim'}"/>`).join('')}${d.points.map((p,j)=>`<circle cx="${p[0]-100}" cy="${p[1]}" r="${j===x.stars&&!done?8:5}" class="${j<x.stars?'lit':j===x.stars&&!done?'collecting':'dim'}"/>`).join('')}${done?'<ellipse cx="0" cy="0" rx="120" ry="90" class="picture-outline"/>':''}</svg></div><button data-action="sky-detail-next" ${animating||pos===allowed.length-1?'disabled':''}>›</button></div>${animating?`<div class="sky-detail-caption">${skyRun.caption}</div>`:`<div class="sky-detail-info">${done?`<h3>${d.name} 이야기</h3><p>${d.story}</p>`:`<strong>${x.stars+1}번째 별</strong><p>별 조각 ${x.pieces} / ${d.need}</p><progress max="${d.need}" value="${x.pieces}"></progress><p>수학 문제를 맞히거나 특별한 활동을 하면 별 조각을 모을 수 있어요.</p><button data-action="sky-learn">수학 풀고 별 조각 모으기 →</button>`}</div>`}`;}
function skyHTML(){return skyDetail===null?skyMapHTML():skyDetailHTML();}
function clearSkyTimers(){skyTimers.forEach(clearTimeout);skyTimers=[];}
function finishSkyEvent(){const s=skyState();clearSkyTimers();K.finish(s);skyRun=null;focusSky(s.focus);save();renderActivity();}
function startSkyEvent(){const s=skyState();if(!s.pending)return;const steps=s.pending.steps;let at=0;function next(){if(at>=steps.length){finishSkyEvent();return;}const step=steps[at++];skyRun=step;K.applyStep(s,step);focusSky(step.focus);save();renderActivity();skyTimers.push(setTimeout(next,matchMedia('(prefers-reduced-motion: reduce)').matches?100:step.duration));}next();}
function afterSkyEnter(){const s=skyState();if(!s.guideDone&&!s.pending&&!s.guide)s.guide='intro';skyDetail=null;skyTools=false;skySearch=false;skyQuery='';focusSky(s.focus);if(s.guide==='intro'){skyTimers.push(setTimeout(()=>{if(activityKind==='constellation'&&s.guide==='intro'){s.guide='drag';renderActivity();}},1800));}else if(s.pending)startSkyEvent();if(s.longGap){skyToast='드래그해 이동하고, 지도 도구에서 확대·축소해 보세요.';s.longGap=false;skyTimers.push(setTimeout(()=>{skyToast='';if(activityKind==='constellation')renderActivity();},3000));}renderActivity();}
function openSkyDetail(i){const s=skyState();if(K.status(s,i)==='idle'||skyRun)return;if(s.guide&&s.guide!=='select')return;s.guide=null;s.guideDone=true;clearSkyTimers();skyDetail=i;const x=s.items[i],before=x.seenStars,done=x.stars===K.defs[i].points.length,changed=before!==x.stars||x.seenPieces!==x.pieces;K.seen(s,i);if(changed){skyRun={kind:'detail',focus:i,caption:done?'별자리 완성 · 그림과 이야기 해금':'별 조각과 완성한 별을 확인해요.'};renderActivity();skyTimers.push(setTimeout(()=>{skyRun=null;save();renderActivity();},done?1000:700));}else{save();renderActivity();}}
function skyAction(act,b){const s=skyState(),id=Number(b.dataset.id);if(act==='sky-case'){clearSkyTimers();skyRun=null;skyDetail=null;K.scenario(state,id);if(activityKind==='constellation'){afterSkyEnter();save();}else openActivity('constellation');return true;}
if(act==='sky-pieces'){K.addPieces(s,id);daily().fragments=(daily().fragments||0)+id;notify('테스트 별 조각 +'+id);if(activityKind==='constellation')renderActivity();return true;}
if(act==='sky-skip'){finishSkyEvent();return true;}
if(skyRun)return act.startsWith('sky-');
if(act==='sky-tools'){skyTools=!skyTools;if(s.guide==='tools')s.guide='current';renderActivity();return true;}
if(act==='sky-current'){const i=K.current(s);if(i>=0)focusSky(i);if(s.guide==='current')s.guide='select';renderActivity();return true;}
if(act==='sky-guide-next'){if(s.guide==='intro')s.guide='drag';else if(s.guide==='drag')s.guide='tools';renderActivity();return true;}
if(act==='sky-detail'){openSkyDetail(id);return true;}
if(act==='sky-detail-back'){skyDetail=null;renderActivity();return true;}
if(act==='sky-detail-next'||act==='sky-detail-prev'){const a=K.defs.filter((d,i)=>K.status(s,i)!=='idle'),p=a.findIndex(d=>d.id===skyDetail)+(act==='sky-detail-next'?1:-1);if(a[p])openSkyDetail(a[p].id);return true;}
if(act==='sky-zoom'){skyZoom=Math.max(.5,Math.min(2,skyZoom+id*.25));renderActivity();return true;}
if(act==='sky-zone'){focusSky(id*4);renderActivity();return true;}
if(act==='sky-pictures'){skyPictures=!skyPictures;renderActivity();return true;}
if(act==='sky-search'){skySearch=!skySearch;skyQuery='';renderActivity();if(skySearch)$('#sky-query').focus();return true;}
if(act==='sky-search-result'){focusSky(id);skySearch=false;renderActivity();return true;}
if(act==='sky-dismiss'){skyToast='';renderActivity();return true;}
if(act==='sky-help'){skyToast='별 조각으로 별을 순서대로 완성해요. 진행 중이거나 완성한 별자리를 눌러 상세를 볼 수 있어요.';renderActivity();return true;}
if(act==='sky-learn'){skyReturnToLearning=true;skyExit();return true;}
return false;}
async function skyEnter(){if(skyBusy)return;skyMainScroll=window.scrollY||0;skyBusy=true;skyMode='view';selectedStar=null;skyTimer=daily().timerRunning;daily().timerRunning=false;skyState().newPieces=false;focusSky(skyState().focus);save();render();const t=$('#sky-transition'),b=$('.constellation-trigger'),rect=b.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!reduced&&t.animate){t.hidden=false;t.style.left=cx+'px';t.style.top=cy+'px';try{await t.animate([{transform:'translate(-50%,-50%) scale(.96)',opacity:0},{transform:'translate(-50%,-50%) scale(1)',opacity:.9}],{duration:220,easing:'ease-in-out',fill:'forwards'}).finished;}catch{}}
activityKind='constellation';$('#activity').classList.add('sky-dialog');renderActivity();$('#activity').showModal();if(!reduced&&$('#activity').animate){try{await $('#activity').animate([{clipPath:`circle(28px at ${cx}px ${cy}px)`,opacity:.2},{clipPath:`circle(${skyRevealRadius(cx,cy)}px at ${cx}px ${cy}px)`,opacity:1}],{duration:820,easing:'cubic-bezier(.45,0,.3,1)'}).finished;}catch{}}t.hidden=true;t.getAnimations?.().forEach(a=>a.cancel());skyBusy=false;afterSkyEnter();}
async function skyExit(){if(skyBusy||skyRun)return;clearSkyTimers();const s=skyState();if(s.guide){s.guide=null;s.guideDone=true;}skyDetail=null;skyToast='';save();skyBusy=true;const dialog=$('#activity'),t=$('#sky-transition'),b=$('.constellation-trigger'),rect=b.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!reduced&&dialog.animate){try{await dialog.animate([{clipPath:`circle(${skyRevealRadius(cx,cy)}px at ${cx}px ${cy}px)`,opacity:1},{clipPath:`circle(28px at ${cx}px ${cy}px)`,opacity:.2}],{duration:640,easing:'cubic-bezier(.45,0,.3,1)',fill:'forwards'}).finished;}catch{}}
dialog.close();dialog.getAnimations?.().forEach(a=>a.cancel());dialog.classList.remove('sky-dialog');activityKind=null;if(!reduced&&t.animate){t.hidden=false;t.style.left=cx+'px';t.style.top=cy+'px';try{await t.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:.8},{transform:'translate(-50%,-50%) scale(.96)',opacity:0}],{duration:260,easing:'ease-out'}).finished;}catch{}}t.hidden=true;t.getAnimations?.().forEach(a=>a.cancel());daily().timerRunning=skyTimer;skyBusy=false;window.scrollTo(0,skyMainScroll);if(skyReturnToLearning&&!M.currentProgram(current()))$('.card.is-current')?.scrollIntoView?.({block:'center'});skyReturnToLearning=false;render();b.focus({preventScroll:true});}
function rewardsAction(act,b){if(skyAction(act,b))return true;const id=Number(b.dataset.id);
if(act==='mypage'){openMy();return true;}if(act==='back-main'){backMain();return true;}
if(act==='my-answers'){openActivity('answers');return true;}if(act==='my-wrongnotes'){openActivity('wrongnotes');return true;}if(act==='user-settings'){openActivity('settings');return true;}
if(act==='calendar-prev'||act==='calendar-next'){const [y,m]=monthParts(),date=new Date(Date.UTC(y,m-1+(act==='calendar-prev'?-1:1),1));calendarMonth=date.toISOString().slice(0,7);renderMy();return true;}
if(act==='calendar-day'){reportDate=b.dataset.date;openActivity('report');return true;}
if(act==='save-user'){state.profile.name=$('#user-name').value.trim().slice(0,20)||'재능';closeSurface('#activity');activityKind=null;notify('학습자 설정 변경');return true;}
return false;}

function markLearning(){const d=daily();d.started=true;d.entry='activity';d.timerRunning=true;}
function dailyControls(){const d=daily();return `${skyControls()}<h3>CSV 말풍선·추천 검증</h3><div class="fields"><label>회원 유형<select id="mentor-member"><option value="member" ${state.profile.memberType!=='trial'?'selected':''}>재능회원</option><option value="trial" ${state.profile.memberType==='trial'?'selected':''}>체험회원</option></select></label><label>생일 조건 확인<input type="date" id="mentor-birthday" value="${esc(state.profile.birthday||'')}"></label></div><button data-action="mentor-greeting">인사 조건 다시 확인</button><div class="presets">${M.draftPresetNames.map((n,i)=>i===10?'':`<button data-action="draft-preset" data-id="${i}">${i===4?'실력알기 3회 진입 · 미완료':n}</button>`).join('')}</div><div class="fields"><label>학습자 이름<input id="learner-name" value="${esc(state.profile.name)}"></label><label>오늘 목표 시간(분)<input type="number" id="daily-target" min="0" max="120" value="${d.target||0}"></label></div><div class="fields"><label>오늘 학습 시간(분)<input type="number" id="daily-minutes" min="0" max="600" value="${d.minutes}"></label><label>미확인 답변 수<input type="number" id="daily-answers" min="0" max="99" value="${d.unreadAnswers}"></label></div><div class="fields"><label>실력알기 진입 횟수<input type="number" id="group-attempts" min="0" max="99" value="${current().mentorDiagnosisEntries||0}"></label><label>연속 처방 없이 통과<input type="number" id="clean-streak" min="0" max="99" value="${d.cleanStreak}"></label></div><div class="actions"><button data-action="daily-add">학습 시간 +1분</button><button data-action="daily-variant">다른 메시지 보기</button><button data-action="goal">목표시간 화면</button><button data-action="report">오늘의 리포트</button></div><div class="notice">초안 프리셋은 조건을 분리하기 위해 전체 학습 테스트 상태를 초기화합니다.<br>추천 우선순위(가정): 미확인 답변 → 오답 3개 이상 → 목표 달성 리포트 → 목표 정하기 → 오늘 학습.<br>말풍선은 공유 CSV의 P0~P5 우선순위와 노출 횟수를 따릅니다. 긴 문구는 읽을 시간을 두고 나눠 보여줍니다.<br>같은 프레임 반복은 학습 창의 ‘현재 프레임 다시 시도’ 또는 프리셋으로 확인합니다. 실력알기 진입 횟수는 진단 화면을 여는 횟수입니다. 시간은 활성 학습 중 화면이 보일 때 1분 단위로 기록합니다.</div>`;}
function followRecommendation(r){if(r.kind==='diagnosis')openLearning('diagnosis');if(r.kind==='program')openLearning('program',r.id);if(r.kind==='next')select(state.grade,state.index+1);if(r.kind==='grade')select(state.grade+1,0);}
let activityKind=null,completedCardSelection=null;
function openActivity(kind){if(kind==='constellation'){$('#activity').classList.remove('study-choice-dialog');$('#activity').removeAttribute('aria-labelledby');completedCardSelection=null;if(panel)closePanel();skyEnter();return;}$('#activity').classList.remove('sky-dialog','study-choice-dialog');if(kind==='completed-study'){$('#activity').classList.add('study-choice-dialog');$('#activity').setAttribute('aria-labelledby','study-choice-title');}else{$('#activity').removeAttribute('aria-labelledby');completedCardSelection=null;}if(kind==='report'){speechPolicy?.offer(state,'SB-026',daily().date);if(!reportDate)reportDate=todayKey();}if(panel)closePanel();activityKind=kind;renderActivity();$('#activity').showModal();}
function renderActivity(){const d=daily(),s=current();let title='',content='';
if(activityKind==='completed-study'){
  const p=selectedCompletedCard();if(!p){dismissCompletedCard();return;}
  const review=p.reviewSession&&!p.reviewSession.complete?'복습 이어하기':'복습하기';
  renderDialogView('#activity',`<div class="study-choice-top"><span>학습 다시 살펴보기</span><button data-action="close-activity" aria-label="학습 선택 닫기"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></div><div class="study-choice-body"><span class="study-choice-symbol" aria-hidden="true">${statusSVG(p.status==='failed'?'failed':'passed')}</span><h2 id="study-choice-title">${esc(p.name)}</h2><p>${p.status==='failed'?'헷갈렸던 내용을 한 번 더 익혀볼까요?':'완료한 학습을 한 번 더 연습해볼까요?'}</p><div class="study-choice-actions completion-actions"><button class="primary" data-action="study-choice-review" ${M.canReview(s,p)?'':'disabled'}>${review}</button><button data-action="study-choice-result">결과 보기</button></div></div>`,'completed-study:'+state.grade+':'+state.index+':'+p.id);return;
}
if(activityKind==='diagnosis-guide'){title='실력알기 안내';content=`<div class="welcome-help-copy">${diagnosisWelcomeTipsHTML(true)}<div class="actions"><button class="primary" data-action="welcome-help-start">${s.diagnosis==='active'?'실력알기 이어하기':'실력알기 시작하기'}</button></div></div>`;}
if(activityKind==='settings'){title='학습 설정';content=`<label>학습자 이름<input id="user-name" value="${esc(state.profile.name)}"></label><div class="actions"><button data-action="save-user">저장</button><button data-action="goal">목표 시간 변경</button></div>`;}
if(activityKind==='goal'){title='오늘의 목표 학습 시간';content=`<p>오늘은 얼마나 공부해 볼까요?</p><div class="actions">${[10,15,20,30,45].map(n=>`<button data-action="goal-option" data-id="${n}">${n}분</button>`).join('')}</div><label>목표 시간(분)<input id="goal-minutes" type="number" min="5" max="120" value="${d.target||20}"></label><div class="actions"><button class="primary" data-action="save-goal">목표 정하기</button></div>`;}
if(activityKind==='answers'&&!d.unreadAnswers){title='도와줘요';content='<p>선생님께 최근 요청한 도움이 없어요.</p>';}else if(activityKind==='answers'){title='도와줘요 답변';content=`<p>분모가 다른 분수는 어떻게 더하나요?</p><div class="learning-info">분모를 같게 바꾼 다음 분자끼리 더해 보세요. 예를 들어 1/2 + 1/4은 2/4 + 1/4이므로 3/4입니다.</div><button data-action="answer-read">답변 확인했어요</button>`;}
if(activityKind==='wrongnotes'){title='오답노트';const a=M.wrongEntries(state);content=`<p>미통과 학습 ${a.length}개</p><div class="wrong-list">${a.map(x=>`<button data-action="wrong-entry" data-g="${x.grade}" data-set="${x.index}" data-id="${x.id}"><strong>${esc(x.name)}</strong><small>${grade(x.grade)}등급 · ${esc(x.groupName)}</small></button>`).join('')||'<p>다시 학습할 항목이 없어요.</p>'}</div>`;}
if(activityKind==='report'){const date=reportDate||d.date,rec=date===d.date?d:state.history[date]||{},logs=Object.values(rec.log||{});title=date===d.date?'오늘의 학습 리포트':date+' 학습 리포트';content=`<div class="learning-info"><strong>${rec.target?'목표 '+rec.target+'분 / 학습 '+(rec.minutes||0)+'분':'학습 '+(rec.minutes||0)+'분 · 목표 미설정'}</strong><p>모은 별 조각 ${rec.fragments||0}개</p>${rec.target?`<progress max="${rec.target}" value="${Math.min(rec.minutes||0,rec.target)}"></progress>`:''}</div><div class="report-programs">${logs.map(p=>`<div><strong>${esc(p.name)}</strong><small>${p.reviewed?'복습':'학습'} · ${M.labels[p.status]} · 진행률 ${p.progress}%</small></div>`).join('')||'<p>기록된 프로그램 학습이 없습니다.</p>'}</div>${date===d.date?`<div class="actions"><button data-action="toggle-timer">${d.timerRunning?'학습 시간 기록 일시정지':'학습 시간 기록 재개'}</button><button data-action="goal">목표 시간 변경</button></div>`:''}`;}
if(activityKind==='constellation'){renderDialogView('#activity',skyHTML(),'sky:'+(skyDetail===null?'map':'detail:'+skyDetail),true);return;}
renderDialogView('#activity',`<div class="dialog-top"><h2>${title}</h2><button data-action="close-activity" aria-label="닫기">×</button></div>${content}`,activityKind+':'+(reportDate||''));
}
function draftAction(act,b){const d=daily(),s=current(),id=Number(b.dataset.id);
if(diagnosisWelcomeAction(act))return true;if(rewardsAction(act,b))return true;if(['goal','report','constellation'].includes(act)){if(act==='report')reportDate=todayKey();openActivity(act);return true;}
if(act==='close-activity'&&activityKind==='completed-study'){dismissCompletedCard();return true;}
if(act==='close-activity'){if(activityKind==='constellation')skyExit();else{closeSurface('#activity');activityKind=null;reportDate=null;}return true;}
if(act==='goal-option'){$('#goal-minutes').value=id;return true;}
if(act==='save-goal'){d.target=Math.max(5,Math.min(120,Number($('#goal-minutes').value)||20));closeSurface('#activity');activityKind=null;notify('오늘 목표 '+d.target+'분 설정');return true;}
if(act==='answer-read'){d.unreadAnswers=0;closeSurface('#activity');activityKind=null;notify('도와줘요 답변 확인');return true;}
if(act==='toggle-timer'){d.timerRunning=!d.timerRunning;save();renderActivity();return true;}
if(act==='wrong-entry'){if(myOpen)backMain();select(Number(b.dataset.g),Number(b.dataset.set));closeSurface('#activity');activityKind=null;openLearning('program',id);if(editing)editing.fromWrongNote=true;return true;}
if(act==='map-group'){select(state.grade,id);closeSurface('#activity');activityKind=null;return true;}
if(act==='daily-add'){d.minutes++;notify('학습 시간 1분 추가');return true;}
if(act==='daily-variant'){if(speechPolicy){const text=speechPolicy.preview(state);if(panel)closePanel();if(text)animateMessage(true,text);save();}else{d.variant++;notify('메시지 다른 표현 확인');}return true;}
if(act==='mentor-greeting'){const book=state.mentorPolicy;if(book){book.queue=[];for(const key of Object.keys(book.seen))if(/^SB-00[2-7]:/.test(key))delete book.seen[key];}speechPolicy?.reset();mentorEntry++;if(panel)closePanel();render();return true;}
if(act==='draft-preset'){loadValidationScenario(id,true);return true;}
return false;}

function save(){archiveDay();try{localStorage.setItem(key,JSON.stringify(state));}catch{ $('storage-note')?.remove();}}
function notify(text){recordProgram();cancelComposition();daily().variant++;current().recent=text;presetIndex=null;save();render();refreshDialog();}
function isCleanPass(s){return s.diagnosis==='done'&&s.programs.length===0;}
// Completing one group is not the same as completing its whole grade.
function cleanPassInfo(){
  const completed=s=>s.diagnosis==='done'&&s.programs.every(p=>p.status==='passed');
  const groups=state.grades[state.grade],gradeComplete=groups.every(completed);
  let targetGrade=state.grade,targetIndex=-1;
  if(!gradeComplete){
    for(let offset=1;offset<=groups.length;offset++){
      const i=(state.index+offset)%groups.length;
      if(!completed(groups[i])){targetIndex=i;break;}
    }
  }else{
    for(let g=state.grade+1;g<state.grades.length;g++){
      const i=state.grades[g].findIndex(s=>!completed(s));
      if(i>=0){targetGrade=g;targetIndex=i;break;}
    }
  }
  let next=null,cta='',nextLabel='';
  if(targetIndex>=0){
    const record=state.grades[targetGrade][targetIndex];
    const rec=M.learningRecommend({...state,grade:targetGrade,index:targetIndex});
    next={grade:targetGrade,index:targetIndex,kind:['diagnosis','program'].includes(rec.kind)?rec.kind:'overview',id:rec.id,name:record.groupName};
    const continuing=record.diagnosis!=='idle';
    nextLabel=targetGrade!==state.grade?'다음 등급':targetIndex<=state.index?'남은 학습':'다음 학습';
    cta=next.kind==='overview'?'남은 학습 확인하기':targetGrade!==state.grade?`${grade(targetGrade)}등급 ${continuing?'이어하기':'시작하기'}`:next.kind==='program'?'남은 학습 이어하기':continuing?'실력알기 이어하기':'다음 실력알기 시작';
  }
  const title=gradeComplete?`${grade(state.grade)}등급을 통과했어요!`:'진단을 통과했어요!';
  const message=next?next.grade!==state.grade?`이제 ${grade(next.grade)}등급에 도전해 볼까요?`:next.kind==='program'?'남은 학습을 이어가 볼까요?':'다음 실력알기로 이어가 볼까요?':'이번 등급의 학습을 모두 마쳤어요.';
  return {gradeComplete,title,message,next,nextLabel,cta};
}
function cleanPassHTML(){
  const pass=cleanPassInfo();
  if(pass.next&&(editing.passStage==='ready'||(!editing.passStage&&current().cleanPassStage==='ready')))return cleanPassReadyHTML(pass);
  return `<div class="diagnosis-screen-top"><button data-action="diagnosis-leave">← 학습 목록</button><strong>실력알기 결과</strong><button class="pass-detail-link" data-action="pass-details">결과 자세히</button></div>
  <section class="pass-screen pass-celebrate" aria-labelledby="pass-title">
    <div class="achievement-stamp" aria-hidden="true"><svg viewBox="0 0 144 144" fill="none"><circle cx="72" cy="72" r="61"/><circle class="stamp-orbit" cx="72" cy="72" r="69"/><path d="m53 43 8 8 18-20"/></svg><span>${grade(state.grade)}</span><small>${pass.gradeComplete?'등급 통과':'진단 통과'}</small><i class="stamp-spark one"></i><i class="stamp-spark two"></i><i class="stamp-spark three"></i><i class="stamp-spark four"></i></div>
    <p class="pass-context">${grade(state.grade)}등급 · ${esc(current().groupName)}</p>
    <h1 id="pass-title" tabindex="-1">${pass.title}</h1>
    <p class="pass-mentor"><strong>훌륭해요!</strong> ${pass.gradeComplete?'이 등급의 학습을 모두 마쳤어요.':'추가 학습 없이 통과했어요.'}</p>
    <div class="achievement-record"><span aria-hidden="true">✓</span><span>${esc(pass.gradeComplete?grade(state.grade)+'등급':current().groupName)} 완성</span></div>
    ${pass.next?`<button class="primary pass-continue" data-action="pass-next">${cleanPassPrepareLabel(pass)} <span aria-hidden="true">→</span></button>`:''}
    <button class="pass-later" data-action="diagnosis-leave">${pass.next?'오늘은 여기까지':'학습 목록으로'}</button>
  </section>`;
}
function cleanPassPrepareLabel(pass){return pass.next?.kind==='program'||pass.nextLabel==='남은 학습'?'남은 학습 살펴보기':'다음 단계 만나기';}
function cleanPassReadyHTML(pass){
  const next=pass.next;if(!next)return '';
  const record=state.grades[next.grade][next.index],continuing=record.diagnosis!=='idle';
  const fresh=next.kind==='diagnosis'&&!continuing;
  const title=fresh?'다음 도전이 열렸어요!':'이어서 도전해 볼까요?';
  const name=next.kind==='program'?record.programs.find(p=>p.id===next.id)?.name||next.name:next.name;
  const action=next.kind==='overview'?'학습 목록 확인하기':next.kind==='program'?'학습 이어하기':continuing?'진단 이어하기':'진단 시작하기';
  const note=fresh?'새로운 내용을 얼마나 알고 있는지 알아봐요.':next.kind==='diagnosis'?'지난번에 풀던 문제부터 이어갈 수 있어요.':next.kind==='overview'?'남은 학습을 확인해 봐요.':'진행하던 학습을 차근차근 이어가요.';
  return `<div class="diagnosis-screen-top"><button data-action="pass-summary">← 통과 화면</button><strong>다음 학습 준비</strong><button class="pass-detail-link" data-action="diagnosis-leave">나중에 할게요</button></div>
  <section class="pass-screen pass-ready" aria-labelledby="pass-title">
    <p class="ready-achievement"><span aria-hidden="true">✓</span> ${esc(pass.gradeComplete?grade(state.grade)+'등급':current().groupName)} 통과</p>
    <h1 id="pass-title" tabindex="-1">${title}</h1>
    <p class="pass-mentor">${fresh?'한 걸음 더 성장한 만큼, 새로운 도전을 준비했어요.':note}</p>
    <div class="next-part-card"><span class="next-part-label">${pass.nextLabel}</span><div class="next-part-grade" aria-hidden="true">${grade(next.grade)}<span>등급</span></div><h2>${esc(name)}</h2><p>${grade(next.grade)}등급${next.kind==='program'?' · '+esc(next.name):''}</p><span class="next-part-type">${next.kind==='diagnosis'?'실력알기':next.kind==='program'?'맞춤 학습':'학습 목록'}</span></div>
    ${fresh?'<p class="ready-note">준비됐다면, 실력알기를 시작해 볼까요?</p>':''}
    <button class="primary pass-continue" data-action="pass-begin">${action} <span aria-hidden="true">→</span></button>
    <button class="pass-later" data-action="diagnosis-leave">오늘은 여기까지</button>
  </section>`;
}
function continueCleanPass(){
  if(diagnosisOutcomeRun||!isCleanPass(current()))return;
  const pass=cleanPassInfo();if(!pass.next){closeLearning();return;}
  daily().timerRunning=false;current().cleanPassStage='ready';
  editing={kind:'diagnosis',complete:true,passStage:'ready'};
  save();refreshDialog();if(!$('#learning').open)$('#learning').showModal();$('#pass-title')?.focus();
}
function beginCleanPassNext(){
  if(!isCleanPass(current())||!editing?.complete||(editing.passStage||current().cleanPassStage)!=='ready')return;
  const {next}=cleanPassInfo();if(!next){closeLearning();return;}
  select(next.grade,next.index);
  if(next.kind==='overview'){closeLearning();return;}
  openLearning(next.kind,next.id);
  const heading=$('#learning h1, #learning h2');heading?.setAttribute('tabindex','-1');heading?.focus();
}
// Decorative mentor motion follows the actual local message lifecycle.
// A short minimum hold lets each shape read clearly even across rapid updates.
let mentorTimer=null,mentorToken=0,mentorMode='idle',mentorShape='clover',mentorChangedAt=0;
function syncMentorMotion(mode){
  mentorMode=mode;clearTimeout(mentorTimer);mentorTimer=null;const token=++mentorToken;
  const card=$('.ai-top'),symbol=$('#mentor-symbol');
  if(!card||!symbol)return;
  card.setAttribute('data-mentor-state',mode);
  card.setAttribute('data-mentor-paused',document.visibilityState==='hidden'?'true':'false');
  if(document.visibilityState==='hidden')return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shapes=mode==='speaking'?['plus','times','minus','divide','clover']:mode==='thinking'?['divide','plus','times','minus','clover']:['clover','plus','divide','times','minus'];
  let index=0;
  function show(){
    if(token!==mentorToken||document.visibilityState==='hidden')return;
    mentorShape=shapes[index%shapes.length];mentorChangedAt=Date.now();
    symbol.setAttribute('data-shape',mentorShape);index++;
    if(!reduced)mentorTimer=setTimeout(show,mode==='idle'?2400:1800);
  }
  if(reduced){show();return;}
  const hold=mentorShape==='clover'?0:Math.max(0,900-(Date.now()-mentorChangedAt));
  if(hold)mentorTimer=setTimeout(show,hold);else show();
}
function setAIState(label){
  aiState=label;
  syncMentorMotion(label==='생각 중'?'thinking':label==='반응 중'?'speaking':'idle');
}
document.addEventListener('visibilitychange',()=>syncMentorMotion(mentorMode));
matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',()=>syncMentorMotion(mentorMode));
let bubblePhase='rest',bubbleTimer=null,bubbleGeneration=0,bubbleHold=4000,mentorReadTimer=null,mentorReadToken=0,mentorReadingOverflow=false,mentorPointerPaused=false,mentorFocusPaused=false;
let mentorReminderTimer=null,mentorReminderToken=0,mentorReminderIndex=0,lastMentorContext='',mentorTargetText='',mentorRun=null;
const MENTOR_PAGE_GAP=380;
const speechPolicy=window.MentorPolicy?.createTracker();
const mentorSession='visit:'+Date.now().toString(36)+':'+Math.random().toString(36).slice(2,7);
let mentorEntry=1,mentorCurrentId=null;
function speechContext(){return {entry:mentorSession+':'+mentorEntry,reentry:window.performance?.getEntriesByType?.("navigation")?.[0]?.type!=="reload",wrongNote:!!editing?.fromWrongNote};}
function observeSpeech(){speechPolicy?.observe(state,speechContext());}
function markMentorInterrupted(p){if(!speechPolicy||!p||p.status!=='active'||p.progress>=100)return;state.mentorPolicy??={seen:{},rotations:{},queue:[],completedByDate:{}};state.mentorPolicy.interrupted??={};state.mentorPolicy.interrupted[state.grade+':'+state.index+':'+p.id]=true;}
function mentorBubbleAvailable(){return Math.min(420,Math.max(56,$('.ai-top').getBoundingClientRect().width-56));}
function mentorTextCapacity(){return Math.max(20,mentorBubbleAvailable()-38);}
function measureMentorText(copy){const measure=$('#mentor-measure');measure.style.maxWidth='none';measure.textContent=copy;return measure.getBoundingClientRect().width;}
function mentorCharacters(copy){return typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(copy)].map(x=>x.segment):Array.from(copy);}
// Prefer two balanced clauses. Very narrow screens or exceptional input can use
// additional pages, so no word ever has to scroll out of the speech bubble.
function splitMentorMessage(copy,limit=mentorTextCapacity(),measure=measureMentorText){
  copy=String(copy).trim();if(!copy)return [''];if(measure(copy)<=limit)return [copy];
  const chars=mentorCharacters(copy),length=chars.length;
  function fit(start,end,suffix=false){let low=0,high=end-start;while(low<high){const count=Math.ceil((low+high)/2),part=suffix?chars.slice(end-count,end):chars.slice(start,start+count);if(measure(part.join('').trim())<=limit)low=count;else high=count-1;}return low;}
  function boundaryScore(i){const previous=chars[i-1],next=chars[i];return /[.!?。！？]/u.test(previous)?0:/\s/u.test(previous)||/\s/u.test(next)?4:40;}
  const prefix=fit(0,length),suffix=fit(0,length,true),first=Math.max(1,length-suffix),last=Math.min(length-1,prefix);
  if(first<=last){
    let best=first,score=Infinity;
    for(let i=first;i<=last;i++){const a=chars.slice(0,i).join('').trim(),b=chars.slice(i).join('').trim();if(!a||!b)continue;const value=boundaryScore(i)+Math.abs(measure(a)-measure(b))*.03;if(value<score){score=value;best=i;}}
    return [chars.slice(0,best).join('').trim(),chars.slice(best).join('').trim()];
  }
  const pages=[];let start=0;
  while(start<length){
    while(start<length&&/\s/u.test(chars[start]))start++;if(start>=length)break;
    const count=Math.max(1,fit(start,length));let end=start+count;
    if(end<length)for(let i=end;i>=start+Math.ceil(count*.6);i--)if(boundaryScore(i)<40){end=i;break;}
    pages.push(chars.slice(start,end).join('').trim());start=end;
  }
  return pages;
}
function prepareMentorPages(run){run.capacity=mentorTextCapacity();run.pages=splitMentorMessage(run.fullText,run.capacity);run.index=Math.min(run.index,run.pages.length-1);run.width=Math.max(56,...run.pages.map(page=>Math.ceil(measureMentorText(page))+38));}
function updateMentorReadButtons(){const index=mentorRun?.index||0,total=mentorRun?.pages.length||1;$('#mentor-read-back').disabled=index===0;$('#mentor-read-next').disabled=index>=total-1;}
function fitMentorBubble(){
  const bubble=$('#mentor-bubble');if(!bubble)return;const text=$('#ai-message');
  if(!['speaking','holding','paging'].includes(bubblePhase))bubble.style.width='56px';
  else bubble.style.width=Math.min(mentorBubbleAvailable(),mentorRun&&mentorRun.generation===bubbleGeneration?mentorRun.width:Math.max(56,Math.ceil(measureMentorText(text.textContent||' '))+36))+'px';
  bubble.style.height='48px';text.scrollLeft=0;mentorReadingOverflow=false;bubble.setAttribute('data-overflow','false');
  $('#mentor-read-controls').hidden=true;text.tabIndex=mentorRun?.pages.length>1?0:-1;updateMentorReadButtons();
}
function setBubblePhase(phase){bubblePhase=phase;$('.ai-top').setAttribute('data-bubble-phase',phase);fitMentorBubble();scheduleMentorReminder();}
function clearMentorReading(){clearTimeout(bubbleTimer);clearTimeout(mentorReadTimer);bubbleTimer=null;mentorReadTimer=null;mentorReadToken++;}
function scheduleBubbleRest(){
  scheduleMentorReminder();clearMentorReading();if(!['holding','paging'].includes(bubblePhase)||!mainGuidanceVisible()||mentorPointerPaused||mentorFocusPaused)return;
  const run=mentorRun,generation=bubbleGeneration,token=mentorReadToken;
  const valid=()=>generation===bubbleGeneration&&token===mentorReadToken&&run===mentorRun&&mainGuidanceVisible();
  if(bubblePhase==='paging'){
    mentorReadTimer=setTimeout(()=>{if(!valid())return;mentorReadTimer=null;run.index++;showMentorPage(run);},MENTOR_PAGE_GAP);return;
  }
  bubbleTimer=setTimeout(()=>{
    if(!valid())return;bubbleTimer=null;
    if(run&&run.index<run.pages.length-1){$('#ai-message').setAttribute('aria-busy','true');setBubblePhase('paging');scheduleBubbleRest();}
    else setBubblePhase('rest');
  },bubbleHold);
}
function showMentorPage(run){
  if(run!==mentorRun||run.generation!==bubbleGeneration)return;if(!mainGuidanceVisible()){suspendMentor();return;}
  if(run.capacity!==mentorTextCapacity())prepareMentorPages(run);
  const el=$('#ai-message'),page=run.pages[run.index];el.textContent='';el.scrollLeft=0;el.setAttribute('aria-busy','true');
  el.setAttribute('data-page',String(run.index+1));el.setAttribute('data-pages',String(run.pages.length));
  const finish=()=>{if(run!==mentorRun||run.generation!==bubbleGeneration)return;el.classList.remove('generating');el.setAttribute('aria-busy','false');setAIState('대기');setBubblePhase('holding');bubbleHold=run.index<run.pages.length-1?Math.max(2400,Math.min(3600,page.length*110)):Math.max(4000,Math.min(10000,page.length*110));scheduleBubbleRest();};
  if(run.immediate||matchMedia('(prefers-reduced-motion: reduce)').matches){el.textContent=page;finish();return;}
  setAIState('반응 중');el.classList.add('generating');setBubblePhase('speaking');const characters=mentorCharacters(page);let i=0;
  function type(){
    if(run!==mentorRun||run.generation!==bubbleGeneration)return;if(!mainGuidanceVisible()){suspendMentor();return;}
    if(i>=characters.length){finish();return;}const char=characters[i++];el.textContent=characters.slice(0,i).join('');el.scrollLeft=0;
    if(i===characters.length){finish();return;}animTimer=setTimeout(type,/[.!?。！？]/u.test(char)?130:48);
  }
  animTimer=setTimeout(type,run.index===0?300:80);
}
function moveMentorReading(direction){
  if(!mentorRun||mentorRun.pages.length<2||!mainGuidanceVisible()||bubblePhase!=='holding')return;
  const next=Math.max(0,Math.min(mentorRun.pages.length-1,mentorRun.index+direction));if(next===mentorRun.index)return;
  clearMentorReading();clearTimeout(animTimer);mentorRun.index=next;showMentorPage(mentorRun);
}
function refitMentorMessage(force=false){
  if(mentorRun&&mentorRun.generation===bubbleGeneration&&mainGuidanceVisible()&&(force===true||mentorRun.capacity!==mentorTextCapacity())){
    mentorRun.index=0;prepareMentorPages(mentorRun);if(['speaking','holding','paging'].includes(bubblePhase)){clearMentorReading();clearTimeout(animTimer);showMentorPage(mentorRun);return;}
  }
  fitMentorBubble();if(bubblePhase==='holding')scheduleBubbleRest();
}
document.addEventListener('visibilitychange',scheduleBubbleRest);
window.addEventListener?.('resize',refitMentorMessage);
document.fonts?.ready?.then(()=>refitMentorMessage(true));
$('#mentor-bubble').addEventListener('pointerenter',e=>{if(e.pointerType==='touch')return;mentorPointerPaused=true;scheduleBubbleRest();});
$('#mentor-bubble').addEventListener('pointerleave',()=>{mentorPointerPaused=false;scheduleBubbleRest();});
$('#mentor-bubble').addEventListener('pointerdown',()=>{mentorPointerPaused=true;scheduleBubbleRest();});
$('#mentor-bubble').addEventListener('pointerup',e=>{mentorPointerPaused=e.pointerType!=='touch';scheduleBubbleRest();});
$('#mentor-bubble').addEventListener('pointercancel',()=>{mentorPointerPaused=false;scheduleBubbleRest();});
$('#mentor-bubble').addEventListener('focusin',()=>{mentorFocusPaused=true;scheduleBubbleRest();});
$('#mentor-bubble').addEventListener('focusout',e=>{if($('#mentor-bubble').contains?.(e.relatedTarget))return;mentorFocusPaused=false;scheduleBubbleRest();});
$('#ai-message').addEventListener('keydown',e=>{if(mentorRun?.pages.length>1&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();moveMentorReading(e.key==='ArrowRight'?1:-1);}});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',scheduleBubbleRest);
let guidanceClosing=false,guidanceClosingTimer=null,guidanceReleaseToken=0,mentorNeedsResume=false;
function mainGuidanceVisible(){return document.visibilityState!=='hidden'&&!myOpen&&!editing&&!diagnosisOutcomeRun&&panel!=='test'&&!guidanceClosing&&!composing&&!skyBusy&&!activityKind&&!$('#learning').open&&!$('#help').open&&!$('#activity').open&&!$('#prescription').open;}
function suspendMentor(){
  if(!mentorNeedsResume){bubbleGeneration++;clearTimeout(thinkTimer);clearTimeout(animTimer);thinkTimer=null;animTimer=null;clearMentorReading();clearTimeout(mentorTimer);mentorTimer=null;mentorToken++;}
  mentorNeedsResume=true;$('.ai-top').setAttribute('data-mentor-paused','true');
}
function holdGuidanceAfterClose(){
  mentorEntry++;
  clearTimeout(guidanceClosingTimer);guidanceClosing=true;suspendMentor();const token=++guidanceReleaseToken;
  guidanceClosingTimer=setTimeout(()=>{if(token!==guidanceReleaseToken)return;guidanceClosingTimer=null;guidanceClosing=false;syncGuidanceReminders();},matchMedia('(prefers-reduced-motion: reduce)').matches?0:420);
}
function closeSurface(selector){const d=$(selector),wasOpen=d.open;d.close();if(wasOpen)holdGuidanceAfterClose();}
function mentorOverviewLine(){
  const s=current(),d=daily();
  if(isCleanPass(s)){const pass=cleanPassInfo();return pass.gradeComplete?grade(state.grade)+'등급을 통과했어요!':'진단을 통과했어요!';}
  if(composing)return '필요한 학습을 준비하고 있어요.';
  if(s.presentationPending)return '맞춤 학습이 준비됐어요.';
  const raw=M.message(state);
  if(raw.length<=32)return raw;
  return mentorReminderLines()[0];
}

function mentorContext(){
  const s=current(),d=daily(),p=M.currentProgram(s),rec=M.recommend(state);
  return JSON.stringify([state.grade,state.index,s.diagnosis,M.status(s,state.policy),p?.id,!!s.presentationPending,d.unreadAnswers>0,!!(d.target&&d.minutes>=d.target),M.wrongEntries(state).length>=3,!!state.sky?.newPieces,rec.kind,rec.id]);
}
function mentorReminderLines(){
  const s=current(),d=daily(),st=M.status(s,state.policy),rec=M.recommend(state);
  if(isCleanPass(s)){const pass=cleanPassInfo();return ['추가 학습 없이 진단을 통과했어요.',pass.next?pass.message:'오늘의 학습을 잘 마쳤어요.'];}
  if(rec.kind==='wrongnotes')return ['헷갈렸던 문제를 다시 풀어볼까요?','오답노트에서 함께 연습해요.'];
  if(rec.kind==='report')return ['오늘 목표를 해냈어요!','리포트에서 오늘의 학습을 확인해요.'];
  if(rec.kind==='constellation')return ['새 별 조각을 모았어요.','나의 별자리를 꾸며볼까요?'];
  if(s.presentationPending)return ['맞춤 학습이 준비됐어요.','첫 번째 학습부터 시작해 볼까요?','실력알기 결과도 확인할 수 있어요.'];
  if(s.diagnosis==='idle')return ['실력알기로 지금 실력을 알아볼까요?','알고 있는 내용부터 차근차근 확인해요.',!d.target&&!d.started?'오늘 목표 시간을 정해볼까요?':'준비되면 실력알기를 시작해요.'];
  if(s.diagnosis==='active')return ['진행 중인 실력알기가 있어요.','풀던 문제부터 이어서 확인해 볼까요?'];
  if(rec.kind==='done')return ['여기까지 차근차근 잘 해냈어요.','오늘 학습은 리포트에서 확인해요.'];
  if(st==='passed')return ['필요한 학습을 모두 마쳤어요!','다음 학습을 만나볼까요?'];
  if(st==='failed'||s.programs.some(p=>p.status==='failed'))return ['헷갈린 부분을 복습해 볼까요?','틀린 문제에서 한 번 더 배워요.'];
  if(M.currentProgram(s))return ['풀던 학습을 이어서 해볼까요?','한 문제씩 차근차근 풀어봐요.'];
  if(rec.kind==='locked')return ['이전 학습을 마치면 다음 학습이 열려요.','진행 중인 학습부터 이어가 볼까요?'];
  return ['맞춤 학습부터 하나씩 시작해요.','실력알기 결과에서 틀린 내용을 확인해요.'];
}
function scheduleMentorReminder(){
  if(!mainGuidanceVisible()||bubblePhase!=='rest'||mentorPointerPaused||mentorFocusPaused||(speechPolicy&&!speechPolicy.pending(state))){clearTimeout(mentorReminderTimer);mentorReminderTimer=null;mentorReminderToken++;return;}
  if(mentorReminderTimer)return;const token=++mentorReminderToken;
  mentorReminderTimer=setTimeout(()=>{
    if(token!==mentorReminderToken)return;mentorReminderTimer=null;
    if(!mainGuidanceVisible()||bubblePhase!=='rest'||mentorPointerPaused||mentorFocusPaused)return;
    if(speechPolicy){animateMessage(true);return;}
    // Compatibility for an older preview adapter without the policy script.
    if(mentorContext()!==lastMentorContext){animateMessage();return;}
    const lines=mentorReminderLines();animateMessage(true,lines[mentorReminderIndex++%lines.length]);
  },speechPolicy?1200:6500);
}
function animateMessage(force=false,reminderMessage=null){
  observeSpeech();if(!mainGuidanceVisible()){suspendMentor();return;}
  const resuming=mentorNeedsResume,context=mentorContext();
  // Keep a readable current page stable during unrelated renders.
  if(!force&&!resuming&&context===lastMentorContext&&bubblePhase!=='rest')return;
  let choice=null;
  if(!reminderMessage&&speechPolicy&&!(resuming&&context===lastMentorContext&&!speechPolicy.pending(state)&&mentorTargetText))choice=speechPolicy.next(state,speechContext());
  const baseMessage=choice?.text??(speechPolicy?null:mentorOverviewLine());
  let msg=reminderMessage??baseMessage;if(!msg&&resuming&&context===lastMentorContext)msg=mentorTargetText;
  if(!msg&&force&&context===lastMentorContext)msg=mentorTargetText;
  mentorNeedsResume=false;$('.ai-top').setAttribute('data-mentor-paused','false');
  if(!msg){if(resuming){clearTimeout(thinkTimer);clearTimeout(animTimer);clearMentorReading();setBubblePhase('rest');}return;}
  if(choice){mentorCurrentId=choice.id;$('.ai-top').setAttribute('data-message-id',choice.id);save();}
  const passed=isCleanPass(current())?cleanPassInfo():null;$('.ai-top').setAttribute('data-clean-pass',passed?'true':'false');
  const signature=context+':'+(speechPolicy?(choice?.key||'')+':'+msg:mentorOverviewLine());if(signature===lastMessage&&!force&&!resuming)return;
  lastMessage=signature;lastMentorContext=context;mentorTargetText=msg;
  const generation=++bubbleGeneration;clearTimeout(thinkTimer);clearTimeout(animTimer);clearMentorReading();
  const el=$('#ai-message');el.scrollLeft=0;el.textContent='';el.classList.remove('generating');el.setAttribute('aria-busy','true');setAIState('생각 중');
  mentorRun={generation,fullText:msg,pages:[],index:0,immediate:!!passed};prepareMentorPages(mentorRun);setBubblePhase('thinking');const run=mentorRun;
  if(run.immediate||matchMedia('(prefers-reduced-motion: reduce)').matches){showMentorPage(run);return;}
  thinkTimer=setTimeout(()=>{if(generation!==bubbleGeneration||run!==mentorRun)return;showMentorPage(run);},450);
}
// Local recommendation preparation motion; no extra network request is needed.
let recommendationTimer=null,recommendationGeneration=0,recommendationSignature='',recommendationPending=false,recommendationDisabled=false;
let recommendationReminderTimer=null,recommendationReminderToken=0,recommendationPointerPaused=false,recommendationFocusPaused=false;
function finishRecommendation(generation){
  if(generation!==recommendationGeneration||!recommendationPending||document.visibilityState==='hidden')return;
  clearTimeout(recommendationTimer);recommendationTimer=null;recommendationPending=false;
  $('.recommend').setAttribute('data-recommend-state','ready');$('.recommend').setAttribute('aria-busy','false');
  $('#recommend-status').textContent='';
  $('#recommend').disabled=recommendationDisabled;scheduleRecommendationReminder();
}
function scheduleRecommendation(){
  clearTimeout(recommendationTimer);recommendationTimer=null;const generation=++recommendationGeneration;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('.recommend').setAttribute('data-recommend-paused',document.visibilityState==='hidden'||reduced?'true':'false');
  if(!recommendationPending||document.visibilityState==='hidden')return;
  if(reduced){finishRecommendation(generation);return;}
  recommendationTimer=setTimeout(()=>finishRecommendation(generation),1400);
}
// The action stays in the model; the compact labels follow the supplied activity list.
function recommendationLabel(text){
  if(text==='오늘의 목표 학습 시간 정하기')return '목표 학습 시간 조정하기';
  if(text==='리포트 확인하며 오늘의 학습 정리하기')return '오늘의 학습 기록 확인하기';
  if(text==='새로 모은 별로 하늘 꾸미기')return '완성한 별자리 확인하기';
  if(text==='오답노트 속 문제 풀기'||text.startsWith('복습하기 · '))return '틀린 문제 다시 풀기';
  if(text.startsWith('시작하기 · '))return '새로운 학습 시작하기';
  if(text.startsWith('이어하기 · '))return '오늘의 학습 이어가기';
  if(text.startsWith('결과 확인 · '))return '내 학습 현황 보기';
  if(text==='실력알기 이어하기')return '내 실력 이어서 알아보기';
  if(text==='실력알기 시작하기')return state.index===0?'첫 실력 알기 시작하기':'실력 알기 진행하기';
  if(text==='다음 진단 그룹으로 이동'||text==='다음 등급의 첫 진단 그룹으로 이동')return '다음 실력 알아보기';
  if(text==='이전 학습을 완료하면 다음 학습이 열려요')return '오늘의 학습 이어가기';
  if(text==='마지막 진단 그룹까지 완료했어요'||text==='이번 등급 학습 완료')return '내 학습 현황 보기';
  if(text==='맞춤 프로그램을 준비하고 있어요')return '활동을 고르고 있어요';
  return text;
}
function setRecommendationText(text){const label=recommendationLabel(text);$('#recommend-copy').textContent=label;$('#recommend').setAttribute('aria-label','AI 추천 · '+label);}
function syncRecommendation(action){
  const button=$('#recommend'),signature=JSON.stringify([state.grade,state.index,action,$('#recommend-copy').textContent,button.disabled]);
  if(signature!==recommendationSignature){
    clearRecommendationReminder();recommendationSignature=signature;recommendationDisabled=button.disabled;recommendationPending=true;recommendationGeneration++;
    $('.recommend').setAttribute('data-recommend-state','loading');$('.recommend').setAttribute('aria-busy','true');
    $('#recommend-status').textContent='추천 활동 준비 중';
    scheduleRecommendation();
  }
  // Unrelated re-renders must neither restart preparation nor re-enable a hidden action.
  button.disabled=recommendationPending||recommendationDisabled;scheduleRecommendationReminder();
}
document.addEventListener('visibilitychange',scheduleRecommendation);
matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',scheduleRecommendation);
function clearRecommendationReminder(){clearTimeout(recommendationReminderTimer);recommendationReminderTimer=null;recommendationReminderToken++;}
function scheduleRecommendationReminder(){
  if(!mainGuidanceVisible()||recommendationPending||recommendationDisabled||recommendationPointerPaused||recommendationFocusPaused){clearRecommendationReminder();return;}
  if(recommendationReminderTimer)return;const token=++recommendationReminderToken,signature=recommendationSignature;
  recommendationReminderTimer=setTimeout(()=>{
    if(token!==recommendationReminderToken||signature!==recommendationSignature)return;recommendationReminderTimer=null;
    if(!mainGuidanceVisible()||recommendationPending||recommendationDisabled||recommendationPointerPaused||recommendationFocusPaused)return;
    recommendationPending=true;recommendationGeneration++;$('#recommend').disabled=true;
    $('.recommend').setAttribute('data-recommend-state','loading');$('.recommend').setAttribute('aria-busy','true');
    $('#recommend-status').textContent='추천 활동을 다시 살펴보고 있어요';scheduleRecommendation();
  },24000);
}
function syncGuidanceReminders(){if(!mainGuidanceVisible())suspendMentor();else if(mentorNeedsResume)animateMessage(true);scheduleMentorReminder();scheduleRecommendationReminder();syncDiagnosisResultHint();syncMainResumeScroll();observeDiagnosisWelcomeVisit();}
$('.recommend').addEventListener('pointerenter',()=>{recommendationPointerPaused=true;scheduleRecommendationReminder();});
$('.recommend').addEventListener('pointerleave',()=>{recommendationPointerPaused=false;scheduleRecommendationReminder();});
$('.recommend').addEventListener('focusin',()=>{recommendationFocusPaused=true;scheduleRecommendationReminder();});
$('.recommend').addEventListener('focusout',e=>{if($('.recommend').contains?.(e.relatedTarget))return;recommendationFocusPaused=false;scheduleRecommendationReminder();});
// User-supplied SVG geometry is unchanged; only paint roles are themed.
const STATUS_ICONS={"locked":"<svg aria-hidden=\"true\" focusable=\"false\" width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<rect width=\"64\" height=\"64\" rx=\"20\" fill=\"var(--status-lock-surface)\"/>\n<path d=\"M20.666 49.8957C19.5008 49.8957 18.5035 49.4809 17.674 48.6514C16.8445 47.8218 16.4297 46.8245 16.4297 45.6594V26.9115C16.4297 25.7341 16.8445 24.7262 17.674 23.888C18.5035 23.0494 19.5008 22.6302 20.666 22.6302H22.9193V19.2952C22.9193 16.7357 23.7962 14.5636 25.5499 12.779C27.3033 10.994 29.444 10.1016 31.9719 10.1016C34.4996 10.1016 36.6422 10.994 38.3998 12.779C40.1574 14.5636 41.0362 16.7357 41.0362 19.2952V22.6302H43.2896C44.467 22.6302 45.4749 23.0494 46.3131 23.888C47.1517 24.7262 47.5709 25.7341 47.5709 26.9115V45.6594C47.5709 46.8245 47.1517 47.8218 46.3131 48.6514C45.4749 49.4809 44.467 49.8957 43.2896 49.8957H20.666ZM34.4339 38.7628C35.1099 38.1009 35.4479 37.3052 35.4479 36.3756C35.4479 35.4742 35.1074 34.6555 34.4263 33.9194C33.7452 33.1833 32.9264 32.8153 31.9701 32.8153C31.0138 32.8153 30.1976 33.1833 29.5216 33.9194C28.8456 34.6555 28.5076 35.4818 28.5076 36.3981C28.5076 37.3145 28.8482 38.1032 29.5293 38.7641C30.2104 39.4251 31.0291 39.7556 31.9854 39.7556C32.9418 39.7556 33.7579 39.4247 34.4339 38.7628ZM27.1556 22.6302H36.7999V19.3056C36.7999 17.9016 36.3395 16.7302 35.4186 15.7913C34.4981 14.8524 33.3564 14.3829 31.9936 14.3829C30.631 14.3829 29.4841 14.8524 28.5527 15.7913C27.6213 16.7302 27.1556 17.9016 27.1556 19.3056V22.6302Z\" fill=\"var(--status-lock-fill)\"/>\n</svg>","passed":"<svg aria-hidden=\"true\" focusable=\"false\" width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<circle cx=\"31.9997\" cy=\"32.0007\" r=\"28.6609\" fill=\"var(--status-pass-fill)\"/>\n<path d=\"M19.7002 32.1913L27.4019 39.8934C28.6518 41.1435 30.6959 41.0847 31.8719 39.7648L45.027 25.0005\" stroke=\"var(--status-pass-mark)\" stroke-width=\"6.51383\" stroke-linecap=\"round\"/>\n</svg>","failed":"<svg aria-hidden=\"true\" focusable=\"false\" width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<circle cx=\"31.9997\" cy=\"32.0007\" r=\"28.6609\" fill=\"var(--status-review-fill)\"/>\n<path d=\"M32 17.9141V32.9141\" stroke=\"var(--status-review-mark)\" stroke-width=\"6.51\" stroke-linecap=\"round\"/>\n<circle cx=\"31.9995\" cy=\"44.7456\" r=\"3.97217\" fill=\"var(--status-review-mark)\"/>\n</svg>"};
function statusSVG(status){return STATUS_ICONS[status]||STATUS_ICONS.locked;}
// Unmodified SVG exports from the supplied Figma component nodes.
function figmaStatusIcon(status){const kind=['passed','failed'].includes(status)?status:'locked',size=kind==='locked'?40:44;return `<img class="figma-status-icon" src="assets/figma-v4-1/${kind}.svg" width="${size}" height="${size}" alt="">`;}
function firstCompletedCardHint(topic,program,kind=program.status==='failed'?'failed':'passed'){
  if(state.ui?.[kind+'CardHintSeen'])return false;
  const first=topic.programs.find(p=>p.status===kind&&p.progress>=100&&M.canStudy(topic,p));
  return !!first&&first.id===program.id;
}
function programCard(s,p){
  const unlocked=M.canStudy(s,p),active=M.currentProgram(s)?.id===p.id,finished=p.progress>=100,st=unlocked?p.status:'locked',progress=Math.max(0,Math.min(100,Number(p.progress)||0)),statusLabel=st==='active'&&finished?'풀이 완료':M.labels[st];
  const introduced=unlocked&&s.presentationPending&&p.id===0&&p.status==='idle';
  if(unlocked&&finished){
    const kind=p.status==='failed'?'failed':'passed',hint=firstCompletedCardHint(s,p,kind),review=p.reviewSession&&!p.reviewSession.complete?'복습 이어하기':'복습하기';
    return `<button class="card program-card is-complete ${kind==='failed'?'needs-review-card':'passed-card'}" data-action="${kind==='failed'?'failed-card':'completed-card'}" data-id="${p.id}" data-program-id="${p.id}" aria-haspopup="dialog" aria-label="${esc(p.name)} · ${statusLabel} · ${review} 또는 결과 보기" ${hint?`aria-describedby="first-${kind}-card-hint"`:''} style="--prescription-delay:${Math.min(p.id,15)*105}ms"><div class="completed-card-heading"><strong class="program-title">${esc(p.name)}</strong></div><div class="card-footer"><span class="completed-card-cue"><span class="card-state-icon ${kind==='failed'?'needs-review':'is-passed'}" aria-hidden="true">${figmaStatusIcon(kind)}</span>${hint?`<span class="completed-first-tooltip" id="first-${kind}-card-hint" role="tooltip"><span class="sr-only">카드를 눌러 복습해보세요!</span><img class="hint-art" src="assets/figma-v4-1/review-hint-body.svg" width="176" height="35" alt=""></span>`:''}</span></div></button>`;
  }
  const action=active?'이어서 하기':'시작하기',lock=`<span class="card-lock" aria-hidden="true">${figmaStatusIcon('locked')}</span>`;
  const classes=`card program-card ${introduced?'is-introduced ':''}${!unlocked?'is-locked':active?'is-current':'is-ready'}`;
  return `<button class="${classes}" data-action="program" data-id="${p.id}" style="--prescription-delay:${Math.min(p.id,15)*105}ms" ${unlocked?'':'disabled'} aria-label="${esc(p.name)} ${statusLabel}${unlocked?' · '+action:''}" ${active?'aria-current="step"':''} title="${unlocked?'':p.status==='locked'?'테스트에서 잠금으로 설정된 학습':'이전 학습을 마치면 열려요'}">${unlocked?'<img class="active-card-art" src="assets/figma-v4-1/active-card-art.svg" alt="" width="141" height="159">':''}<strong class="program-title">${esc(p.name)}</strong>${active?`<div class="card-progress"><progress max="100" value="${progress}" aria-label="${esc(p.name)} 학습 진행률" aria-valuetext="${progress}% · ${p.completedFrames||0} / ${p.frames?.length||1}문항"></progress><span class="card-percent" aria-hidden="true">${progress}%</span></div>`:''}<div class="card-footer">${unlocked?`<span class="card-start-box" aria-hidden="true">${action}</span>`:lock}</div></button>`;
}
function selectedCompletedCard(){
  if(!completedCardSelection||completedCardSelection.grade!==state.grade||completedCardSelection.index!==state.index)return null;
  const p=current().programs.find(p=>p.id===completedCardSelection.id);
  return p&&p.progress>=100&&M.canStudy(current(),p)?p:null;
}
function openCompletedCard(id){
  const p=current().programs.find(p=>p.id===id);if(!p||p.progress<100||!M.canStudy(current(),p))return;
  const hintKey=(p.status==='failed'?'failed':'passed')+'CardHintSeen',dismissHint=!state.ui?.[hintKey];
  if(dismissHint){state.ui??={};state.ui[hintKey]=true;save();}
  completedCardSelection={grade:state.grade,index:state.index,id};openActivity('completed-study');
  if(dismissHint)render();
}
function dismissCompletedCard(){
  const selection=completedCardSelection;completedCardSelection=null;activityKind=null;closeSurface('#activity');
  if(selection?.grade===state.grade&&selection.index===state.index&&!$('#learning').open)restoreProgramCardFocus(selection.id,'failed-card');
}
function chooseCompletedCard(review){
  const p=selectedCompletedCard();if(!p){dismissCompletedCard();return;}
  const id=p.id;completedCardSelection=null;activityKind=null;closeSurface('#activity');
  if(review)openCardReview(id);else openLearning('program',id);
  if(editing?.kind==='program')editing.entryAction=p.status==='failed'?'failed-card':'completed-card';
}
function restoreProgramCardFocus(id,entryAction='program'){
  const p=current().programs.find(p=>p.id===id);if(!p||!M.canStudy(current(),p))return;
  if(p.progress>=100){$('[data-action="'+(p.status==='failed'?'failed-card':'completed-card')+'"][data-id="'+id+'"]')?.focus({preventScroll:true});return;}
  $('[data-action="program"][data-id="'+id+'"]')?.focus({preventScroll:true});
}
// Pin the whole guidance area for long lists; keep keyboard targets below it.
function syncLearningHeader(topic){
  if(topic.programs.length>=8)document.body.classList.add('has-long-learning-list');
  else document.body.classList.remove('has-long-learning-list');
  measureLearningHeader();
}
function measureLearningHeader(){
  const height=Math.ceil($('.ai').getBoundingClientRect().height)+40,host=$('#learning-workspace');
  if(host.style.setProperty)host.style.setProperty('--learning-header-clearance',height+'px');
  else host.style['--learning-header-clearance']=height+'px';
}
// On a genuine overview entry, show its top before returning to unfinished work.
// Stable guidance renders never restart this run, and direct input always wins.
const MAIN_RESUME_DELAY=600;
let mainResumeScrollRun=null,mainResumeVisible=false,mainResumeTopic=null,mainResumeSpaceKey=null;
if(window.history&&'scrollRestoration' in window.history)window.history.scrollRestoration='manual';
function mainResumeOverviewVisible(){
  return document.visibilityState!=='hidden'&&!$('main').hidden&&!myOpen&&!editing&&!diagnosisOutcomeRun&&!composing&&!skyBusy&&!activityKind&&panel!=='test'&&!$('#learning').open&&!$('#help').open&&!$('#activity').open&&!$('#prescription').open;
}
function cancelMainResumeScroll(){
  const run=mainResumeScrollRun;if(!run)return;mainResumeScrollRun=null;
  clearTimeout(run.timer);clearTimeout(run.finishTimer);
  if(run.phase==='moving')window.scrollTo({top:window.scrollY||0,behavior:'instant'});
}
function mainResumeGeometry(program){
  const card=$('#programs [data-action="program"][data-id="'+program.id+'"]');
  if(!card)return null;const rect=card.getBoundingClientRect();if(rect.height<=0)return null;
  const height=window.visualViewport?.height||window.innerHeight;
  const header=document.body.classList.contains('has-long-learning-list')?Math.min(height-80,$('.ai').getBoundingClientRect().height):0;
  return {card,rect,height,header,center:(height+header)/2,documentCenter:rect.top+(window.scrollY||0)+rect.height/2};
}
function setMainResumeSpace(geometry){
  const value=Math.ceil(Math.max(100,(geometry.height-geometry.header-geometry.rect.height)/2+24))+'px';
  document.body.classList.add('has-resume-scroll-space');
  const style=$('main').style;if(style.setProperty)style.setProperty('--resume-scroll-space',value);else style['--resume-scroll-space']=value;
}
function syncMainResumeScroll(){
  const topic=current(),program=M.currentProgram(topic),topicKey=state.grade+':'+state.index,spaceKey=program?topicKey+':'+program.id:null;
  if(spaceKey!==mainResumeSpaceKey){document.body.classList.remove('has-resume-scroll-space');mainResumeSpaceKey=spaceKey;}
  const visible=mainResumeOverviewVisible();
  if(!visible){cancelMainResumeScroll();mainResumeVisible=false;return;}
  const entered=!mainResumeVisible||mainResumeTopic!==topicKey;
  mainResumeVisible=true;mainResumeTopic=topicKey;
  if(mainResumeScrollRun&&(mainResumeScrollRun.topic!==topic||mainResumeScrollRun.programId!==program?.id))cancelMainResumeScroll();
  if(!entered||!program)return;
  cancelMainResumeScroll();const geometry=mainResumeGeometry(program);
  if(!geometry||geometry.documentCenter<=geometry.center+32)return;
  setMainResumeSpace(geometry);window.scrollTo({top:0,left:0,behavior:'instant'});
  const run=mainResumeScrollRun={topic,programId:program.id,phase:'waiting',timer:null,finishTimer:null};
  run.timer=setTimeout(()=>{
    if(mainResumeScrollRun!==run)return;
    if(!mainResumeOverviewVisible()||!mainGuidanceVisible()||current()!==run.topic||M.currentProgram(current())?.id!==run.programId){cancelMainResumeScroll();return;}
    const currentGeometry=mainResumeGeometry(program);if(!currentGeometry){cancelMainResumeScroll();return;}
    setMainResumeSpace(currentGeometry);
    const target=Math.max(0,currentGeometry.documentCenter-currentGeometry.center),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    run.phase='moving';window.scrollTo({top:target,left:0,behavior:reduced?'instant':'smooth'});
    if(reduced){mainResumeScrollRun=null;return;}
    run.finishTimer=setTimeout(()=>{if(mainResumeScrollRun===run)mainResumeScrollRun=null;},1600);
  },MAIN_RESUME_DELAY);
}
for(const type of ['wheel','touchstart','pointerdown'])document.addEventListener(type,cancelMainResumeScroll,{passive:true});
document.addEventListener('keydown',event=>{if(!['Shift','Control','Alt','Meta'].includes(event.key))cancelMainResumeScroll();});
window.addEventListener?.('pagehide',()=>{cancelMainResumeScroll();mainResumeVisible=false;});
window.addEventListener?.('pageshow',event=>{if(event.persisted){mainResumeVisible=false;syncMainResumeScroll();}});
window.addEventListener?.('scrollend',()=>{const run=mainResumeScrollRun;if(run?.phase==='moving'){clearTimeout(run.finishTimer);mainResumeScrollRun=null;}});
let programCardsMarkup=null,programCardsView=null;
function renderProgramCards(topic){
  const markup=topic.programs.map(p=>programCard(topic,p)).join(''),view=state.grade+':'+state.index;
  // Keep mounted hints and keyboard focus when only surrounding guidance changes.
  if(markup!==programCardsMarkup||view!==programCardsView){
    cancelStudyLayoutAnimations();
    if(cardRevealRun)clearPrescribedCardReveal();
    $('#programs').innerHTML=markup;programCardsMarkup=markup;programCardsView=view;
  }
}
function hideDiagnosisResultHint(){
  clearTimeout(diagnosisResultHintTimer);diagnosisResultHintTimer=null;diagnosisResultHintRun=null;
  $('#diagnosis-result-hint').hidden=true;$('#diagnostic').removeAttribute('aria-describedby');
}
function dismissDiagnosisResultHint(){
  hideDiagnosisResultHint();state.ui??={testControls:false};state.ui.diagnosisResultHintSeen=true;current().diagnosisResultHintPending=false;save();
}
function syncDiagnosisResultHint(){
  const topic=current(),visible=topic.diagnosis==='done'&&topic.programs.length>0&&!composing&&!cardRevealRun&&mainGuidanceVisible();
  if(diagnosisResultHintRun){
    if(diagnosisResultHintRun.target!==topic||!visible)hideDiagnosisResultHint();
    else $('#diagnostic').setAttribute('aria-describedby','diagnosis-result-hint');
    return;
  }
  if(!visible||!topic.diagnosisResultHintPending||state.ui?.diagnosisResultHintSeen){$('#diagnosis-result-hint').hidden=true;return;}
  const run=diagnosisResultHintRun={target:topic};state.ui??={testControls:false};state.ui.diagnosisResultHintSeen=true;topic.diagnosisResultHintPending=false;
  const hint=$('#diagnosis-result-hint');hint.textContent='실력알기 결과를 확인해보세요!';hint.hidden=false;
  $('#diagnostic').setAttribute('aria-describedby','diagnosis-result-hint');save();
  diagnosisResultHintTimer=setTimeout(()=>{if(diagnosisResultHintRun===run)hideDiagnosisResultHint();},8000);
}
document.addEventListener('visibilitychange',()=>syncDiagnosisResultHint());
function syncLearningContext(topic){
  const ready=!composing&&topic.diagnosis==='done'&&topic.programs.length>0;
  $('#learning-context').hidden=!ready;
  if(ready)document.body.classList.add('has-personalized-learning');else document.body.classList.remove('has-personalized-learning');
}
// Short guidance combines the original carousel rules with the two learning benefits.
const DIAGNOSIS_WELCOME_TIPS=[
  {key:'focus',label:'집중해서<br>스스로 풀어요',title:'혼자 힘으로 집중하기',detail:'차분히 집중해서 스스로 문제를 풀어요.',icon:'<path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3"/><circle cx="12" cy="12" r="4"/>'},
  {key:'resume',label:'잠깐 나가도<br>이어서 풀어요',title:'쉬었다 이어서 풀기',detail:'중간에 나가도 이어서 할 수 있어요.',icon:'<path d="M20 7V3m0 4h-4M20 7a9 9 0 1 0 1 8"/><path d="M10 9v6m4-6v6"/>'},
  {key:'personal',label:'마치면<br>맞춤 학습을 만나요',title:'나에게 맞는 학습 만나기',detail:'실력알기를 마치면 나에게 맞는 학습을 준비해요.',icon:'<rect x="4" y="6" width="13" height="15" rx="3"/><path d="M8 11h5m-5 4h3m6-12 1.2 2.8L21 7l-2.8 1.2L17 11l-1.2-2.8L13 7l2.8-1.2L17 3Z"/>'}
];
function diagnosisWelcomeTipsHTML(expanded=false){
  return `<ul class="welcome-tips${expanded?' is-expanded':''}" aria-label="실력알기 이용 안내">${DIAGNOSIS_WELCOME_TIPS.map(tip=>`<li data-welcome-tip="${tip.key}"><span class="welcome-tip-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${tip.icon}</svg></span><span class="welcome-tip-copy">${expanded?`<strong>${tip.title}</strong><span>${tip.detail}</span>`:tip.label}</span></li>`).join('')}</ul>`;
}
// V6.1 keeps the V5.1 horizontal invitation and rotates one short tip at a time.
const WELCOME_GUIDE_HOLD=4800,WELCOME_GUIDE_FADE=240;
let diagnosisWelcomeFirstTopic=null,diagnosisSheetSignature=null,welcomeGuideRun=null;
let welcomeGuidePaused=false,welcomeGuideHover=false,welcomeGuideFocus=false,welcomeGuideSuspended=false;
function rotatingWelcomeGuideHTML(){
  const copy=['차분히 집중해서<br>스스로 문제를 풀어요','잠깐 나가도 괜찮아요<br>풀던 문제부터 이어가요','실력알기를 마치면<br>나에게 맞는 학습을 준비해요'];
  return `<div class="welcome-guide-frame" aria-live="off">${DIAGNOSIS_WELCOME_TIPS.map((tip,i)=>`<div id="welcome-guide-slide-${i}" class="welcome-guide-slide" data-welcome-tip="${tip.key}" hidden><span class="welcome-tip-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${tip.icon}</svg></span><span class="welcome-tip-copy">${copy[i]}</span></div>`).join('')}</div><div class="welcome-guide-controls" role="group" aria-label="실력알기 안내 선택">${DIAGNOSIS_WELCOME_TIPS.map((tip,i)=>`<button id="welcome-guide-dot-${i}" class="welcome-guide-dot" data-action="welcome-guide-${i}" aria-label="${tip.title}" aria-pressed="false"><span aria-hidden="true"></span></button>`).join('')}<button id="welcome-guide-pause" class="welcome-guide-pause" data-action="welcome-guide-pause" aria-label="안내 자동 넘김 일시정지" aria-pressed="false"></button></div>`;
}
function clearWelcomeGuideTimers(run=welcomeGuideRun){
  if(!run)return;run.generation++;clearTimeout(run.timer);clearTimeout(run.fadeTimer);run.timer=null;run.fadeTimer=null;run.phase='reading';
  $('#diagnosis-welcome-guide').setAttribute('data-guide-phase','reading');
}
function stopWelcomeGuide(){clearWelcomeGuideTimers();welcomeGuideRun=null;}
function welcomeGuideIsActive(){return diagnosisWelcomeFirstTopic===current()&&!$('#diagnosis-welcome').hidden&&!$('#diagnosis-welcome-guide').hidden;}
function welcomeGuideCanAdvance(){
  return welcomeGuideIsActive()&&mainResumeOverviewVisible()&&mainGuidanceVisible()&&!welcomeGuidePaused&&!welcomeGuideHover&&!welcomeGuideFocus&&!welcomeGuideSuspended&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function renderWelcomeGuideSlide(run){
  for(let i=0;i<DIAGNOSIS_WELCOME_TIPS.length;i++){
    const active=i===run.index,slide=$('#welcome-guide-slide-'+i);slide.hidden=!active;slide.setAttribute('aria-hidden',String(!active));
    $('#welcome-guide-dot-'+i).setAttribute('aria-pressed',String(active));
  }
  const pause=$('#welcome-guide-pause');pause.hidden=matchMedia('(prefers-reduced-motion: reduce)').matches;
  pause.setAttribute('aria-pressed',String(welcomeGuidePaused));pause.setAttribute('aria-label',welcomeGuidePaused?'안내 자동 넘김 재생':'안내 자동 넘김 일시정지');
  const icon=welcomeGuidePaused?'<path d="m6 4 7 4-7 4V4Z"/>':'<path d="M6 4v8m4-8v8"/>';
  const markup=`<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`;
  if(pause.innerHTML!==markup)pause.innerHTML=markup;
  $('#diagnosis-welcome-guide').setAttribute('data-guide-index',run.index);
}
function syncWelcomeGuideClock(){
  if(!welcomeGuideIsActive()){stopWelcomeGuide();return;}
  if(!welcomeGuideRun||welcomeGuideRun.topic!==current()){
    stopWelcomeGuide();welcomeGuideRun={topic:current(),index:0,phase:'reading',generation:0,timer:null,fadeTimer:null};renderWelcomeGuideSlide(welcomeGuideRun);
  }
  const run=welcomeGuideRun;
  if(!welcomeGuideCanAdvance()){clearWelcomeGuideTimers(run);return;}
  if(run.timer||run.fadeTimer)return;
  const generation=run.generation;
  run.timer=setTimeout(()=>{
    if(welcomeGuideRun!==run||run.generation!==generation)return;run.timer=null;
    if(!welcomeGuideCanAdvance()){clearWelcomeGuideTimers(run);return;}
    run.phase='leaving';$('#diagnosis-welcome-guide').setAttribute('data-guide-phase','leaving');
    run.fadeTimer=setTimeout(()=>{
      if(welcomeGuideRun!==run||run.generation!==generation)return;run.fadeTimer=null;
      if(!welcomeGuideCanAdvance()){clearWelcomeGuideTimers(run);return;}
      run.index=(run.index+1)%DIAGNOSIS_WELCOME_TIPS.length;run.phase='reading';
      $('#diagnosis-welcome-guide').setAttribute('data-guide-phase','reading');renderWelcomeGuideSlide(run);syncWelcomeGuideClock();
    },WELCOME_GUIDE_FADE);
  },WELCOME_GUIDE_HOLD);
}
function chooseWelcomeGuide(index){
  if(!welcomeGuideIsActive()||!Number.isInteger(index)||index<0||index>=DIAGNOSIS_WELCOME_TIPS.length)return;
  syncWelcomeGuideClock();const run=welcomeGuideRun;if(!run)return;
  clearWelcomeGuideTimers(run);run.index=index;renderWelcomeGuideSlide(run);syncWelcomeGuideClock();
}
function isDiagnosisWelcomeTopic(topic){return !composing&&!topic.diagnosisOutcome&&topic.programs.length===0&&['idle','active'].includes(topic.diagnosis);}
function observeDiagnosisWelcomeVisit(){
  const visible=mainResumeOverviewVisible();
  // A hidden browser tab or settings dim pauses the tip, without consuming this visit.
  const leftOverview=$('main').hidden||myOpen||editing||diagnosisOutcomeRun||composing||skyBusy||activityKind||$('#learning').open||$('#help').open||$('#activity').open||$('#prescription').open;
  if(diagnosisWelcomeFirstTopic&&(leftOverview||current()!==diagnosisWelcomeFirstTopic))diagnosisWelcomeFirstTopic=null;
  $('#diagnosis-welcome').setAttribute('data-welcome-motion',visible?'running':'paused');
  syncWelcomeGuideClock();
}
function diagnosisWelcomeProgress(topic){
  const answers=topic.diagnosticSession?.answers||[],total=DEMO.length;
  const solved=topic.diagnosis==='active'?DEMO.reduce((n,question,i)=>n+(Number.isInteger(answers[i])&&answers[i]>=0&&answers[i]<question.choices.length?1:0),0):0;
  return {total,solved,percent:Math.round(solved/total*100)};
}
function syncDiagnosisWelcome(topic){
  observeDiagnosisWelcomeVisit();
  const visible=isDiagnosisWelcomeTopic(topic),host=$('#diagnosis-welcome'),button=$('#diagnostic');
  host.hidden=!visible;$('#diagnosis-slot').hidden=visible;
  if(!visible){button.classList.remove('diagnostic-start-button');if(button.getAttribute('aria-describedby')==='diagnosis-welcome-guide')button.removeAttribute('aria-describedby');return;}
  const active=topic.diagnosis==='active',label=active?'실력알기 이어하기':'실력알기 시작하기';
  if(!active&&mainResumeOverviewVisible()&&!state.ui?.diagnosisWelcomeSeen){
    diagnosisWelcomeFirstTopic=topic;state.ui??={testControls:false};state.ui.diagnosisWelcomeSeen=true;save();
  }
  const first=!active&&diagnosisWelcomeFirstTopic===topic;
  host.setAttribute('data-welcome-first',String(first));host.setAttribute('data-diagnosis-state',topic.diagnosis);
  const guide=$('#diagnosis-welcome-guide');guide.hidden=!first;if(first&&!guide.innerHTML)guide.innerHTML=rotatingWelcomeGuideHTML();$('#welcome-dismiss').hidden=!first;
  $('#diagnosis-welcome-title').textContent=first?'실력알기로 시작해볼까요?':active?'풀던 문제부터 이어가요':'나의 실력을 알아볼까요?';
  const progress=diagnosisWelcomeProgress(topic),sheet=$('#diagnosis-welcome-progress');sheet.hidden=false;
  sheet.setAttribute('aria-valuenow',progress.percent);sheet.setAttribute('aria-valuetext',`${progress.total}문항 중 ${progress.solved}문항 풀이 완료 · ${progress.percent}%`);
  const signature=state.grade+':'+state.index+':'+JSON.stringify([progress,topic.diagnosticSession?.answers]);
  if(signature!==diagnosisSheetSignature){
    diagnosisSheetSignature=signature;
    $('#diagnosis-sheet-percent').innerHTML=`${progress.percent}<span>%</span>`;
    $('#diagnosis-sheet-count').textContent=`${progress.solved} / ${progress.total}문항`;
    const answers=active?topic.diagnosticSession?.answers||[]:[],solved=i=>Number.isInteger(answers[i])&&answers[i]>=0&&answers[i]<DEMO[i].choices.length,next=DEMO.findIndex((question,i)=>!solved(i));
    $('#diagnosis-sheet-items').innerHTML=DEMO.map((question,i)=>`<span class="sheet-row ${solved(i)?'is-solved':i===next?'is-next':''}"><i class="sheet-answer">${solved(i)?'✓':i+1}</i><i class="sheet-rule"></i></span>`).join('');
  }
  button.classList.add('diagnostic-start-button');button.setAttribute('aria-label',label);
  if(first)button.setAttribute('aria-describedby','diagnosis-welcome-guide');else button.removeAttribute('aria-describedby');
  const markup=`<span>${label}</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>`;
  if(button.innerHTML!==markup)button.innerHTML=markup;
  if(!$('#diagnosis-welcome-action').contains(button))$('#diagnosis-welcome-action').append(button);
  syncWelcomeGuideClock();
}
function diagnosisWelcomeAction(action){
  if(/^welcome-guide-[0-2]$/.test(action)){chooseWelcomeGuide(Number(action.at(-1)));return true;}
  if(action==='welcome-guide-pause'){
    if(welcomeGuideIsActive()){welcomeGuidePaused=!welcomeGuidePaused;syncWelcomeGuideClock();if(welcomeGuideRun)renderWelcomeGuideSlide(welcomeGuideRun);}
    return true;
  }
  if(action==='welcome-preview-first'||action==='welcome-preview-compact'||action==='welcome-preview-progress'){
    loadValidationScenario(action==='welcome-preview-progress'?1:0);
    if(action!=='welcome-preview-first'){diagnosisWelcomeFirstTopic=null;state.ui.diagnosisWelcomeSeen=true;save();syncDiagnosisWelcome(current());}
    return true;
  }
  if(action==='welcome-help-start'){
    if(activityKind!=='diagnosis-guide')return true;
    activityKind=null;closeSurface('#activity');openLearning('diagnosis');return true;
  }
  if(!['welcome-help','welcome-dismiss-guide'].includes(action))return false;
  if(!isDiagnosisWelcomeTopic(current()))return true;
  diagnosisWelcomeFirstTopic=null;state.ui??={};state.ui.diagnosisWelcomeSeen=true;save();
  if(action==='welcome-help'){openActivity('diagnosis-guide');observeDiagnosisWelcomeVisit();}
  else{syncDiagnosisWelcome(current());softReveal($('#diagnosis-welcome'));$('#diagnostic').focus({preventScroll:true});}
  return true;
}
function render(){observeSpeech();if(cardRevealRun&&cardRevealRun.target!==current())clearPrescribedCardReveal();daily();const s=current();syncLearningHeader(s);syncLearningContext(s);if(!isDiagnosisWelcomeTopic(s))$('#diagnosis-slot').append($('#diagnostic'));$('#diagnostic').classList.remove('grid-diagnostic','card','clean-passed','diagnostic-summary-trigger');$('#diagnostic').setAttribute('aria-label','실력알기');$('#diagnostic-result-slot').hidden=true;$('#diagnosis-section').hidden=false;$('#grade-badge').innerHTML=`<strong>${grade(state.grade)}</strong><span>등급</span><span class="grade-topic-number">${String(state.index+1).padStart(2,'0')}</span>`;$('#group-title').textContent=groupName(state.index);if(!isDiagnosisWelcomeTopic(s))$('#diagnostic').innerHTML=`<div><strong>실력알기</strong>${s.diagnosis==='done'?`<small>${s.programs.length?'처방 프로그램 '+s.programs.length+'개':'부족한 학습 목표 0개'}</small>`:''}</div>${badge(s.diagnosis==='done'?(s.programs.length?'passed':'clean'):s.diagnosis)}`;renderProgramCards(s);const rec=M.recommend(state);setRecommendationText(rec.text);$('#recommend').disabled=!!composing||['done','locked'].includes(rec.kind);
if(isCleanPass(s)&&!composing){const pass=cleanPassInfo();$('#diagnostic').classList.add('clean-passed');$('#diagnostic').innerHTML=`<div><strong>진단 통과</strong><small>추가 학습 없이 통과했어요 · 결과 보기</small></div><span class="badge clean">✓ 통과</span>`;setRecommendationText(pass.next?cleanPassPrepareLabel(pass):'이번 등급 학습 완료');$('#recommend').disabled=!pass.next;}
if(composing){setRecommendationText('맞춤 프로그램을 준비하고 있어요');$('#diagnostic').innerHTML='<div><strong>실력알기</strong><small>진단 결과에 맞춰 필요한 학습을 구성하고 있습니다.</small></div><span class="badge active">진단 완료 · 구성 중</span>';$('#diagnostic').disabled=true;$('#programs').hidden=true;$('#composition').hidden=false;renderComposition();}
else{$('#diagnostic').disabled=false;$('#composition').hidden=!diagnosisOutcomeRun||!isDiagnosisPreparation(s.diagnosisOutcome?.stage);$('#programs').hidden=s.programs.length===0;
if(s.diagnosis==='done'&&s.programs.length){const d=$('#diagnostic');d.classList.add('diagnostic-summary-trigger');d.setAttribute('aria-label',groupName(state.index)+' · 실력알기 결과 확인');
d.innerHTML=`<span class="result-icon" aria-hidden="true"><img src="assets/figma-v4-1/result-report.svg" width="14" height="18" alt=""></span><span class="result-copy"><strong>실력알기 결과 확인</strong></span>`;
$('#diagnostic-result-slot').hidden=false;$('#diagnostic-result-slot').append(d);$('#diagnosis-section').hidden=true;
if(reveal)revealPrescribedCards();reveal=false;
}}
syncDiagnosisWelcome(s);
const pieces=skyState().items.reduce((n,x)=>n+x.pieces,0);$('.constellation-trigger').setAttribute('aria-label','나의 별자리 · 별 조각 '+pieces+'개');syncRecommendation(isCleanPass(s)&&!composing?cleanPassInfo().next:rec.kind==='today'?M.learningRecommend(state):rec);animateMessage();renderPanel();if(myOpen)renderMy();syncGuidanceReminders();const viewKey=state.grade+':'+state.index;if(overviewViewKey!==null&&overviewViewKey!==viewKey&&!myOpen){softReveal($('.heading'));if(!$('#programs').hidden)softReveal($('#programs'));}overviewViewKey=viewKey;}
const COURSE_REVEAL={wait:440,stagger:105,card:680,limit:15,invite:760};
let cardRevealRun=null;
function clearPrescribedCardReveal(){
  clearTimeout(cardRevealTimer);cardRevealTimer=null;cardRevealGeneration++;
  const previous=cardRevealRun;cardRevealRun=null;
  // Remove the animation class before releasing individual cards, so they never replay.
  $('#programs').classList.remove('reveal');$('#programs').setAttribute('aria-busy','false');
  $('#programs').removeAttribute('data-course-paused');$('#learning-context').removeAttribute('data-course-paused');$('#learning-context').classList.remove('is-course-revealing');
  for(const card of previous?.cards||[]){card.inert=false;card.style.animation='';}
}
function scheduleCourseRevealEnd(run){
  clearTimeout(cardRevealTimer);cardRevealTimer=null;const token=++run.endToken;
  if(run.paused)return;run.started=Date.now();
  cardRevealTimer=setTimeout(()=>{if(cardRevealRun===run&&run.endToken===token&&!run.paused){clearPrescribedCardReveal();syncDiagnosisResultHint();}},run.remaining);
}
function revealPrescribedCards(){
  clearPrescribedCardReveal();if(matchMedia('(prefers-reduced-motion: reduce)').matches||!current().programs.length)return;
  const host=$('#programs'),last=Math.min(current().programs.length-1,COURSE_REVEAL.limit),inviteAt=COURSE_REVEAL.wait+last*COURSE_REVEAL.stagger+COURSE_REVEAL.card+80;
  const run=cardRevealRun={target:current(),generation:cardRevealGeneration,cards:Array.from(host.querySelectorAll('.program-card')),paused:document.visibilityState==='hidden',endToken:0,remaining:inviteAt+COURSE_REVEAL.invite+80,started:Date.now(),inviteAt};
  for(const card of run.cards)card.inert=true;
  for(const element of [host,$('#learning-context')]){
    const values={'--course-reveal-wait':COURSE_REVEAL.wait+'ms','--course-invite-delay':inviteAt+'ms'};
    for(const [name,value] of Object.entries(values)){if(element.style.setProperty)element.style.setProperty(name,value);else element.style[name]=value;}
  }
  host.setAttribute('aria-busy','true');host.setAttribute('data-course-paused',String(run.paused));$('#learning-context').setAttribute('data-course-paused',String(run.paused));
  void host.offsetWidth;host.classList.add('reveal');$('#learning-context').classList.add('is-course-revealing');scheduleCourseRevealEnd(run);
}
$('#programs').addEventListener('animationend',event=>{
  const run=cardRevealRun,card=event.target;if(!run||event.animationName!=='prescription-card-arrive'||!run.cards.includes(card))return;
  card.inert=false;card.style.animation='none';
  if(card===run.cards[0]&&(document.activeElement===document.body||document.activeElement===$('#diagnostic')))card.focus({preventScroll:true});
});
document.addEventListener('visibilitychange',()=>{
  const run=cardRevealRun;if(!run)return;const paused=document.visibilityState==='hidden';if(paused===run.paused)return;
  if(paused)run.remaining=Math.max(0,run.remaining-(Date.now()-run.started));
  run.paused=paused;$('#programs').setAttribute('data-course-paused',String(paused));$('#learning-context').setAttribute('data-course-paused',String(paused));scheduleCourseRevealEnd(run);
});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',event=>{if(event.matches){clearPrescribedCardReveal();syncDiagnosisResultHint();}});
function cancelComposition(){
  const previous=composing;composeTimers.forEach(clearTimeout);composeTimers=[];composing=null;clearPrescribedCardReveal();
  if(previous?.surface==='learning'){
    // Return the persistent graphic before closing its host; later diagnoses reuse it.
    compositionElement.hidden=true;$('#prescription').append(compositionElement);editing=null;closeSurface('#learning');
  }
  if($('#prescription').open)closeSurface('#prescription');
}
function renderComposition(c=composing){
  if(!c)return;const container=compositionElement;
  // Keep the graphic mounted while the copy types; replacing it would restart the scan every character.
  if(!c.mounted){
    container.innerHTML=`<div class="prescription-graphics" aria-hidden="true"><div class="prescription-complete"><svg viewBox="0 0 220 132" fill="none"><circle class="complete-glow" cx="110" cy="65" r="51"/><g class="complete-sheet"><rect class="complete-paper" x="78" y="24" width="64" height="84" rx="14"/><path class="complete-lines" d="M93 43h22M93 51h34"/><path class="complete-check" pathLength="1" d="m92 75 12 12 25-28"/></g><path class="complete-spark spark-one" d="m53 42 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/><path class="complete-spark spark-two" d="m167 78 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/></svg></div><div class="prescription-search"><svg viewBox="0 0 220 132" fill="none"><g class="search-guides" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 11"><path d="M22 32H198M22 66H198M22 100H198"/></g><g class="search-lens"><path class="lens-handle" d="m117 72 26 26"/><circle class="lens-glass" cx="96" cy="50" r="28"/><path class="lens-shine" d="M80 43a18 18 0 0 1 12-10"/></g></svg></div><div class="prescription-ready"><svg viewBox="0 0 220 132" fill="none"><circle class="ready-glow" cx="110" cy="65" r="51"/><g class="ready-stack"><rect class="ready-back" x="60" y="31" width="57" height="76" rx="12" transform="rotate(-8 88 69)"/><rect class="ready-back" x="119" y="30" width="48" height="73" rx="12" transform="rotate(10 143 66)"/><rect class="ready-front" x="82" y="23" width="65" height="87" rx="13"/><path class="ready-book" d="M114 43c-5-3-11-3-17-1v18c6-2 12-2 17 1 5-3 11-3 17-1V42c-6-2-12-2-17 1Zm0 0v18"/><path class="ready-lines" d="M98 76h29M98 84h20"/></g><g class="ready-play"><circle cx="150" cy="96" r="21"/><path d="m145 88 12 8-12 8Z"/></g></svg></div></div><p id="composition-topic-context" class="composition-topic-context"></p><h2 id="composition-title" tabindex="-1"></h2><p><span id="composition-copy"></span><span id="composition-caret" class="prescription-caret" hidden aria-hidden="true"></span></p><div id="diagnosis-inline-summary" class="diagnosis-inline-summary" hidden></div>`;
    c.mounted=true;
  }
  container.setAttribute('data-compose-step',String(c.step));container.setAttribute('data-compose-paused',document.visibilityState==='hidden'?'true':'false');
  $('#composition-topic-context').textContent=c.context||c.topicName+' · '+(c.step===0?'실력 알기 완료':c.step===1?'실력알기 결과로 준비 중':'더 연습할 학습 '+c.count+'개');
  $('#composition-title').textContent=c.step===0?'수고했어요!':c.step===1?'맞춤 학습을 찾고 있어요':c.name+'님을 위한 학습이 준비됐어요';
  $('#composition-copy').textContent=c.step===0?(c.summaryMessage||'실력알기를 마쳤어요.'):c.step===1?'더 익힐 내용을 모으고 있어요.':c.text||'';
  $('#composition-caret').hidden=c.step!==2;
}
document.addEventListener('visibilitychange',()=>{$('#composition').setAttribute('data-compose-paused',document.visibilityState==='hidden'?'true':'false');});
function beginComposition(n,mode,surface){
  const inline=surface==='learning'||$('#learning').open&&editing?.kind==='diagnosis'&&!editing.preparing;
  daily().cleanStreak=0;daily().timerRunning=false;cancelComposition();const target=current();state.ui??={testControls:false};
  const first=mode==='first'||(mode!=='repeat'&&!state.ui.prescriptionSeen),searchAt=first?2400:2000,readyAt=first?5200:4400,total=first?8000:7000;
  if(panel)closePanel();
  const run=composing={count:n,topicName:groupName(state.index),step:0,text:'',target,surface:inline?'learning':'prescription',name:state.profile?.name||'재능',first,searchAt,readyAt,total,message:'여기부터 시작해 볼까요?'};
  const valid=()=>composing===run&&current()===target;
  if(inline){
    // Keep the existing full-screen diagnosis open; the overview is never exposed between steps.
    editing={kind:'diagnosis',preparing:true};refreshDialog();$('#diagnosis-composition-slot').append(compositionElement);
  }else{editing=null;closeSurface('#learning');}
  render();if(!inline)$('#prescription').showModal();else{if(!$('#learning').open)$('#learning').showModal();$('#composition-title')?.focus({preventScroll:true});}
  composeTimers.push(setTimeout(()=>{if(valid()){run.step=1;renderComposition();}},searchAt));
  composeTimers.push(setTimeout(()=>{if(valid()){run.step=2;renderComposition();}},readyAt));
  for(let i=1;i<=run.message.length;i++)composeTimers.push(setTimeout(()=>{if(valid()&&!run.fastForward){run.text=run.message.slice(0,i);renderComposition();}},readyAt+i*45));
  composeTimers.push(setTimeout(()=>{
    if(!valid())return;target.diagnosis='done';target.programs=M.programs(n,state.grade,state.index);target.reviewHistory=false;target.diagnosticSession=null;target.presentationPending=true;target.diagnosisResultHintPending=!state.ui.diagnosisResultHintSeen;state.ui.prescriptionSeen=true;
    cancelComposition();reveal=true;notify('진단 완료 · 맞춤 프로그램 '+n+'개 구성 완료');
    const card=document.querySelector('#programs [data-action="program"]');if(!cardRevealRun)card?.focus();card?.scrollIntoView?.({block:'nearest',behavior:'auto'});
  },total));
}

// Diagnosis completion is one resumable run. Its native dialog stays open until
// the reward ends, including the transparent course-generation stage.
const DIAGNOSIS_OUTCOME_TIMING={searching:3000,ready:3000,reward:3600,collecting:1800};
const DIAGNOSIS_OUTCOME_STAGES=['summary','searching','ready','generating','reward','collecting'];
function isDiagnosisPreparation(stage){return ['summary','searching','ready'].includes(stage);}
function programOutcome(flow=current().diagnosisOutcome){return flow?.kind==='program';}
function outcomeResult(target=current()){return programOutcome(target.diagnosisOutcome)?target.diagnosisOutcome.result:target.diagnosticResult;}
function programStudyActive(p){return editing?.kind==='program'&&!editing.intro&&!editing.resultOnly&&(editing.reviewing?!p.reviewSession?.complete:p.status==='active'&&p.progress<100);}
function syncProgramStudyClock(p,review,running){
  const mode=review?'review':'normal';p.studyTiming??={};const clock=p.studyTiming[mode]??={elapsedMs:0,runningSince:null};
  const now=Date.now();if(clock.runningSince!==null)clock.elapsedMs+=Math.max(0,now-clock.runningSince);
  clock.runningSince=running?now:null;return Math.max(1,Math.round(clock.elapsedMs/1000));
}
function programResult(p,review=false){
  const source=review?p.reviewSession:p.initialResult||p,total=p.frames?.length||1;
  const wrong=Math.min(total,(source?.wrongFrames||[]).length||(source?.status==='failed'?1:0));
  return {questionCount:total,incorrect:wrong,status:review?source.result?.status||'failed':source.status,seconds:review?source.result?.seconds||0:p.completionResult?.seconds||Math.round((p.studyTiming?.normal?.elapsedMs||0)/1000),review};
}
function programSummaryMetricsHTML(result){
  const stats=diagnosisSummary(result),percent=stats.total?Math.round(stats.correct/stats.total*100):0;
  return `<div class="diagnosis-outcome-metrics program-outcome-metrics"><div class="diagnosis-outcome-metric"><span>달성률</span><div class="outcome-ring" style="--result-ratio:${stats.total?stats.correct/stats.total:0}" role="img" aria-label="달성률 ${percent}%, 정답 ${stats.correct}개, 오답 ${stats.wrong}개"><strong>${percent}<small>%</small></strong></div><small>정답 ${stats.correct}개 · 오답 ${stats.wrong}개</small></div><div class="diagnosis-outcome-metric outcome-time"><span>학습 시간</span><strong>${Math.floor(stats.seconds/60)}<small>분</small> ${String(stats.seconds%60).padStart(2,'0')}<small>초</small></strong></div></div>`;
}
function beginProgramOutcome(p,review=false,preview=false){
  recordProgram();const seconds=syncProgramStudyClock(p,review,false),result=programResult(p,review);
  result.seconds=seconds;if(review)p.reviewSession.result.seconds=seconds;else p.completionResult={...result};
  cancelComposition();cancelDiagnosisOutcome(true);state.ui??={testControls:false};
  state.programAttemptSequence=(Number(state.programAttemptSequence)||0)+1;
  const attemptId='program:'+current().groupId+':'+p.programId+':'+Date.now()+':'+state.programAttemptSequence;
  current().diagnosisOutcome={kind:'program',programId:p.id,attemptId,stage:'summary',result,review,preview};
  current().recent=(review?'복습':'학습')+' 완료 · '+p.name;
  resumeDiagnosisOutcome();
}
function finishProgramOutcome(run){
  const flow=run.target.diagnosisOutcome,id=flow.programId;
  delete run.target.diagnosisOutcome;cancelDiagnosisOutcome();editing=null;closeSurface('#learning');
  save();render();restoreProgramCardFocus(id);
}
document.addEventListener('visibilitychange',()=>{
  if(editing?.kind!=='program'||editing.intro||editing.resultOnly)return;
  const p=current().programs.find(p=>p.id===editing.id);if(!p)return;
  syncProgramStudyClock(p,!!editing.reviewing,document.visibilityState!=='hidden'&&daily().timerRunning&&programStudyActive(p));save();
});
window.addEventListener?.('pagehide',()=>{
  if(editing?.kind!=='program'||editing.intro||editing.resultOnly)return;
  const p=current().programs.find(p=>p.id===editing.id);if(p){syncProgramStudyClock(p,!!editing.reviewing,false);save();}
});
window.addEventListener?.('pageshow',()=>{
  if(editing?.kind!=='program'||editing.intro||editing.resultOnly)return;
  const p=current().programs.find(p=>p.id===editing.id);if(p)syncProgramStudyClock(p,!!editing.reviewing,daily().timerRunning&&programStudyActive(p));
});
function diagnosisPreparationHTML(){
  return `<div class="diagnosis-screen-top"><span>${programOutcome()?(current().diagnosisOutcome.review?'복습 완료':'학습 완료'):'실력알기 완료'}</span><strong class="diagnosis-context"><span class="diagnosis-grade">${grade(state.grade)}등급</span><span>${esc(current().groupName)}</span></strong><span>${programOutcome()?'학습 결과':'맞춤 학습 준비'}</span></div><div class="diagnosis-screen-body diagnosis-preparation" id="diagnosis-composition-slot"></div>`;
}
function mountDiagnosisPreparation(){
  const run=diagnosisOutcomeRun,stage=run?.target.diagnosisOutcome?.stage;
  if(!run||!isDiagnosisPreparation(stage))return;
  // Reuse the original graphic and its mounted SVGs. Only their step changes,
  // so the check → scanning lens → ready cards can crossfade in one full screen.
  const preparation=run.preparation??={topicName:programOutcome()?run.target.programs.find(p=>p.id===run.target.diagnosisOutcome.programId)?.name||run.target.groupName:run.target.groupName,count:run.target.diagnosisOutcome.count,name:state.profile?.name||'재능',text:'여기부터 시작해 볼까요?'};
  preparation.step=stage==='summary'?0:stage==='searching'?1:2;
  preparation.summaryMessage=programOutcome()?(outcomeResult().status==='passed'?'학습을 통과했어요!':'끝까지 풀어냈어요. 다시 연습할 문항을 확인해요.'):diagnosisSummary(outcomeResult()).deficits?'실력알기를 마쳤어요.':'실력알기를 통과했어요!';
  if(programOutcome())preparation.context=preparation.topicName+' · '+(run.target.diagnosisOutcome.review?'복습 결과':'학습 결과');
  const slot=$('#diagnosis-composition-slot');
  if(!slot.contains(compositionElement))slot.append(compositionElement);
  compositionElement.hidden=false;renderComposition(preparation);
  const summary=$('#diagnosis-inline-summary');summary.hidden=stage!=='summary';
  const result=outcomeResult(),decoration=programOutcome()?completionConfettiHTML(true):'';
  const html=decoration+(programOutcome()?`<span class="badge ${result.status}">${result.status==='passed'?'통과':'미통과'}</span>`+programSummaryMetricsHTML(result):diagnosisSummaryMetricsHTML(result))+'<button class="primary outcome-confirm" data-action="diagnosis-outcome-confirm">확인</button>';
  if(summary.innerHTML!==html)summary.innerHTML=html;
}
function releaseDiagnosisPreparation(run){
  if(!run?.preparation)return;
  compositionElement.hidden=true;$('#prescription').append(compositionElement);run.preparation=null;
}
function diagnosisSummary(result){
  const total=Math.max(0,Number(result.questionCount)||0),wrong=Math.min(total,Math.max(0,Number(result.incorrect)||0));
  const goals=result.goals||[],goalCount=goals.length;
  const deficits=goals.length?goals.filter(g=>g.questions?.some(q=>q.chosen!==q.correct)).length:Math.max(0,Number(result.deficits)||0);
  return {total,wrong,correct:total-wrong,deficits,goalCount,seconds:Math.max(0,Math.round(Number(result.seconds)||0))};
}
function diagnosisMetric(label,value,total,detail){
  const ratio=total?Math.max(0,Math.min(1,value/total)):0;
  return `<div class="diagnosis-outcome-metric"><span>${label}</span><div class="outcome-ring" style="--result-ratio:${ratio}" role="img" aria-label="${esc(detail)}"><strong>${value}<small> / ${total}</small></strong></div><small>${detail}</small></div>`;
}
function diagnosisSummaryMetricsHTML(result){
  const stats=diagnosisSummary(result);
  return `<div class="diagnosis-outcome-metrics">${diagnosisMetric('맞힌 문제',stats.correct,stats.total,`정답 ${stats.correct}개 · 오답 ${stats.wrong}개`)}${diagnosisMetric('더 익힐 목표',stats.deficits,stats.goalCount,`전체 ${stats.goalCount}개 중 ${stats.deficits}개`)}<div class="diagnosis-outcome-metric outcome-time"><span>학습 시간</span><strong>${Math.floor(stats.seconds/60)}<small>분</small> ${String(stats.seconds%60).padStart(2,'0')}<small>초</small></strong></div></div>`;
}
function diagnosisFragmentHTML(){
  return '<svg viewBox="0 0 128 128" fill="none" aria-hidden="true"><path d="m64 9 15 35 35 20-35 20-15 35-15-35L14 64l35-20Z" class="fragment-base"/><path d="m64 9 0 55-50 0 35-20Z" class="fragment-light"/><path d="m64 64 50 0-35 20-15 35Z" class="fragment-shade"/><path d="m64 9 15 35 35 20-35 20-15 35-15-35L14 64l35-20Z" class="fragment-outline"/></svg>';
}
function diagnosisOutcomeHTML(){
  const run=diagnosisOutcomeRun,s=current(),flow=s.diagnosisOutcome,result=outcomeResult(s),stats=diagnosisSummary(result),stage=flow.stage;
  const background=!stats.deficits&&stage==='reward'?`<div class="diagnosis-outcome-background" inert aria-hidden="true">${run.background||`<div class="diagnosis-screen-top"><span>${programOutcome()?'학습 완료':'실력알기'}</span><strong>${esc(s.groupName)}</strong></div>`}</div>`:'';
  if(isDiagnosisPreparation(stage))return diagnosisPreparationHTML();
  if(stage==='generating')return '<section class="outcome-generating-label" role="status" aria-live="polite"><span class="outcome-spinner" aria-hidden="true"></span>나에게 필요한 학습이 펼쳐지고 있어요</section>';
  if(stage==='collecting')return diagnosisCollectionHTML(stats.correct);
  return `${background}<section class="diagnosis-outcome-scrim outcome-reward outcome-arrival" aria-labelledby="diagnosis-outcome-title"><p class="outcome-reward-mentor">${stats.correct?`${stats.correct}문제를 맞혔어요!`:'끝까지 도전해줘서 고마워요!'}</p><div class="outcome-fragment-stage ${stats.correct?'':'is-empty'}" aria-hidden="true"><div class="outcome-fragment-halo"></div><div class="outcome-fragment">${diagnosisFragmentHTML()}</div>${stats.correct?'<i class="reward-spark spark-a"></i><i class="reward-spark spark-b"></i><i class="reward-spark spark-c"></i>':''}</div><h1 id="diagnosis-outcome-title" tabindex="-1">${stats.correct?`별 조각 <strong>+${stats.correct}</strong>`:'다음에는 별 조각도 모아봐요'}</h1><p>${stats.correct?'맞힌 문제만큼 별 조각을 받았어요.':'맞힌 문제마다 별 조각을 받을 수 있어요.'}</p><small class="outcome-reward-rule">${flow.preview?'보상 미리보기 · 보유 조각에는 반영되지 않아요':'정답 1개당 별 조각 1개'}</small></section>`;
}
function diagnosisCollectionHTML(correct){
  const count=Math.min(5,correct);
  return `<section class="diagnosis-collection" aria-labelledby="diagnosis-outcome-title"><p class="sr-only" id="diagnosis-outcome-title" tabindex="-1" role="status">별 조각을 나의 별자리에 모았어요.</p><div id="diagnosis-reward-flight" class="diagnosis-reward-flight" aria-hidden="true">${Array.from({length:count},(_,i)=>`<span class="fragment-particle" style="--particle-delay:${i*64}ms"><span class="fragment-particle-rise">${diagnosisFragmentHTML()}</span></span>`).join('')}</div></section>`;
}
function rewardButtonCenter(ensureVisible=false){
  const button=$('.constellation-trigger');let rect=button.getBoundingClientRect();
  if(ensureVisible&&(rect.top<0||rect.bottom>window.innerHeight)){
    button.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'auto'});rect=button.getBoundingClientRect();
  }
  return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
}
function captureDiagnosisFlight(run){
  const rect=$('.outcome-fragment')?.getBoundingClientRect();
  run.flight={from:rect&&rect.width>0?{x:rect.left+rect.width/2,y:rect.top+rect.height/2}:{x:window.innerWidth/2,y:window.innerHeight*.48},to:rewardButtonCenter(true)};
}
function mountDiagnosisFlight(){
  const run=diagnosisOutcomeRun;if(!run||run.target.diagnosisOutcome?.stage!=='collecting')return;
  // On reload the reward has already been credited; resume only the visual collection.
  run.flight??={from:{x:window.innerWidth/2,y:window.innerHeight*.48},to:rewardButtonCenter(true)};
  const {from}=run.flight,to=run.flight.to=rewardButtonCenter();
  const host=$('#diagnosis-reward-flight');
  for(const [name,value] of Object.entries({'--flight-from-x':from.x+'px','--flight-from-y':from.y+'px','--flight-dx':(to.x-from.x)+'px','--flight-dy':(to.y-from.y)+'px'})){
    if(host.style.setProperty)host.style.setProperty(name,value);else host.style[name]=value;
  }
  const button=$('.constellation-trigger');button.classList.add('is-receiving-fragments');button.setAttribute('data-reward-paused',String(document.visibilityState==='hidden'));
}
function clearDiagnosisFlight(run){
  $('.constellation-trigger').classList.remove('is-receiving-fragments');$('.constellation-trigger').removeAttribute('data-reward-paused');
  if(run)run.flight=null;
}
window.addEventListener?.('resize',mountDiagnosisFlight);
function diagnosisOutcomeValid(run){return diagnosisOutcomeRun===run&&current()===run.target&&run.target.diagnosisOutcome?.attemptId===run.attemptId;}
function lockDiagnosisOverview(run){
  run.locks=['#learning-workspace','#group-panel','.groups-trigger','.settings-trigger'].map(selector=>{const element=$(selector),previous=!!element.inert;element.inert=true;return {element,previous};});
}
function releaseDiagnosisOverview(run){for(const {element,previous} of run?.locks||[])element.inert=previous;}
function cancelDiagnosisOutcome(discard=false){
  const run=diagnosisOutcomeRun;diagnosisOutcomeRun=null;clearTimeout(diagnosisOutcomeTimer);diagnosisOutcomeTimer=null;
  if(run){run.epoch++;clearDiagnosisFlight(run);releaseDiagnosisPreparation(run);releaseDiagnosisOverview(run);if(discard)delete run.target.diagnosisOutcome;}
  $('#learning').classList.remove('diagnosis-outcome-active','diagnosis-generating','diagnosis-preparing','diagnosis-summary-screen','diagnosis-collecting','program-outcome-screen');$('#learning').removeAttribute('data-outcome-paused');$('#learning').removeAttribute('aria-labelledby');$('#learning').removeAttribute('aria-label');
}
function scheduleDiagnosisOutcome(run){
  clearTimeout(diagnosisOutcomeTimer);diagnosisOutcomeTimer=null;const epoch=++run.epoch;
  if(!diagnosisOutcomeValid(run)||document.visibilityState==='hidden'||!run.next)return;
  run.started=Date.now();
  diagnosisOutcomeTimer=setTimeout(()=>{if(!diagnosisOutcomeValid(run)||run.epoch!==epoch||document.visibilityState==='hidden')return;diagnosisOutcomeTimer=null;const next=run.next;run.next=null;next();},run.remaining);
}
function grantDiagnosisReward(run){
  const flow=run.target.diagnosisOutcome,stats=diagnosisSummary(outcomeResult(run.target));
  // The receipt and both balances are saved together; a refresh or result replay
  // may show the reward again but can never apply it twice.
  const receipts=programOutcome(flow)?(state.programRewards??={}):(state.diagnosisRewards??={});
  if(!flow.preview&&!Object.hasOwn(receipts,run.attemptId)){
    if(stats.correct>0)K.addPieces(skyState(),stats.correct);daily().fragments=(daily().fragments||0)+stats.correct;
    receipts[run.attemptId]={pieces:stats.correct,date:todayKey()};
  }
  save();
}
function finishDiagnosisOutcome(run){
  if(!diagnosisOutcomeValid(run))return;
  if(programOutcome(run.target.diagnosisOutcome)){finishProgramOutcome(run);return;}
  const target=run.target,stats=diagnosisSummary(outcomeResult(run.target));
  if(!stats.deficits){target.diagnosis='done';target.programs=[];target.cleanPassStage='celebrate';daily().cleanStreak++;}
  else{target.diagnosisResultHintPending=!state.ui.diagnosisResultHintSeen;target.presentationPending=true;}
  delete target.diagnosisOutcome;cancelDiagnosisOutcome();
  if(stats.deficits){
    editing=null;closeSurface('#learning');
    target.recent='실력알기 완료 · 맞춤 학습 '+target.programs.length+'개 열림';
    save();render();document.querySelector('#programs [data-action="program"]')?.focus({preventScroll:true});
  }else{
    editing={kind:'diagnosis',complete:true,passStage:'celebrate'};target.recent='실력알기 통과 · 별 조각 보상 확인';save();render();refreshDialog();
  }
}
function setDiagnosisOutcomeStage(stage){
  const run=diagnosisOutcomeRun;if(!run||!diagnosisOutcomeValid(run))return;
  const target=run.target,flow=target.diagnosisOutcome;
  if(programOutcome(flow)&&!['summary','reward','collecting'].includes(stage))return;
  if(stage==='collecting'&&!run.flight&&flow.stage==='reward')captureDiagnosisFlight(run);
  flow.stage=stage;run.next=null;run.remaining=0;
  if(!isDiagnosisPreparation(stage))releaseDiagnosisPreparation(run);
  if(stage==='searching'||stage==='ready'){
    const next={searching:'ready',ready:'generating'};
    run.remaining=DIAGNOSIS_OUTCOME_TIMING[stage];run.next=()=>setDiagnosisOutcomeStage(next[stage]);
  }
  if(stage==='generating'){
    target.diagnosis='done';
    if(!flow.courseBuilt){target.programs=M.programs(flow.count,state.grade,state.index);target.reviewHistory=false;flow.courseBuilt=true;}
    target.presentationPending=true;state.ui.prescriptionSeen=true;reveal=true;
    run.remaining=matchMedia('(prefers-reduced-motion: reduce)').matches?2200:Math.max(2800,COURSE_REVEAL.wait+Math.min(target.programs.length-1,COURSE_REVEAL.limit)*COURSE_REVEAL.stagger+COURSE_REVEAL.card+COURSE_REVEAL.invite+240);
    run.next=()=>{clearPrescribedCardReveal();setDiagnosisOutcomeStage('reward');};
  }
  if(stage==='reward'){
    grantDiagnosisReward(run);run.remaining=DIAGNOSIS_OUTCOME_TIMING.reward;run.next=()=>diagnosisSummary(outcomeResult(target)).correct>0?setDiagnosisOutcomeStage('collecting'):finishDiagnosisOutcome(run);
  }
  if(stage==='collecting'){run.remaining=matchMedia('(prefers-reduced-motion: reduce)').matches?450:DIAGNOSIS_OUTCOME_TIMING.collecting;run.next=()=>finishDiagnosisOutcome(run);}
  editing={kind:'diagnosis',outcome:true};daily().timerRunning=false;save();render();refreshDialog();
  if(!$('#learning').open)$('#learning').showModal();
  $('#learning').scrollTop=0;$(isDiagnosisPreparation(stage)?'#composition-title':'#diagnosis-outcome-title')?.focus({preventScroll:true});scheduleDiagnosisOutcome(run);
}
function resumeDiagnosisOutcome(background=''){
  const target=current(),flow=target.diagnosisOutcome;
  if(flow?.stage==='acknowledge')flow.stage='summary';
  if(!flow||!DIAGNOSIS_OUTCOME_STAGES.includes(flow.stage)||!outcomeResult(target))return false;
  if(programOutcome(flow)&&!target.programs.some(p=>p.id===flow.programId)){delete target.diagnosisOutcome;return false;}
  cancelDiagnosisOutcome();if(panel)closePanel();hideDiagnosisResultHint();clearPrescribedCardReveal();
  const run=diagnosisOutcomeRun={target,attemptId:flow.attemptId,background,epoch:0,remaining:0,next:null};
  lockDiagnosisOverview(run);$('#learning').setAttribute('data-outcome-paused',String(document.visibilityState==='hidden'));setDiagnosisOutcomeStage(flow.stage);return true;
}
function beginDiagnosisOutcome(result,{count=M.sourceCount(state.grade,state.index),preview=false,background=''}={}){
  cancelComposition();cancelDiagnosisOutcome(true);state.ui??={testControls:false};
  state.diagnosisAttemptSequence=(Number(state.diagnosisAttemptSequence)||0)+1;
  result.attemptId=current().groupId+':'+Date.now()+':'+state.diagnosisAttemptSequence;result.deficits=diagnosisSummary(result).deficits;
  const target=current();target.diagnosticResult=result;target.diagnosticSession=null;
  target.diagnosis='active';target.programs=[];target.diagnosisResultHintPending=false;
  target.diagnosisOutcome={attemptId:result.attemptId,stage:'summary',count,preview};
  resumeDiagnosisOutcome(background);
}
document.addEventListener('visibilitychange',()=>{
  const run=diagnosisOutcomeRun;if(!run)return;const paused=document.visibilityState==='hidden';
  if(paused&&diagnosisOutcomeTimer)run.remaining=Math.max(0,run.remaining-(Date.now()-run.started));
  $('#learning').setAttribute('data-outcome-paused',String(paused));mountDiagnosisFlight();scheduleDiagnosisOutcome(run);
});

// Keep card widths stable and carry mounted cards quietly into their new grid slots.
let studyLayoutAnimations=[],navigationCardWidth=null,navigationViewport=0;
function baselineStudyGrid(viewport){
  const columns=viewport<=760?2:viewport<=980?3:4,gap=viewport<=380?10:viewport<=650?12:16;
  const main=Math.min(1080,viewport-152);
  return {columns,gap,width:Math.max(1,(main-gap*(columns-1))/columns)};
}
function navigationGridMetrics(viewport,available,preferred){
  const base=baselineStudyGrid(viewport),desired=Number(preferred)>0?Number(preferred):base.width;
  const columns=Math.max(1,Math.min(base.columns,Math.floor((available+base.gap)/(desired*(viewport<=980?.96:1)+base.gap))));
  const width=Math.min(desired,Math.max(1,(available-base.gap*(columns-1))/columns));
  return {columns,width,contentWidth:columns*width+(columns-1)*base.gap};
}
function applyNavigationGrid(preferred){
  if(!document.body.classList.contains('learning-navigation-open')||window.innerWidth<=650)return;
  if(Number(preferred)>0){navigationCardWidth=Number(preferred);navigationViewport=window.innerWidth;}else if(navigationViewport!==window.innerWidth){navigationCardWidth=baselineStudyGrid(window.innerWidth).width;navigationViewport=window.innerWidth;}
  const host=$('#learning-workspace'),available=Math.max(1,host.getBoundingClientRect().width-48),metrics=navigationGridMetrics(window.innerWidth,available,navigationCardWidth);
  for(const [key,value] of Object.entries({'--navigation-columns':String(metrics.columns),'--navigation-card-width':metrics.width+'px','--navigation-content-width':metrics.contentWidth+'px'})){
    if(host.style.setProperty)host.style.setProperty(key,value);else host.style[key]=value;
  }
}
function cancelStudyLayoutAnimations(){const previous=studyLayoutAnimations;studyLayoutAnimations=[];previous.forEach(a=>a.cancel?.());$('#programs').removeAttribute('data-layout-motion');}
function changeNavigationDock(open){
  const cards=Array.from(document.querySelectorAll?.('#programs>.program-card')||[]);
  const headings=[$('.ai'),$('.heading')].filter(element=>element&&!element.hidden);
  const elements=[...headings,...cards];
  // Capture the visible position before cancelling an interrupted transition.
  const before=elements.map(element=>element.getBoundingClientRect()),preferred=before[headings.length]?.width;
  const changed=document.body.classList.contains('learning-navigation-open')!==open;
  cancelStudyLayoutAnimations();
  if(open)document.body.classList.add('learning-navigation-open');else document.body.classList.remove('learning-navigation-open');
  if(open)applyNavigationGrid(preferred);
  fitMentorBubble();measureLearningHeader();
  void $('#learning-workspace').offsetWidth;
  if(changed&&!cardRevealRun&&window.innerWidth>650&&window.innerWidth<1800&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    // Finish all geometry/style reads before starting any animation. Header and cards
    // share one clock, so a wrapped row never chases an already-snapped heading.
    $('#programs').setAttribute('data-layout-motion','true');
    const after=elements.map(element=>element.getBoundingClientRect());
    const resting=elements.map(element=>window.getComputedStyle?.(element).transform||'none');
    const start=document.timeline?.currentTime;
    let order=0;
    elements.forEach((element,i)=>{
      const from=before[i],to=after[i],x=from.left-to.left,y=from.top-to.top;
      if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)+Math.abs(y)<1)return;
      if((from.bottom<=0||from.top>=window.innerHeight)&&(to.bottom<=0||to.top>=window.innerHeight))return;
      const base=resting[i]==='none'?'':` ${resting[i]}`,delay=i<headings.length?0:Math.min(order++,4)*10;
      const animation=element.animate?.([{transform:`translate3d(${x}px,${y}px,0)${base}`},{transform:resting[i]}],{duration:480,delay,easing:'cubic-bezier(.25,.1,.25,1)',fill:'both'});
      if(!animation)return;
      if(Number.isFinite(start))animation.startTime=start;
      studyLayoutAnimations.push(animation);
      const release=()=>{if(!studyLayoutAnimations.includes(animation))return;studyLayoutAnimations=studyLayoutAnimations.filter(a=>a!==animation);animation.cancel?.();if(!studyLayoutAnimations.length)$('#programs').removeAttribute('data-layout-motion');};
      animation.finished?.then(release,release);
    });
    if(!studyLayoutAnimations.length)$('#programs').removeAttribute('data-layout-motion');
  }
}
window.addEventListener?.('resize',()=>{cancelStudyLayoutAnimations();applyNavigationGrid();});
let lastPanel='groups',groupPanelPhase='closed',panelMotionTimer=null,panelMotionGeneration=0;
const railScrollBindings=new WeakSet();let railScrollObserver=null;
let groupRevealTimer=null,groupRevealGeneration=0,groupPanelMarkup='',railPositionKey=null;
function railCurrentTopicIndex(){
  if(browseGrade===state.grade)return state.index;
  const active=(state.grades[browseGrade]||[]).findIndex(topic=>M.status(topic,state.policy)==='active');
  return active<0?0:active;
}
function alignRailToCurrent(force=false){
  if(panel!=='groups')return;
  const index=railCurrentTopicIndex(),key=browseGrade+':'+index;
  if(!force&&railPositionKey===key)return;
  const list=$('#group-panel .group-list'),row=$(`#group-panel [data-action="select-group"][data-id="${index}"]`);
  if(!list||!row||!(Number(list.clientHeight)>0))return;
  const listRect=list.getBoundingClientRect(),rowRect=row.getBoundingClientRect();
  const target=Math.max(0,rowRect.top-listRect.top+list.scrollTop);
  // Only add the room needed to align a late topic; retain the numbered catalog order.
  const last=$('#group-panel .group-list>.group-item:last-child')?.getBoundingClientRect();
  const naturalHeight=Math.max(target+rowRect.height+14,last?last.bottom-listRect.top+list.scrollTop+14:0);
  const tail=Math.max(0,list.clientHeight-(naturalHeight-target));
  list.style.setProperty('--rail-tail-space',tail+'px');list.setAttribute('data-tail-space',tail);
  list.scrollTop=target;railPositionKey=key;syncRailOverflow();
}
function clearGroupPanelReveal(){clearTimeout(groupRevealTimer);groupRevealTimer=null;groupRevealGeneration++;$('#group-panel').setAttribute('data-reveal','false');}
function revealGroupPanel(){
  clearGroupPanelReveal();if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const generation=groupRevealGeneration;void $('#group-panel').offsetWidth;$('#group-panel').setAttribute('data-reveal','true');
  groupRevealTimer=setTimeout(()=>{if(generation!==groupRevealGeneration)return;$('#group-panel').setAttribute('data-reveal','false');groupRevealTimer=null;},600);
}
function setGroupPanelPhase(phase){
  groupPanelPhase=phase;$('.groups-trigger').inert=phase==='open';$('.groups-trigger').tabIndex=phase==='open'?-1:0;$('#group-panel').setAttribute('data-panel-phase',phase);$('.groups-trigger').setAttribute('data-tab-phase',phase);$('.groups-trigger').setAttribute('aria-expanded',phase==='open'?'true':'false');$('.groups-trigger').setAttribute('aria-label',phase==='open'?'학습 주제 닫기':'학습 주제 열기');
}
function finishGroupPanelClose(generation){
  if(generation!==panelMotionGeneration||groupPanelPhase!=='closing'||panel)return;
  clearTimeout(panelMotionTimer);panelMotionTimer=null;setGroupPanelPhase('closed');$('#group-panel').hidden=true;syncGuidanceReminders();
}
function closePanel(){
  if(!panel)return;
  const closing=panel;panel=null;clearTimeout(panelMotionTimer);panelMotionTimer=null;clearGroupPanelReveal();const generation=++panelMotionGeneration;
  $('#group-panel').inert=true;$('#group-panel').setAttribute('aria-hidden','true');
  if(closing==='groups'){
    changeNavigationDock(false);setGroupPanelPhase('closing');document.querySelector('[data-action="groups"]').focus({preventScroll:true});
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){finishGroupPanelClose(generation);return;}
    panelMotionTimer=setTimeout(()=>finishGroupPanelClose(generation),500);return;
  }
  setGroupPanelPhase('closed');$('#group-panel').hidden=true;$('#test-panel').hidden=true;
  $('#overlay').hidden=true;document.body.classList.remove('panel-open');document.querySelector('[data-action="test"]').focus({preventScroll:true});syncGuidanceReminders();
}
function openPanel(p){
  if(panel===p)return;
  clearTimeout(panelMotionTimer);panelMotionTimer=null;panelMotionGeneration++;clearGroupPanelReveal();
  const wasHidden=$('#group-panel').hidden;panel=p;lastPanel=p;browseGrade=state.grade;railPositionKey=null;
  $('#overlay').setAttribute('data-panel-kind',p);$('#overlay').hidden=p==='groups';
  if(p==='groups'){document.body.classList.remove('panel-open');changeNavigationDock(true);}
  else{changeNavigationDock(false);document.body.classList.add('panel-open');}
  $('#group-panel').inert=p!=='groups';$('#group-panel').setAttribute('aria-hidden',p==='groups'?'false':'true');
  if(p!=='groups'||wasHidden)setGroupPanelPhase('closed');renderPanel();
  if(p==='groups'){void $('#group-panel').offsetWidth;setGroupPanelPhase('open');alignRailToCurrent(true);revealGroupPanel();}
  $('#'+(p==='groups'?'group':'test')+'-panel [data-action="close-panel"]').focus({preventScroll:true});syncGuidanceReminders();
}
matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',()=>{
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){clearGroupPanelReveal();cancelStudyLayoutAnimations();finishGroupPanelClose(panelMotionGeneration);}
});
if(typeof ResizeObserver!=='undefined'){new ResizeObserver(()=>fitMentorBubble()).observe($('.ai-top'));new ResizeObserver(()=>measureLearningHeader()).observe($('.ai'));new ResizeObserver(()=>applyNavigationGrid()).observe($('#learning-workspace'));}
function focusNavigationAction(action,id){
  const selector='#group-panel [data-action="'+action+'"]'+(action==='select-group'?'[data-id="'+Number(id)+'"]':'');let target=$(selector);
  if(target?.disabled&&['prev-grade','next-grade'].includes(action))target=$('#group-panel [data-action="'+(action==='prev-grade'?'next-grade':'prev-grade')+'"]');
  if(!target?.disabled)target?.focus({preventScroll:true});
}
function canNavigateTopic(topic){return !!topic&&!['idle','locked'].includes(M.status(topic,state.policy));}
function navigationStatusIcon(status){
  if(status==='failed')return `<span class="rail-failed-icon" aria-hidden="true">${figmaStatusIcon('failed')}</span>`;
  if(['clean','passed'].includes(status))return '<img src="assets/figma-v4-1/rail-passed.svg" width="24" height="24" alt="">';
  if(['idle','locked'].includes(status))return '<img src="assets/figma-v4-1/rail-locked.svg" width="24" height="24" alt="">';
  return '<img src="assets/figma-v4-1/rail-active.svg" width="22" height="22" alt="">';
}
function availableRailGrades(){
  return state.grades.map((topics,g)=>g===state.grade||topics.some(topic=>topic.diagnosis!=='idle')?g:null).filter(g=>g!==null);
}
function railGradeProgress(g=browseGrade){
  const topics=state.grades[g]||[],total=topics.length,completed=topics.filter(topic=>topic.diagnosis==='done').length;
  return {total,completed,percent:total?Math.round(completed/total*100):0};
}
function railGradeArrow(direction,disabled){
  const previous=direction==='prev';
  return `<button class="nav-grade-arrow ${previous?'is-prev':'is-next'}" data-action="${direction}-grade" aria-label="${previous?'이전':'다음'} 등급 보기" title="${previous?'이전':'다음'} 등급" ${disabled?'disabled':''}><img src="assets/figma-v4-1/grade-arrow.svg" width="18" height="18" alt=""></button>`;
}
function railHasMoreBelow(scrollHeight,clientHeight,scrollTop=0){
  const height=Math.max(0,Number(clientHeight)||0),end=Math.max(0,(Number(scrollHeight)||0)-height);
  return height>0&&end>2&&(Number(scrollTop)||0)<end-2;
}
function syncRailOverflow(){
  if(panel!=='groups')return;
  const list=$('#group-panel .group-list');if(!list)return;
  const more=railHasMoreBelow(list.scrollHeight,list.clientHeight,list.scrollTop);
  list.setAttribute('data-has-more',String(more));$('#rail-scroll-hint').hidden=!more;
  if(more)list.setAttribute('aria-describedby','rail-scroll-hint');else list.removeAttribute('aria-describedby');
}
function bindRailOverflow(){
  const list=$('#group-panel .group-list');if(!list)return;
  if(!railScrollBindings.has(list)){
    railScrollBindings.add(list);list.addEventListener('scroll',syncRailOverflow,{passive:true});
    if(typeof ResizeObserver!=='undefined'){
      railScrollObserver??=new ResizeObserver(()=>{alignRailToCurrent(true);syncRailOverflow();});railScrollObserver.disconnect();railScrollObserver.observe(list);
    }
  }
  syncRailOverflow();
}
window.addEventListener?.('resize',()=>{alignRailToCurrent(true);syncRailOverflow();});
document.fonts?.ready?.then(()=>{alignRailToCurrent(true);syncRailOverflow();});
function renderPanel(){
  const gp=$('#group-panel'),tp=$('#test-panel');gp.hidden=panel!=='groups'&&groupPanelPhase!=='closing';tp.hidden=panel!=='test';
  if(panel==='groups'){
    const topics=state.grades[browseGrade],labels={idle:'시작 전',active:'학습 중',clean:'완료',passed:'완료',failed:'복습 필요',locked:'시작 전'};
    const grades=availableRailGrades(),position=grades.indexOf(browseGrade),progress=railGradeProgress();
    const markup=`<button class="mobile-sheet-handle" data-action="close-panel" aria-label="학습 주제 목록 닫기"></button><div class="panel-head nav-stagger" style="--nav-delay:0ms"><button class="nav-close" data-action="close-panel" aria-label="학습 주제 닫기"><img src="assets/figma-v4-1/close.svg" width="20" height="20" alt=""></button></div><div class="panel-content"><div class="group-nav nav-stagger" style="--nav-delay:20ms" role="group" aria-label="등급 선택">${railGradeArrow('prev',position<=0)}<h2 id="nav-grade-title"><span>${grade(browseGrade)}</span>등급</h2>${railGradeArrow('next',position>=grades.length-1)}</div><div class="nav-list-heading nav-stagger" style="--nav-delay:50ms"><h3 id="nav-topic-heading">학습 주제 <span>${topics.length}개</span></h3><button class="nav-help" data-action="help" aria-label="학습 상태 안내"><img src="assets/figma-v4-1/info.svg" width="20" height="20" alt=""></button></div><div class="nav-list-scroll"><div class="group-list" role="group" aria-labelledby="nav-topic-heading" tabindex="0">${topics.map((topic,i)=>{const status=M.status(topic,state.policy),selected=browseGrade===state.grade&&i===state.index;return `<button data-state="${status}" class="group-item nav-stagger ${selected?'selected':''}" style="--nav-delay:${80+Math.min(i,7)*14}ms" data-action="select-group" data-id="${i}" aria-current="${selected?'true':'false'}" ${canNavigateTopic(topic)?'':'disabled aria-disabled="true"'}><span class="nav-topic-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span class="nav-topic-copy"><strong>${esc(groupName(i,browseGrade))}</strong></span><span class="nav-topic-status ${status}" title="${labels[status]||'시작 전'}"><span class="sr-only">${labels[status]||'시작 전'}</span>${navigationStatusIcon(status)}</span></button>`;}).join('')}</div><span id="rail-scroll-hint" class="sr-only" hidden>아래에 학습 주제가 더 있어요. 스크롤해서 확인해요.</span></div></div><footer class="nav-grade-progress nav-stagger" style="--nav-delay:200ms" aria-labelledby="rail-progress-title"><div class="nav-progress-heading"><span id="rail-progress-title">${grade(browseGrade)}등급 실력알기</span><span class="nav-progress-count">완료 <b>${progress.completed}</b> / ${progress.total}</span></div><progress max="${progress.total||1}" value="${progress.completed}" aria-label="${grade(browseGrade)}등급 실력 알기 진행률" aria-valuetext="전체 ${progress.total}개 중 ${progress.completed}개 완료, ${progress.percent}%"></progress></footer>`;
    if(markup!==groupPanelMarkup){const scroll=$('#group-panel .group-list')?.scrollTop||0,focused=gp.contains?.(document.activeElement)?document.activeElement?.closest?.('[data-action]')?.dataset:null;gp.innerHTML=markup;groupPanelMarkup=markup;$('#group-panel .group-list').scrollTop=scroll;if(focused&&['close-panel','prev-grade','next-grade','help','select-group'].includes(focused.action))focusNavigationAction(focused.action,focused.id);}
    bindRailOverflow();alignRailToCurrent();
  }
  if(panel==='test')renderTest();
}
// Explicit validation cases replay presentation as well as domain state.
function resetValidationSurfaces(){
  cancelDiagnosisOutcome(true);hideDiagnosisResultHint();cancelComposition();
  if($('#learning').open)closeLearning();else editing=null;
  completedCardSelection=null;activityKind=null;
  for(const selector of ['#activity','#help'])if($(selector).open)closeSurface(selector);
  if(myOpen)backMain();
  if(typeof diagnosisEndBackground!=='undefined')diagnosisEndBackground=null;
  daily().timerRunning=false;
}
function resetValidationHints(first=false){
  stopWelcomeGuide();welcomeGuidePaused=false;welcomeGuideHover=false;welcomeGuideFocus=false;
  diagnosisWelcomeFirstTopic=null;state.ui??={testControls:false};state.ui.diagnosisWelcomeSeen=!first;
  Object.assign(state.ui,{diagnosisIntroSeen:!first,passedCardHintSeen:false,failedCardHintSeen:false,diagnosisResultHintSeen:false});
}
function loadValidationScenario(id,draft=false){
  const names=draft?M.draftPresetNames:M.presetNames;
  if(!Number.isInteger(id)||id<0||id>=names.length)return;
  resetValidationSurfaces();
  if(draft)M.draftPreset(state,id);else{
    M.preset(state,id);const topic=current();
    Object.assign(daily(),{target:null,minutes:0,started:topic.diagnosis!=='idle',entry:id===0?'first':topic.diagnosis==='idle'?'today':'activity',variant:0,unreadAnswers:0,frameAttempts:{},cleanStreak:0,timerRunning:false});
    if(state.sky)state.sky.newPieces=false;
    if(id===1)topic.diagnosticSession={index:1,answers:[DEMO[0].correct],started:Date.now(),notes:''};
  }
  delete state.mentorPolicy;speechPolicy?.reset();mentorEntry++;
  if(!(draft?id===0||id===1:id===0))state.mentorPolicy={seen:{['SB-006:'+daily().date]:true},rotations:{},queue:[],completedByDate:{}};
  if(draft&&id===4){M.preset(state,1);current().mentorDiagnosisEntries=3;speechPolicy?.offer(state,'SB-020',state.grade+':'+state.index,{},state.grade+':'+state.index);}
  const fixtureIds={6:'SB-032',7:'SB-033',8:'SB-034',9:'SB-036'};if(draft&&fixtureIds[id])speechPolicy?.offer(state,fixtureIds[id],state.grade+':'+state.index,{X:grade(state.grade),'연속 통과 진단 수':daily().cleanStreak},state.grade+':'+state.index);
  resetValidationHints(draft?id===0||id===1:id===0);
  current().diagnosisResultHintPending=current().diagnosis==='done'&&current().programs.length>0;
  state.ui.prescriptionSeen=current().diagnosis==='done'&&current().programs.length>0;
  browseGrade=state.grade;presetIndex=draft?null:id;
  if(panel)closePanel();save();render();
}
function replayValidationResumeScroll(){
  loadValidationScenario(9);
  const topic=current();topic.programs=M.programs(20,state.grade,state.index);
  topic.programs.slice(0,12).forEach(program=>{program.status='passed';M.setProgress(program,100);});
  topic.programs[12].status='active';M.setProgress(topic.programs[12],50);
  state.ui.passedCardHintSeen=true;daily().started=true;daily().target=20;
  topic.recent='확인용 상태 · 20개 카드 중 13번째 학습 진행 중';
  mainResumeVisible=false;save();render();
}
function validationDiagnosisBackground(passed=false){
  if(typeof diagnosisEndBackground==='undefined')return;
  const previous=editing;editing={kind:'diagnosis'};
  const topic=current(),session={index:2,answers:DEMO.map(q=>passed?q.correct:(q.correct+1)%q.choices.length),started:Date.now(),notes:''};
  diagnosisEndBackground={target:topic,html:diagnosticScreenHTML({...topic,diagnosticSession:session})};editing=previous;
}
function validationDiagnosisResult(passed=false){
  const goals=DEMO.map((q,i)=>({title:q.title,area:q.area,questions:[{...q,chosen:passed||i!==1?q.correct:(q.correct+1)%q.choices.length}]}));
  return {questionCount:DEMO.length,incorrect:passed?0:1,deficits:passed?0:1,seconds:65,goals};
}
function replayValidationPrescription(mode){
  const n=current().programs.length||M.sourceCount(state.grade,state.index);
  resetValidationSurfaces();resetValidationHints();state.ui.prescriptionSeen=mode==='repeat';
  beginDiagnosisOutcome(validationDiagnosisResult(false),{count:n,preview:true});
}
function replayValidationCleanPass(){
  resetValidationSurfaces();resetValidationHints();
  beginDiagnosisOutcome(validationDiagnosisResult(true),{preview:true});
}
function replayValidationProgram(passed=true){
  resetValidationSurfaces();resetValidationHints();const topic=current();
  topic.diagnosis='done';if(!topic.programs.length)topic.programs=M.programs(M.sourceCount(state.grade,state.index),state.grade,state.index);
  const p=topic.programs[0];p.status=passed?'passed':'failed';M.setProgress(p,100);p.wrongFrames=passed?[]:[0];delete p.initialResult;delete p.reviewSession;
  p.studyTiming={normal:{elapsedMs:65000,runningSince:null}};if(panel)closePanel();beginProgramOutcome(p,false,true);
}
function renderTest(){const s=current(),scroll=$('#test-panel .panel-content')?.scrollTop||0;$('#test-panel').innerHTML=`<div class="panel-head"><h2>테스트 패널</h2><button data-action="close-panel">닫기 ×</button></div><div class="panel-content"><label class="preview-mode"><input id="test-controls" type="checkbox" ${testVisible()?'checked':''}> 학습 화면에 테스트 버튼 표시</label><div class="notice">기획·개발 검증 전용<br>시나리오를 선택하면 설정이 닫히고 해당 상태가 표시돼요. 첫 진입 안내와 카드 복습 안내도 다시 확인할 수 있어요. 필수 시나리오는 현재 주제를 바꿉니다.</div><div class="fields"><label>등급<select id="test-grade">${gradeOptions(state.grade)}</select></label><label>진단 그룹<select id="test-group">${groupOptions(state.grade,state.index)}</select></label></div><h3>V6.1 시작 화면</h3><div class="actions"><button data-action="welcome-preview-first">첫 안내 다시 보기</button><button data-action="welcome-preview-compact">간단한 시작 화면</button><button data-action="welcome-preview-progress">진단 진행률 보기</button></div><h3>필수 검증 시나리오</h3><div class="presets">${M.presetNames.map((n,i)=>`<button class="${i===presetIndex?'selected':''}" data-action="preset" data-id="${i}">${i+1}. ${n}</button>`).join('')}</div><p class="validation-note">통과·미통과 시나리오를 다시 선택하면 첫 카드의 복습 안내도 다시 표시돼요.</p><h3>진행 중 카드로 돌아오기</h3><button data-action="replay-resume-scroll">아래쪽 진행 중 카드로 자동 이동</button><p class="validation-note">확인용 카드 20개 중 13번째를 진행 중으로 표시해요. 메인 맨 위에서 0.6초 후 해당 카드로 이동해요.</p><h3>진단 후 전환 다시 보기</h3><p class="validation-note">전체 화면 결과 요약 → 돋보기로 맞춤 학습 찾기 → 준비 완료 → 카드 생성 → 별 조각 보상 → 별자리로 모으기 → 학습 열림 순서로 보여줘요. 보상은 미리보기로 제공돼요.</p><div class="actions"><button data-action="replay-first">첫 처방 · 결과부터 보기</button><button data-action="replay-repeat">반복 처방 · 결과부터 보기</button><button data-action="replay-clean-pass">처방 없이 통과 연출</button></div><h3>개별 학습 완료 다시 보기</h3><div class="actions"><button data-action="replay-program-pass">프로그램 통과 · 결과부터 보기</button><button data-action="replay-program-fail">프로그램 미통과 · 결과부터 보기</button></div><h3>진단과 처방 직접 변경</h3><label>진단 상태<select id="diagnosis-state">${options([['idle','시작 전 · 처방 제거'],['active','진행 중 · 처방 제거'],['clean','처방 없이 통과'],['prescribed','진단 완료 · 처방 발생']],s.diagnosis==='done'?(s.programs.length?'prescribed':'clean'):s.diagnosis)}</select></label><div class="fields"><label>처방 프로그램 수 (1~52)<input id="prescription-count" type="number" min="1" max="52" value="${s.programs.length||M.sourceCount(state.grade,state.index)}"></label></div><button data-action="resize">개수 적용 · 진단 완료 처리</button><div class="actions"><button data-action="all-pass">모두 통과</button><button data-action="make-fail">미통과 1개 생성</button><button data-action="review-all">미통과 모두 복습 후 통과</button><button data-action="reset-current">현재 세트 초기화</button><button data-action="reset-all">전체 초기화</button></div><h3>개별 프로그램 (${s.programs.length})</h3>${s.programs.length?s.programs.map(p=>`<div class="program-edit"><strong>${p.id+1}. ${esc(p.name)} ${p.reviewed?'· 복습 완료':''}</strong><select data-program-state="${p.id}" aria-label="프로그램 ${p.id+1} 상태">${options(['locked','idle','active','passed','failed'].map(x=>[x,M.labels[x]]),p.status)}</select><label><small>진행률 ${p.progress}%</small><input type="range" min="0" max="100" value="${p.progress}" data-program-progress="${p.id}" aria-label="프로그램 ${p.id+1} 진행률" ${p.status!=='active'?'disabled':''}></label>${p.status==='failed'?`<button data-action="review-one" data-id="${p.id}">복습 후 통과</button>`:''}</div>`).join(''):'<p><small>현재 처방 프로그램이 없습니다.</small></p>'}<h3>데이터 기준</h3><div class="notice">시트 기준: ${M.Catalog.meta.groups}개 세트 / ${M.Catalog.meta.programs}개 프로그램<br>${M.Catalog.meta.frameAssociations}개 프로그램-프레임 연결 (완전 중복 ${M.Catalog.meta.exactDuplicateFramesRemoved}행 제외)<br>MF012736 → M1.H99.16 정정<br>그룹–프로그램 연결표 미제공: 같은 등급의 프로그램을 테스트용으로 선택${s.programs.some(p=>p.sample)?'<br>현재 처방에 테스트용 추가 항목 포함':''}<br>진단 채점·실제 처방 엔진은 미구현. 원본 ‘O’, ‘삭제’, ‘1’ 표시는 보존하며 자동 제외하지 않음.</div>${dailyControls()}<h3>기획 확인 정책</h3><details class="policy"><summary>판정 규칙·추천 우선순위 편집</summary><p>진단 미시작 → 시작 전<br>진단 진행 → 진행 중<br>진단 완료 + 처방 0 → 처방 없이 통과<br>전체 통과 → 통과<br>전체 풀이 완료 + 미통과 존재 → 미통과</p><label>처방 후 학습 미시작<select id="policy-prescribed">${options([['active','진행 중 (요청의 임시 가정)'],['idle','시작 전 (비교용)']],state.policy.prescribed)}</select></label><label>일부 프로그램 미완료<select id="policy-unfinished">${options([['active','진행 중'],['idle','시작 전 (비교용)']],state.policy.unfinished)}</select></label><label>추천 우선순위<select id="policy-recommendation">${options([['active','진행 중 → 다음 순서 → 복습'],['failed','진행 중 → 복습 → 다음 순서']],state.policy.recommendation)}</select></label><p>순차 학습: 이전 프로그램 진행률 100% → 다음 학습 열림. 통과·미통과와 별개. 테스트 패널은 순서 제한 없이 상태를 조작할 수 있음.<br>부족 목표 1개 = 프로그램 1개인 샘플 가정.<br>등급·그룹 진입은 자유. 프로그램 학습은 순차 진행.</p></details><h3>최근 상태 변경</h3><div class="notice">${esc(s.recent||'변경 이력 없음')}</div><div class="actions"><button data-action="export">현재 테스트 데이터 JSON 내려받기</button><a href="source.zip" download>소스 코드 ZIP</a><a href="README.md" download>요구사항·테스트 안내</a></div></div>`;$('#test-panel .panel-content').scrollTop=scroll;}
function showHelp(){const rows=[['clean','실력 알기를 마쳤고, 추가 학습 없이 통과했어요.'],['passed','실력 알기 후 필요한 학습을 모두 마쳤어요.'],['active','실력 알기 또는 맞춤 학습을 진행하고 있어요.'],['failed','학습을 마쳤지만 다시 살펴볼 내용이 있어요.'],['idle','아직 실력 알기를 시작하지 않았어요.']];$('#help').innerHTML=`<div class="dialog-top"><h2>학습 상태 확인</h2><button data-action="close-help" aria-label="닫기">×</button></div>${rows.map(([st,t])=>`<div class="status-help-row">${st==='active'?`<span class="status-dot ${st}" aria-label="${M.labels[st]}"></span>`:`<span class="status-help-icon" aria-label="${M.labels[st]}">${statusSVG(st==='clean'?'passed':st==='idle'?'locked':st)}</span>`}<p>${t}</p></div>`).join('')}`;$('#help').showModal();}
const DEMO=[
{title:'모양 알기',area:'도형',text:'동그라미를 골라요.',choices:[{shape:'circle',label:'동그라미'},{shape:'square',label:'네모'},{shape:'triangle',label:'세모'},{shape:'rectangle',label:'직사각형'}],correct:0},
{title:'수의 크기 비교',area:'수',text:'가장 큰 수를 골라요.',choices:[{label:'3'},{label:'8'},{label:'2'},{label:'5'}],correct:1},
{title:'수의 순서',area:'수',text:'3 다음에 오는 수를 골라요.',choices:[{label:'2'},{label:'4'},{label:'5'},{label:'6'}],correct:1}];
function testVisible(){state.ui??={testControls:false};return state.ui.testControls;}
function choiceVisual(c){return c.shape?`<span class="answer-shape ${c.shape}" aria-label="${c.label}"></span>`:`<span class="answer-number">${c.label}</span>`;}
function choiceBoard(q,chosen,action,readOnly=false){const feedback=action!=='diagnosis-answer';return `<div class="question-choices">${q.choices.map((c,i)=>`<button ${action?`data-action="${action}" data-id="${i}"`:''} class="${chosen!==undefined?(feedback?(i===q.correct?'answer-correct':i===chosen?'answer-wrong':''):(i===chosen?'answer-selected':'')):''}" ${readOnly||chosen!==undefined?'disabled':''} aria-label="${c.label}${i===chosen?' · 선택한 답':''}${readOnly&&i===q.correct?' · 정답':''}">${choiceVisual(c)}${feedback&&chosen!==undefined&&i===q.correct?'<small>정답</small>':''}</button>`).join('')}</div>`;}
function diagnosticTestTools(s){return testVisible()?`<details class="dev-tools"><summary>테스트 전용 · 진단 결과 변경</summary><div class="actions"><button data-action="diag-start">진단 진행 상태</button><button data-action="diag-clean">처방 없이 통과</button></div><label>테스트 처방 수<input id="diag-count" type="number" min="1" max="52" value="${s.programs.length||M.sourceCount(state.grade,state.index)}"></label><button data-action="diag-prescribe">처방 발생으로 완료</button></details>`:'';}
function programTestTools(p){return !editing?.reviewing&&testVisible()?`<details class="dev-tools"><summary>테스트 전용 · 학습 상태 변경</summary><div class="actions"><button data-action="program-start">학습 시작 상태</button><button data-action="program-pass">통과 처리</button><button data-action="program-fail">미통과 처리</button><button data-action="program-review">복습 후 통과</button></div><label>테스트 진행률<input type="range" id="learning-progress" min="0" max="100" value="${p.progress}"></label><div class="actions"><button data-action="program-frame">다음 프레임 완료</button><button data-action="program-retry">프레임 반복 시도</button></div></details>`:'';}
function fallbackDiagnostic(s){const prescribed=!!s.programs.length;return {questionCount:6,incorrect:prescribed?2:0,deficits:prescribed?2:0,seconds:65,goals:DEMO.map((q,i)=>({title:q.title,area:q.area,questions:[{...q,chosen:prescribed&&i>0?0:q.correct},{...q,chosen:q.correct}]}))};}
function diagnosticResultHTML(s){const r=s.diagnosticResult||fallbackDiagnostic(s),goalIndex=Math.max(0,Math.min(r.goals.length-1,editing.goal||0));return `<div class="dialog-top"><h2>실력 확인 결과</h2><button data-action="close-learning" aria-label="결과 닫기">×</button></div><section class="diagnostic-summary"><div><strong>${esc(s.groupName)}</strong><span class="badge">${r.questionCount}문제</span></div><div class="result-metrics"><div><small>오답 문항 수</small><strong>${r.incorrect}개</strong></div><div><small>결손 학습 목표</small><strong>${r.deficits}개</strong></div><div><small>학습 시간</small><strong>${String(Math.floor(r.seconds/60)).padStart(2,'0')}분 ${String(r.seconds%60).padStart(2,'0')}초</strong></div></div></section><div class="result-goals">${r.goals.map((g,i)=>{const wrong=g.questions.filter(q=>q.chosen!==q.correct).length,open=i===goalIndex,qindex=open?Math.min(editing.item||0,g.questions.length-1):0,q=g.questions[qindex];return `<section class="result-goal"><button class="goal-heading ${wrong?'has-deficit':'has-pass'}" data-action="result-goal" data-id="${i}"><span>${wrong?'×':'✓'}</span><strong>${esc(g.title)}</strong><span>${open?'⌃':'⌄'}</span></button>${open?`<div class="goal-body"><div class="goal-meta"><span>${esc(g.area)}</span><small>${qindex+1} / ${g.questions.length}문항</small></div>${q.chosen!==q.correct?'<p class="wrong-description">고른 답이 정답과 달라요. 정답 표시를 확인해 보세요.</p>':''}<p>${esc(q.text)}</p>${choiceBoard(q,q.chosen,null,true)}<div class="result-question-nav"><button data-action="result-prev" ${qindex===0?'disabled':''}>← 이전 문항</button><button data-action="result-next" ${qindex===g.questions.length-1?'disabled':''}>다음 문항 →</button></div></div>`:''}</section>`;}).join('')}</div>${isCleanPass(s)?'<div class="pass-result-return"><button class="primary" data-action="pass-summary">통과 안내 · 다음 학습</button></div>':''}${diagnosticTestTools(s)}`;}
function activeReview(){const p=current().programs.find(p=>p.id===editing?.id);return editing?.kind==='program'&&editing.reviewing&&$('#learning').open&&p?.reviewSession&&!p.reviewSession.complete;}
function startReview(p){
  if(!M.canReview(current(),p))return false;
  p.initialResult??={status:p.status,progress:p.progress,completedFrames:p.completedFrames,wrongFrames:[...(p.wrongFrames||[])]};
  if(!p.reviewSession||p.reviewSession.complete){p.reviewSession={index:0,answers:[],wrongFrames:[],complete:false,startedAt:Date.now()};p.studyTiming??={};p.studyTiming.review={elapsedMs:0,runningSince:null};}
  editing.justCompleted=false;editing.justReviewed=false;editing.reviewing=true;editing.showResult=false;editing.resultOnly=false;markLearning();syncProgramStudyClock(p,true,true);return true;
}
function openCardReview(id){
  const p=current().programs.find(program=>program.id===id);if(!M.canReview(current(),p))return;
  editing={kind:'program',id,intro:false,showResult:false,resultOnly:false,entryAction:'card-review'};
  if(!startReview(p)){editing=null;return;}
  notify('복습 시작');if(!$('#learning').open)$('#learning').showModal();
}
function completionConfettiHTML(fresh){
  const confetti=fresh?`<div class="completion-confetti" aria-hidden="true">${Array.from({length:22},(_,i)=>`<i class="confetti-color-${i%4}" style="--x:${4+(i*37)%93}%;--drift:${((i*41)%150)-75}px;--turn:${(i%2?1:-1)*(220+i*31)}deg;--delay:${(i%7)*.075}s"></i>`).join('')}</div>`:'';
  return confetti;
}
function completionArt(passed,fresh){
  return completionConfettiHTML(fresh)+`<span class="completion-emblem" aria-hidden="true">${statusSVG(passed?'passed':'failed')}</span>`;
}
function programReviewHTML(p){
  const r=p.reviewSession,total=p.frames?.length||1;
  if(r.complete){const passed=!r.wrongFrames.length;return `<div class="program-result completion-result">${completionArt(passed,!!editing.justReviewed)}<span class="badge ${passed?'passed':'failed'}">복습 완료</span><h1 id="program-completion-title" tabindex="-1">${passed?'한 번 더 익혔어요!':'헷갈린 문제를 다시 확인해요.'}</h1><h3>${esc(p.name)}</h3>${programSummaryMetricsHTML(programResult(p,true))}<details class="review-answers"><summary>복습 문항 확인</summary>${r.answers.map((chosen,i)=>{const q=DEMO[i%3];return `<section class="review-answer"><strong>${i+1}번 · ${chosen===q.correct?'정답':'다시 살펴보기'}</strong><p>${q.text}</p>${choiceBoard(q,chosen,null,true)}</section>`;}).join('')}</details><div class="actions completion-actions"><button class="primary" data-action="close-learning">학습 목록으로</button><button data-action="learner-review">다시 복습하기</button></div></div>`;}
  const q=DEMO[r.index%3],chosen=r.answers[r.index];
  return `<p class="review-context">완료한 학습을 한 번 더 연습해요.</p><div class="review-progress"><span>복습 문항 ${r.index+1} / ${total}</span><progress max="${total}" value="${r.index+1}" aria-label="복습 문항 진행"></progress></div><div class="lesson-question"><p>${q.text}</p>${choiceBoard(q,chosen,'learner-answer')}${chosen!==undefined?`<p class="answer-feedback">${chosen===q.correct?'잘했어요!':'정답을 살펴보고 다음 문제를 풀어요.'}</p>`:''}<div class="actions"><button class="primary" data-action="learner-next" ${chosen===undefined?'disabled':''}>${r.index+1>=total?'복습 결과 보기':'다음 문항'}</button><button data-action="review-original">이전 학습 결과 보기</button></div></div>`;
}
function learnerDialogHTML(){
  const s=current();if(editing.kind==='diagnosis')return diagnosticScreenHTML(s);if(editing.kind==='diagnosis-result')return diagnosticResultHTML(s);
  const p=s.programs.find(p=>p.id===editing.id);if(!p)return '';
  const top=`<div class="diagnosis-screen-top program-screen-top"><button data-action="close-learning"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 5-5 5 5 5"/></svg>학습 목록</button><strong class="diagnosis-context"><span class="diagnosis-grade">${grade(state.grade)}등급</span><span>${esc(s.groupName)}</span></strong><span>${editing.reviewing?'복습':editing.showResult?'학습 결과':'맞춤 학습'}</span></div>`;
  const resultScreen=!editing.intro&&(editing.reviewing?!!p.reviewSession?.complete:editing.showResult||['passed','failed'].includes(p.status)||p.progress>=100);
  return top+`<div class="diagnosis-screen-body program-screen-body${resultScreen?' has-completion':''}${editing.intro?' diagnosis-intro program-intro intro-arrival':''}">${editing.intro?programIntroHTML(p):programContentHTML(p)}</div>`;
}
function programIntroHTML(p){
  const resume=p.status==='active',total=p.frames?.length||1;
  return `<div class="program-entry-art" aria-hidden="true"><svg viewBox="0 0 112 112" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle class="entry-halo" cx="56" cy="56" r="52" stroke="none"/><rect class="entry-paper" x="30" y="19" width="52" height="72" rx="12"/><path d="M43 36h26M43 46h17"/><path d="m44 65 8 8 16-18"/><circle class="entry-spark" cx="88" cy="29" r="5" stroke="none"/><path d="M19 72v10M14 77h10"/></svg></div><span class="badge">맞춤 학습 · ${total}문항</span><h1>${esc(p.name)}</h1><p>${resume?`${total}문항 중 ${p.completedFrames||0}문항을 마쳤어요.<br>풀던 문제부터 이어서 해 볼까요?`:'한 문제씩 천천히 풀어봐요.<br>중간에 나가도 이어서 할 수 있어요.'}</p><button class="primary program-entry-button" data-action="program-begin">${resume?'이어서 학습하기':'학습 시작하기'}</button>`;
}
function programContentHTML(p){
  const s=current();if(editing.reviewing&&p.reviewSession)return (p.reviewSession.complete?'':`<div class="program-lesson-title"><h2>${esc(p.name)}</h2></div>`)+programReviewHTML(p);
  if(editing.showResult||['passed','failed'].includes(p.status)||p.progress>=100){const original=p.initialResult||p,failed=original.status==='failed';return `<div class="program-result completion-result">${completionArt(!failed,!!editing.justCompleted)}${p.initialResult?'<small>첫 학습 결과</small>':''}<span class="badge ${failed?'failed':'passed'}">${failed?'미통과':'통과'}</span><h1 id="program-completion-title" tabindex="-1">${editing.justCompleted?'학습을 마쳤어요!':esc(p.name)}</h1><h3>${editing.justCompleted?esc(p.name):failed?'다시 살펴볼 문항이 있어요.':'학습을 마쳤어요!'}</h3>${programSummaryMetricsHTML(programResult(p))}${failed&&p.status==='passed'?'<p class="review-context">복습으로 통과했어요.</p>':''}<p class="review-context">다시 연습하고 싶다면 복습을 시작해요.</p><div class="actions completion-actions"><button class="primary" data-action="close-learning">학습 목록으로</button><button data-action="learner-review" ${M.canReview(s,p)?'':'disabled'}>${p.reviewSession&&!p.reviewSession.complete?'복습 이어하기':'복습하기'}</button></div></div>${programTestTools(p)}`;}
  const frame=p.completedFrames||0,total=p.frames?.length||1,q=DEMO[frame%3],chosen=p.demoChoice;
  return `<div class="program-lesson-title"><h2>${esc(p.name)}</h2></div><div class="diagnosis-progress"><span>문항 ${frame+1} / ${total}</span><progress max="${total}" value="${frame}" aria-label="학습 문항 진행"></progress></div><div class="lesson-question"><h1 id="program-question" tabindex="-1">${q.text}</h1>${choiceBoard(q,chosen,'learner-answer')}${chosen!==undefined?`<p class="answer-feedback">${chosen===q.correct?'잘했어요!':'다음에는 정답을 골라볼까요?'}</p>`:''}<div class="actions"><button class="primary" data-action="learner-next" ${chosen===undefined?'disabled':''}>${frame+1>=total?'결과 보기':'다음 문항'}</button></div></div>${programTestTools(p)}`;
}
function startProgram(p,review=false){if(!M.canStart(current(),p))return false;current().presentationPending=false;markLearning();current().attempts=(current().attempts||0)+1;normalize(p,'active');M.setProgress(p,0);p.wrongFrames=[];p.studyTiming??={};p.studyTiming.normal={elapsedMs:0,runningSince:Date.now()};delete p.demoChoice;editing.intro=false;editing.reviewing=review;editing.showResult=false;return true;}
function learningAction(act,b){if(!editing)return false;if(diagnosisOutcomeRun){if(act==='diagnosis-outcome-confirm'&&current().diagnosisOutcome.stage==='summary')setDiagnosisOutcomeStage(programOutcome()?'reward':diagnosisSummary(outcomeResult()).deficits?'searching':'reward');return true;}const s=current(),id=Number(b.dataset.id);if(editing.preparing&&['close-learning','diagnosis-leave','diagnosis-begin','diagnosis-answer','diagnosis-next'].includes(act))return true;if(editing.intro&&['learner-answer','learner-next','learner-review'].includes(act))return true;
if(act==='program-begin'){
  if(editing.kind!=='program'||!editing.intro)return true;const p=s.programs.find(x=>x.id===editing.id);if(!p||!M.canStart(s,p))return true;
  if(p.status==='idle'){if(!startProgram(p))return true;}else{editing.intro=false;p.wrongFrames??=[];markLearning();}syncProgramStudyClock(p,false,true);
  notify('맞춤 학습 시작');$('#program-question')?.focus({preventScroll:true});return true;
}
if(act==='diagnosis-begin'){startDiagnostic();return true;}if(act==='diagnosis-tool'){editing.tool=editing.tool===b.dataset.tool?null:b.dataset.tool;refreshDialog();return true;}if(act==='diagnosis-stay'){editing.confirmExit=false;refreshDialog();return true;}if(act==='diagnosis-leave'){closeLearning();return true;}if(act==='close-learning'&&editing.kind==='diagnosis'){if(editing.intro||editing.complete)closeLearning();else{editing.confirmExit=true;refreshDialog();}return true;}if(act==='result-goal'){editing.goal=id;editing.item=0;refreshDialog();return true;}if(act==='result-prev'||act==='result-next'){editing.item=Math.max(0,(editing.item||0)+(act==='result-prev'?-1:1));refreshDialog();return true;}
if(act==='diagnosis-answer'){s.diagnosticSession.answers[s.diagnosticSession.index]=id;save();refreshDialog();return true;}if(act==='diagnosis-next'){const session=s.diagnosticSession;if(session.answers[session.index]===undefined)return true;if(session.index<2){session.index++;save();refreshDialog();return true;}const background=diagnosticScreenHTML(s),incorrect=DEMO.filter((q,i)=>session.answers[i]!==q.correct).length;
  const result={questionCount:DEMO.length,incorrect,deficits:incorrect,seconds:Math.max(1,Math.round((Date.now()-session.started)/1000)),goals:DEMO.map((q,i)=>({title:q.title,area:q.area,questions:[{...q,chosen:session.answers[i]}]}))};
  beginDiagnosisOutcome(result,{background});return true;}
if(act==='learner-review'){const p=s.programs.find(x=>x.id===editing.id);if(startReview(p))notify('복습 시작');return true;}
if(act==='review-original'){recordProgram();daily().timerRunning=false;const p=s.programs.find(p=>p.id===editing.id);if(p)syncProgramStudyClock(p,true,false);editing.justCompleted=false;editing.justReviewed=false;editing.reviewing=false;editing.showResult=true;editing.resultOnly=true;save();refreshDialog();return true;}
if(act==='learner-answer'){const p=s.programs.find(x=>x.id===editing.id);if(editing.reviewing&&p?.reviewSession){const r=p.reviewSession;if(r.complete||r.answers[r.index]!==undefined||!Number.isInteger(id)||id<0||id>=DEMO[r.index%3].choices.length)return true;r.answers[r.index]=id;if(id!==DEMO[r.index%3].correct)r.wrongFrames.push(r.index);save();refreshDialog();return true;}if(p.demoChoice!==undefined)return true;p.demoChoice=id;const index=p.completedFrames||0;if(id!==DEMO[index%3].correct&&!p.wrongFrames.includes(index))p.wrongFrames.push(index);save();refreshDialog();return true;}
if(act==='learner-next'){const p=s.programs.find(x=>x.id===editing.id);if(editing.reviewing&&p?.reviewSession){const r=p.reviewSession;if(r.complete||r.answers[r.index]===undefined)return true;if(r.index+1<(p.frames?.length||1)){r.index++;notify('다음 복습 문항');}else{r.complete=true;r.completedAt=Date.now();r.result={status:r.wrongFrames.length?'failed':'passed',seconds:Math.max(1,Math.round((Date.now()-r.startedAt)/1000))};p.reviewCount=(p.reviewCount||0)+1;if(!r.wrongFrames.length){p.reviewed=true;s.reviewHistory=true;if(p.status==='failed')p.status='passed';}daily().timerRunning=false;editing.justReviewed=true;beginProgramOutcome(p,true);}return true;}if(p.demoChoice===undefined)return true;M.setProgress(p,((p.completedFrames||0)+1)/(p.frames?.length||1)*100);delete p.demoChoice;if(p.progress>=100){p.status=p.wrongFrames.length?'failed':'passed';daily().timerRunning=false;if(editing.reviewing){p.reviewed=p.status==='passed';s.reviewHistory=p.reviewed;}editing.justCompleted=true;editing.showResult=true;beginProgramOutcome(p);return true;}notify('다음 문항으로 이동');return true;}
return false;}

function startDiagnostic(){if(diagnosisOutcomeRun)return;const s=current();state.ui??={testControls:false};state.ui.diagnosisIntroSeen=true;editing.intro=false;if(s.diagnosis==='idle'){s.attempts=(s.attempts||0)+1;s.diagnosis='active';}s.diagnosticSession??={index:0,answers:[],started:Date.now(),notes:''};markLearning();save();render();refreshDialog();}
function openLearning(kind,id){
  if(diagnosisOutcomeRun)return;
  if(current().diagnosisOutcome&&resumeDiagnosisOutcome())return;
  if(kind==='program'&&!M.canStudy(current(),current().programs.find(p=>p.id===id)))return;
  if(kind==='diagnosis'&&current().diagnosis==='done'&&current().programs.length)dismissDiagnosisResultHint();else hideDiagnosisResultHint();
  clearPrescribedCardReveal();
  const s=current();if(kind==='diagnosis'&&s.diagnosis!=='done'){s.mentorDiagnosisEntries=(s.mentorDiagnosisEntries||0)+1;}if(kind==='diagnosis'&&s.diagnosis==='done')editing={kind:'diagnosis-result',goal:0,item:0};
  else{editing={kind,id};if(kind==='diagnosis'){state.ui??={testControls:false};editing.intro=s.diagnosis==='idle'&&!state.ui.diagnosisIntroSeen;if(!editing.intro)startDiagnostic();}
    else{const p=s.programs.find(x=>x.id===id);markMentorInterrupted(p);editing.showResult=p.progress>=100||['passed','failed'].includes(p.status);editing.resultOnly=editing.showResult;editing.intro=!editing.showResult;daily().timerRunning=false;}}
  save();render();refreshDialog();if(!$('#learning').open)$('#learning').showModal();
}
function refreshDialog(){
  if(!editing)return;const d=$('#learning');d.classList.remove('diagnosis-screen','diagnosis-result-dialog','program-screen','diagnosis-outcome-active','diagnosis-generating','diagnosis-preparing','diagnosis-summary-screen','diagnosis-collecting','program-outcome-screen');d.removeAttribute('aria-labelledby');
  if(editing.outcome){const stage=current().diagnosisOutcome.stage;d.classList.add('diagnosis-outcome-active');if(stage==='generating'){d.classList.add('diagnosis-generating');d.setAttribute('aria-label','맞춤 학습 생성 중');}else{d.removeAttribute('aria-label');if(isDiagnosisPreparation(stage))d.classList.add('diagnosis-preparing');if(stage==='summary')d.classList.add('diagnosis-summary-screen');if(programOutcome())d.classList.add('program-outcome-screen');if(stage==='collecting')d.classList.add('diagnosis-collecting');d.setAttribute('aria-labelledby',isDiagnosisPreparation(stage)?'composition-title':'diagnosis-outcome-title');}}
  if(['diagnosis','program'].includes(editing.kind))d.classList.add('diagnosis-screen');if(editing.kind==='program')d.classList.add('program-screen');
  if(editing.kind==='diagnosis-result')d.classList.add('diagnosis-result-dialog');
  const viewKey=learningViewKey(),changed=dialogViews.get(d)?.key!==viewKey;
  renderDialogView('#learning',learnerDialogHTML(),viewKey);if(editing.outcome){mountDiagnosisPreparation();mountDiagnosisFlight();}if(changed&&editing.kind==='program'){d.scrollTop=0;if(editing.justCompleted||editing.justReviewed)$('#program-completion-title')?.focus({preventScroll:true});}if(editing.complete)$('#pass-title')?.focus();
}
function closeLearning(){if(diagnosisOutcomeRun)return;if(editing?.kind==='program'){const p=current().programs.find(x=>x.id===editing.id);markMentorInterrupted(p);}const programId=editing?.kind==='program'?editing.id:null,entryAction=editing?.entryAction||'program';daily().timerRunning=false;recordProgram();save();editing=null;closeSurface('#learning');render();if(programId===null)document.querySelector('[data-action="diagnosis"]')?.focus({preventScroll:true});else restoreProgramCardFocus(programId,entryAction);}
function diagnosticScreenHTML(s){if(editing.outcome)return diagnosisOutcomeHTML();if(editing.preparing)return `<div class="diagnosis-screen-top"><span>실력알기 완료</span><strong class="diagnosis-context"><span class="diagnosis-grade">${grade(state.grade)}등급</span><span>${esc(s.groupName)}</span></strong><span>맞춤 학습 준비</span></div><div class="diagnosis-screen-body diagnosis-preparation" id="diagnosis-composition-slot"></div>`;const top=`<div class="diagnosis-screen-top"><button data-action="close-learning">← 학습 목록</button><strong class="diagnosis-context"><span class="diagnosis-grade">${grade(state.grade)}등급</span><span>${esc(s.groupName)}</span></strong><span>실력알기</span></div>`;if(editing.intro)return top+`<div class="diagnosis-screen-body diagnosis-intro intro-arrival"><span class="badge">3문항 · 예시 진단</span><h1>어디를 더 공부하면 좋을지 알아볼까요?</h1><p>혼자 힘으로 풀어 보세요.<br>중간에 나가도 이어서 할 수 있어요.</p><button class="primary" data-action="diagnosis-begin">실력알기 시작</button></div>`;if(editing.complete)return cleanPassHTML();if(editing.confirmExit)return top+`<div class="diagnosis-screen-body diagnosis-intro"><h1>잠시 쉬었다 할까요?</h1><p>지금까지 푼 내용은 저장돼요.<br>다시 누르면 이어서 할 수 있어요.</p><div class="actions pause-actions"><button class="text-button" data-action="diagnosis-leave">저장하고 나가기</button><button class="primary" data-action="diagnosis-stay">계속 풀기</button></div></div>`;const session=s.diagnosticSession,q=DEMO[session.index%3],chosen=session.answers[session.index];return top+`<div class="diagnosis-screen-body"><div class="diagnosis-progress"><span>문항 ${session.index+1} / 3</span><progress max="3" value="${session.index+1}" aria-label="진단 문항 진행"></progress></div><div class="lesson-question"><h1>${q.text}</h1>${choiceBoard(q,chosen,'diagnosis-answer')}<div class="actions"><button class="primary" data-action="diagnosis-next" ${chosen===undefined?'disabled':''}>${session.index===2?'진단 마치기':'다음 문항'}</button></div></div><div class="diagnosis-tools"><button data-action="diagnosis-tool" data-tool="notes" aria-expanded="${editing.tool==='notes'}">연습장</button><button data-action="diagnosis-tool" data-tool="help" aria-expanded="${editing.tool==='help'}">사용 방법</button></div>${editing.tool==='notes'?`<label class="diagnosis-notes">자유롭게 적어 보세요.<textarea id="diagnosis-notes" rows="5">${esc(session.notes||'')}</textarea></label>`:editing.tool==='help'?'<div class="learning-info">답을 하나 고른 뒤 다음 문항을 눌러요. 정답은 진단을 마친 후 결과에서 확인할 수 있어요.</div>':''}${diagnosticTestTools(s)}</div>`;}
function normalize(p,st){p.status=st;M.setProgress(p,['passed','failed'].includes(st)?100:st==='active'?(p.progress>=100?0:p.progress):0);p.reviewed=false;}
function count(input){const n=Number(input?.value);return Number.isFinite(n)?Math.max(1,Math.min(52,Math.round(n))):8;}
function resize(n){const s=current();s.diagnosis='done';s.programs=M.programs(n,state.grade,state.index).map((p,i)=>s.programs[i]||p);}
function select(g,i){const pendingOutcome=!!diagnosisOutcomeRun;cancelDiagnosisOutcome();if(pendingOutcome){editing=null;closeSurface('#learning');}mentorEntry++;cancelComposition();state.grade=g;state.index=i;presetIndex=null;editing=null;save();render();if(current().diagnosisOutcome)resumeDiagnosisOutcome();}
document.addEventListener('click',e=>{if(skyWasDragged&&e.target.closest('.sky-canvas')){skyWasDragged=false;return;}skyWasDragged=false;const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const act=b.dataset.action,id=Number(b.dataset.id),s=current();if(diagnosisOutcomeRun&&!['diagnosis-outcome-confirm','preset','draft-preset','reset-current','reset-all','replay-first','replay-repeat','replay-clean-pass','replay-composition','replay-program-pass','replay-program-fail','replay-resume-scroll','welcome-preview-first','welcome-preview-compact','welcome-preview-progress'].includes(act))return;if(act==='mentor-repeat'){animateMessage(true);return;}if(act==='mentor-read-back'||act==='mentor-read-next'){moveMentorReading(act==='mentor-read-next'?1:-1);return;}if(act==='pass-next'){continueCleanPass();return;}if(act==='pass-begin'){beginCleanPassNext();return;}if(act==='pass-summary'){if(isCleanPass(current())){current().cleanPassStage='celebrate';editing={kind:'diagnosis',complete:true,passStage:'celebrate'};save();refreshDialog();}return;}if(act==='pass-details'){if(isCleanPass(current())){editing={kind:'diagnosis-result',goal:0,item:0};refreshDialog();}return;}if(act==='failed-card'||act==='completed-card'){openCompletedCard(id);return;}if(act==='study-choice-review'||act==='study-choice-result'){chooseCompletedCard(act==='study-choice-review');return;}if(act==='card-review'){openCardReview(id);return;}if(!['preset','draft-preset','reset-current','reset-all','replay-first','replay-repeat','replay-clean-pass','replay-composition','replay-program-pass','replay-program-fail','replay-resume-scroll','welcome-preview-first','welcome-preview-compact','welcome-preview-progress'].includes(act)&&learningAction(act,b))return;if(draftAction(act,b))return;if(act==='test')openPanel('test');else if(act==='groups'){if(panel==='groups')closePanel();else openPanel('groups');}else if(act==='close-panel')closePanel();else if(act==='prev-grade'||act==='next-grade'){const grades=availableRailGrades(),next=grades[grades.indexOf(browseGrade)+(act==='prev-grade'?-1:1)];if(next!==undefined&&next!==browseGrade){browseGrade=next;renderPanel();alignRailToCurrent(true);syncRailOverflow();revealGroupPanel();focusNavigationAction(act);}}else if(act==='select-group'){if(!canNavigateTopic(state.grades[browseGrade]?.[id]))return;clearGroupPanelReveal();select(browseGrade,id);focusNavigationAction('select-group',id);}else if(act==='help')showHelp();else if(act==='close-help')closeSurface('#help');else if(act==='diagnosis')openLearning('diagnosis');else if(act==='program')openLearning('program',id);else if(act==='close-learning'){closeLearning();}else if(act==='recommend'){if(isCleanPass(current())){continueCleanPass();return;}const r=M.recommend(state);if(r.kind==='today')followRecommendation(M.learningRecommend(state));else if(['goal','answers','wrongnotes','report'].includes(r.kind))openActivity(r.kind);else followRecommendation(r);}else if(act==='preset'){loadValidationScenario(id);}else if(act==='replay-resume-scroll'){replayValidationResumeScroll();}else if(act==='resize'){resize(count($('#prescription-count')));notify('처방 프로그램 수 변경: '+s.programs.length);}else if(act==='all-pass'){if(!s.programs.length)resize(M.sourceCount(state.grade,state.index));s.programs.forEach(p=>{p.status='passed';M.setProgress(p,100);});notify('모든 프로그램 통과');}else if(act==='make-fail'){if(!s.programs.length)resize(M.sourceCount(state.grade,state.index));normalize(s.programs[0],'failed');notify('첫 프로그램 미통과 생성');}else if(act==='review-all'||act==='review-one'){s.programs.filter(p=>p.status==='failed'&&(act==='review-all'||p.id===id)).forEach(p=>{p.status='passed';M.setProgress(p,100);p.reviewed=true;s.reviewHistory=true;});notify('미통과 프로그램 복습 후 통과');}else if(act==='reset-current'){loadValidationScenario(0);}else if(act==='reset-all'){resetValidationSurfaces();state=M.create();browseGrade=state.grade;resetValidationHints(true);if(panel)closePanel();notify('전체 데이터와 정책 초기화');}else if(act==='diag-start'){markLearning();s.attempts=(s.attempts||0)+1;s.diagnosis='active';s.programs=[];notify('실력알기 시작');}else if(act==='diag-prescribe'){beginDiagnosisOutcome(validationDiagnosisResult(false),{count:count($('#diag-count')),preview:true});}else if(act==='diag-clean'){replayValidationCleanPass();}else if(act==='replay-program-pass'||act==='replay-program-fail'){replayValidationProgram(act==='replay-program-pass');}else if(act==='replay-clean-pass'){replayValidationCleanPass();}else if(['replay-composition','replay-first','replay-repeat'].includes(act)){replayValidationPrescription(act==='replay-first'?'first':act==='replay-repeat'?'repeat':undefined);}else if(act.startsWith('program-')){const p=s.programs.find(x=>x.id===editing?.id);if(!p||!M.canStudy(s,p))return;if(act==='program-retry'){if(M.currentProgram(s)?.id!==p.id)return;const k=s.groupId+':'+p.programId+':'+(p.completedFrames||0);daily().frameAttempts[k]=(daily().frameAttempts[k]||0)+1;notify('현재 프레임 반복 시도');return;}if(act==='program-frame'){if(M.currentProgram(s)?.id!==p.id)return;M.setProgress(p,((p.completedFrames||0)+1)/(p.frames.length||1)*100);if(p.progress>=100){daily().timerRunning=false;}notify('프레임 완료: '+p.completedFrames+' / '+p.frames.length);return;}if(act==='program-start'){if(!M.canStart(s,p))return;editing.intro=false;markLearning();s.attempts=(s.attempts||0)+1;editing.reviewing=p.status==='failed'||p.reviewed;normalize(p,'active');M.setProgress(p,0);}if(act==='program-pass'){daily().timerRunning=false;normalize(p,'passed');if(editing.reviewing){p.reviewed=true;s.reviewHistory=true;}}if(act==='program-fail'){daily().timerRunning=false;normalize(p,'failed');}if(act==='program-review'){p.status='passed';M.setProgress(p,100);p.reviewed=true;s.reviewHistory=true;}notify(p.name+' · '+M.labels[p.status]);}else if(act==='export'){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ai-math-test-state.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}});
document.addEventListener('change',e=>{if(diagnosisOutcomeRun)return;const t=e.target,s=current(),d=daily();if(t.id==='diagnosis-notes'){s.diagnosticSession.notes=t.value;save();}else if(t.id==='test-controls'){state.ui.testControls=t.checked;save();refreshDialog();renderPanel();}else if(t.id==='mentor-member'){state.profile.memberType=t.value==='trial'?'trial':'member';notify('말풍선 회원 유형 변경');}else if(t.id==='mentor-birthday'){state.profile.birthday=t.value;save();}else if(t.id==='learner-name'){state.profile.name=t.value.trim().slice(0,20)||'재능';notify('학습자 이름 변경');}else if(t.id==='daily-target'){d.target=Math.max(0,Math.min(120,Number(t.value)||0))||null;notify('목표시간 변경');}else if(t.id==='daily-minutes'){d.minutes=Math.max(0,Math.min(600,Number(t.value)||0));notify('학습시간 변경');}else if(t.id==='daily-answers'){d.unreadAnswers=Math.max(0,Math.min(99,Number(t.value)||0));notify('미확인 답변 수 변경');}else if(t.id==='group-attempts'){s.mentorDiagnosisEntries=Math.max(0,Number(t.value)||0);notify('실력알기 진입 횟수 변경');}else if(t.id==='clean-streak'){d.cleanStreak=Math.max(0,Number(t.value)||0);notify('연속 처방 없이 통과 횟수 변경');}else if(t.id==='test-grade')select(Number(t.value),0);else if(t.id==='test-group')select(state.grade,Number(t.value));else if(t.id==='diagnosis-state'){s.reviewHistory=false;if(t.value==='prescribed'){resize(s.programs.length||M.sourceCount(state.grade,state.index));}else{s.diagnosis=t.value==='clean'?'done':t.value;s.programs=[];}notify('진단 상태 직접 변경');}else if(t.dataset.programState!==undefined){normalize(s.programs[Number(t.dataset.programState)],t.value);notify('개별 프로그램 상태 변경');}else if(t.dataset.programProgress!==undefined){M.setProgress(s.programs[Number(t.dataset.programProgress)],Number(t.value));notify('개별 프로그램 진행률 변경');}else if(t.id==='learning-progress'){const p=s.programs.find(p=>p.id===editing?.id);if(!p||M.currentProgram(s)?.id!==p.id||p.progress>=100)return;M.setProgress(p,Number(t.value));if(p.progress>=100){d.timerRunning=false;}notify('학습 진행률 변경: '+t.value+'%');}else if(t.id.startsWith('policy-')){state.policy[t.id.slice(7)]=t.value;notify('프로토타입 가정 정책 변경');}});
$('#overlay').addEventListener('click',()=>{if(panel==='test')closePanel();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel&&!$('#learning').open&&!$('#help').open&&!$('#activity').open)closePanel();if(e.key==='Tab'&&panel==='test'&&!$('#learning').open&&!$('#help').open&&!$('#activity').open){const items=[...$('#'+(panel==='groups'?'group':'test')+'-panel').querySelectorAll('button:not(:disabled),select,input:not(:disabled),a,summary')];if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}}});$('#learning').addEventListener('cancel',e=>{if(editing?.kind==='diagnosis'){e.preventDefault();learningAction('close-learning',{dataset:{}});}});$('#learning').addEventListener('close',()=>{if(!$('#learning').open){if(diagnosisOutcomeRun)cancelDiagnosisOutcome();if(editing?.kind==='program'){const p=current().programs.find(x=>x.id===editing.id);markMentorInterrupted(p);}if(composing?.surface==='learning')cancelComposition();if(!guidanceClosing)holdGuidanceAfterClose();daily().timerRunning=false;recordProgram();save();editing=null;render();}});document.addEventListener('input',e=>{if(e.target.id==='diagnosis-notes'&&current().diagnosticSession){current().diagnosticSession.notes=e.target.value;save();}});const wasVisited=state.everVisited;daily();if(wasVisited&&!state.daily.started)state.daily.entry='today';save();if(current().diagnosisOutcome)resumeDiagnosisOutcome();setInterval(()=>{const d=daily();if(d.timerRunning&&document.visibilityState==='visible'&&(current().diagnosis==='active'||M.currentProgram(current())||activeReview())){d.minutes++;save();render();if(activityKind&&!skyBusy)renderActivity();}},60000);if(speechPolicy)setInterval(()=>{if(mainGuidanceVisible()){observeSpeech();if(bubblePhase==='rest')animateMessage();}},15000);render();

$('#activity').addEventListener('close',()=>{if(!$('#activity').open&&activityKind==='completed-study')dismissCompletedCard();if(activityKind!=='constellation'){activityKind=null;reportDate=null;}});$('#activity').addEventListener('cancel',e=>{if(activityKind==='constellation'){e.preventDefault();skyExit();}});document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.dataset?.action==='sky-detail'){e.preventDefault();skyAction('sky-detail',e.target);}});

document.addEventListener('input',e=>{if(e.target.id==='sky-query'){skyQuery=e.target.value.replace(/[^a-zA-Z가-힣\s]/g,'');e.target.value=skyQuery;$('#sky-search-results').innerHTML=searchResultsHTML();}});
document.addEventListener('pointerdown',e=>{if(activityKind!=='constellation'||skyDetail!==null||skyRun||skyBusy||!e.target.closest('.sky-canvas')||(skyState().guide&&skyState().guide!=='drag'))return;skyDrag={x:e.clientX,y:e.clientY,pan:{...skyPan},moved:false};});
document.addEventListener('pointermove',e=>{if(!skyDrag)return;const dx=e.clientX-skyDrag.x,dy=e.clientY-skyDrag.y;if(Math.abs(dx)+Math.abs(dy)>4)skyDrag.moved=true;const rect=$('#sky-canvas').getBoundingClientRect();skyPan={x:skyDrag.pan.x-dx*1000/(Math.max(1,rect.width)*skyZoom),y:skyDrag.pan.y-dy*600/(Math.max(1,rect.height)*skyZoom)};renderActivity();});
document.addEventListener('pointerup',()=>{if(!skyDrag)return;skyWasDragged=skyDrag.moved;if(skyDrag.moved&&skyState().guide==='drag')skyState().guide='tools';skyDrag=null;if(activityKind==='constellation')renderActivity();});
document.addEventListener('wheel',e=>{if(activityKind!=='constellation'||skyDetail!==null||skyRun||skyState().guide||!e.target.closest('.sky-canvas'))return;e.preventDefault();skyZoom=Math.max(.5,Math.min(2,skyZoom+(e.deltaY<0?.25:-.25)));renderActivity();},{passive:false});

$('#prescription').addEventListener('cancel',e=>e.preventDefault());compositionElement.addEventListener('click',()=>{if(composing?.step===2){composing.fastForward=true;composing.text=composing.message;renderComposition();}});

// Only surface periodic guidance on the visible learning overview; never interrupt a lesson or dialog.
document.addEventListener('click',syncGuidanceReminders);
document.addEventListener('visibilitychange',syncGuidanceReminders);
for(const id of ['learning','help','activity','prescription'])$('#'+id).addEventListener('close',()=>{if(!guidanceClosing)holdGuidanceAfterClose();else syncGuidanceReminders();});

// Observe the final state after the action handler, including a modal-to-main return.
document.addEventListener('click',syncMainResumeScroll);

document.addEventListener('click',observeDiagnosisWelcomeVisit);
document.addEventListener('visibilitychange',observeDiagnosisWelcomeVisit);
const welcomeGuideElement=$('#diagnosis-welcome-guide');
welcomeGuideElement.addEventListener('pointerenter',event=>{if(event.pointerType==='touch')return;welcomeGuideHover=true;syncWelcomeGuideClock();});
welcomeGuideElement.addEventListener('pointerleave',()=>{welcomeGuideHover=false;syncWelcomeGuideClock();});
welcomeGuideElement.addEventListener('focusin',()=>{welcomeGuideFocus=true;syncWelcomeGuideClock();});
welcomeGuideElement.addEventListener('focusout',event=>{if(event.relatedTarget&&welcomeGuideElement.contains(event.relatedTarget))return;welcomeGuideFocus=false;syncWelcomeGuideClock();});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',()=>{syncWelcomeGuideClock();if(welcomeGuideRun)renderWelcomeGuideSlide(welcomeGuideRun);});
window.addEventListener?.('pagehide',()=>{welcomeGuideSuspended=true;syncWelcomeGuideClock();});
window.addEventListener?.('pageshow',()=>{welcomeGuideSuspended=false;observeDiagnosisWelcomeVisit();});
$('#activity').addEventListener('close',()=>{
  if(activityKind==='diagnosis-guide'){activityKind=null;render();$('#diagnosis-help-trigger').focus({preventScroll:true});}
});
