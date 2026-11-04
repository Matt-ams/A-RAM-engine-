/** Safeguard: old B audio must stop immediately on Orbit settings/event changes.
 * The audible new B, download WAV and verify-downloaded-WAV compare the same PCM.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium,webkit} from 'playwright';
const root=process.cwd(),port=4402;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:'ignore'});
const tone=freq=>{
 const rate=44100,length=rate*3,file=Buffer.alloc(44+length*4);
 file.write('RIFF',0);file.writeUInt32LE(file.length-8,4);file.write('WAVEfmt ',8);
 file.writeUInt32LE(16,16);file.writeUInt16LE(1,20);file.writeUInt16LE(2,22);
 file.writeUInt32LE(rate,24);file.writeUInt32LE(rate*4,28);file.writeUInt16LE(4,32);file.writeUInt16LE(16,34);
 file.write('data',36);file.writeUInt32LE(length*4,40);
 for(let i=0;i<length;i++){
  const t=i/rate,gain=freq>200&&((t<.4||t>1.55))?.15:1;
  const v=Math.round(11000*gain*(Math.sin(2*Math.PI*freq*t)+.18*Math.sin(2*Math.PI*freq*3*t)));
  file.writeInt16LE(v,44+i*4);file.writeInt16LE(v,46+i*4)
 }
 return file
};
const signed=(b,i)=>{let x=b[i]|b[i+1]<<8|b[i+2]<<16;return (x&0x800000)?x-0x1000000:x};
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch('http://127.0.0.1:'+port+'/')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,220))}assert(ready,'vite');
 const engine=process.env.PLAYWRIGHT_BROWSER==='webkit'?webkit:chromium;
 browser=await engine.launch({headless:true,args:engine===webkit?[]:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1360,height:940},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.__capture=[];const oldStart=AudioBufferSourceNode.prototype.start,oldStop=AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start=function(...args){
   if(this.context instanceof AudioContext){window.__last=this.buffer;window.__capture.push({action:'start',frames:this.buffer.length})}
   return oldStart.apply(this,args)
  };
  AudioBufferSourceNode.prototype.stop=function(...args){
   if(this.context instanceof AudioContext){window.__capture.push({action:'stop'})}
   return oldStop.apply(this,args)
  };
 });
 await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:/STEMS/}).first().click();
 await page.locator('.stemGrid .stemChannel').nth(0).locator('input[type=file]').setInputFiles({name:'test-beat.wav',mimeType:'audio/wav',buffer:tone(124)});
 await page.locator('.stemGrid .stemChannel').nth(1).locator('input[type=file]').setInputFiles({name:'test-lead.wav',mimeType:'audio/wav',buffer:tone(340)});
 await page.getByRole('button',{name:/BUILD REAL STEM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:60000});
 await page.getByRole('button',{name:/ROOM V4.3 · CENTER \+ HALO/}).click();
 await page.getByRole('button',{name:/REBUILD ROOM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:60000});
 const panel=page.getByRole('region',{name:'Rear Orbits Micro Events'});
 await panel.getByRole('button',{name:/\+ DETAIL AT PLAYHEAD/}).click();
 await panel.getByRole('slider',{name:'Orbit event time'}).fill('0.65');
 await panel.getByRole('slider',{name:'Orbit event duration'}).fill('0.8');
 await panel.getByRole('button',{name:'ORBIT ENGINE · OFF'}).click();
 await page.getByRole('slider',{name:'Orbit wet intensity'}).fill('20');
 const readyForExport=()=>page.waitForFunction(()=>{const b=document.querySelector('button.export');return b&&!b.hasAttribute('disabled')},null,{timeout:90000});
 await readyForExport();
 const firstD=page.waitForEvent('download');await page.locator('button.export').click();const wavBefore=await readFile(await (await firstD).path());
 await page.getByRole('button',{name:'Play audio'}).click();
 await page.getByRole('button',{name:'Pause audio'}).waitFor({timeout:10000});
 await page.getByRole('slider',{name:'Orbit wet intensity'}).fill('80');
 await page.getByRole('button',{name:'Play audio'}).waitFor({timeout:10000});
 assert.equal(await page.locator('button.export').isDisabled(),true,'export must disable while changed Orbit audio is not ready');
 const stopped=await page.evaluate(()=>window.__capture.some(e=>e.action==='stop'));
 assert.equal(stopped,true,'changing Orbit wet must stop old audio audition, not keep playing stale render');
 await readyForExport();
 const secondD=page.waitForEvent('download');await page.locator('button.export').click();const wavAfter=await readFile(await (await secondD).path());
 assert.equal(wavAfter.length,wavBefore.length);
 assert(!wavAfter.equals(wavBefore),'changing wet intensity must change audio master');
 await page.locator('.exportAuditPanel input[type=file]').setInputFiles({name:'new-render.wav',mimeType:'audio/wav',buffer:wavAfter});
 await page.getByText('PCM MATCH · EXPORT IS THE SAME ENGINE RENDER').waitFor({timeout:30000});
 await page.locator('.exportAuditPanel input[type=file]').setInputFiles({name:'stale-render.wav',mimeType:'audio/wav',buffer:wavBefore});
 await page.getByText('PCM MISMATCH · EXPORT IS NOT THE CURRENT RENDER').waitFor({timeout:30000});
 await page.getByRole('button',{name:'Play audio'}).click();
 await page.getByRole('button',{name:'Pause audio'}).waitFor({timeout:15000});
 const samples=await page.evaluate(()=>{
  const b=window.__last,arr=[];for(let i=0;i<4000;i+=17)for(let ch=0;ch<b.numberOfChannels;ch++)arr.push({pos:i*2+ch,val:b.getChannelData(ch)[i]});
  return arr
 });
 let max=0;for(const {pos,val} of samples)max=Math.max(max,Math.abs(signed(wavAfter,44+pos*3)/8388608-val));
 assert(max<.000002,'fresh B preview must match freshly exported WAV');
 // Event placement edits must also stop stale audio and block export while re-rendering.
 await page.getByRole('slider',{name:'Orbit event time'}).fill('1.2');
 await page.getByRole('button',{name:'Play audio'}).waitFor({timeout:10000});
 assert.equal(await page.locator('button.export').isDisabled(),true);
 await readyForExport();
 assert.equal(errors.length,0,errors.join(' / '));
 console.log('STALE ORBIT AUDITION / EXPORT QA PASS',JSON.stringify({browser:engine===webkit?'webkit':'chromium',oldStopped:true,exportBlockedDuringRender:true,oldExportRejectedByVerifier:true,newExportMatched:true,max24bitDifference:max,changedExport:true}));
}finally{await browser?.close();server.kill('SIGTERM')}
