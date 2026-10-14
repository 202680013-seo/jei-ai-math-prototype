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
