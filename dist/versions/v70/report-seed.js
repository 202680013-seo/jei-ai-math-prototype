(function(){
 'use strict';
 const key='ai-math-prototype-diagnosis-v1',revision=2;
 try{
  if(window.__JEI_REVIEW__?.scenario!=='keep')return;
  const previous=localStorage.getItem(key);let saved=null;try{saved=JSON.parse(previous);}catch{}
  if(saved?.reportStartRevision===revision)return;
  // Apply the newly requested demo once, then keep all subsequent learning progress.
  if(previous)try{const backup=key+'-before-report-start-v2';if(!localStorage.getItem(backup))localStorage.setItem(backup,previous);}catch{}
  const s=MathModel.create(),topic=s.grades[3][0];topic.diagnosis='done';topic.programs=MathModel.programs(8,3,0);
  topic.programs.slice(0,7).forEach(p=>{p.status='passed';MathModel.setProgress(p,100);p.wrongFrames=[];});
  s.reportStartRevision=revision;
  s.ui={diagnosisWelcomeSeen:true,diagnosisIntroSeen:false,passedCardHintSeen:false,failedCardHintSeen:true,diagnosisResultHintSeen:true};
  topic.recent='보고용 V1 · 마지막 학습 시작';localStorage.setItem(key,JSON.stringify(s));
 }catch{}
})();
