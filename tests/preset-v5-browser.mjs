/** A$RAM V5 round-trip: STEM + ROOM + MASTER -> JSON -> new session -> WAV parity. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4341','--strictPort'],{cwd:root,stdio:'ignore'});
function wav(freq=150){
 const sr=44100,n=sr*3,bytes=Buffer.alloc(44+n*4);
 bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(2,22);
 bytes.writeUInt32LE(sr,24);bytes.writeUInt32LE(sr*4,28);bytes.writeUInt16LE(4,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(n*4,40);
 for(let i=0;i<n;i++){const v=Math.round(6500*Math.sin(2*Math.PI*freq*i/sr));bytes.writeInt16LE(v,44+i*4);bytes.writeInt16LE(v,46+i*4)}return bytes
}
const files=[{name:'beat.wav',mimeType:'audio/wav',buffer:wav(116)},{name:'lead.wav',mimeType:'audio/wav',buffer:wav(238)},{name:'doubles.wav',mimeType:'audio/wav',buffer:wav(315)}];
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch('http://127.0.0.1:4341/')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,250))}
 assert(ready,'Vite dev server unavailable');
 const engine=process.env.PLAYWRIGHT_BROWSER==='webkit'?webkit:chromium;
 browser=await engine.launch({headless:true,args:engine===webkit?[]:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4341/',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:/STEMS/}).first().click();
 const channel=page.locator('.stemGrid .stemChannel');
 for(let i=0;i<files.length;i++)await channel.nth(i).locator('input[type=file]').setInputFiles(files[i]);
 await channel.nth(0).locator('input[type=range]').nth(0).fill('-3.4');
 await channel.nth(0).locator('input[type=range]').nth(1).fill('0.35');
 await channel.nth(1).locator('input[type=range]').nth(0).fill('-2.2');
 await channel.nth(1).locator('input[type=range]').nth(1).fill('-0.2');
 await channel.nth(2).getByRole('button',{name:'MUTE'}).click();
 await page.getByRole('button',{name:/BUILD REAL STEM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:40000});
 await page.getByRole('button',{name:/ROOM V4.3 · CENTER \+ HALO/}).click();
 await page.locator('.haloPanel input[type=range]').fill('32');
 await page.getByRole('button',{name:/DUPLICATE BEAT/}).click();
 const copy=page.locator('.roomCopyRow').first();
 await copy.locator('input[type=range]').nth(0).fill('.82');
 await copy.locator('input[type=range]').nth(1).fill('-.48');
 await page.locator('.roomRebuild').click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:40000});
 await page.waitForFunction(()=>{const b=document.querySelector('button.export');return b&&!b.hasAttribute('disabled')},null,{timeout:90000});
 const firstPresetEvent=page.waitForEvent('download',{timeout:30000});await page.getByRole('button',{name:/SAVE SETTINGS · V5/}).click();const firstPreset=await firstPresetEvent;const preset=JSON.parse(await readFile(await firstPreset.path(),'utf-8'));
 assert.equal(preset.version,5);
 assert.equal(preset.format,'asram-studio-preset');
 assert.equal(preset.stemMix.beat.gain,-3.4);
 assert.equal(preset.stemMix.beat.pan,.35);
 assert.equal(preset.stemMix.lead.gain,-2.2);
 assert.equal(preset.stemMix.lead.pan,-.2);
 assert.equal(preset.stemMix.doubles.mute,true);
 assert.equal(preset.haloMode,true);
 assert.equal(preset.haloAmount,.32);
 assert.equal(preset.roomCopies.length,1);
 assert.equal(preset.roomCopies[0].pan,.82);
 assert.equal(preset.roomCopies[0].depth,-.48);
 assert.equal(preset.stemMix.beat.file,undefined,'no raw audio or File is allowed in preset');
 assert.equal(preset.stemMix.beat.buffer,undefined,'no PCM buffers in preset');
 const wav1Event=page.waitForEvent('download',{timeout:45000});await page.locator('button.export').click();const wav1=await wav1Event;const pcm1=await readFile(await wav1.path());
 assert.equal(pcm1.toString('ascii',0,4),'RIFF');
 await page.getByRole('button',{name:/NEW SESSION/}).click();
 await page.getByRole('button',{name:/STEMS/}).first().click();
 const earlyFile=page.locator('.earlyPresetLoader input[type=file]');
 await earlyFile.setInputFiles({name:'tt2-v5.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(preset))});
 await page.getByText(/V5 COMPLETE · ROOM \+ MASTER \+ STEM MIX restored/).waitFor({timeout:15000});
 const channel2=page.locator('.stemGrid .stemChannel');
 for(let i=0;i<files.length;i++)await channel2.nth(i).locator('input[type=file]').setInputFiles(files[i]);
 assert.equal(Number(await channel2.nth(0).locator('input[type=range]').nth(0).inputValue()),-3.4);
 assert.equal(Number(await channel2.nth(0).locator('input[type=range]').nth(1).inputValue()),.35);
 assert.equal(Number(await channel2.nth(1).locator('input[type=range]').nth(0).inputValue()),-2.2);
 assert.equal(Number(await channel2.nth(1).locator('input[type=range]').nth(1).inputValue()),-.2);
 assert((await channel2.nth(2).getByRole('button',{name:'MUTE'}).getAttribute('class'))?.includes('on'));
 await page.getByRole('button',{name:/BUILD REAL STEM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:40000});
 assert((await page.getByRole('button',{name:/ROOM V4.3 · CENTER \+ HALO/}).getAttribute('class'))?.includes('sel'));
 assert.equal(Number(await page.locator('.haloPanel input[type=range]').inputValue()),32);
 assert.equal(Number(await page.locator('.roomCopyRow input[type=range]').first().inputValue()),.82);
 await page.waitForFunction(()=>{const b=document.querySelector('button.export');return b&&!b.hasAttribute('disabled')},null,{timeout:90000});
 const wav2Event=page.waitForEvent('download',{timeout:45000});await page.locator('button.export').click();const wav2=await wav2Event;const pcm2=await readFile(await wav2.path());
 assert.equal(pcm1.length,pcm2.length,'WAV dimensions must match');
 let differing=0,largestDiff=0;
 for(let i=44;i<pcm1.length;i++){if(pcm1[i]!==pcm2[i]){differing++;largestDiff=Math.max(largestDiff,Math.abs(pcm1[i]-pcm2[i]))}}
 assert.equal(differing,0,'full V5 preset roundtrip should recreate sample-identical WAV for the same files');
 // Legacy preset compatibility: restore ROOM but accurately warn that original stem settings were never stored.
 await page.getByRole('button',{name:/NEW SESSION/}).click();
 await page.getByRole('button',{name:/STEMS/}).first().click();
 const legacy={...preset,version:4};delete legacy.stemMix;
 await page.locator('.earlyPresetLoader input[type=file]').setInputFiles({name:'legacy-v4.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
 await page.getByText(/LEGACY V4 LOADED/).waitFor({timeout:15000});
 await page.locator('.stemGrid .stemChannel').first().locator('input[type=file]').setInputFiles(files[0]);
 assert.equal(Number(await page.locator('.stemGrid .stemChannel').first().locator('input[type=range]').nth(0).inputValue()),-1.2,'legacy must preserve local stem gain, cannot invent it');
 // Tampered V5 must reject before changing any settings.
 const invalid={...preset,stemMix:{...preset.stemMix,beat:{...preset.stemMix.beat,gain:1000}}};
 await page.locator('.earlyPresetLoader input[type=file]').setInputFiles({name:'invalid-v5.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});
 await page.getByText(/Invalid preset file/).waitFor({timeout:15000});
 assert.equal(Number(await page.locator('.stemGrid .stemChannel').first().locator('input[type=range]').nth(0).inputValue()),-1.2,'invalid V5 must not mutate state');
 assert.equal(errors.length,0,errors.join('; '));
 console.log('V5 PRESET ROUNDTRIP PASS',JSON.stringify({engine:engine===webkit?'webkit':'chromium',roomCopies:preset.roomCopies.length,pcmBytes:pcm1.length,differing,legacyWarning:true,invalidRejected:true}));
}finally{await browser?.close();server.kill('SIGTERM')}
