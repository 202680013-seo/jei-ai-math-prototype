(function(){
 'use strict';
 const key='ai-math-prototype-diagnosis-v1';
 // Explicit review scenarios/checkpoints remain intentional; normal report entries restart.
 if(window.__JEI_REVIEW__?.scenario!=='keep'||window.__JEI_REVIEW__?.restored)return;
 function reset(){
  const s=MathModel.create(),topic=s.grades[3][0];topic.diagnosis='done';topic.programs=MathModel.programs(8,3,0);
  topic.programs.slice(0,7).forEach(p=>{p.status='passed';MathModel.setProgress(p,100);p.wrongFrames=[];});
  s.reportStartRevision=3;
  s.ui={diagnosisWelcomeSeen:true,diagnosisIntroSeen:false,passedCardHintSeen:false,failedCardHintSeen:true,diagnosisResultHintSeen:true};
  topic.recent='보고용 V1 · 마지막 학습 시작';localStorage.setItem(key,JSON.stringify(s));
 }
 try{reset();}catch{}
 let away=false,reloading=false;
 const reopen=()=>{if(reloading)return;reloading=true;window.location.reload();};
 // A cached browser return does not execute scripts again, so request a fresh entry.
 window.addEventListener?.('pageshow',event=>{if(event.persisted)reopen();});
 // Home-screen web apps can remain alive after closing to the launcher.
 const standalone=window.matchMedia?.('(display-mode: standalone)').matches||window.navigator?.standalone===true;
 if(standalone)document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden')away=true;
  else if(document.visibilityState==='visible'&&away)reopen();
 });
})();
