(function(){
  'use strict';const config=window.__JEI_REVIEW__;
  if(config.scenario!=='keep'){
    state=M.create();browseGrade=state.grade;M.preset(state,Number(config.scenario));presetIndex=Number(config.scenario);editing=null;render();save();
  }
  window.parent.postMessage({type:config.hasError?'jei-review-error':'jei-review-ready'},location.origin);
})();
