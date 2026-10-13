// Compatibility for previously shared preview.html links; current views load directly.
(async function(){
 'use strict';
 try{
  const params=new URLSearchParams(location.search),id=params.get('version')||'working';
  const response=await fetch('versions.json',{cache:'no-store'});if(!response.ok)throw new Error('버전 목록을 읽을 수 없어요.');
  const data=ReviewModel.validate(await response.json());if(!ReviewModel.get(data,id))throw new Error('찾을 수 없는 버전이에요.');
  const scenario=params.get('scenario');location.replace(ReviewModel.previewUrl(id,['0','3','4','5'].includes(scenario)?scenario:'keep'));
 }catch(error){document.querySelector('#status').textContent=error.message;}
})();
