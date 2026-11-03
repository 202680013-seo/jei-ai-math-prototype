(function(){
  'use strict';const config=window.__JEI_REVIEW__;
  if(config.scenario!=='keep'){
    state=M.create();browseGrade=state.grade;
    if(['many','scroll20'].includes(config.scenario)){
      const expanded=config.scenario==='scroll20';
      if(expanded){state.grade=3;state.index=1;browseGrade=state.grade;state.grades[3][0].diagnosis='done';}
      const topic=state.grades[state.grade][state.index];topic.diagnosis='done';topic.programs=M.programs(expanded?20:12,state.grade,state.index);
      topic.programs.slice(0,2).forEach(program=>{program.status='passed';M.setProgress(program,100);});
      topic.programs[2].status='active';M.setProgress(topic.programs[2],45);
      topic.recent='확인용 상태 · 학습 카드 '+topic.programs.length+'개';presetIndex=-1;
      daily().target=20;daily().started=true;
    }else{M.preset(state,Number(config.scenario));presetIndex=Number(config.scenario);}
    editing=null;render();save();
  }
  if(config.restored?.view==='mypage')openMy();
  // Only the review adapter reads learner state; immutable design sources stay untouched.
  window.__JEI_REVIEW_BRIDGE__={capture(){
    if(composing||skyBusy||skyRun||(typeof cleanMove!=='undefined'&&cleanMove&&!cleanMove.paused))throw new Error('화면 전환이 끝난 뒤 저장해 주세요.');
    return {appState:JSON.parse(JSON.stringify(state)),view:myOpen?'mypage':'main'};
  }};
  // The UI is usable immediately. No readiness message or click-blocking loading layer.
})();
