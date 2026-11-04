/** ROOM V4.3 HRTF gain + wet/dry audit: unchanged historical DSP. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium,webkit} from 'playwright';
const root=process.cwd(),port=4393;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:'ignore'});
let browser;
try{
 let ok=false;for(let i=0;i<100;i++){try{ok=(await fetch('http://127.0.0.1:'+port+'/')).ok;if(ok)break}catch{}await new Promise(r=>setTimeout(r,170))}assert(ok,'vite');
 browser=await (process.env.PLAYWRIGHT_BROWSER==='webkit'?webkit:chromium).launch({headless:true,args:process.env.PLAYWRIGHT_BROWSER==='webkit'?[]:['--no-sandbox']});
 const page=await browser.newPage();await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'networkidle'});
 const m=await page.evaluate(async()=>{
  const {renderCleanHalo}=await import('/src/audio/roomHalo.ts');
  const sr=44100,len=sr*2;const waveform=(freq,amplitude)=>{const b=new AudioBuffer({numberOfChannels:1,length:len,sampleRate:sr});const x=b.getChannelData(0);for(let i=0;i<len;i++)x[i]=amplitude*Math.sin(2*Math.PI*freq*i/sr);return b};
  const beat=waveform(138,.18),lead=waveform(357,.22),quiet=waveform(357,0);
  const stem=(buffer,pan=0)=>({buffer,gain:0,pan,mute:false,solo:false});
  const create=(beatBuffer,leadBuffer)=>({beat:stem(beatBuffer,-.65),lead:stem(leadBuffer,0),doubles:stem(null,0),adlibs:stem(null,0)});
  const depth={beat:.45,lead:0,doubles:.65,adlibs:.72};
  const size=.42,absorption=.38,center=true;
  const rms=b=>{let p=0;for(let ch=0;ch<b.numberOfChannels;ch++){const data=b.getChannelData(ch);for(let i=0;i<Math.min(len,b.length);i++)p+=data[i]*data[i]}return Math.sqrt(p/(Math.min(len,b.length)*b.numberOfChannels))};
  const rawLead=create(quiet,lead);
  const lOff=await renderCleanHalo(rawLead,depth,[],false,0,size,absorption,center);
  const lOn=await renderCleanHalo(rawLead,depth,[],true,0,size,absorption,center);
  const lHaloOff=await renderCleanHalo(rawLead,depth,[],false,.30,size,absorption,center);
  const lHaloOn=await renderCleanHalo(rawLead,depth,[],true,.30,size,absorption,center);
  const rawBeat=create(beat,quiet);
  const bOff=await renderCleanHalo(rawBeat,depth,[],false,0,size,absorption,center);
  const bOn=await renderCleanHalo(rawBeat,depth,[],true,0,size,absorption,center);
  const bHaloOff=await renderCleanHalo(rawBeat,depth,[],false,.30,size,absorption,center);
  const bHaloOn=await renderCleanHalo(rawBeat,depth,[],true,.30,size,absorption,center);
  const diff=(a,b)=>{let sum=0,max=0;for(let ch=0;ch<a.numberOfChannels;ch++){const x=a.getChannelData(ch),y=b.getChannelData(ch);for(let i=0;i<len;i++){const d=Math.abs(x[i]-y[i]);sum+=d;max=Math.max(max,d)}}return {max,mean:sum/(len*a.numberOfChannels)}};
  return {leadRmsHrtfOff:rms(lOff),leadRmsHrtfOn:rms(lOn),leadRatio:rms(lOn)/rms(lOff),
   beatRmsHrtfOff:rms(bOff),beatRmsHrtfOn:rms(bOn),beatRatio:rms(bOn)/rms(bOff),
   leadHaloRatio:rms(lHaloOn)/rms(lHaloOff),beatHaloRatio:rms(bHaloOn)/rms(bHaloOff),
   haloChangeLead:diff(lHaloOff,lHaloOn),haloChangeBeat:diff(bHaloOff,bHaloOn)};
 });
 console.log('HRTF measured',JSON.stringify(m));
 assert(Math.abs(m.leadRatio-.85)<.000001,'HRTF flag must reveal inherited 0.85 direct LEAD scalar');
 assert(Number.isFinite(m.beatRatio)&&Math.abs(m.beatRatio-1)>.01,'ROOM HRTF changes beat dry output due to both scalar and Panner');
 assert(Number.isFinite(m.leadHaloRatio)&&m.leadHaloRatio<1,'wet/dry balance is not level-matched when ROOM HRTF enabled');
 console.log('HISTORIC ROOM V4.3 HRTF GAIN AUDIT PASS',JSON.stringify({engine:process.env.PLAYWRIGHT_BROWSER==='webkit'?'webkit':'chromium',...m}));
}finally{await browser?.close();server.kill('SIGTERM')}
