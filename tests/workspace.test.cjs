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
test('workspace controls switch between the saved baseline and working, resize, and produce valid comparison links',async()=>{
  const selectors=['#version-list','#version-count','#detail-title','#detail-date','#detail-changes','.sidebar-note strong','#toast','#single-mode','#compare-mode','#view-title','#view-description','#device','#zoom','#scenario','#compare-note','#compare-note span:last-child','#preview-grid','#viewport-label','#reload','#copy-link','#link-input','#link-dialog','#close-link-dialog','#menu-toggle','#sidebar'];
  const nodes=new Map(selectors.map(x=>[x,element()]));const grid=nodes.get('#preview-grid'),events={},location={origin:'https://review.example',pathname:'/',search:'',href:'https://review.example/'},history={replaceState(a,b,url){location.search=url;location.href=location.origin+'/'+url;},pushState(a,b,url){this.replaceState(a,b,url);}};
  let copied;const document={querySelector:s=>nodes.get(s)||null,querySelectorAll:s=>s==='.preview-pane'?grid.children:grid.querySelectorAll(s),createElement:element,createElementNS:(ns,tag)=>element(tag),addEventListener:(k,f)=>events[k]=f};
  const c=vm.createContext({document,window:{addEventListener:(k,f)=>events[k]=f},location,history,navigator:{clipboard:{writeText:async x=>{copied=x;}}},ReviewModel:R,fetch:async()=>({ok:true,json:async()=>structuredClone(registry)}),URLSearchParams,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>fn(),getComputedStyle:()=>({paddingLeft:'22px',paddingRight:'22px'}),setTimeout:()=>1,clearTimeout(){},console});
  await vm.runInContext(fs.readFileSync(path.join(dist,'workspace.js'),'utf8'),c);
  assert.equal(grid.children.length,1);assert.equal(nodes.get('#view-title').textContent,'현재 작업본');assert.equal(grid.children[0].querySelector('iframe').src,'views/working.html');
  nodes.get('#compare-mode').events.click();assert.equal(grid.children.length,2);assert.equal(nodes.get('#compare-note').hidden,false);assert.equal(grid.children[0].querySelector('iframe').src,'views/'+registry.working.basedOn+'.html');assert.equal(grid.children[1].querySelector('iframe').src,'views/working.html');
  nodes.get('#device').events.change({target:{value:'mobile'}});assert.equal(grid.children[0].querySelector('iframe').style.width,'390px');assert.equal(grid.children[1].querySelector('iframe').style.width,'390px');
  nodes.get('#scenario').events.change({target:{value:'4'}});assert.ok(grid.children.every(p=>p.querySelector('iframe').src.endsWith('?scenario=4')));
  const select=grid.children[0].querySelector('select');select.value='working';select.events.change();assert.ok(grid.children[1].querySelector('iframe').src.includes('views/'+registry.working.basedOn+'.html'));assert.ok(grid.children[0].querySelector('iframe').src.includes('views/working.html'));
  await nodes.get('#copy-link').events.click();assert.ok(copied.includes('view=compare'));assert.ok(copied.includes('device=mobile'));
  nodes.get('#single-mode').events.click();assert.equal(grid.children.length,1);assert.equal(nodes.get('#view-title').textContent,R.get(registry,registry.working.basedOn).label+' · '+R.get(registry,registry.working.basedOn).title);
});
test('direct view documents contain the real UI, share the catalog, and have no readiness overlay',()=>{
  const shared=[];
  for(const id of R.entries(registry).map(v=>v.id)){
    const html=fs.readFileSync(path.join(dist,'views',id+'.html'),'utf8');
    assert.ok(html.includes('data-action="diagnosis"'));
    assert.ok(html.includes('data-action="groups"'));
    assert.ok(html.includes('data-version="'+id+'"'));
    assert.ok(!html.includes('<iframe'));
    assert.ok(!html.includes('srcdoc'));
    assert.ok(!html.includes('id="status"'));
    assert.ok(html.indexOf('preview-runtime.js')<html.indexOf('src="app.js'));
    assert.ok(html.indexOf('preview-controls.js')>html.indexOf('src="app.js'));
    shared.push(html.match(/src="(\/shared\/catalog-[a-f0-9]+\.js)"/)[1]);
    const source=fs.readFileSync(path.join(dist,R.get(registry,id).path,'catalog.js'));
    assert.deepEqual(fs.readFileSync(path.join(dist,shared.at(-1))),source);
  }
  assert.equal(new Set(shared).size,1);
  assert.ok(!fs.readFileSync(path.join(dist,'preview-controls.js'),'utf8').includes('postMessage('));
});
