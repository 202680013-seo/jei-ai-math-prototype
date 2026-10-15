(function(root){
  'use strict';
  const devices={fullhd:{width:1920,height:1080},desktop:{width:1440,height:900},tablet:{width:1280,height:800},mobile:{width:390,height:844}};
  function validate(data){
    if(data?.schema!==1||data.working?.id!=='working'||!Array.isArray(data.versions)||!data.versions.length)throw new Error('버전 목록 형식이 올바르지 않습니다.');
    const ids=new Set();
    for(const item of [data.working,...data.versions]){
      if(!/^(working|v[1-9]\d*)$/.test(item.id)||ids.has(item.id))throw new Error('중복되거나 잘못된 버전입니다.');
      if(item.path!==(item.id==='working'?'working/':`versions/${item.id}/`))throw new Error('버전 경로가 올바르지 않습니다.');
      if(!item.label||!item.title||!Array.isArray(item.changes))throw new Error('버전 설명이 없습니다.');
      if(item.family&&(!/^v[1-9]\d*$/.test(item.family)||!Number.isInteger(item.revision)||item.revision<0))throw new Error('수정 이력 정보가 올바르지 않습니다.');
      ids.add(item.id);
    }
    if(!ids.has(data.working.basedOn)||data.working.basedOn==='working')throw new Error('기준 버전이 없습니다.');
    if(data.versions.some(item=>item.family&&!ids.has(item.family)))throw new Error('수정 이력의 원본 버전이 없습니다.');
    return data;
  }
  const entries=data=>[data.working,...[...data.versions].reverse()];
  const get=(data,id)=>entries(data).find(item=>item.id===id);
  const normalizeColor=value=>typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value)?value.toLowerCase():null;
  const normalizeTheme=value=>['current','teal','green'].includes(value)?value:null;
  function normalize(data,params){
    const left=get(data,params.get('left'))?.id||'working';let right=get(data,params.get('right'))?.id||data.working.basedOn;
    if(left===right)right=entries(data).find(item=>item.id!==left).id;
    const theme=normalizeTheme(params.get('theme'))||'current',color=params.has('theme')?null:normalizeColor(params.get('color'));
    return {mode:params.get('view')==='compare'?'compare':'single',left,right,device:Object.hasOwn(devices,params.get('device'))?params.get('device'):'fullhd',zoom:['100','75','50'].includes(params.get('zoom'))?params.get('zoom'):'fit',scenario:['0','3','4','5','6','many','scroll20'].includes(params.get('scenario'))?params.get('scenario'):'keep',color,theme};
  }
  function query(state){const p=new URLSearchParams({view:state.mode,left:state.left,device:state.device,zoom:state.zoom});if(state.mode==='compare')p.set('right',state.right);if(state.scenario!=='keep')p.set('scenario',state.scenario);if(normalizeTheme(state.theme)&&state.theme!=='current')p.set('theme',state.theme);else if(normalizeColor(state.color))p.set('color',state.color);return p.toString();}
  function previewUrl(id,scenario='keep',color=null,theme='current'){if(!/^(working|v[1-9]\d*)$/.test(id))throw new Error('잘못된 버전입니다.');const p=new URLSearchParams();if(scenario!=='keep')p.set('scenario',scenario);if(normalizeTheme(theme)&&theme!=='current')p.set('theme',theme);else if(normalizeColor(color))p.set('color',normalizeColor(color));return 'views/'+id+'.html'+(p.size?'?'+p.toString():'');}
  function scale(width,device,zoom){return zoom==='fit'?Math.max(.08,Math.min(1,width/devices[device].width)):Number(zoom)/100;}
  const api={devices,validate,entries,get,normalize,query,previewUrl,scale,normalizeColor,normalizeTheme};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ReviewModel=api;
})(typeof window!=='undefined'?window:globalThis);
