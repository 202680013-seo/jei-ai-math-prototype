(function(root){
  'use strict';
  const KEY='jei-design-checkpoints:v1',STATE_KEY='ai-math-prototype-diagnosis-v1';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const designId=value=>/^v[1-9]\d*$/.test(value);
  function validateState(s){
    const counts=[7,9,13,19,27,32,40,47,57,78];
    if(!s||s.schema!=='diagnosis-v1'||!Array.isArray(s.grades)||s.grades.length!==10||!s.policy||!Number.isInteger(s.grade)||s.grade<0||s.grade>9||!Number.isInteger(s.index))throw new Error('저장한 학습 상태를 읽을 수 없어요.');
    if(!s.grades.every((groups,i)=>Array.isArray(groups)&&groups.length>=counts[i]&&groups.length<=Math.max(78,counts[i])&&groups.every(g=>g&&['idle','active','done'].includes(g.diagnosis)&&Array.isArray(g.programs))))throw new Error('학습 상태의 형식이 올바르지 않아요.');
    if(s.index<0||s.index>=s.grades[s.grade].length)throw new Error('저장한 진단 그룹을 찾을 수 없어요.');
    return s;
  }
  function validateRecord(r){
    if(!r||!/^cp-[a-zA-Z0-9-]+$/.test(r.id)||!designId(r.versionId)||!designId(r.familyId)||typeof r.title!=='string'||r.title.length>100||!Number.isFinite(Date.parse(r.createdAt))||!['main','mypage'].includes(r.view))throw new Error('저장 기록의 형식이 올바르지 않아요.');
    validateState(r.appState);return r;
  }
  function createStore(storage){
    function read(){
      let raw;try{raw=storage?.getItem(KEY);}catch{throw new Error('이 브라우저에서 저장 기록에 접근할 수 없어요.');}
      if(!raw)return [];
      let data;try{data=JSON.parse(raw);}catch{throw new Error('저장 기록이 손상되어 읽을 수 없어요. 기존 기록은 그대로 두었어요.');}
      if(data.schema!==1||!Array.isArray(data.records))throw new Error('지원하지 않는 저장 기록이에요.');
      data.records.forEach(validateRecord);return data.records;
    }
    function write(records){
      if(!storage)throw new Error('브라우저 저장소를 사용할 수 없어 저장하지 못했어요.');
      try{storage.setItem(KEY,JSON.stringify({schema:1,records}));}catch{throw new Error('저장 공간이 부족하거나 저장이 차단됐어요. 기존 기록을 지운 후 다시 시도해 주세요.');}
    }
    return {
      list:()=>clone(read()),
      get:id=>{const found=read().find(r=>r.id===id);return found?clone(found):null;},
      add(input){
        const records=read();if(records.length>=40)throw new Error('기록은 40개까지 저장할 수 있어요. 필요 없는 기록을 먼저 지워 주세요.');
        const r=validateRecord({id:'cp-'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),versionId:input.versionId,familyId:input.familyId,title:(input.title||'이름 없는 저장').trim().slice(0,100),createdAt:new Date().toISOString(),view:input.view==='mypage'?'mypage':'main',kind:input.kind==='backup'?'backup':'manual',appState:clone(input.appState)});
        records.unshift(r);write(records);return clone(r);
      },
      remove(id){const records=read();write(records.filter(r=>r.id!==id));}
    };
  }
  function route(versionId,checkpointId){
    if(!designId(versionId))throw new Error('잘못된 디자인 버전이에요.');
    if(checkpointId&&!/^cp-[a-zA-Z0-9-]+$/.test(checkpointId))throw new Error('잘못된 저장 기록이에요.');
    return '/views/'+versionId+'.html'+(checkpointId?'?checkpoint='+encodeURIComponent(checkpointId):'');
  }
  const api={KEY,STATE_KEY,validateState,validateRecord,createStore,route};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JeiHistory=api;
})(typeof window!=='undefined'?window:globalThis);
