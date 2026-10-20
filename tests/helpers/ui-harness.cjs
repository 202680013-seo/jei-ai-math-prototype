// Deterministic application-state harness; not a browser layout or pixel substitute.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {MathModel:M}=require('../../dist/working/model.js');
const MentorPolicy=require('../../dist/working/mentor-policy.js');
const {SkyModel}=require('../../dist/working/sky.js');
const source=()=>fs.readFileSync(path.join(__dirname,'../../dist/working/app.js'),'utf8');
const STATE_KEY='ai-math-prototype-diagnosis-v1';

function harness(saved,{reducedMotion=true,appSource,rects={},viewportHeight=800,initialScroll=0}={}){
  const nodes=new Map(),events=new Map(),windowEvents=new Map(),timers=[],intervals=[],storage=new Map(),media={matches:reducedMotion},scrollCalls=[];
  if(saved)storage.set(STATE_KEY,JSON.stringify(saved));
  const subscribe=(map,type,fn)=>{if(!map.has(type))map.set(type,[]);map.get(type).push(fn);};
  function node(selector){
    if(nodes.has(selector))return nodes.get(selector);
    const classes=new Set(),handlers=new Map(),attrs=new Map();
    const element={
      style:{setProperty(name,value){this[name]=value;}},hidden:false,disabled:false,open:false,
      innerHTML:'',textContent:'',value:8,offsetWidth:1,scrollLeft:0,scrollWidth:240,clientWidth:240,
      children:[],dataset:{},
      classList:{add(...names){names.forEach(name=>classes.add(name));},remove(...names){names.forEach(name=>classes.delete(name));},contains(name){return classes.has(name);}},
      setAttribute(name,value){attrs.set(name,String(value));this[name]=value;},
      getAttribute(name){return attrs.get(name)??null;},
      removeAttribute(name){attrs.delete(name);delete this[name];},
      getBoundingClientRect(){const width=selector==='#mentor-measure'?this.textContent.length*8:selector==='.ai-top'?616:240,custom=rects[selector],rect={left:0,top:0,width,height:240,...(typeof custom==='function'?custom(c):custom)};return {...rect,right:rect.left+rect.width,bottom:rect.top+rect.height};},
      append(child){if(child.parent)child.parent.children=child.parent.children.filter(item=>item!==child);this.children.push(child);child.parent=this;},
      prepend(child){if(child.parent)child.parent.children=child.parent.children.filter(item=>item!==child);this.children.unshift(child);child.parent=this;},
      contains(child){return this.children.includes(child);},
      querySelectorAll(){return [];},focus(){},scrollIntoView(){},remove(){},animate(){return null;},
      addEventListener(type,fn){subscribe(handlers,type,fn);},
      emit(type,event={}){for(const fn of handlers.get(type)||[])fn(event);},
      showModal(){this.open=true;},
      close(){const wasOpen=this.open;this.open=false;if(wasOpen)this.emit('close');}
    };
    nodes.set(selector,element);return element;
  }
  const document={visibilityState:'visible',querySelector:node,querySelectorAll(){return [];},body:node('body'),addEventListener(type,fn){subscribe(events,type,fn);}};
  const c=vm.createContext({console,MathModel:M,SkyModel,MentorPolicy,document,
    localStorage:{getItem(key){return storage.get(key)??null;},setItem(key,value){storage.set(key,String(value));}},
    matchMedia:()=>media,
    setTimeout(fn,ms){const timer={fn,ms,cancelled:false};timers.push(timer);return timer;},
    clearTimeout(timer){if(timer)timer.cancelled=true;},
    setInterval(fn,ms){const timer={fn,ms};intervals.push(timer);return timer;},clearInterval(){},
    innerWidth:1200,innerHeight:viewportHeight,scrollY:initialScroll,scrollTo(...args){const options=typeof args[0]==='object'?{...args[0]}:{left:args[0],top:args[1]};scrollCalls.push(options);c.scrollY=options.top??c.scrollY;},addEventListener(type,fn){subscribe(windowEvents,type,fn);},
  });
  c.window=c;
  vm.runInContext(appSource??source(),c);
  const evaluate=code=>vm.runInContext(code,c);
  const data=code=>JSON.parse(evaluate('JSON.stringify('+code+')'));
  const click=(action,id)=>{
    const button={dataset:{action,id:String(id??'')},disabled:false,closest(selector){return selector==='[data-action]'?this:null;}};
    for(const fn of events.get('click')||[])fn({target:button});
  };
  const seed=(status='passed',nextActive=true)=>evaluate(`
    state=M.create();daily();current().diagnosis='done';current().programs=M.programs(3);
    current().programs[0].status=${JSON.stringify(status)};M.setProgress(current().programs[0],100);
    current().programs[0].wrongFrames=${status==='failed'?'[0]':'[]'};
    ${nextActive?"current().programs[1].status='active';M.setProgress(current().programs[1],50);current().programs[1].demoChoice=1;":''}
    render();
  `);
  const answer=(wrong=false)=>{
    const correct=evaluate('DEMO[current().programs[0].reviewSession.index%3].correct');
    click('learner-answer',wrong?(correct+1)%3:correct);click('learner-next');
  };
  const finishReview=(wrongFirst=false)=>{
    const limit=evaluate('(current().programs[0].frames.length||1)+1');
    for(let i=0;i<limit&&!evaluate('current().programs[0].reviewSession.complete');i++)answer(wrongFirst&&i===0);
    assert.equal(evaluate('current().programs[0].reviewSession.complete'),true,'review reaches its own result');
  };
  const tick=()=>{const minute=intervals.find(timer=>timer.ms===60000);assert.ok(minute,'learning-minute timer is registered');minute.fn();};
  const escape=()=>{let prevented=false;node('#learning').emit('cancel',{preventDefault(){prevented=true;}});if(!prevented)node('#learning').close();};
  const emitDocument=(type,event={})=>{for(const fn of events.get(type)||[])fn(event);};
  const emitWindow=(type,event={})=>{for(const fn of windowEvents.get(type)||[])fn(event);};
  return {node,evaluate,data,click,seed,answer,finishReview,tick,escape,document,emitDocument,emitWindow,context:c,timers,intervals,events,storage,media,scrollCalls,saved:()=>JSON.parse(storage.get(STATE_KEY))};
}

module.exports={harness};
