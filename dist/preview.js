(async function(){
  'use strict';const status=document.querySelector('#status'),frame=document.querySelector('#prototype');
  try{
    const params=new URLSearchParams(location.search),id=params.get('version')||'working',r=await fetch('versions.json',{cache:'no-store'});if(!r.ok)throw new Error('버전 목록을 읽을 수 없어요.');const data=ReviewModel.validate(await r.json()),version=ReviewModel.get(data,id);if(!version)throw new Error('찾을 수 없는 버전이에요.');
    document.title=`${version.label} · ${version.title} | 재능 AI 수학`;frame.title=`${version.label} · ${version.title}`;
    const base=new URL(version.path,location.href),source=await fetch(new URL('index.html',base),{cache:'no-store'});if(!source.ok)throw new Error('시안 파일을 읽을 수 없어요.');let html=await source.text();
    const config={id:version.id,scenario:['0','3','4','5'].includes(params.get('scenario'))?params.get('scenario'):'keep'};
    const runtime=new URL('preview-runtime.js',location.href).href,controls=new URL('preview-controls.js',location.href).href,safe=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
    html=html.replace(/<head([^>]*)>/i,`<head$1><base href="${safe(base.href)}"><script>window.__JEI_REVIEW__=${JSON.stringify(config)};<\/script><script src="${safe(runtime)}"><\/script>`).replace(/<\/body>/i,`<script src="${safe(controls)}"><\/script></body>`);
    let ready=false;const timeout=setTimeout(()=>{if(!ready){status.hidden=false;status.textContent='시안을 여는 데 시간이 걸리고 있어요. 새로고침해 주세요.';}},15000);
    window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow||!['jei-review-ready','jei-review-error'].includes(event.data?.type))return;ready=true;clearTimeout(timeout);status.hidden=event.data.type==='jei-review-ready';if(!status.hidden)status.textContent='시안 실행 중 오류가 발생했어요. 새로고침하거나 다른 버전을 선택해 주세요.';});frame.hidden=false;frame.srcdoc=html;
  }catch(error){status.textContent=error.message;const link=document.createElement('a');link.href='./';link.textContent='버전 목록으로 돌아가기';status.append(document.createElement('br'),link);}
})();
