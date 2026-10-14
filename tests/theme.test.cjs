const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const T=require('../dist/theme-model.js'),R=require('../dist/review-model.js');
test('custom themes preserve defaults, alpha and legible primary text, and reject unsafe colors',()=>{
  assert.equal(T.normalize('#12AB3F'),'#12ab3f');
  for(const invalid of ['red','#abc','#123456;display:none','url(https://example.org)'])assert.equal(T.normalize(invalid),null);
  for(const color of [...Object.values(T.PRESETS),'#146850','#222222','#fafafa','#1166cc']){
    const palette=T.palette(color);assert.equal(palette['--jei-c-9fe870'],color);
    assert(T.contrast(color,palette['--jei-on-accent'])>=4.5);
    assert.equal(T.recolor('#16330020',color).slice(-2),'20');
    assert(Object.values(palette).every(v=>/^#[a-f\d]{6}(?:[a-f\d]{2})?$|^url\("data:image\/svg\+xml,/i.test(v)));
  }
  assert.equal(T.recolor('#edf5e7',T.DEFAULT),'#edf5e7');
  assert.equal(R.normalizeColor('#123456;background:red'),null);
  const registry=JSON.parse(fs.readFileSync('dist/versions.json','utf8'));
  const state=R.normalize(registry,new URLSearchParams('color=%238edbb6'));
  assert.equal(R.normalize(registry,new URLSearchParams(R.query(state))).color,'#8edbb6');
  assert.equal(R.previewUrl('working','4','#8edbb6'),'views/working.html?scenario=4&color=%238edbb6');
});
test('preview theme accepts only the same-origin parent and only affects opted-in versions',()=>{
  const script=fs.readFileSync('dist/theme-preview.js','utf8'),properties={},attrs={'data-jei-color-theme':'true'},events={},parent={};
  const root={getAttribute:k=>attrs[k],setAttribute:(k,v)=>attrs[k]=v,style:{setProperty:(k,v)=>properties[k]=v}};
  const c={window:{JeiTheme:T,parent,addEventListener:(k,f)=>events[k]=f},document:{documentElement:root},location:{origin:'https://review.example',search:'?color=%238edbb6'},URLSearchParams};
  vm.runInNewContext(script,c);assert.equal(properties['--jei-accent'],'#8edbb6');
  events.message({origin:'https://other.example',source:parent,data:{type:'jei-theme-preview',color:'#bad18d'}});assert.equal(properties['--jei-accent'],'#8edbb6');
  events.message({origin:c.location.origin,source:{},data:{type:'jei-theme-preview',color:'#bad18d'}});assert.equal(properties['--jei-accent'],'#8edbb6');
  events.message({origin:c.location.origin,source:parent,data:{type:'jei-theme-preview',color:'url(bad)'}});assert.equal(properties['--jei-accent'],'#8edbb6');
  events.message({origin:c.location.origin,source:parent,data:{type:'jei-theme-preview',color:'#bad18d'}});assert.equal(properties['--jei-accent'],'#bad18d');
  events.message({origin:c.location.origin,source:parent,data:{type:'jei-theme-preview',color:null}});assert.equal(properties['--jei-accent'],T.DEFAULT);
  attrs['data-jei-color-theme']='false';delete events.message;vm.runInNewContext(script,c);assert.equal(events.message,undefined);
});

test('whole-screen presets use independent semantic palettes and accessible text colors',()=>{
  const baseline=T.palette(T.DEFAULT),current=T.presetPalette('current');
  for(const [key,value] of Object.entries(baseline))assert.equal(current[key],value);
  for(const id of ['teal','green']){
    const r=T.THEMES[id].roles,p=T.presetPalette(id);
    for(const role of ['page','title','muted','line','soft','active','locked','primary','night'])assert.notEqual(r[role],T.THEMES.current.roles[role]);
    assert.equal(p['--jei-c-f7f9f4'],r.page);assert.equal(p['--jei-c-163300'],r.title);
    assert.equal(p['--jei-c-65705f'],r.muted);assert.equal(p['--jei-c-e0e6db'],r.line);
    assert.equal(p['--jei-c-edf5e7'],r.soft);assert.equal(p['--jei-c-16330020'],r.title+'20');
    for(const [foreground,background] of [[r.title,r.page],[r.text,r.surface],[r.muted,r.surface],[r.muted,r.page],[r.brand,r.surface],[r.onPrimary,r.primary],[r.onActive,r.active],[r.nightText,r.night]])assert(T.contrast(foreground,background)>=4.5,id+' '+foreground+' / '+background);
    assert(T.contrast(r.accent,p['--jei-on-accent'])>=4.5);
  }
  for(const invalid of ['__proto__','custom','url(bad)',null,{}])assert.equal(T.normalizeTheme(invalid),null);
  const registry=JSON.parse(fs.readFileSync('dist/versions.json','utf8'));
  for(const theme of ['teal','green']){
    const state=R.normalize(registry,new URLSearchParams('theme='+theme+'&color=%23abcdef'));
    assert.equal(state.theme,theme);assert.equal(state.color,null);
    assert.equal(R.normalize(registry,new URLSearchParams(R.query(state))).theme,theme);
    assert.equal(R.previewUrl('working','4',null,theme),'views/working.html?scenario=4&theme='+theme);
  }
  assert.equal(R.normalize(registry,new URLSearchParams('theme=untrusted')).theme,'current');
  const html=fs.readFileSync('dist/index.html','utf8');assert(!html.includes('type="color"'));assert(!html.includes('id="theme-hex"'));
});
test('live preset messages validate the sender and reset every role without leaving prior theme colors',()=>{
  const script=fs.readFileSync('dist/theme-preview.js','utf8'),properties={},attrs={'data-jei-color-theme':'true'},events={},parent={};
  const root={getAttribute:k=>attrs[k],setAttribute:(k,v)=>attrs[k]=v,style:{setProperty:(k,v)=>properties[k]=v}};
  const c={window:{JeiTheme:T,parent,addEventListener:(k,f)=>events[k]=f},document:{documentElement:root},location:{origin:'https://review.example',search:'?theme=teal'},URLSearchParams};
  vm.runInNewContext(script,c);assert.equal(attrs['data-preview-theme'],'teal');assert.equal(properties['--theme-page'],T.THEMES.teal.roles.page);
  const send=(data,origin=c.location.origin,source=parent)=>events.message({origin,source,data:{type:'jei-theme-preview',...data}});
  send({theme:'green'},'https://other.example');send({theme:'green'},c.location.origin,{});send({theme:'__proto__'});
  assert.equal(attrs['data-preview-theme'],'teal');
  send({theme:'green'});assert.equal(attrs['data-preview-theme'],'green');assert.equal(properties['--theme-primary'],T.THEMES.green.roles.primary);
  send({theme:'current',color:null});assert.equal(attrs['data-preview-theme'],'current');
  for(const [key,value] of Object.entries(T.presetPalette('current')))assert.equal(properties[key],value);
  send({theme:'teal'});send({theme:'current',color:'#123456;bad'});assert.equal(attrs['data-preview-theme'],'teal');
});
