(function(){
 'use strict';
 const key='ai-math-prototype-diagnosis-v1';
 try{
  if(localStorage.getItem(key)||window.__JEI_REVIEW__?.scenario!=='keep')return;
  const s=MathModel.create(),topic=s.grades[3][0];topic.diagnosis='done';topic.programs=MathModel.programs(8,3,0);
  [topic.programs[0],topic.programs[1],topic.programs[2]]=[topic.programs[1],topic.programs[2],topic.programs[0]];
  topic.programs[0].status='passed';MathModel.setProgress(topic.programs[0],100);
  topic.programs[1].status='failed';MathModel.setProgress(topic.programs[1],100);
  topic.programs[2].status='active';MathModel.setProgress(topic.programs[2],50);
  s.ui={diagnosisWelcomeSeen:true,diagnosisIntroSeen:true,passedCardHintSeen:false,failedCardHintSeen:true,diagnosisResultHintSeen:true};
  topic.recent='보고용 V1 · 대표 학습 화면';localStorage.setItem(key,JSON.stringify(s));
 }catch{}
})();
