(function(){
  'use strict';
  // Open the supplied Figma example once; real progress and explicit test scenarios win.
  if(document.documentElement.getAttribute('data-v4-standalone')!=='true')return;
  if(window.__JEI_REVIEW__?.scenario!=='keep')return;
  const key='ai-math-prototype-diagnosis-v1';
  try{
    if(localStorage.getItem(key))return;
    const state=MathModel.create(),topic=state.grades[3][0];topic.diagnosis='done';topic.programs=MathModel.programs(8,3,0);
    [topic.programs[0],topic.programs[1],topic.programs[2]]=[topic.programs[1],topic.programs[2],topic.programs[0]];
    topic.programs[0].status='passed';MathModel.setProgress(topic.programs[0],100);
    topic.programs[1].status='failed';MathModel.setProgress(topic.programs[1],100);
    topic.programs[2].status='active';MathModel.setProgress(topic.programs[2],50);
    topic.recent='V4.2 · 피그마 메인 화면';
    state.ui={passedCardHintSeen:true,failedCardHintSeen:true,diagnosisResultHintSeen:true};
    localStorage.setItem(key,JSON.stringify(state));
  }catch{}
})();
