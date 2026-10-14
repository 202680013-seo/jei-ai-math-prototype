(async function(){
  'use strict';const $=s=>document.querySelector(s),R=ReviewModel,T=JeiTheme;let data,state,observer,toastTimer;const pendingRoutes={};
  const icon={working:'<path d="m14 4 6 6M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z"/>',saved:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>'};
  function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
  function glyph(content){const node=document.createElementNS('http://www.w3.org/2000/svg','svg');node.setAttribute('viewBox','0 0 24 24');node.setAttribute('aria-hidden','true');node.innerHTML=content;return node;}
  let sidebarOpen=false,sidebarSmall=false,desktopSidebarOpen=true;
  const sidebarPreference='jei-review-sidebar-desktop';
  function smallScreen(){return window.matchMedia?.('(max-width: 650px)').matches??(window.innerWidth||1200)<=650;}
  function savedSidebarOpen(){try{return window.localStorage?.getItem(sidebarPreference)!=='closed';}catch{return true;}}
  function setSidebar(open,{persist=true,focus=false}={}){
    sidebarOpen=!!open;const small=smallScreen(),sidebar=$('#sidebar'),toggle=$('#menu-toggle');
    sidebar.hidden=!sidebarOpen;sidebar.inert=!sidebarOpen;sidebar.classList.toggle('is-open',sidebarOpen);sidebar.setAttribute('aria-hidden',String(!sidebarOpen));
    $('.app-layout').classList.toggle('sidebar-collapsed',!small&&!sidebarOpen);
    toggle.setAttribute('aria-expanded',String(sidebarOpen));toggle.setAttribute('aria-label',sidebarOpen?'버전 관리 패널 닫기':'버전 관리 패널 열기');
    $('#sidebar-backdrop').hidden=!(small&&sidebarOpen);
    if(persist&&!small){desktopSidebarOpen=sidebarOpen;try{window.localStorage?.setItem(sidebarPreference,sidebarOpen?'open':'closed');}catch{}}
    if(focus)(sidebarOpen?$('#close-sidebar'):toggle).focus?.({preventScroll:true});
    // Resize existing frames only: toggling the panel must never reload an in-progress lesson.
    requestAnimationFrame(sizeFrames);
  }
  function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,3200);}
  function activeId(){return state.mode==='compare'?state.right:state.left;}
  function updateUrl(push=false){history[push?'pushState':'replaceState'](null,'','?'+R.query(state));}
  function themeRoute(route){const [path,query='']=route.split('?'),params=new URLSearchParams(query);if(state.color)params.set('color',state.color);else params.delete('color');return path+(params.size?'?'+params.toString():'');}
  function sendTheme(frame){frame.contentWindow?.postMessage({type:'jei-theme-preview',color:state.color},location.origin);}
  function syncThemeControls(){const color=state.color||T.DEFAULT;$('#theme-color').value=color;$('#theme-hex').value=color.toUpperCase();$('#theme-preset').value=Object.entries(T.PRESETS).find(([,v])=>v===color)?.[0]||'custom';}
  function changeTheme(value){const color=R.normalizeColor(value);if(!color)return false;state.color=color===T.DEFAULT?null:color;updateUrl();syncThemeControls();document.querySelectorAll('.preview-pane').forEach(pane=>{sendTheme(pane.querySelector('iframe'));const link=pane.querySelector('.open-link');link.href=R.previewUrl(link.dataset.version,state.scenario,state.color);});return true;}
  function renderSidebar(){
    const list=$('#version-list');list.replaceChildren();R.entries(data).forEach((v,index)=>{if(index===1)list.append(el('div','nav-label','보관한 시안'));const button=el('button','version-option');button.type='button';button.dataset.version=v.id;button.setAttribute('aria-current',String(v.id===activeId()));const symbol=el('span','version-icon');symbol.append(glyph(v.id==='working'?icon.working:icon.saved));const copy=el('span','version-copy');copy.append(el('strong','',v.id==='working'?v.label:`${v.label} · ${v.title}`),el('small','',v.id==='working'?v.title:v.date.replaceAll('-','.')));button.append(symbol,copy);if(v.id===activeId())button.append(el('span','version-dot'));list.append(button);});
    $('#version-count').textContent=String(data.versions.length);const detail=R.get(data,activeId());$('#detail-title').textContent=detail.id==='working'?detail.label:`${detail.label} · ${detail.title}`;$('#detail-date').dateTime=detail.date;$('#detail-date').textContent=detail.date.replaceAll('-','.');$('#detail-changes').replaceChildren(...detail.changes.map(x=>el('li','',x)));const base=R.get(data,data.working.basedOn);$('.sidebar-note strong').textContent=base.family?`${R.get(data,base.family).label} 안에서 이력 이어가기`:'시안 안에서 기록하고 저장';
  }
  function makePane(id,side){
    const v=R.get(data,id),pane=el('article','preview-pane');pane.dataset.side=side;const header=el('div','pane-header'),heading=el('div','pane-heading'),select=el('select','pane-select');select.setAttribute('aria-label',state.mode==='compare'?(side==='left'?'왼쪽 버전':'오른쪽 버전'):'보는 버전');for(const entry of R.entries(data)){const opt=el('option','',entry.id==='working'?entry.label:`${entry.label} · ${entry.title}`);opt.value=entry.id;opt.selected=entry.id===id;select.append(opt);}
    select.addEventListener('change',()=>{const other=side==='left'?'right':'left';if(state[other]===select.value)state[other]=state[side];state[side]=select.value;render(true);});heading.append(el('span','pane-badge',state.mode==='compare'?(side==='left'?'LEFT':'RIGHT'):'PREVIEW'),select);
    const tools=el('div','pane-tools'),readout=el('span','scale-readout'),open=el('a','open-link');readout.setAttribute('aria-label','현재 미리보기 배율');open.dataset.version=id;open.href=R.previewUrl(id,state.scenario,state.color);open.target='_blank';open.rel='noopener';open.setAttribute('aria-label',`${v.label} 새 탭에서 열기`);open.append(el('span','','새 탭'),glyph('<path d="M14 3h7v7M21 3l-9 9M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>'));tools.append(readout,open);header.append(heading,tools);
    const viewport=el('div','preview-viewport'),sizer=el('div','preview-sizer'),frame=el('iframe','prototype-frame');frame.title=`${v.label} · ${v.title} 미리보기`;frame.name='jei-review-'+side;frame.src=themeRoute(pendingRoutes[side]||R.previewUrl(id,state.scenario,state.color));delete pendingRoutes[side];frame.allow='fullscreen';frame.addEventListener('load',()=>sendTheme(frame));sizer.append(frame);viewport.append(sizer);pane.append(header,viewport);return pane;
  }
  function sizeFrames(){const device=R.devices[state.device];document.querySelectorAll('.preview-pane').forEach(pane=>{const viewport=pane.querySelector('.preview-viewport'),sizer=pane.querySelector('.preview-sizer'),frame=pane.querySelector('iframe'),style=getComputedStyle(viewport),available=viewport.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);if(available<=0)return;const scale=R.scale(available,state.device,state.zoom);sizer.style.width=device.width*scale+'px';sizer.style.height=device.height*scale+'px';frame.style.width=device.width+'px';frame.style.height=device.height+'px';frame.style.transform=`scale(${scale})`;pane.querySelector('.scale-readout').textContent=Math.round(scale*100)+'%';});$('#viewport-label').textContent=`${device.width} × ${device.height} · ${state.zoom==='fit'?'자동 맞춤':state.zoom+'%'}`;}
  function render(push=false){
    observer?.disconnect();updateUrl(push);renderSidebar();syncThemeControls();const compare=state.mode==='compare',active=R.get(data,activeId());$('#single-mode').setAttribute('aria-pressed',String(!compare));$('#compare-mode').setAttribute('aria-pressed',String(compare));$('#view-title').textContent=compare?'두 시안을 나란히':active.id==='working'?'현재 작업본':`${active.label} · ${active.title}`;$('#view-description').textContent=compare?'같은 화면 크기로 두 시안을 직접 눌러보며 비교하세요.':active.id==='working'?'수정 중인 화면을 확인하고, 저장한 시안과 비교해 보세요.':'저장한 시안의 화면과 동작을 그대로 확인할 수 있어요.';for(const key of ['device','zoom','scenario'])$('#'+key).value=state[key];
    const same=compare&&data.working.matchesBaseline&&[state.left,state.right].includes('working')&&[state.left,state.right].includes(data.working.basedOn);$('#compare-note').hidden=!same;$('#compare-note span:last-child').textContent=`현재 작업본은 ${R.get(data,data.working.basedOn).label}과 같은 화면이에요. 디자인을 수정하면 이곳에서 차이를 비교할 수 있어요.`;
    const grid=$('#preview-grid');grid.classList.toggle('is-compare',compare);grid.classList.toggle('is-mobile',state.device==='mobile');grid.replaceChildren(makePane(state.left,'left'));if(compare)grid.append(makePane(state.right,'right'));requestAnimationFrame(sizeFrames);observer=new ResizeObserver(sizeFrames);document.querySelectorAll('.preview-viewport').forEach(node=>observer.observe(node));
  }
  try{
    const response=await fetch('versions.json',{cache:'no-store'});if(!response.ok)throw new Error('버전 목록을 가져올 수 없어요.');data=R.validate(await response.json());state=R.normalize(data,new URLSearchParams(location.search));
    sidebarSmall=smallScreen();desktopSidebarOpen=savedSidebarOpen();setSidebar(sidebarSmall?false:desktopSidebarOpen,{persist:false});
    window.addEventListener('message',event=>{
      if(event.origin!==location.origin||event.data?.type!=='jei-history-navigate'||!data.versions.some(v=>v.id===event.data.versionId))return;
      const pane=[...document.querySelectorAll('.preview-pane')].find(p=>p.querySelector('iframe').contentWindow===event.source);if(!pane)return;
      const checkpoint=event.data.checkpoint;if(checkpoint!==null&&checkpoint!==undefined&&!/^cp-[a-zA-Z0-9-]+$/.test(checkpoint))return;
      const side=pane.dataset.side,other=side==='left'?'right':'left';if(state[other]===event.data.versionId)state[other]=state[side];state[side]=event.data.versionId;state.scenario='keep';
      if(checkpoint)pendingRoutes[side]=R.previewUrl(state[side])+'?checkpoint='+encodeURIComponent(checkpoint);render(true);
    });
    $('#version-list').addEventListener('click',event=>{const button=event.target.closest('button[data-version]');if(!button)return;const target=state.mode==='compare'?'right':'left',other=target==='left'?'right':'left';if(state[other]===button.dataset.version)state[other]=state[target];state[target]=button.dataset.version;if(smallScreen())setSidebar(false,{focus:true});render(true);});
    $('#single-mode').addEventListener('click',()=>{if(state.mode==='single')return;state.left=state.right;state.right=R.entries(data).find(v=>v.id!==state.left).id;state.mode='single';render(true);});
    $('#compare-mode').addEventListener('click',()=>{if(state.mode==='compare')return;const selected=state.left;state.left=selected==='working'?data.working.basedOn:selected;state.right=selected==='working'?'working':data.working.id;state.mode='compare';render(true);});
    for(const key of ['device','zoom'])$('#'+key).addEventListener('change',event=>{state[key]=event.target.value;updateUrl();$('#preview-grid').classList.toggle('is-mobile',state.device==='mobile');sizeFrames();});
    $('#scenario').addEventListener('change',event=>{state.scenario=event.target.value;render();if(state.scenario!=='keep')toast(state.mode==='compare'?'두 화면에 같은 학습 상태를 적용했어요.':'선택한 학습 상태를 적용했어요.');});$('#reload').addEventListener('click',()=>render());
    $('#theme-preset').addEventListener('change',event=>{const color=T.PRESETS[event.target.value];if(color)changeTheme(color);else $('#theme-color').focus();});
    $('#theme-color').addEventListener('input',event=>changeTheme(event.target.value));
    $('#theme-hex').addEventListener('input',event=>{if(R.normalizeColor(event.target.value))changeTheme(event.target.value);});
    $('#theme-hex').addEventListener('change',event=>{if(!changeTheme(event.target.value)){syncThemeControls();toast('#과 6자리 색상 코드를 입력해 주세요.');}});
    $('#theme-reset').addEventListener('click',()=>changeTheme(T.DEFAULT));
    $('#copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);toast('현재 보기 링크를 복사했어요.');}catch{$('#link-input').value=location.href;$('#link-dialog').showModal();$('#link-input').select();}});$('#close-link-dialog').addEventListener('click',()=>$('#link-dialog').close());
    $('#menu-toggle').addEventListener('click',()=>setSidebar(!sidebarOpen,{focus:true}));
    $('#close-sidebar').addEventListener('click',()=>setSidebar(false,{focus:true}));
    $('#sidebar-backdrop').addEventListener('click',()=>setSidebar(false,{focus:true}));
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&sidebarOpen&&!$('#link-dialog').open){event.preventDefault?.();setSidebar(false,{focus:true});}
      if(event.key==='Tab'&&sidebarOpen&&smallScreen()){
        const items=Array.from($('#sidebar').querySelectorAll('button:not(:disabled),a[href],select,input:not(:disabled)'));
        if(!items.length)return;
        if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1).focus();}
        else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0].focus();}
      }
    });
    window.addEventListener('resize',()=>{const small=smallScreen();if(small!==sidebarSmall){sidebarSmall=small;setSidebar(small?false:desktopSidebarOpen,{persist:false});}else requestAnimationFrame(sizeFrames);});
    window.addEventListener('popstate',()=>{state=R.normalize(data,new URLSearchParams(location.search));render();});render();
  }catch(error){const card=el('div','error-card');card.append(el('h2','','시안을 불러오지 못했어요'),el('p','',error.message));const retry=el('button','','다시 시도');retry.addEventListener('click',()=>location.reload());card.append(retry);$('#preview-grid').replaceChildren(card);}
})();
