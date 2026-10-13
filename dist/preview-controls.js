(function(){
  'use strict';const config=window.__JEI_REVIEW__;
  if(config.scenario!=='keep'){
    state=M.create();browseGrade=state.grade;M.preset(state,Number(config.scenario));presetIndex=Number(config.scenario);editing=null;render();save();
  }
  // The UI is usable immediately. No readiness message or click-blocking loading layer.
})();
