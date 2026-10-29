(function(){
 'use strict';
 // Reporting-only dialog host. Learner dialogs stay in their original DOM;
 // the operator dock is a permanent sibling, never a child of a learner popup.
 const dialogs=[...document.querySelectorAll('dialog')],stack=[],launchers=new WeakMap(),backdrops=new Map(),originalInert=new Map();
 const plane=document.createElement('div');plane.id='report-ui-plane';
 document.body.prepend(plane);
 for(const node of [...document.body.children])if(node!==plane&&node.id!=='report-dock'&&!dialogs.includes(node)&&!['SCRIPT','STYLE','LINK'].includes(node.tagName))plane.append(node);
 let active=null;
 function sync(){
  for(let i=stack.length-1;i>=0;i--)if(!stack[i].open||stack[i].hidden)stack.splice(i,1);
  active=stack.at(-1)||null;plane.inert=!!active;
  for(const d of dialogs){
   const index=stack.indexOf(d),open=index>=0,backdrop=backdrops.get(d);
   d.inert=open&&d!==active?true:originalInert.get(d);
   backdrop.hidden=!open;
   if(!open)continue;
   d.style.setProperty('--report-dialog-layer',String(101+index*2));
   backdrop.style.zIndex=String(100+index*2);
   const paint=getComputedStyle(d,'::backdrop');
   backdrop.style.background=paint.background;
   backdrop.style.backdropFilter=paint.backdropFilter||'none';
   backdrop.style.webkitBackdropFilter=paint.webkitBackdropFilter||paint.backdropFilter||'none';
  }
 }
 for(const d of dialogs){
  originalInert.set(d,!!d.inert);d.setAttribute('data-report-dialog','');
  const backdrop=document.createElement('div');backdrop.className='report-dialog-backdrop';backdrop.hidden=true;backdrop.setAttribute('aria-hidden','true');document.body.append(backdrop);backdrops.set(d,backdrop);
  for(const type of ['wheel','touchmove'])backdrop.addEventListener(type,e=>e.preventDefault(),{passive:false});
  const close=d.close.bind(d);
  d.showModal=function(){
   if(d.open)return;
   launchers.set(d,document.activeElement);d.inert=originalInert.get(d);
   // A modeless native dialog preserves open/close/returnValue and its native
   // initial focus. Report-only scrims and a separate inert plane provide the
   // learner modality without making the independent operator dock inert.
   d.show();stack.push(d);sync();
  };
  d.close=function(...args){
   const wasActive=d===active,opener=launchers.get(d);close(...args);sync();
   if(wasActive&&opener?.isConnected&&!opener.closest('[inert],[hidden]'))opener.focus({preventScroll:true});
  };
  d.addEventListener('close',sync);
  if(d.open)stack.push(d);
 }
 const observer=new MutationObserver(sync);
 for(const d of dialogs)observer.observe(d,{attributes:true,attributeFilter:['open','hidden','class']});
 document.addEventListener('keydown',event=>{
  if(!active)return;
  if(event.key==='Escape'){
   event.preventDefault();event.stopImmediatePropagation();
   const target=active;if(target.dispatchEvent(new Event('cancel',{cancelable:true}))&&target.open)target.close();return;
  }
  if(event.key!=='Tab')return;
  const selector='button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';
  const dock=document.querySelector('#report-dock');
  const items=[...active.querySelectorAll(selector),...(dock?.querySelectorAll(selector)||[])].filter(e=>!e.closest('[inert],[hidden]')&&e.getClientRects().length);
  const current=items.indexOf(document.activeElement),next=current+(event.shiftKey?-1:1);
  if(current<0||next<0||next>=items.length){event.preventDefault();(event.shiftKey?items.at(-1):items[0])?.focus({preventScroll:true});}
 },true);
 window.JeiReportDialogs={sync};sync();
})();
