// DOM substitute: verify review controls and generated iframe routes, not pixel layout.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dist=path.resolve(__dirname,'../dist'),registry=JSON.parse(fs.readFileSync(path.join(dist,'versions.json'))),R=require('../dist/review-model.js');
function element(tag='div'){
  const classes=new Set(),node={tagName:tag.toUpperCase(),children:[],style:{},dataset:{},attrs:{},events:{},textContent:'',hidden:false,value:'',clientWidth:700,
    append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=[...nodes];},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},
    addEventListener(k,f){this.events[k]=f;},select(){},showModal(){this.open=true;},close(){this.open=false;},
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;},
    querySelectorAll(selector){const match=n=>selector.startsWith('.')?n.classList.contains(selector.slice(1)):n.tagName===selector.toUpperCase();const list=[];function visit(n){for(const child of n.children){if(match(child))list.push(child);visit(child);}}visit(this);return list;}
  };
  Object.defineProperty(node,'className',{get:()=>[...classes].join(' '),set:v=>{classes.clear();v.split(/\s+/).forEach(x=>classes.add(x));}});
  node.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,force){const next=force===undefined?!classes.has(x):force;if(next)classes.add(x);else classes.delete(x);return next;}};
  return node;
}
test('workspace controls switch between saved V1 and working, resize, and produce valid comparison links',async()=>{
  const selectors=['#version-list','#version-count','#detail-title','#detail-date','#detail-changes','.sidebar-note strong','#toast','#single-mode','#compare-mode','#view-title','#view-description','#device','#zoom','#scenario','#compare-note','#compare-note span:last-child','#preview-grid','#viewport-label','#reload','#copy-link','#link-input','#link-dialog','#close-link-dialog','#menu-toggle','#sidebar'];
  const nodes=new Map(selectors.map(x=>[x,element()]));const grid=nodes.get('#preview-grid'),events={},location={origin:'https://review.example',pathname:'/',search:'',href:'https://review.example/'},history={replaceState(a,b,url){location.search=url;location.href=location.origin+'/'+url;},pushState(a,b,url){this.replaceState(a,b,url);}};
  let copied;const document={querySelector:s=>nodes.get(s)||null,querySelectorAll:s=>s==='.preview-pane'?grid.children:grid.querySelectorAll(s),createElement:element,createElementNS:(ns,tag)=>element(tag),addEventListener:(k,f)=>events[k]=f};
  const c=vm.createContext({document,window:{addEventListener:(k,f)=>events[k]=f},location,history,navigator:{clipboard:{writeText:async x=>{copied=x;}}},ReviewModel:R,fetch:async()=>({ok:true,json:async()=>structuredClone(registry)}),URLSearchParams,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>fn(),getComputedStyle:()=>({paddingLeft:'22px',paddingRight:'22px'}),setTimeout:()=>1,clearTimeout(){},console});
  await vm.runInContext(fs.readFileSync(path.join(dist,'workspace.js'),'utf8'),c);
  assert.equal(grid.children.length,1);assert.equal(nodes.get('#view-title').textContent,'현재 작업본');assert.equal(grid.children[0].querySelector('iframe').src,'preview.html?version=working');
  nodes.get('#compare-mode').events.click();assert.equal(grid.children.length,2);assert.equal(nodes.get('#compare-note').hidden,false);assert.equal(grid.children[0].querySelector('iframe').src,'preview.html?version=v1');assert.equal(grid.children[1].querySelector('iframe').src,'preview.html?version=working');
  nodes.get('#device').events.change({target:{value:'mobile'}});assert.equal(grid.children[0].querySelector('iframe').style.width,'390px');assert.equal(grid.children[1].querySelector('iframe').style.width,'390px');
  nodes.get('#scenario').events.change({target:{value:'4'}});assert.ok(grid.children.every(p=>p.querySelector('iframe').src.endsWith('&scenario=4')));
  const select=grid.children[0].querySelector('select');select.value='working';select.events.change();assert.ok(grid.children[1].querySelector('iframe').src.includes('version=v1'));assert.ok(grid.children[0].querySelector('iframe').src.includes('version=working'));
  await nodes.get('#copy-link').events.click();assert.ok(copied.includes('view=compare'));assert.ok(copied.includes('device=mobile'));
  nodes.get('#single-mode').events.click();assert.equal(grid.children.length,1);assert.equal(nodes.get('#view-title').textContent,'V1 · 대리님 원본');
});
test('preview loader preserves source files while injecting the version state adapter and resource base',async()=>{
  const source=fs.readFileSync(path.join(dist,'versions/v1/index.html'),'utf8'),frame=element('iframe'),status=element(),events={};frame.contentWindow={};
  const location={search:'?version=v1&scenario=4',href:'https://review.example/preview.html?version=v1&scenario=4',origin:'https://review.example'};let requested=[];
  const c=vm.createContext({document:{querySelector:s=>s==='#status'?status:frame,createElement:element},window:{addEventListener:(k,f)=>events[k]=f},location,ReviewModel:R,URL,URLSearchParams,fetch:async url=>{requested.push(String(url));return {ok:true,json:async()=>structuredClone(registry),text:async()=>source};},setTimeout:()=>1,clearTimeout(){}});
  await vm.runInContext(fs.readFileSync(path.join(dist,'preview.js'),'utf8'),c);
  assert.equal(requested[1],'https://review.example/versions/v1/index.html');assert.ok(frame.srcdoc.includes('<base href="https://review.example/versions/v1/">'));assert.ok(frame.srcdoc.includes('window.__JEI_REVIEW__={"id":"v1","scenario":"4"}'));assert.ok(frame.srcdoc.indexOf('preview-runtime.js')<frame.srcdoc.indexOf('src="catalog.js"'));assert.ok(frame.srcdoc.indexOf('preview-controls.js')>frame.srcdoc.indexOf('src="app.js"'));assert.equal(frame.hidden,false);
  events.message({origin:location.origin,source:frame.contentWindow,data:{type:'jei-review-ready'}});assert.equal(status.hidden,true);
});
