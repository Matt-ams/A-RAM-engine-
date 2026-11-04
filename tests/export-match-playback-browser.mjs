/** Real browser audio-output and 24-bit export parity: Orbit ON, monitor FX, original lock. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium,webkit} from 'playwright';
const port=4399,root=process.cwd();
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:'ignore'});
function wav(freq){
 const sr=44100,n=sr*3,b=Buffer.alloc(44+n*4);
 b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*4,40);
 for(let i=0;i<n;i++){
  const t=i/sr,active=freq>250?(t>.4&&t<1.4?1:.05):1;
  const a=active*(.14*Math.sin(2*Math.PI*freq*t)+.038*Math.sin(2*Math.PI*freq*2*t));
  const q=Math.round(a*32767);b.writeInt16LE(q,44+i*4);b.writeInt16LE(q,46+i*4)
 }
 return b
}
const signed=(b,i)=>{let x=b[i]|b[i+1]<<8|b[i+2]<<16;return x&0x800000?x-0x1000000:x};
let browser;
try{
 let ready=false;for(let i=0;i<120;i++){try{ready=(await fetch('http://127.0.0.1:'+port+'/')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,230))}
 assert(ready,'Vite server not ready');
 const engine=process.env.PLAYWRIGHT_BROWSER==='webkit'?webkit:chromium;
 browser=await engine.launch({headless:true,args:engine===webkit?[]:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1370,height:900},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.__playbackSignals=[];
  const oldStart=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){
    if(this.context instanceof AudioContext){
     window.__lastRealPlayback=this.buffer;
     window.__playbackSignals.push({kind:'source',duration:this.buffer?.duration,channels:this.buffer?.numberOfChannels});
    }
    return oldStart.apply(this,args)
  };
  const oldGain=GainNode.prototype.connect;
  GainNode.prototype.connect=function(destination,...args){
   if(this.context instanceof AudioContext&&destination instanceof AudioDestinationNode){
    window.__playbackSignals.push({kind:'monitorDirect',gain:this.gain.value});
   }
   return oldGain.call(this,destination,...args)
  };
  const oldMerger=ChannelMergerNode.prototype.connect;
  ChannelMergerNode.prototype.connect=function(destination,...args){
   if(this.context instanceof AudioContext&&destination instanceof AudioDestinationNode){
    window.__playbackSignals.push({kind:'immersiveOutput'});
   }
   return oldMerger.call(this,destination,...args)
  };
 });
 await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:/STEMS/}).first().click();
 const fixtures=[{name:'beat.wav',mimeType:'audio/wav',buffer:wav(125)},{name:'lead.wav',mimeType:'audio/wav',buffer:wav(340)}];
 for(let i=0;i<2;i++)await page.locator('.stemGrid .stemChannel').nth(i).locator('input[type=file]').setInputFiles(fixtures[i]);
 await page.getByRole('button',{name:/BUILD REAL STEM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:40000});
 await page.getByRole('button',{name:/ROOM V4.3 · CENTER \+ HALO/}).click();
 await page.getByRole('button',{name:/REBUILD ROOM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:45000});
 const panel=page.getByRole('region',{name:'Rear Orbits Micro Events'});
 await panel.getByRole('button',{name:/\+ DETAIL AT PLAYHEAD/}).click();
 await panel.getByRole('slider',{name:'Orbit event time'}).fill('0.65');
 await panel.getByRole('slider',{name:'Orbit event duration'}).fill('0.7');
 await panel.getByRole('button',{name:'ORBIT ENGINE · OFF'}).click();
 await page.waitForFunction(()=>{const b=document.querySelector('button.export');return b&&!b.hasAttribute('disabled')},{timeout:90000});
 await page.locator('.monitor input[type=range]').fill('-18');
 await page.getByRole('button',{name:'IMMERSIVE MONITOR OFF'}).click();
 // Default EXPORT MATCH must override monitoring-only -18 dB and immersive stereo crossfeed.
 assert.equal(await page.getByRole('button',{name:/EXPORT MATCH · ON/}).getAttribute('aria-pressed'),'true');
 const download=page.waitForEvent('download',{timeout:60000});
 await page.locator('button.export').click();const wavBytes=await readFile(await (await download).path());
 assert.equal(wavBytes.toString('ascii',0,4),'RIFF');assert.equal(wavBytes.readUInt16LE(34),24);
 // Two consecutive exports of the same verified master must never acquire
 // random hiss, crackle or other new data during WAV serialization.
 const repeatDownload=page.waitForEvent('download',{timeout:60000});
 await page.locator('button.export').click();
 const wavRepeat=await readFile(await (await repeatDownload).path());
 assert(wavBytes.equals(wavRepeat),'Repeated WAV exports of the same processed buffer must be byte-for-byte deterministic');
 const verifyInput=page.getByRole('textbox',{name:'Compare exported WAV to ENGINE'});
 // The actual WAV downloaded by the user should match the actual internal B buffer.
 await page.locator('.exportAuditPanel input[type=file]').setInputFiles({name:'test-export.wav',mimeType:'audio/wav',buffer:wavBytes});
 await page.getByText('PCM MATCH · EXPORT IS THE SAME ENGINE RENDER').waitFor({timeout:30000});
 const changed=Buffer.from(wavBytes);
 changed[44+170*6]=changed[44+170*6]^0x10;
 await page.locator('.exportAuditPanel input[type=file]').setInputFiles({name:'corrupted.wav',mimeType:'audio/wav',buffer:changed});
 await page.getByText('PCM MISMATCH · EXPORT IS NOT THE CURRENT RENDER').waitFor({timeout:30000});
 const brokenFormat=Buffer.from(wavBytes);brokenFormat.writeUInt16LE(16,34);
 await page.locator('.exportAuditPanel input[type=file]').setInputFiles({name:'unsupported.wav',mimeType:'audio/wav',buffer:brokenFormat});
 await page.getByText(/accepts A\$RAM-style uncompressed PCM 24-bit/).waitFor({timeout:30000});
 await page.getByRole('button',{name:'Play audio'}).click();await page.getByRole('button',{name:'Pause audio'}).waitFor({timeout:22000});
 const preview=await page.evaluate(()=>{
  const b=window.__lastRealPlayback;if(!b)return null;
  const arr=[];for(let i=0;i<Math.min(b.length,2000);i+=13)for(let c=0;c<b.numberOfChannels;c++)arr.push({offset:i*2+c,value:b.getChannelData(c)[i]});
  return {duration:b.duration,rate:b.sampleRate,channels:b.numberOfChannels,events:window.__playbackSignals.slice(),samples:arr}
 });
 assert(preview?.samples.length>100,'failed to capture real B audition PCM buffer');
 assert(preview.events.some(x=>x.kind==='monitorDirect'&&x.gain===1),'Export-match B must use unity monitor gain');
 assert(!preview.events.some(x=>x.kind==='immersiveOutput'),'Export-match B must bypass immersive monitor path');
 let max=0,mean=0;
 for(const {offset,value} of preview.samples){
  const actual=signed(wavBytes,44+offset*3)/8388608;
  const d=Math.abs(actual-value);max=Math.max(max,d);mean+=d;
 }
 mean/=preview.samples.length;
 assert(max<0.000002,'Export WAV differs from B playback raw samples more than PCM24+dither tolerance');
 await page.getByRole('button',{name:'Pause audio'}).click();
 // Explicit legacy listening mode still exists and changes only monitoring, not exported PCM.
 await page.getByRole('button',{name:/EXPORT MATCH · ON/}).click();
 assert.equal(await page.getByRole('button',{name:/EXPORT MATCH · OFF/}).getAttribute('aria-pressed'),'false');
 await page.getByRole('button',{name:'Play audio'}).click();
 await page.getByRole('button',{name:'Pause audio'}).waitFor({timeout:22000});
 const legacy=await page.evaluate(()=>window.__playbackSignals.slice());
 assert(legacy.some(x=>x.kind==='immersiveOutput'),'legacy immersive monitoring should remain available');
 await page.getByRole('button',{name:'Pause audio'}).click();
 // Original Lock: the exportable source must be heard in B, not the mastered buffer.
 await page.getByRole('button',{name:/EXPORT MATCH · OFF/}).click();
 await page.getByRole('button',{name:'LOCK ORIGINAL'}).click();
 assert((await page.locator('.signalAudit').innerText()).includes('SOURCE LOCKED'));
 const locked=page.waitForEvent('download',{timeout:60000});await page.locator('button.export').click();
 const lockBytes=await readFile(await (await locked).path());
 await page.getByRole('button',{name:'Play audio'}).click();await page.getByRole('button',{name:'Pause audio'}).waitFor({timeout:22000});
 const lockPreview=await page.evaluate(()=>{const b=window.__lastRealPlayback;return {duration:b.duration,first:b.getChannelData(0)[1000],samples:Array.from({length:100},(_,i)=>({sample:i*11,value:b.getChannelData(0)[i*11]}))}});
 assert.equal(lockBytes.toString('ascii',0,4),'RIFF');
 let lockedDelta=0;for(const {sample,value} of lockPreview.samples){lockedDelta=Math.max(lockedDelta,Math.abs(signed(lockBytes,44+sample*6)/8388608-value))}
 assert(lockedDelta<.000002,'Original Lock B preview must match original locked WAV export');
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('EXPORT MATCH / WAV PCM PARITY PASS',JSON.stringify({browser:engine===webkit?'webkit':'chromium',wavBytes:wavBytes.length,maxPcm24Difference:max,meanPcm24Difference:mean,previewDirectUnity:true,repeatedWavByteIdentical:true,legacyImmersiveStillAvailable:true,originalLockParity:true,lockedMaxDelta:lockedDelta}));
}finally{await browser?.close();server.kill('SIGTERM')}
