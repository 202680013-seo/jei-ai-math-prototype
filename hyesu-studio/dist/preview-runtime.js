(function(){
  'use strict';
  // Isolate simulation state without changing the saved prototype source.
  const id=document.currentScript.dataset.version;
  if(!/^(working|v[1-9]\d*)$/.test(id))throw new Error('Unknown design version.');
  const scenario=new URLSearchParams(location.search).get('scenario');
  const config=window.__JEI_REVIEW__={id,designId:document.currentScript.dataset.designId||id,scenario:['0','3','4','5','6','many','scroll20'].includes(scenario)?scenario:'keep'},prefix=`jei-review:${id}:`,memory=new Map();let native;
  try{native=window.localStorage;}catch{}
  if(window.JeiHistory)window.__JEI_HISTORY_STORE__=window.JeiHistory.createStore(native);
  if(config.id==='working'&&native){try{const marker='jei-review:migrated:working',key='ai-math-prototype-diagnosis-v1';if(!native.getItem(marker)){const legacy=native.getItem(key);if(legacy!=null&&native.getItem(prefix+key)==null)native.setItem(prefix+key,legacy);native.setItem(marker,'1');}}catch{}}
  const keys=()=>{if(!native)return [...memory.keys()];try{return Array.from({length:native.length},(_,i)=>native.key(i)).filter(k=>k?.startsWith(prefix)).map(k=>k.slice(prefix.length));}catch{return [...memory.keys()];}};
  const scoped={
    getItem(key){key=String(key);try{const value=native?.getItem(prefix+key);if(value!=null)return value;}catch{}return memory.get(key)??null;},
    setItem(key,value){key=String(key);value=String(value);memory.set(key,value);try{native?.setItem(prefix+key,value);}catch{}},
    removeItem(key){key=String(key);memory.delete(key);try{native?.removeItem(prefix+key);}catch{}},
    clear(){for(const key of keys())this.removeItem(key);},key(index){return keys()[index]??null;},get length(){return keys().length;}
  };Object.defineProperty(window,'localStorage',{configurable:true,value:scoped});
  // Restore a pinned design's checkpoint before the original application reads its state.
  const checkpoint=new URLSearchParams(location.search).get('checkpoint');
  if(checkpoint){
    config.scenario='keep';
    try{
      const record=window.__JEI_HISTORY_STORE__?.get(checkpoint);
      if(!record||record.versionId!==config.designId)throw new Error('이 브라우저에 해당 저장 기록이 없어요. 현재 상태는 유지했어요.');
      scoped.setItem(window.JeiHistory.STATE_KEY,JSON.stringify(record.appState));config.restored=record;
    }catch(error){config.restoreError=error.message;}
    // Refresh must keep subsequent learning changes instead of applying the checkpoint again.
    if(window.history?.replaceState){const url=new URL(location.href);url.searchParams.delete('checkpoint');url.searchParams.delete('scenario');window.history.replaceState(null,'',url.pathname+url.search+url.hash);}
  }
})();
