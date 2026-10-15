const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),os=require('node:os'),cp=require('node:child_process');
const R=require('../dist/review-model.js'),root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),data=JSON.parse(fs.readFileSync(path.join(dist,'versions.json')));

test('all saved design files remain intact and V1 matches the handed-off original',()=>{
  R.validate(data);
  for(const version of data.versions){const folder=path.join(dist,version.path),manifest=JSON.parse(fs.readFileSync(path.join(folder,'snapshot.json')));for(const [file,hash] of Object.entries(manifest.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(folder,file))).digest('hex'),hash,version.id+'/'+file);}
  const original=JSON.parse(fs.readFileSync(path.join(root,'SOURCE_BASELINE.json')));for(const [file,info] of Object.entries(original.files)){if(file.startsWith('dist/'))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,'versions/v1',file.slice(5)))).digest('hex'),info.sha256);}
});
test('comparison links round-trip, reject invalid paths, and always show distinct versions',()=>{
  const s=R.normalize(data,new URLSearchParams('view=compare&left=v1&right=working&device=mobile&zoom=75&scenario=4'));assert.deepEqual(R.normalize(data,new URLSearchParams(R.query(s))),s);
  const fhd=R.normalize(data,new URLSearchParams('device=fullhd&scenario=scroll20'));
  assert.equal(fhd.device,'fullhd');assert.deepEqual(R.normalize(data,new URLSearchParams(R.query(fhd))),fhd);
  assert.deepEqual(R.devices.fullhd,{width:1920,height:1080});assert.equal(R.scale(960,'fullhd','fit'),.5);
  assert.equal(R.normalize(data,new URLSearchParams()).device,'fullhd');
  for(const device of ['fullhd','desktop','tablet','mobile'])assert.equal(R.normalize(data,new URLSearchParams('device='+device)).device,device);
  const fallback=R.normalize(data,new URLSearchParams('left=../../&right=working&device=bad&zoom=-1&scenario=99'));assert.notEqual(fallback.left,fallback.right);assert.equal(fallback.device,'fullhd');assert.equal(fallback.zoom,'fit');assert.equal(fallback.scenario,'keep');
  const bad=structuredClone(data);bad.versions[0].path='https://example.org/';assert.throws(()=>R.validate(bad));assert.equal(R.scale(640,'tablet','fit'),.5);assert.equal(R.scale(1920,'tablet','fit'),1);
});
test('the many-card scenario survives review links and direct-view initialization',()=>{
  const selected=R.normalize(data,new URLSearchParams('scenario=many'));
  assert.equal(R.normalize(data,new URLSearchParams('scenario=scroll20')).scenario,'scroll20');
  const failed=R.normalize(data,new URLSearchParams('scenario=6'));assert.equal(failed.scenario,'6');assert.equal(R.normalize(data,new URLSearchParams(R.query(failed))).scenario,'6');
  assert.equal(selected.scenario,'many');assert.equal(R.normalize(data,new URLSearchParams(R.query(selected))).scenario,'many');
  assert(R.previewUrl('working','many').endsWith('?scenario=many'));
  const window={localStorage:null};vm.runInNewContext(fs.readFileSync(path.join(dist,'preview-runtime.js'),'utf8'),{window,document:{currentScript:{dataset:{version:'working'}}},location:{search:'?scenario=many'},URLSearchParams,Map,Object,Array,String});
  assert.equal(window.__JEI_REVIEW__.scenario,'many');
});
test('version storage is isolated; clearing V1 cannot clear working or legacy state',()=>{
  const backing=new Map([['ai-math-prototype-diagnosis-v1','legacy']]);const native={get length(){return backing.size},key:i=>[...backing.keys()][i]??null,getItem:k=>backing.get(k)??null,setItem:(k,v)=>backing.set(k,String(v)),removeItem:k=>backing.delete(k)};
  function load(id){const window={__JEI_REVIEW__:{id},localStorage:native};vm.runInNewContext(fs.readFileSync(path.join(dist,'preview-runtime.js'),'utf8'),{window,document:{currentScript:{dataset:{version:id}}},location:{search:''},URLSearchParams,Map,Object,Array,String});return window.localStorage;}
  const a=load('v1'),b=load('working');assert.equal(a.getItem('ai-math-prototype-diagnosis-v1'),null);assert.equal(b.getItem('ai-math-prototype-diagnosis-v1'),'legacy');a.setItem('state','one');b.setItem('state','two');assert.equal(a.getItem('state'),'one');assert.equal(b.getItem('state'),'two');a.clear();assert.equal(a.getItem('state'),null);assert.equal(b.getItem('state'),'two');assert.equal(backing.get('ai-math-prototype-diagnosis-v1'),'legacy');
});
test('saving the next design version preserves V1 and rejects an unchanged duplicate',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jeimath-version-'));
  try{fs.cpSync(dist,path.join(temp,'dist'),{recursive:true});fs.mkdirSync(path.join(temp,'scripts'));fs.copyFileSync(path.join(root,'scripts/save-design-version.mjs'),path.join(temp,'scripts/save-design-version.mjs'));fs.copyFileSync(path.join(root,'scripts/build-review-views.mjs'),path.join(temp,'scripts/build-review-views.mjs'));fs.writeFileSync(path.join(temp,'CHANGELOG.md'),'# History\n');
    const run=()=>cp.spawnSync(process.execPath,['scripts/save-design-version.mjs','--title','Test change','--change','Changed only the working title'],{cwd:temp,encoding:'utf8'});
    assert.notEqual(run().status,0);const v1=fs.readFileSync(path.join(temp,'dist/versions/v1/index.html'),'utf8');fs.appendFileSync(path.join(temp,'dist/working/style.css'),'\n/* new design */\n');let result=run();assert.equal(result.status,0,result.stderr);const updated=JSON.parse(fs.readFileSync(path.join(temp,'dist/versions.json')));assert.equal(updated.versions.length,data.versions.length+1);assert.equal(updated.versions.at(-1).id,'v'+(1+Math.max(...data.versions.map(v=>Number(v.id.slice(1))))));assert.equal(fs.readFileSync(path.join(temp,'dist/versions/v1/index.html'),'utf8'),v1);assert.notEqual(run().status,0);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
