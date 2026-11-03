/** ROOM V4.2 browser integration. Run after: npx playwright install chromium */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4189','--strictPort'],{cwd:root,stdio:'ignore'});
const url='http://127.0.0.1:4189/';
function wav(sr,seconds,freq,channels){
 const n=Math.round(sr*seconds),b=Buffer.alloc(44+n*2*channels);
 b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);
 b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(channels,22);
 b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*channels*2,28);
 b.writeUInt16LE(channels*2,32);b.writeUInt16LE(16,34);
 b.write('data',36);b.writeUInt32LE(n*channels*2,40);
 for(let i=0;i<n;i++)for(let c=0;c<channels;c++)
  b.writeInt16LE(Math.round(12000*Math.sin(2*Math.PI*(freq+c*35)*i/sr)),44+(i*channels+c)*2);
 return b;
}
let browser;
try{
 let connected=false;
 for(let i=0;i<80;i++){try{const r=await fetch(url);if(r.ok){connected=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}
 assert(connected,'Vite did not start');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1366,height:900},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'networkidle'});
 // Run real OfflineAudioContext with a 44.1k stereo beat and 48k mono vocal, including a copy.
 const dsp=await page.evaluate(async()=>{
  const {renderEnhancedRoom}=await import('/src/audio/room.ts');
  const beat=new AudioBuffer({numberOfChannels:2,length:44100,sampleRate:44100});
  const lead=new AudioBuffer({numberOfChannels:1,length:86400,sampleRate:48000});
  for(let i=0;i<beat.length;i++){
   beat.getChannelData(0)[i]=.22*Math.sin(2*Math.PI*110*i/44100);
   beat.getChannelData(1)[i]=.18*Math.sin(2*Math.PI*220*i/44100);
  }
  for(let i=0;i<lead.length;i++)lead.getChannelData(0)[i]=.31*Math.sin(2*Math.PI*330*i/48000);
  const original=beat.getChannelData(0)[500];
  const st=(buffer,pan)=>({buffer,pan,gain:-3,mute:false,solo:false});
  const stems={beat:st(beat,-.2),lead:st(lead,.5),doubles:st(null,0),adlibs:st(null,0)};
  const opts={roomDepth:{beat:.4,lead:-.7,doubles:.6,adlibs:.6},
   roomDistance:{beat:.2,lead:.6,doubles:.2,adlibs:.4},
   roomCopies:[{id:1,key:'lead',pan:-.6,depth:.4,distance:.5}],
   binauralStems:true,size:.62,reflections:.75,absorption:.35,monoSubHz:120};
  const a=await renderEnhancedRoom(stems,opts);let finite=true;
  for(let ch=0;ch<2;ch++)for(const v of a.buffer.getChannelData(ch))if(!Number.isFinite(v))finite=false;
  return {...a.report,finite,sourceUnchanged:beat.getChannelData(0)[500]===original,
   trulyStereo:a.buffer.getChannelData(0)[600]!==a.buffer.getChannelData(1)[600]};
 });
 assert.equal(dsp.sampleRate,48000);assert.equal(dsp.sourceRateConversions,1);
 assert(dsp.renderedSeconds>=2.1&&dsp.sourceSeconds===1.8);
 assert.equal(dsp.copiesRendered,1);assert.equal(dsp.finite,true);
 assert.equal(dsp.sourceUnchanged,true);assert.equal(dsp.trulyStereo,true);
 assert(dsp.peakAfterTrim<=.961);
 // Existing stem UI, re-render after every edit, A/B Classic fallback and real WAV/preset downloads.
 await page.getByRole('button',{name:/STEMS/}).first().click();
 const inputs=page.locator('input[type=file][accept*="audio"]');
 await inputs.nth(0).setInputFiles({name:'BEAT_44.wav',mimeType:'audio/wav',buffer:wav(44100,1.2,110,2)});
 await inputs.nth(1).setInputFiles({name:'LEAD_48.wav',mimeType:'audio/wav',buffer:wav(48000,1.7,220,1)});
 await page.getByRole('button',{name:/BUILD REAL STEM BUS/}).click();
 await page.locator('.roomDiagnostics').waitFor({timeout:45000});
 await page.getByRole('button',{name:/DUPLICATE LEAD/}).click();
 assert.match(await page.locator('.roomVersion span').innerText(),/PENDING/);
 assert(await page.locator('button.export').isDisabled(),'stale ROOM export must be blocked');
 await page.getByRole('button',{name:/REBUILD ROOM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:45000});
 assert.match(await page.locator('.roomDiagnostics').innerText(),/1 safe copy/);
 await page.getByRole('button',{name:/HRTF BINAURAL OFF/}).click();
 await page.getByRole('button',{name:/REBUILD ROOM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:45000});
 const exp=page.waitForEvent('download',{timeout:45000});
 await page.locator('button.export').click();
 const exportFile=await exp;
 assert.equal(readFileSync(await exportFile.path()).toString('ascii',0,4),'RIFF');
 const saved=page.waitForEvent('download',{timeout:45000});
 await page.getByRole('button',{name:/SAVE SETTINGS/}).click();
 const presetFile=await saved;
 const preset=JSON.parse(readFileSync(await presetFile.path(),'utf8'));
 assert.equal(preset.version,3);assert.equal(preset.roomCopies.length,1);
 assert.equal(preset.enhancedRoom,true);
 await page.getByRole('button',{name:/ROOM V4.1 · CLASSIC/}).click();
 await page.getByRole('button',{name:/REBUILD ROOM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:45000});
 assert.equal(await page.locator('.roomDiagnostics').count(),0);
 assert.deepEqual(errors,[]);
 console.log('ROOM V4.2 BROWSER PASS: sample rates, HRTF stereo, bounded copies, mono guard, no NaN, preset v3, classic fallback, WAV');
}finally{await browser?.close();server.kill('SIGTERM')}
