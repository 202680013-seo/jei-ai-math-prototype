(function(){
  'use strict';
  // The iPad entry opens with the supplied screen once, then keeps real progress.
  if(document.documentElement.getAttribute('data-v4-standalone')!=='true')return;
  if(window.__JEI_REVIEW__?.scenario!=='keep')return;
  const key='ai-math-prototype-diagnosis-v1';
  try{
    if(localStorage.getItem(key))return;
    const state=MathModel.create(),topic=state.grades[3][0];topic.diagnosis='done';topic.programs=MathModel.programs(8,3,0);
    [topic.programs[0],topic.programs[1]]=[topic.programs[1],topic.programs[0]];
    topic.programs[0].status='passed';MathModel.setProgress(topic.programs[0],100);
    topic.programs[1].status='active';MathModel.setProgress(topic.programs[1],50);
    topic.recent='V4 · 컬러 적용 화면';
    state.ui={passedCardHintSeen:true,failedCardHintSeen:false,diagnosisResultHintSeen:true};
    localStorage.setItem(key,JSON.stringify(state));
  }catch{}
})();
