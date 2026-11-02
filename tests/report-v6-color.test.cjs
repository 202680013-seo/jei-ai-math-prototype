const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../dist/versions/v77/color-engine.js');
test('OKLCH conversion round trips sRGB and palettes retain contrast across hue/chroma/lightness extremes',()=>{
 for(const h of ['#e5303a','#328472','#5379ae','#ffffff','#000000']){const v=C.lab(h);assert.equal(C.hex(v.l,v.c,v.h),h);}
 for(const l of [.15,.4,.65,.9])for(const c of [0,.15,.32])for(let h=0;h<360;h+=15){const p=C.palette({l,c,h});assert(C.contrast(p.primary,p.onPrimary)>=4.5);assert(C.contrast(p.text,p.active)>4.5);assert(C.lab(p.page).l>C.lab(p.active).l);assert(C.lab(p.active).l>C.lab(p.border).l);for(const [k,v]of Object.entries(p))if(k!=='v')assert(/^#[a-f0-9]{6}$/.test(v),k);}
});
test('V6 shares learner flow and uses an independent settings panel while V5 remains preserved',()=>{
 const html=fs.readFileSync('dist/report-v6.html','utf8'),source=fs.readFileSync('dist/versions/v77/report.js','utf8');
 assert(html.includes('/versions/v74/app.js'));assert(html.includes('/versions/v75/report-v5.css'));assert(source.includes('document.body.append(dock,gear)'));assert(source.includes('dock.hidden=true'));assert(!source.includes("||collapsed){setPanelCollapsed"));
 assert(fs.readFileSync('dist/report-v5.html','utf8').includes('/versions/v71/report.js'));
});
test('V6 color changes and reset write only accent variables, never page or card roles',()=>{
 const vm=require('node:vm'),source=fs.readFileSync('dist/versions/v77/color-panel.js','utf8');
 const values=new Map([['--theme-page','#ffffff'],['--theme-active','#fde4e0'],['--theme-text','#383838']]);
 const context={C,chosen:true,values:C.lab('#328472'),palette:null,key:'test',sync(){},localStorage:{setItem(){}},root:{setAttribute(){},removeAttribute(){},style:{setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)}}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function apply(){'),source.indexOf('function sync(){')),context);context.apply();
 assert.equal(values.get('--theme-page'),'#ffffff');assert.equal(values.get('--theme-active'),'#fde4e0');assert.equal(values.get('--theme-text'),'#383838');assert(values.has('--v6-primary'));assert.equal(values.size,6);
 context.chosen=null;context.apply();assert.equal(values.size,3);
 const css=fs.readFileSync('dist/versions/v77/report-v6.css','utf8').split('/* Accent-only')[1];assert(!css.includes('mentor-bubble'));assert(!css.includes('--theme-page'));assert(!css.includes('.is-complete'));assert(!css.includes('.is-locked'));
});
