/** SATURN LAB V0.1: isolated wet-only scenes, preserve approved master, 48 events, presets, export. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium,webkit} from 'playwright';
const port=4421;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:process.cwd(),stdio:'ignore'});
function wav(freq=130){
 const sr=44100,n=sr*3,bytes=Buffer.alloc(44+n*4);
 bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);
 bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(2,22);
 bytes.writeUInt32LE(sr,24);bytes.writeUInt32LE(sr*4,28);bytes.writeUInt16LE(4,32);
 bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(n*4,40);
 for(let i=0;i<n;i++){
  const t=i/sr;
  const v=Math.round(10000*((freq>450&&t>.8&&t<1.65?1:freq>450?.02:1)*(.82*Math.sin(2*Math.PI*freq*t)+.10*Math.sin(2*Math.PI*freq*1.5*t))));
  bytes.writeInt16LE(v,44+i*4);bytes.writeInt16LE(v,46+i*4);
 }
 return bytes;
}
const fixtures=[
 {name:'kick-snare-beat.wav',mimeType:'audio/wav',buffer:wav(115)},
 {name:'lead.wav',mimeType:'audio/wav',buffer:wav(425)},
 {name:'adlibs.wav',mimeType:'audio/wav',buffer:wav(1950)}
];
function maxPcmDelta(a,b,start=0,end=3){
 let max=0,mean=0,count=0;
 const sr=44100;
 for(let frame=Math.floor(start*sr);frame<Math.floor(end*sr);frame+=4){
  const at=44+frame*6;
  for(let c=0;c<2;c++){
   const dec=(bytes,index)=>{let x=bytes[index]|bytes[index+1]<<8|bytes[index+2]<<16;return (x&0x800000?x-0x1000000:x)/8388608};
   const d=Math.abs(dec(a,at+c*3)-dec(b,at+c*3));max=Math.max(max,d);mean+=d;count++;
  }
 }
 return {max,mean:mean/Math.max(1,count)};
}
let browser;
try{
 let ready=false;for(let i=0;i<130;i++){
  try{ready=(await fetch('http://127.0.0.1:'+port+'/')).ok;if(ready)break}catch{}
  await new Promise(r=>setTimeout(r,200));
 }
 assert(ready,'Vite must serve SATURN build');
 const engine=process.env.PLAYWRIGHT_BROWSER==='webkit'?webkit:chromium;
 browser=await engine.launch({headless:true,args:engine===webkit?[]:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:950},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'networkidle'});
 const dsp=await page.evaluate(async()=>{
  const {renderSaturn,scoutSaturn,saturnDefaults,saturnPathPoints,validSaturnEvent,validSaturnSettings,SATURN_MAX_EVENTS}
    =await import('/src/audio/saturn.ts');
  const sr=44100,n=sr*3;
  const master=new AudioBuffer({sampleRate:sr,length:n,numberOfChannels:2});
  const adlibs=new AudioBuffer({sampleRate:sr,length:n,numberOfChannels:1});
  const beat=new AudioBuffer({sampleRate:sr,length:n,numberOfChannels:1});
  for(let i=0;i<n;i++){
   const t=i/sr,low=.17*Math.sin(2*Math.PI*120*t),glide=t>.65&&t<1.25?.21*Math.sin(2*Math.PI*1780*t):0;
   for(let c=0;c<2;c++)master.getChannelData(c)[i]=low+(c===0?1:.92)*glide;
   adlibs.getChannelData(0)[i]=glide;
   beat.getChannelData(0)[i]=low;
  }
  const orig=Array.from(master.getChannelData(0));
  const stems={adlibs:{buffer:adlibs,mute:false,solo:false},beat:{buffer:beat,mute:false,solo:false}};
  const ev=[{id:1,source:'adlibs',at:.67,duration:.60,path:'slide-left-rear',level:.92}];
  const off=await renderSaturn(master,stems,ev,{...saturnDefaults,enabled:false});
  const zero=await renderSaturn(master,stems,ev,{...saturnDefaults,enabled:true,wet:0});
  const empty=await renderSaturn(master,stems,[],{...saturnDefaults,enabled:true});
  const on=await renderSaturn(master,stems,ev,{...saturnDefaults,enabled:true,wet:.9,trail:.7,hrtf:false});
  const binaural=await renderSaturn(master,stems,ev,{...saturnDefaults,enabled:true,wet:.9,trail:.7,hrtf:true,matchHrtf:true});
  const points=saturnPathPoints('slide-left-rear',.9,.9);
  const effects=(output,begin,end)=>{
   let delta=0,energy=0,peak=0,count=0,finite=true;
   for(let i=Math.floor(begin*sr);i<Math.floor(end*sr);i++){
    const dry=master.getChannelData(0)[i],sample=output.getChannelData(0)[i];
    delta=Math.max(delta,Math.abs(sample-dry));energy+=(sample-dry)**2;
    peak=Math.max(peak,Math.abs(sample));finite&&=Number.isFinite(sample);count++;
   }
   return {delta,wetRms:Math.sqrt(energy/count),peak,finite};
  };
  const sampleUnchanged=master.getChannelData(0).every((v,i)=>v===orig[i]);
  const ignoredBeat=!scoutSaturn(master,stems,'stems',10).some(x=>x.source==='beat');
  const long=new AudioBuffer({sampleRate:sr,length:sr*17,numberOfChannels:1});
  for(let i=0;i<long.length;i++)long.getChannelData(0)[i]=.2*Math.sin(2*Math.PI*1950*i/sr);
  const dense=scoutSaturn(long,{},'stereo',24);
  const focus=scoutSaturn(long,{},'stereo',12,8);
  const bad=!validSaturnEvent({...ev[0],source:'beat'});
  return {offIdentity:off===master,zeroIdentity:zero===master,emptyIdentity:empty===master,
   first:effects(on,0,.5),during:effects(on,.73,1.10),later:effects(on,2,2.9),
   hrtfDuring:effects(binaural,.73,1.10),sampleUnchanged,
   pathHasRear:points.at(-1)[1]>0,validSettings:validSaturnSettings(saturnDefaults),
   invalidSettings:!validSaturnSettings({...saturnDefaults,wet:5}),invalidBeat:bad,
   ignoredBeat,maxEvents:SATURN_MAX_EVENTS,scoutCount:dense.length,focusCount:focus.length,
   normalizedReferencePeak:Math.max(...master.getChannelData(0).slice(0,1000).map(x=>Math.abs(x)))};
 });
 assert(dsp.offIdentity&&dsp.zeroIdentity&&dsp.emptyIdentity,'SATURN OFF/zero/empty must return approved master by object identity');
 assert(dsp.sampleUnchanged,'SATURN must never mutate original PCM');
 assert(dsp.pathHasRear&&dsp.validSettings&&dsp.invalidSettings&&dsp.invalidBeat&&dsp.ignoredBeat,'route/settings/source invariants');
 assert.equal(dsp.maxEvents,48);
 assert(dsp.scoutCount>=15&&dsp.focusCount>=4,'dynamic scout should return substantially more candidates than V4.6 7');
 assert(dsp.first.delta<1e-7&&dsp.later.delta<1e-7,'no wet modification outside event and tail');
 assert(dsp.during.delta>.00002&&dsp.during.finite,'moving wet reflections must be real, finite audio');
 assert(dsp.hrtfDuring.delta>.00001&&dsp.hrtfDuring.finite,'optional HRTF wet rendering must work');
 assert(dsp.hrtfDuring.peak<=.98501,'HRTF must not clip');
 await page.getByRole('button',{name:/STEMS/}).first().click();
 for(let i=0;i<fixtures.length;i++)
  await page.locator('.stemGrid .stemChannel').nth(i===2?3:i).locator('input[type=file]').setInputFiles(fixtures[i]);
 await page.getByRole('button',{name:/BUILD REAL STEM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:45000});
 await page.getByRole('button',{name:/ROOM V4.3 · CENTER \+ HALO/}).click();
 await page.getByRole('button',{name:/REBUILD ROOM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:45000});
 const saturn=page.getByRole('region',{name:'SATURN LAB experimental spatial field'});
 await saturn.waitFor({timeout:15000});
 assert.equal(await saturn.getByRole('button',{name:'SATURN LAYER · OFF'}).count(),1,'SATURN OFF by default');
 assert.equal(await page.getByRole('button',{name:'ORBIT ENGINE · OFF'}).count(),1,'legacy Orbits stay OFF');
 await page.waitForFunction(()=>{const b=document.querySelector('button.export');return b&&!b.disabled},null,{timeout:100000});
 const dl0=page.waitForEvent('download');await page.locator('button.export').click();const baseline=await readFile(await (await dl0).path());
 await page.locator('input.seek').fill('0.9');
 await saturn.getByRole('button',{name:'+ EVENT AT PLAYHEAD'}).click();
 const source=await saturn.getByRole('combobox',{name:'SATURN event source'}).inputValue();
 assert.equal(source,'adlibs','SATURN should favor available vocal detail');
 await saturn.getByRole('button',{name:'SATURN LAYER · OFF'}).click();
 assert.equal(await saturn.getByRole('button',{name:'SATURN LAYER · ON'}).count(),1);
 await page.waitForFunction(()=>{const b=document.querySelector('button.export');return b&&!b.disabled},null,{timeout:100000});
 const dl1=page.waitForEvent('download');await page.locator('button.export').click();const shifted=await readFile(await (await dl1).path());
 assert.equal(shifted.length,baseline.length);
 assert(maxPcmDelta(baseline,shifted,.0,.4).max<.0003,'SATURN does not alter the start of master before motion');
 assert(maxPcmDelta(baseline,shifted,1.0,1.45).max>.00005,'SATURN edits only intended audible events');
 await saturn.getByRole('button',{name:'EXPERIMENTAL HRTF · WET ONLY OFF'}).click();
 await page.waitForFunction(()=>{const b=document.querySelector('button.export');return b&&!b.disabled},null,{timeout:110000});
 const dlH=page.waitForEvent('download');await page.locator('button.export').click();const hrtf=await readFile(await (await dlH).path());
 assert.equal(hrtf.length,baseline.length);
 assert(maxPcmDelta(baseline,hrtf,.0,.4).max<.0003,'HRTF wet only leaves earlier dry unchanged');
 const saved=page.waitForEvent('download');await page.getByRole('button',{name:/SAVE SETTINGS · V6/}).click();
 const preset=JSON.parse(await readFile(await (await saved).path(),'utf8'));
 assert.equal(preset.version,6);assert(preset.saturnSettings.enabled);
 assert(preset.saturnSettings.hrtf&&preset.saturnSettings.matchHrtf);
 assert.equal(preset.saturnEvents.length,1);
 assert.equal(preset.orbitSettings.enabled,false,'do not rewrite legacy V4.6 Orbit state');
 await page.getByRole('button',{name:/NEW SESSION/}).click();
 await page.getByRole('button',{name:/STEMS/}).first().click();
 await page.locator('.earlyPresetLoader input[type=file]').setInputFiles({name:'tt3-saturn-v6.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(preset))});
 await page.getByText(/V6 COMPLETE · ROOM \+ MASTER \+ STEM MIX/).waitFor();
 for(let i=0;i<fixtures.length;i++)
  await page.locator('.stemGrid .stemChannel').nth(i===2?3:i).locator('input[type=file]').setInputFiles(fixtures[i]);
 await page.getByRole('button',{name:/BUILD REAL STEM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:45000});
 const saturnRestored=page.getByRole('region',{name:'SATURN LAB experimental spatial field'});
 assert.equal(await saturnRestored.getByRole('button',{name:'SATURN LAYER · ON'}).count(),1);
 assert.equal(await saturnRestored.getByRole('combobox',{name:'SATURN selected event'}).locator('option').count(),1);
 assert.equal(await saturnRestored.getByRole('button',{name:'EXPERIMENTAL HRTF · WET ONLY ON'}).count(),1);
 // Explicitly clone approved V4.6 events into SATURN, never move/change the original.
 await page.locator('input.seek').fill('2.15');
 const orbitPanel=page.getByRole('region',{name:'Rear Orbits Micro Events'});
 await orbitPanel.getByRole('button',{name:/\\+ DETAIL AT PLAYHEAD/}).click();
 const originalOrbitCount=await page.locator('.orbitMarker').count();
 assert(originalOrbitCount>=1,'V4.6 original event exists');
 await saturnRestored.getByRole('button',{name:/COPY V4.6 EVENTS/}).click();
 assert.equal(await saturnRestored.getByRole('combobox',{name:'SATURN selected event'}).locator('option').count(),2,'SATURN now contains copied event');
 assert.equal(await page.locator('.orbitMarker').count(),originalOrbitCount,'V4.6 scene must not be changed by copy');
 await saturnRestored.getByRole('button',{name:'SATURN preset sliding field'}).click();
 assert.equal(await saturnRestored.getByRole('slider',{name:'SATURN SLIDE / GLIDE'}).inputValue(),'96','named SLIDING FIELD preset must apply');
 assert.equal(errors.length,0,errors.join('\\n'));
 console.log('SATURN LAB V0.1 PASS',JSON.stringify({browser:engine===webkit?'webkit':'chromium',dsp,initialMasterUntouched:true,rearMotionRenders:true,hrtfWetOnly:true,presetV6Restored:true,orbitV46Unchanged:true,legacyEventCopiedNonDestructively:true,namedSaturnPresetTested:true}));
}finally{await browser?.close();server.kill('SIGTERM')}
