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
  const selectors=['#version-list','#version-count','#detail-title','#detail-date','#detail-changes','.sidebar-note strong','#toast','#single-mode','#compare-mode','#view-title','#view-description','#device','#zoom','#scenario','#compare-note','#compare-note span:last-child','#preview-grid','#viewport-label','#reload','#copy-link','#link-input','#link-dialog','#close-link-dialog','#menu-toggle','#sidebar','.app-layout','#close-sidebar','#sidebar-backdrop','#theme-preset','#theme-color','#theme-hex','#theme-reset'];
  const nodes=new Map(selectors.map(x=>[x,element()]));const grid=nodes.get('#preview-grid'),events={},location={origin:'https://review.example',pathname:'/',search:'',href:'https://review.example/'},history={replaceState(a,b,url){location.search=url;location.href=location.origin+'/'+url;},pushState(a,b,url){this.replaceState(a,b,url);}};
  const stored=new Map(),screen={matches:false};
  let copied;const document={querySelector:s=>nodes.get(s)||null,querySelectorAll:s=>s==='.preview-pane'?grid.children:grid.querySelectorAll(s),createElement:element,createElementNS:(ns,tag)=>element(tag),addEventListener:(k,f)=>events[k]=f};
  const c=vm.createContext({document,window:{addEventListener:(k,f)=>events[k]=f,matchMedia:()=>screen,localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)}},location,history,navigator:{clipboard:{writeText:async x=>{copied=x;}}},ReviewModel:R,JeiTheme:require('../dist/theme-model.js'),fetch:async()=>({ok:true,json:async()=>structuredClone(registry)}),URLSearchParams,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>fn(),getComputedStyle:()=>({paddingLeft:'22px',paddingRight:'22px'}),setTimeout:()=>1,clearTimeout(){},console});
  await vm.runInContext(fs.readFileSync(path.join(dist,'workspace.js'),'utf8'),c);
  assert.equal(grid.children.length,1);assert.equal(nodes.get('#view-title').textContent,'현재 작업본');assert.equal(grid.children[0].querySelector('iframe').src,'views/working.html');
  nodes.get('#compare-mode').events.click();assert.equal(grid.children.length,2);assert.equal(nodes.get('#compare-note').hidden,!registry.working.matchesBaseline);assert.equal(grid.children[0].querySelector('iframe').src,'views/'+registry.working.basedOn+'.html');assert.equal(grid.children[1].querySelector('iframe').src,'views/working.html');
  nodes.get('#device').events.change({target:{value:'mobile'}});assert.equal(grid.children[0].querySelector('iframe').style.width,'390px');assert.equal(grid.children[1].querySelector('iframe').style.width,'390px');
  nodes.get('#scenario').events.change({target:{value:'4'}});assert.ok(grid.children.every(p=>p.querySelector('iframe').src.endsWith('?scenario=4')));
  const select=grid.children[0].querySelector('select');select.value='working';select.events.change();assert.ok(grid.children[1].querySelector('iframe').src.includes('views/'+registry.working.basedOn+'.html'));assert.ok(grid.children[0].querySelector('iframe').src.includes('views/working.html'));
  await nodes.get('#copy-link').events.click();assert.ok(copied.includes('view=compare'));assert.ok(copied.includes('device=mobile'));
  nodes.get('#single-mode').events.click();assert.equal(grid.children.length,1);assert.equal(nodes.get('#view-title').textContent,R.get(registry,registry.working.basedOn).label+' · '+R.get(registry,registry.working.basedOn).title);
  // Management panel visibility resizes the existing iframe, without reloading learner state.
  const liveFrame=grid.children[0].querySelector('iframe'),liveRoute=liveFrame.src;
  assert.equal(nodes.get('#sidebar').hidden,false);
  assert.equal(nodes.get('#menu-toggle').attrs['aria-expanded'],'true');
  nodes.get('#close-sidebar').events.click();
  assert.equal(nodes.get('#sidebar').hidden,true);assert.equal(nodes.get('#sidebar').inert,true);
  assert(nodes.get('.app-layout').classList.contains('sidebar-collapsed'));
  assert.equal(nodes.get('#menu-toggle').attrs['aria-label'],'버전 관리 패널 열기');
  assert.equal(stored.get('jei-review-sidebar-desktop'),'closed');
  assert.equal(grid.children[0].querySelector('iframe'),liveFrame);assert.equal(liveFrame.src,liveRoute);
  nodes.get('#menu-toggle').events.click();
  assert.equal(nodes.get('#sidebar').hidden,false);assert.equal(nodes.get('#sidebar').inert,false);
  assert.equal(stored.get('jei-review-sidebar-desktop'),'open');
  events.keydown({key:'Escape'});assert.equal(nodes.get('#sidebar').hidden,true);
  nodes.get('#menu-toggle').events.click();
  screen.matches=true;events.resize();
  assert.equal(nodes.get('#sidebar').hidden,true); // small screens start with the drawer closed
  nodes.get('#menu-toggle').events.click();assert.equal(nodes.get('#sidebar-backdrop').hidden,false);
  nodes.get('#sidebar-backdrop').events.click();assert.equal(nodes.get('#sidebar').hidden,true);
  assert.equal(nodes.get('#sidebar-backdrop').hidden,true);
  assert.equal(stored.get('jei-review-sidebar-desktop'),'open'); // mobile does not overwrite the desktop preference
  screen.matches=false;events.resize();assert.equal(nodes.get('#sidebar').hidden,false);
  assert.equal(grid.children[0].querySelector('iframe'),liveFrame);assert.equal(liveFrame.src,liveRoute);

  // Live theme changes keep the iframe and learner session in place.
  const frame=grid.children[0].querySelector('iframe'),originalRoute=frame.src,messages=[];
  frame.contentWindow={postMessage:(data,origin)=>messages.push({data,origin})};
  nodes.get('#theme-preset').events.change({target:{value:'mint'}});
  assert.equal(grid.children[0].querySelector('iframe'),frame);
  assert.equal(frame.src,originalRoute);
  assert.equal(messages.at(-1).data.color,'#8edbb6');
  assert.equal(messages.at(-1).origin,location.origin);
  assert.equal(nodes.get('#theme-color').value,'#8edbb6');
  assert.ok(grid.children[0].querySelector('.open-link').href.includes('color=%238edbb6'));
  await nodes.get('#copy-link').events.click();assert.ok(copied.includes('color=%238edbb6'));
  nodes.get('#theme-hex').events.change({target:{value:'javascript:bad'}});
  assert.equal(messages.at(-1).data.color,'#8edbb6');
  nodes.get('#theme-reset').events.click();assert.equal(messages.at(-1).data.color,null);
  assert.ok(!location.search.includes('color='));
  const before=grid.children[0].querySelector('iframe').src,source={};grid.children[0].querySelector('iframe').contentWindow=source;
  events.message({origin:'https://untrusted.example',source,data:{type:'jei-history-navigate',versionId:'v2',checkpoint:'cp-test'}});assert.equal(grid.children[0].querySelector('iframe').src,before);
  events.message({origin:location.origin,source:{},data:{type:'jei-history-navigate',versionId:'v2',checkpoint:'cp-test'}});assert.equal(grid.children[0].querySelector('iframe').src,before);
  events.message({origin:location.origin,source,data:{type:'jei-history-navigate',versionId:'v2',checkpoint:'cp-test'}});assert.equal(grid.children[0].querySelector('iframe').src,'views/v2.html?checkpoint=cp-test');assert.equal(nodes.get('#view-title').textContent,'V2 · 민트 학습 화면');assert.equal(nodes.get('#scenario').value,'keep');
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
    assert.ok(html.indexOf('history-model.js')<html.indexOf('preview-runtime.js'));
    assert.ok(html.indexOf('history-ui.js')>html.indexOf('preview-controls.js'));
    shared.push(html.match(/src="(\/shared\/catalog-[a-f0-9]+\.js)"/)[1]);
    const source=fs.readFileSync(path.join(dist,R.get(registry,id).path,'catalog.js'));
    assert.deepEqual(fs.readFileSync(path.join(dist,shared.at(-1))),source);
  }
  assert.equal(new Set(shared).size,1);
  assert.ok(!fs.readFileSync(path.join(dist,'preview-controls.js'),'utf8').includes('postMessage('));
});
