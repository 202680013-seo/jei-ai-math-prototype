(async function(){
  'use strict';
  const config=window.__JEI_REVIEW__,H=window.JeiHistory,store=window.__JEI_HISTORY_STORE__,bridge=window.__JEI_REVIEW_BRIDGE__;
  if(!config||!H||!bridge)return;
  let registry,currentVersion,family,noticeTimer;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const dialog=el('dialog');dialog.id='jei-history-dialog';dialog.setAttribute('aria-labelledby','rh-title');
  dialog.innerHTML='<div class="rh-head"><div><span class="rh-eyebrow">DESIGN HISTORY</span><h2 id="rh-title">변경 기록</h2></div><button type="button" class="rh-close" aria-label="변경 기록 닫기">×</button></div><div class="rh-content"><p class="rh-summary"></p><section class="rh-save-box"><label for="rh-name">현재 상태 저장</label><div class="rh-save-row"><input id="rh-name" maxlength="100" placeholder="저장 이름 (선택)" autocomplete="off"><button type="button" class="rh-commit rh-primary">저장</button></div><p>디자인 버전과 학습 상태를 이 브라우저에 저장해요. 다른 기기와 동기화되지는 않아요.</p></section><p class="rh-status" role="status" aria-live="polite" hidden></p><section><h3>디자인 변경 이력</h3><p class="rh-help">항목을 누르면 해당 디자인으로 돌아가요. 돌아가기 전 현재 상태도 자동 저장해요.</p><div class="rh-revisions"></div></section><section><h3>내 저장 기록 <span class="rh-count"></span></h3><p class="rh-help">저장 당시의 디자인과 진단·학습 진행 상태를 함께 불러와요.</p><div class="rh-checkpoints"></div></section><a class="rh-workspace" href="/" target="_top">전체 버전·비교 화면 열기 ↗</a></div>';
  const notice=el('div');notice.id='jei-history-notice';notice.hidden=true;notice.setAttribute('role','status');
  document.body.append(dialog,notice);
  const q=s=>dialog.querySelector(s),inWorkspace=window.parent!==window&&/^jei-review-(left|right)$/.test(window.name);
  function notifyWorkspace(type){if(inWorkspace)window.parent.postMessage({type},location.origin);}
  function report(text,error=false){q('.rh-status').textContent=text;q('.rh-status').hidden=false;q('.rh-status').classList.toggle('is-error',error);notice.textContent=text;notice.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.hidden=true,4500);}
  function date(value){return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));}
  function capture(title,kind='manual'){
    if(!currentVersion)throw new Error('디자인 정보를 불러온 뒤 저장할 수 있어요.');
    if(config.id==='working'&&config.designId==='working')throw new Error('수정 중인 디자인은 게시가 완료된 뒤 저장할 수 있어요.');
    const snapshot=bridge.capture();
    if(kind==='backup'){
      const latest=store.list()[0];
      if(latest&&latest.versionId===currentVersion.id&&latest.view===snapshot.view&&JSON.stringify(latest.appState)===JSON.stringify(snapshot.appState))return latest;
    }
    return store.add({versionId:currentVersion.id,familyId:family,title:title||`${currentVersion.label} · ${date(new Date())}`,kind,...snapshot});
  }
  function navigate(versionId,checkpoint){
    H.route(versionId,checkpoint); // Reject invalid targets before saving or navigating.
    if(window.parent!==window&&/^jei-review-(left|right)$/.test(window.name)){
      window.parent.postMessage({type:'jei-history-navigate',versionId,checkpoint:checkpoint||null},location.origin);
    }else location.assign(H.route(versionId,checkpoint));
  }
  function go(versionId,checkpoint){
    try{
      if(!registry.versions.some(v=>v.id===versionId))throw new Error('이 디자인 버전을 찾을 수 없어요.');
      if(checkpoint){const saved=store.get(checkpoint);if(!saved||saved.versionId!==versionId)throw new Error('이 저장 기록을 찾을 수 없어요.');}
      capture('돌아가기 전 자동 저장','backup');navigate(versionId,checkpoint);
    }catch(error){report(error.message,true);}
  }
  function renderRecords(){
    const list=q('.rh-checkpoints');list.replaceChildren();
    try{
      const records=store.list().filter(r=>r.familyId===family);q('.rh-count').textContent=String(records.length);
      if(!records.length){list.append(el('p','rh-empty','아직 저장한 기록이 없어요. 위의 저장 버튼으로 첫 기록을 남겨보세요.'));return;}
      for(const record of records){
        const version=registry.versions.find(v=>v.id===record.versionId),card=el('article','rh-record'),button=el('button','rh-restore');button.type='button';button.setAttribute('aria-label',record.title+' 상태로 돌아가기');
        button.append(el('span','rh-record-kind',record.kind==='backup'?'자동 저장':'직접 저장'),el('strong','',record.title),el('small','',`${version?.label||record.versionId} · ${date(record.createdAt)}`),el('span','rh-return','이 상태로 돌아가기 ↶'));button.addEventListener('click',()=>go(record.versionId,record.id));
        const remove=el('button','rh-delete','삭제');remove.type='button';remove.setAttribute('aria-label',record.title+' 기록 삭제');
        remove.addEventListener('click',()=>{if(remove.dataset.confirm!=='yes'){remove.dataset.confirm='yes';remove.textContent='한 번 더 눌러 삭제';return;}try{store.remove(record.id);renderRecords();report('저장 기록을 삭제했어요.');}catch(error){report(error.message,true);}});
        card.append(button,remove);list.append(card);
      }
    }catch(error){list.append(el('p','rh-error',error.message));q('.rh-count').textContent='';}
  }
  function renderRevisions(){
    const list=q('.rh-revisions');list.replaceChildren();
    for(const version of [...registry.versions].reverse().filter(v=>(v.family||v.id)===family)){
      const button=el('button','rh-revision');button.type='button';button.setAttribute('aria-current',String(version.id===currentVersion.id));
      const heading=el('span','rh-revision-heading');heading.append(el('strong','',version.label),el('span','',version.id===currentVersion.id?'현재 디자인':'이 디자인으로 돌아가기 ↶'));
      button.append(heading,el('b','',version.title),el('small','',version.createdAt?date(version.createdAt):version.date.replaceAll('-','.')));
      const changes=el('ul');version.changes.forEach(change=>changes.append(el('li','',change)));button.append(changes);
      button.disabled=version.id===currentVersion.id;button.addEventListener('click',()=>go(version.id));list.append(button);
    }
  }
  function open(){if(registry&&currentVersion)renderRecords();if(!dialog.open)dialog.showModal();notifyWorkspace('jei-history-opened');}
  // Only the owning review pane can open history. Standalone learner views stay free of review buttons.
  window.addEventListener('message',event=>{if(inWorkspace&&event.source===window.parent&&event.origin===location.origin&&event.data?.type==='jei-history-open')open();});
  q('.rh-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>notifyWorkspace('jei-history-closed'));
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  function commit(){try{const saved=capture(q('#rh-name').value);q('#rh-name').value='';renderRecords();report('“'+saved.title+'” 저장했어요.');}catch(error){report(error.message,true);}}
  q('.rh-commit').addEventListener('click',commit);q('#rh-name').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commit();}});
  window.addEventListener('storage',event=>{if(event.key===H.KEY&&registry)renderRecords();});
  try{
    const response=await fetch('/versions.json',{cache:'no-store'});if(!response.ok)throw new Error('변경 이력을 불러오지 못했어요. 화면을 새로고침해 주세요.');registry=await response.json();
    currentVersion=registry.versions.find(v=>v.id===config.designId)||registry.versions.find(v=>v.id===registry.working.basedOn);if(!currentVersion)throw new Error('현재 디자인의 이력을 찾을 수 없어요.');family=currentVersion.family||currentVersion.id;
    q('#rh-title').textContent=(registry.versions.find(v=>v.id===family)?.label||currentVersion.label)+' 변경 기록';q('.rh-summary').textContent=currentVersion.label+' · '+currentVersion.title;q('.rh-workspace').href='/?view=single&left='+currentVersion.id;
    renderRevisions();renderRecords();
    if(config.restoreError)report(config.restoreError,true);else if(config.restored)report('“'+config.restored.title+'” 상태로 돌아왔어요.');
  }catch(error){q('.rh-summary').textContent=error.message;q('.rh-commit').disabled=true;report(error.message,true);}
  finally{notifyWorkspace('jei-history-ready');}
})();
