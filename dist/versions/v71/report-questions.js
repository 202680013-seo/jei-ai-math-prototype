(function(root){
 'use strict';
 const items=[
  {title:'모양 알기',area:'도형',text:'동그라미를 골라요.',choices:[{shape:'circle',label:'동그라미'},{shape:'square',label:'정사각형'},{shape:'triangle',label:'세모'},{shape:'rectangle',label:'직사각형'}],correct:0},
  {title:'수의 크기 비교',area:'수',text:'가장 큰 수를 골라요.',choices:[{label:'3'},{label:'8'},{label:'2'},{label:'5'}],correct:1}
 ];
 items.forEach(q=>{q.choices.forEach(Object.freeze);Object.freeze(q.choices);Object.freeze(q);});Object.freeze(items);
 const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
 function program(p){
  if(p.reportQuestionVersion===1&&p.frames?.length===items.length)return p;
  const oldIndex=p.completedFrames||0,complete=p.progress>=100||['passed','failed'].includes(p.status);
  p.reportOriginalQuestionState??=clone({frames:p.frames,completedFrames:p.completedFrames,progress:p.progress,wrongFrames:p.wrongFrames,initialResult:p.initialResult,completionResult:p.completionResult,reviewSession:p.reviewSession});
  p.frames=items.map((q,i)=>({frameId:'REPORT-Q'+(i+1),name:q.title,reportSample:true}));
  p.completedFrames=complete?2:p.progress>0?1:0;p.progress=p.completedFrames*50;
  p.wrongFrames=(p.wrongFrames||[]).filter(i=>i<2);
  if(complete&&p.status==='failed'&&!p.wrongFrames.length)p.wrongFrames=[1];
  if(oldIndex>1)delete p.demoChoice;
  if(p.initialResult){p.initialResult.wrongFrames=(p.initialResult.wrongFrames||[]).filter(i=>i<2);if(p.initialResult.status==='failed'&&!p.initialResult.wrongFrames.length)p.initialResult.wrongFrames=[1];}
  if(p.completionResult){p.completionResult.questionCount=2;p.completionResult.incorrect=p.wrongFrames.length;}
  if(p.reviewSession){const r=p.reviewSession;r.answers=(r.answers||[]).slice(0,2);r.index=Math.min(1,r.index||0);r.wrongFrames=r.answers.flatMap((a,i)=>a===items[i].correct?[]:[i]);if(r.complete&&r.result){r.result.status=r.wrongFrames.length?'failed':'passed';r.result.questionCount=2;r.result.incorrect=r.wrongFrames.length;}}
  p.reportQuestionVersion=1;return p;
 }
 function prepare(state){
  for(const topics of state.grades)for(const topic of topics){
   const session=topic.diagnosticSession;
   if(session&&(session.index>1||session.answers?.length>2)){topic.reportOriginalDiagnosticSession??=clone(session);session.index=Math.min(1,session.index);session.answers=(session.answers||[]).slice(0,2);}
   const result=topic.diagnosticResult;
   if(result&&result.questionCount!==2){
    topic.reportOriginalDiagnosticResult??=clone(result);
    const wrong=Math.min(2,Math.max(0,result.incorrect||0));
    result.questionCount=2;result.incorrect=wrong;result.deficits=wrong;
    result.goals=items.map((q,i)=>({title:q.title,area:q.area,questions:[{...clone(q),chosen:i<wrong?(q.correct+1)%q.choices.length:q.correct}]}));
   }
   topic.programs.forEach(program);
  }
  return state;
 }
 const api={items,program,prepare};root.JeiReportQuestions=api;if(typeof module==='object')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
