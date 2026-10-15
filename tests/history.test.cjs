const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const H=require('../dist/history-model.js'),M=require('../dist/working/model.js').MathModel;
function storage(){const map=new Map();return {map,get length(){return map.size},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};}
function record(store,versionId='v2',preset=4){const appState=M.create();M.preset(appState,preset);return store.add({versionId,familyId:'v2',title:'검토 기록',appState,view:'main'});}
function runtime(native,version,search,designId=version){
  const window={localStorage:native,JeiHistory:H,history:{replaceState(a,b,url){window.replacedUrl=url;}}};
  vm.runInNewContext(fs.readFileSync('dist/preview-runtime.js','utf8'),{window,document:{currentScript:{dataset:{version,designId}}},location:{search,href:'https://review.example/views/'+version+'.html'+search},URL,URLSearchParams});
  return window;
}
test('manual checkpoints pin an immutable design and independently copy learner state',()=>{
  const native=storage(),store=H.createStore(native),saved=record(store),before=JSON.stringify(saved.appState);
  saved.appState.grades[saved.appState.grade][saved.appState.index].programs[0].progress=99;
  assert.equal(JSON.stringify(store.get(saved.id).appState),before);
  const later=record(store,'v3',5);assert.equal(store.list()[0].id,later.id);assert.equal(store.list()[1].versionId,'v2');
  assert.equal(H.route('v2',saved.id),'/views/v2.html?checkpoint='+saved.id);assert.throws(()=>H.route('../../evil'));assert.throws(()=>H.route('v2','http://evil'));
  const broken=M.create();broken.index=999;assert.throws(()=>store.add({versionId:'v2',familyId:'v2',appState:broken}));assert.equal(store.list().length,2);
});
test('restore seeds the exact saved state before app startup and cannot reset it again on refresh',()=>{
  const native=storage(),store=H.createStore(native),saved=record(store),old=M.create();native.setItem('jei-review:v2:'+H.STATE_KEY,JSON.stringify(old));native.setItem('jei-review:v1:'+H.STATE_KEY,'original-v1');
  const window=runtime(native,'v2','?checkpoint='+saved.id+'&scenario=0&extra=keep');
  assert.equal(window.__JEI_REVIEW__.scenario,'keep');assert.equal(window.__JEI_REVIEW__.restored.id,saved.id);assert.deepEqual(JSON.parse(window.localStorage.getItem(H.STATE_KEY)),saved.appState);
  assert.equal(window.replacedUrl,'/views/v2.html?extra=keep');assert.equal(native.getItem('jei-review:v1:'+H.STATE_KEY),'original-v1');
  const updated=JSON.parse(window.localStorage.getItem(H.STATE_KEY));updated.index=1;window.localStorage.setItem(H.STATE_KEY,JSON.stringify(updated));
  assert.equal(JSON.parse(runtime(native,'v2','?extra=keep').localStorage.getItem(H.STATE_KEY)).index,1);
  window.localStorage.clear();assert.equal(store.get(saved.id).id,saved.id,'clearing a learner view must not clear history');
});
test('missing or wrong-design checkpoints keep the existing state intact',()=>{
  const native=storage(),store=H.createStore(native),saved=record(store);native.setItem('jei-review:v1:'+H.STATE_KEY,'keep-v1');
  const wrong=runtime(native,'v1','?checkpoint='+saved.id);assert.ok(wrong.__JEI_REVIEW__.restoreError);assert.equal(wrong.localStorage.getItem(H.STATE_KEY),'keep-v1');
  const missing=runtime(native,'v1','?checkpoint=cp-missing');assert.ok(missing.__JEI_REVIEW__.restoreError);assert.equal(missing.localStorage.getItem(H.STATE_KEY),'keep-v1');
});
test('storage failures do not erase history or report a successful save',()=>{
  const native=storage(),store=H.createStore(native),saved=record(store),before=native.getItem(H.KEY);
  native.setItem=()=>{throw new Error('QuotaExceededError');};assert.throws(()=>record(store),/저장 공간/);assert.equal(native.getItem(H.KEY),before);assert.equal(store.list()[0].id,saved.id);
  assert.throws(()=>H.createStore(null).add({versionId:'v2',familyId:'v2',appState:M.create()}),/저장소/);
});
test('corrupt history is reported and never silently replaced',()=>{
  const native=storage();native.setItem(H.KEY,'corrupted');const store=H.createStore(native);assert.throws(()=>record(store),/손상/);assert.equal(native.getItem(H.KEY),'corrupted');
});

// Event integration in a small DOM substitute; this does not verify browser layout.
function element(tag='div'){
  const classes=new Set(),n={tagName:tag,children:[],attrs:{},dataset:{},events:{},textContent:'',value:'',hidden:false,
    append(...nodes){this.children.push(...nodes)},replaceChildren(...nodes){this.children=[...nodes]},setAttribute(k,v){this.attrs[k]=v},
    addEventListener(k,f){this.events[k]=f},focus(){this.focused=true},showModal(){this.open=true},close(){this.open=false;this.events.close?.()},
    querySelector(s){return this.querySelectorAll(s)[0]||null},querySelectorAll(s){const result=[];function visit(node){for(const child of node.children){if(s[0]==='.'?child.classList.contains(s.slice(1)):s[0]==='#'?child.id===s.slice(1):child.tagName===s)result.push(child);visit(child)}}visit(this);return result},
    getBoundingClientRect(){return {left:0,right:400,top:0,bottom:800}}
  };
  Object.defineProperty(n,'className',{get:()=>[...classes].join(' '),set:v=>{classes.clear();v.split(/\s+/).forEach(c=>classes.add(c))}});
  n.classList={contains:x=>classes.has(x),toggle(x,force){if(force)classes.add(x);else classes.delete(x)}};
  Object.defineProperty(n,'innerHTML',{set:html=>{n.children=[];for(const match of html.matchAll(/<([a-z][a-z0-9-]*)([^>]*)>/gi)){const child=element(match[1]);for(const attr of match[2].matchAll(/(class|id)="([^"]*)"/g))child[attr[1]==='class'?'className':'id']=attr[2];n.append(child)}}});
  return n;
}
test('history UI saves named checkpoints, restores older designs, and backs up the state being left',async()=>{
  const registry=JSON.parse(fs.readFileSync('dist/versions.json'));
  let current=registry.versions.find(v=>v.family==='v2'&&v.revision>0);
  if(!current){current={id:'v3',family:'v2',revision:1,label:'V2.1',title:'수정한 실력알기',date:'2026-10-13',changes:['진단 구조 변경']};registry.versions.push(current)}
  const native=storage(),store=H.createStore(native),old=record(store,'v2',3),body=element('body'),events={},messages=[],parent={postMessage:(data,origin)=>messages.push({data,origin})};let snapshot=M.create();M.preset(snapshot,4);
  const window={name:'jei-review-left',parent,__JEI_REVIEW__:{id:current.id,designId:current.id},JeiHistory:H,__JEI_HISTORY_STORE__:store,__JEI_REVIEW_BRIDGE__:{capture:()=>({appState:JSON.parse(JSON.stringify(snapshot)),view:'main'})},addEventListener:(type,handler)=>events[type]=handler};
  const context=vm.createContext({window,document:{body,createElement:element},location:{origin:'https://review.example'},fetch:async()=>({ok:true,json:async()=>registry}),Intl,Date,console,setTimeout:()=>1,clearTimeout(){}});
  await vm.runInContext(fs.readFileSync('dist/history-ui.js','utf8'),context);
  const dialog=body.querySelector('#jei-history-dialog');
  assert.equal(body.querySelector('#jei-history-dock'),null);assert.equal(body.querySelector('.rh-open'),null);assert.equal(body.querySelector('.rh-save'),null);
  assert.equal(messages.at(-1).data.type,'jei-history-ready');assert.equal(messages.at(-1).origin,'https://review.example');
  events.message({origin:'https://untrusted.example',source:parent,data:{type:'jei-history-open'}});assert.ok(!dialog.open);
  events.message({origin:'https://review.example',source:{},data:{type:'jei-history-open'}});assert.ok(!dialog.open);
  events.message({origin:'https://review.example',source:parent,data:{type:'jei-history-open'}});assert.equal(dialog.open,true);assert.equal(messages.at(-1).data.type,'jei-history-opened');
  dialog.querySelector('#rh-name').value='회의 전 검토';dialog.querySelector('.rh-commit').events.click();
  assert.equal(store.list()[0].title,'회의 전 검토');assert.equal(store.list()[0].versionId,current.id);assert.ok(dialog.querySelector('.rh-status').textContent.includes('저장했어요'));
  M.preset(snapshot,5);const before=JSON.stringify(old.appState);dialog.querySelector('.rh-checkpoints').children.at(-1).querySelector('.rh-restore').events.click();
  assert.equal(messages.at(-1).data.type,'jei-history-navigate');assert.equal(messages.at(-1).data.versionId,'v2');assert.equal(messages.at(-1).data.checkpoint,old.id);assert.equal(store.list()[0].kind,'backup');assert.equal(store.list()[0].versionId,current.id);assert.deepEqual(store.list()[0].appState,snapshot);assert.equal(JSON.stringify(store.get(old.id).appState),before);
  dialog.querySelector('.rh-close').events.click();assert.equal(dialog.open,false);assert.equal(messages.at(-1).data.type,'jei-history-closed');
});

test('history remains available from the workspace when its registry fails, without floating controls',async()=>{
  const body=element('body'),events={},messages=[],parent={postMessage:data=>messages.push(data)},window={name:'jei-review-right',parent,JeiHistory:H,__JEI_REVIEW__:{id:'v2',designId:'v2'},__JEI_HISTORY_STORE__:H.createStore(storage()),__JEI_REVIEW_BRIDGE__:{capture:()=>({appState:M.create(),view:'main'})},addEventListener:(type,handler)=>events[type]=handler};
  await vm.runInNewContext(fs.readFileSync('dist/history-ui.js','utf8'),{window,document:{body,createElement:element},location:{origin:'https://review.example'},fetch:async()=>({ok:false}),Intl,Date,setTimeout:()=>1,clearTimeout(){}});
  assert.equal(messages.at(-1).type,'jei-history-ready');assert.equal(body.querySelector('#jei-history-dock'),null);
  events.message({origin:'https://review.example',source:parent,data:{type:'jei-history-open'}});
  const dialog=body.querySelector('#jei-history-dialog');assert.equal(dialog.open,true);assert.equal(dialog.querySelector('.rh-commit').disabled,true);assert.match(dialog.querySelector('.rh-summary').textContent,/불러오지 못했어요/);
});
