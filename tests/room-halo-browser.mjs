/** Verifies wet-only ROOM HALO does not touch musical dry samples. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4299','--strictPort'],{cwd:root,stdio:'ignore'});
let browser;
try {
 let up=false;for(let i=0;i<70;i++){try{up=(await fetch('http://127.0.0.1:4299/')).ok;if(up)break}catch{}await new Promise(r=>setTimeout(r,250))}
 assert(up,'dev server not ready');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1366,height:950}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4299/',{waitUntil:'networkidle'});
 const result=await page.evaluate(async()=>{
  const {renderCleanHalo}=await import('/src/audio/roomHalo.ts');
  const sr=44100,n=sr*2,beat=new AudioBuffer({length:n,numberOfChannels:2,sampleRate:sr}),lead=new AudioBuffer({length:n,numberOfChannels:1,sampleRate:sr});
  for(let i=0;i<n;i++){beat.getChannelData(0)[i]=.18*Math.sin(2*Math.PI*105*i/sr);beat.getChannelData(1)[i]=.17*Math.sin(2*Math.PI*121*i/sr);lead.getChannelData(0)[i]=.28*Math.sin(2*Math.PI*280*i/sr)}
  const original=lead.getChannelData(0)[1200];
  const item=(buffer,pan)=>({buffer,pan,gain:0,mute:false,solo:false});
  const stems={beat:item(beat,0),lead:item(lead,.3),doubles:item(null,0),adlibs:item(null,0)};
  const depth={beat:.45,lead:.2,doubles:.5,adlibs:.5},copies=[{id:1,key:'beat',pan:-.5,depth:.8}];
  const dry=await renderCleanHalo(stems,depth,copies,false,0,.42,.38,true);
  const wet=await renderCleanHalo(stems,depth,copies,false,.24,.42,.38,true);
  const classic=await renderCleanHalo(stems,depth,copies,false,0,.42,.38,false);
  let firstDiff=0,laterDiff=0,finite=true,monoEnergy=0,stereoEnergy=0;
  for(let ch=0;ch<2;ch++){
   const a=dry.getChannelData(ch),b=wet.getChannelData(ch);
   for(let i=0;i<Math.floor(sr*.06);i++)firstDiff=Math.max(firstDiff,Math.abs(a[i]-b[i]));
   for(let i=sr;i<sr+2000;i++)laterDiff=Math.max(laterDiff,Math.abs(a[i]-b[i]));
   for(let i=0;i<wet.length;i++){if(!Number.isFinite(b[i]))finite=false}
  }
  let maxPeak=0;for(let ch=0;ch<2;ch++)for(const v of wet.getChannelData(ch))maxPeak=Math.max(maxPeak,Math.abs(v));
  return{firstDiff,laterDiff,finite,sourceUnchanged:original===lead.getChannelData(0)[1200],
   dryDuration:dry.duration,wetDuration:wet.duration,maxPeak,
   classicCompared:Math.abs(classic.getChannelData(0)[500]-dry.getChannelData(0)[500])};
 });
 assert(result.firstDiff<2e-7,'WET HALO altered the undelayed musical dry signal');
 assert(result.laterDiff>1e-6,'WET ambience should create a different tail');
 assert(result.finite&&result.sourceUnchanged);
 assert(result.wetDuration>result.dryDuration+.2);
 const buttons=await page.locator('.roomVersion button').allInnerTexts();
 assert(buttons.some(t=>t.includes('CLASSIC'))&&buttons.some(t=>t.includes('HALO'))&&buttons.some(t=>t.includes('ENHANCED')));
 assert((await page.locator('.roomVersion button.sel').innerText()).includes('CLASSIC'),'Default must be pristine Classic');
 assert.equal(errors.length,0,errors.join(' / '));
 console.log('ROOM HALO PASS',JSON.stringify(result),buttons);
}finally {await browser?.close();server.kill('SIGTERM')}
