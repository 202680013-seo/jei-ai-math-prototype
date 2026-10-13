(function(){
  'use strict';const config=window.__JEI_REVIEW__;
  if(config.scenario!=='keep'){
    state=M.create();browseGrade=state.grade;M.preset(state,Number(config.scenario));presetIndex=Number(config.scenario);editing=null;render();save();
  }
  if(config.restored?.view==='mypage')openMy();
  // Only the review adapter reads learner state; immutable design sources stay untouched.
  window.__JEI_REVIEW_BRIDGE__={capture(){
    if(composing||skyBusy||skyRun)throw new Error('화면 전환이 끝난 뒤 저장해 주세요.');
    return {appState:JSON.parse(JSON.stringify(state)),view:myOpen?'mypage':'main'};
  }};
  // The UI is usable immediately. No readiness message or click-blocking loading layer.
})();
