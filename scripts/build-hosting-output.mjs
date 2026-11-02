import {cpSync,rmSync,readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
// Keep immutable source snapshots intact. Only deployment copies share identical catalogs.
const source='dist',output='site-dist';rmSync(output,{recursive:true,force:true});cpSync(source,output,{recursive:true});
const shared=new Map(readdirSync(join(output,'shared')).filter(n=>/^catalog-.*\.js$/.test(n)).map(n=>[createHash('sha256').update(readFileSync(join(output,'shared',n))).digest('hex'),'/shared/'+n]));
let count=0,saved=0;
function walk(dir){for(const name of readdirSync(dir)){const path=join(dir,name);if(statSync(path).isDirectory())walk(path);else if(name==='catalog.js'){const bytes=readFileSync(path),url=shared.get(createHash('sha256').update(bytes).digest('hex'));if(!url)continue;const shim=`document.write('<script src="${url}"><\\/script>');\n`;writeFileSync(path,shim);saved+=bytes.length-Buffer.byteLength(shim);count++;}}}
walk(output);console.log(JSON.stringify({catalogsShared:count,bytesSaved:saved}));
