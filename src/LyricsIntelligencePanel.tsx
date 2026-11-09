import {useEffect,useMemo,useRef,useState} from 'react';
import {groupTranscriptWords,lyricToOrbit,parseTimedLyrics,type LyricCandidate,type TimestampWord} from './audio/lyricsIntelligence';
import {ORBIT_MAX_EVENTS,type OrbitEvent,type OrbitStemMap,type OrbitSettings} from './audio/microOrbits';
import {SATURN_MAX_EVENTS,SATURN_MAX_DURATION,type SaturnEvent,type SaturnSettings} from './audio/saturn';
type Voice='lead'|'doubles'|'adlibs';
type Props={stems:OrbitStemMap;duration:number;playhead:number;events:OrbitEvent[];
 setEvents:React.Dispatch<React.SetStateAction<OrbitEvent[]>>;
 setSettings:React.Dispatch<React.SetStateAction<OrbitSettings>>;
 saturnEvents:SaturnEvent[];setSaturnEvents:React.Dispatch<React.SetStateAction<SaturnEvent[]>>;
 saturnSettings:SaturnSettings;setSaturnSettings:React.Dispatch<React.SetStateAction<SaturnSettings>>;
 onSeek:(seconds:number)=>void;roomPending:boolean;originalLock:boolean;mode:'stereo'|'stems'};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
async function mono16k(buffer:AudioBuffer,from:number,duration:number){
 const seconds=Math.max(.25,Math.min(duration,buffer.duration-from));
 const off=new OfflineAudioContext(1,Math.ceil(seconds*16000),16000);
 const src=off.createBufferSource();src.buffer=buffer;src.connect(off.destination);src.start(0,from,seconds);
 const rendered=await off.startRendering();
 const result=new Float32Array(rendered.getChannelData(0));
 // Prevent denormals and non-finite data before local ASR.
 for(let i=0;i<result.length;i++)if(!Number.isFinite(result[i]))result[i]=0;
 return result;
}
export default function LyricsIntelligencePanel({stems,duration,playhead,events,setEvents,setSettings,saturnEvents,setSaturnEvents,saturnSettings,setSaturnSettings,onSeek,roomPending,originalLock,mode}:Props){
 const available=(['lead','doubles','adlibs'] as const).filter(k=>stems[k]?.buffer);
 const [voice,setVoice]=useState<Voice>('lead');
 const selectedVoice=available.includes(voice)?voice:available[0]??'lead';
 const buffer=stems[selectedVoice]?.buffer??null;
 const [candidates,setCandidates]=useState<LyricCandidate[]>([]);
 const [manual,setManual]=useState('');
 const [windowLength,setWindowLength]=useState(18);
 const [status,setStatus]=useState('No transcription started');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [recognizedWithoutTime,setRecognizedWithoutTime]=useState('');
 const worker=useRef<Worker|null>(null),serial=useRef(0);
 const loadedBuffer=useRef<AudioBuffer|null>(buffer);
 const [progress,setProgress]=useState(0);
 const [scanRange,setScanRange]=useState<'window'|'track'>('window');
 const [hasReviewed,setHasReviewed]=useState(false);

 useEffect(()=>{
  if(loadedBuffer.current!==buffer){
   loadedBuffer.current=buffer;
   worker.current?.terminate();worker.current=null;serial.current++;
   setCandidates([]);setBusy(false);setError('');setProgress(0);setStatus('Voice source changed: previous transcription cleared');
  }
 },[buffer]);
 useEffect(()=>()=>{serial.current++;worker.current?.terminate();worker.current=null},[]);
 const cancel=()=>{
  serial.current++;worker.current?.terminate();worker.current=null;
  setBusy(false);setStatus('Transcription cancelled. Existing proposals remain review-only.');
 };
 const scan=async(full:boolean)=>{
  if(!buffer||mode!=='stems'||busy)return;
  cancel();setError('');setRecognizedWithoutTime('');setCandidates([]);setHasReviewed(false);setBusy(true);setProgress(0);
  const id=++serial.current,from=full?0:clamp(playhead,0,Math.max(0,buffer.duration-.25));
  const length=full?Math.min(buffer.duration,360):Math.min(windowLength,buffer.duration-from);
  setScanRange(full?'track':'window');setStatus('Resampling isolated vocal stem locally (16 kHz)…');
  try{
   const pcm=await mono16k(buffer,from,length);
   if(id!==serial.current)return;
   const w=new Worker(new URL('./workers/whisperAsr.worker.ts',import.meta.url),{type:'module'});
   worker.current=w;
   w.onmessage=(event:MessageEvent<Record<string,unknown>>)=>{
    const packet=event.data;
    if(packet.type==='model-progress'){setStatus('Downloading local recognition model… '+Math.round(Number(packet.progress)||0)+'%');return}
    if(packet.id!==id)return;
    if(packet.type==='model-ready'){setStatus('Model loaded in browser. Transcribing…');return}
    if(packet.type==='segment'){
     const words=Array.isArray(packet.words)?packet.words as TimestampWord[]:[];
     const relative=words.map(x=>({...x,start:x.start+from,end:x.end+from}));
     const proposed=groupTranscriptWords(relative,0,duration);
     if(proposed.length){
      setCandidates(prev=>[...prev,...proposed.map((x,i)=>({...x,id:'asr-'+id+'-'+String(packet.index)+'-'+i}))].slice(0,500));
     }else if(typeof packet.text==='string'&&packet.text.trim()){
      setRecognizedWithoutTime(old=>[old,packet.text].filter(Boolean).join(' | ').slice(0,2500));
     }
     const done=Number(packet.index)+1,total=Math.max(1,Number(packet.total)||1);
     setProgress(Math.round(100*done/total));
     setStatus('Recognized '+done+'/'+total+' audio windows. Every lyric remains UNVERIFIED.');
     return;
    }
    if(packet.type==='done'){setBusy(false);setProgress(100);setStatus('Recognition complete. Review and confirm each phrase BEFORE creating motion.');w.terminate();if(worker.current===w)worker.current=null;}
    if(packet.type==='error'){setError('Local ASR failed: '+String(packet.message||'unknown')+'. You can still import LRC or add manually.');setBusy(false);w.terminate();if(worker.current===w)worker.current=null;}
   };
   w.onerror=event=>{if(id!==serial.current)return;setError('The browser transcription worker stopped unexpectedly. Try a shorter window, or import LRC.');setBusy(false);w.terminate();if(worker.current===w)worker.current=null;event.preventDefault()};
   w.postMessage({type:'transcribe',id,audio:pcm,sampleRate:16000,duration:pcm.length/16000},[pcm.buffer]);
   setStatus('Loading local Whisper model (first use downloads model weights)…');
  }catch(e){if(id!==serial.current)return;setError('Local audio preparation failed: '+(e instanceof Error?e.message:String(e)));setBusy(false)}
 };
 const loadLrc=async(file:File)=>{
  if(file.size>250000){setError('Timed lyrics file is too large.');return}
  cancel();try{
   const content=await file.text();const parsed=parseTimedLyrics(content,duration);
   if(!parsed.length)throw Error('No valid [mm:ss.xx] timestamped lines found.');
   setCandidates(parsed);setHasReviewed(true);setError('');
   setStatus(parsed.length+' timed lyric lines imported from file (verify alignment by listening).');
  }catch(e){setError(e instanceof Error?e.message:String(e))}
 };
 const confirm=(id:string)=>{setCandidates(prev=>prev.map(c=>c.id===id?{...c,reviewed:true}:c));setHasReviewed(true)};
 const update=(id:string,text:string)=>setCandidates(prev=>prev.map(c=>c.id===id?{...c,text:text.slice(0,400),reviewed:false}:c));
 const adjust=(id:string,key:'start'|'end',value:number)=>setCandidates(prev=>prev.map(c=>{
  if(c.id!==id)return c;
  const start=key==='start'?clamp(value,0,Math.max(0,c.end-.12)):c.start;
  const end=key==='end'?clamp(value,start+.12,duration):c.end;
  return {...c,start:Math.round(start*100)/100,end:Math.round(end*100)/100,reviewed:false};
 }));
 const accepted=useMemo(()=>candidates.filter(c=>c.reviewed).length,[candidates]);
 const approve=(c:LyricCandidate)=>{
  if(!c.reviewed||!c.text.trim()||roomPending||originalLock)return;
  if(events.length>=ORBIT_MAX_EVENTS){setError('ORBIT event limit reached. Remove old events first.');return}
  if(events.some(e=>e.source===selectedVoice&&Math.abs(e.at-c.start)<.15)){setError('There is already a very close event on that stem; refine it in ORBIT instead.');return}
  const nextId=Math.max(Date.now(),...events.map(e=>e.id+1));
  const event=lyricToOrbit(c,nextId,selectedVoice,duration);
  setEvents(prev=>[...prev,event].sort((a,b)=>a.at-b.at));
  setSettings(prev=>({...prev,enabled:true,amount:Math.max(.5,prev.amount),presence:prev.presence??.72}));
  onSeek(event.at);
  setStatus('Approved phrase added to ORBIT. Adjust trajectory, start, duration and level in ORBIT editor.');
  setError('');
 };
 const approveSaturn=(c:LyricCandidate)=>{
  if(!c.reviewed||!c.text.trim()||roomPending||originalLock||mode!=='stems'||!buffer)return;
  if(saturnEvents.length>=SATURN_MAX_EVENTS){setError('SATURN scene is full. Remove an old event first.');return}
  if(saturnEvents.some(e=>e.source===selectedVoice&&Math.abs(e.at-c.start)<.15)){setError('SATURN already has a near-identical event. Edit its timing instead.');return}
  const at=clamp(c.start,0,Math.max(0,duration-.2));
  const availableEnd=Math.min(duration,buffer.duration);
  const end=Math.min(availableEnd,Math.max(c.end,c.start+.4));
  const length=Math.min(SATURN_MAX_DURATION,Math.max(.15,end-at));
  if(length<.25){setError('No usable vocal audio remains at the selected timestamp.');return}
  const event:SaturnEvent={id:Math.max(Date.now(),...saturnEvents.map(e=>e.id+1)),
    source:selectedVoice,at:Math.round(at*100)/100,duration:Math.round(length*100)/100,path:'head-orbit-cw',level:.94};
  setSaturnEvents(prev=>[...prev,event].sort((a,b)=>a.at-b.at));
  setSaturnSettings(prev=>({...prev,enabled:true,wet:Math.max(.58,prev.wet),depth:Math.max(.84,prev.depth),
    glide:Math.max(.88,prev.glide),trail:Math.max(.58,prev.trail)}));
  onSeek(event.at);
  setStatus('Reviewed phrase sent to SATURN HEAD ORBIT. Edit the path and duration in SATURN. Dry master preserved.');
  setError('');
 };
 const addManual=()=>{
  const content=manual.trim();if(!content||!buffer)return;
  const at=clamp(playhead,0,Math.max(0,duration-.4));
  setCandidates(prev=>[...prev,{id:'manual-'+Date.now(),start:Math.round(at*100)/100,end:Math.round(Math.min(duration,at+Math.min(6.2,windowLength))*100)/100,text:content.slice(0,400),origin:'lrc',reviewed:false}]);
  setManual('');
  setStatus('Manual phrase added at playhead. Check duration and confirm before approving.');
 };
 return <section className='v5Lyrics' aria-label='V5 lyric intelligence and human review' data-testid='v5-lyrics-lab'>
  <div className='v5LyricsHead'><div><small>V5 · LYRICS INTELLIGENCE · OPTIONAL</small><h2>PHRASE INTELLIGENCE</h2>
   <p>Detect vocal phrases, inspect proposed lyrics, then approve an exact phrase for spatial motion. Recognition NEVER automatically edits the master or ORBIT scene.</p></div>
   <div className='v5LyricsCounts'><b>{candidates.length}</b><span>candidates</span><b>{accepted}</b><span>reviewed</span></div>
  </div>
  <div className='v5LyricsWarnings'>Whisper runs locally in your browser after you explicitly start it. The first run downloads public model weights, which can be large. Sung words, reverb and adlibs can be MISHEARD or hallucinated. Timestamps are estimates, never verified lyric facts. The LEAD stem stays on your device.</div>
  {mode!=='stems'||!available.length?<p className='v5LyricsNotice'>Load an isolated LEAD, DOUBLES or ADLIBS stem to enable auto-transcription. Stereo-only songs cannot reliably separate vocals. Timed lyrics may still be imported.</p>:<>
   <div className='v5LyricsControls'>
    <label>VOICE SOURCE<select value={selectedVoice} onChange={e=>setVoice(e.target.value as Voice)} disabled={busy}>{available.map(v=><option value={v} key={v}>{v.toUpperCase()}</option>)}</select></label>
    <label>NEAR PLAYHEAD <b>{Math.round(windowLength)}s</b><input type='range' min='6' max='24' step='2' value={windowLength} onChange={e=>setWindowLength(Number(e.target.value))} disabled={busy}/></label>
   </div>
   <div className='v5LyricsButtons'>
    <button disabled={busy||roomPending} onClick={()=>void scan(false)}>DETECT LYRICS NEAR PLAYHEAD</button>
    <button disabled={busy||roomPending} onClick={()=>void scan(true)}>SCAN TRACK · LOCAL ASR (MAX 6 MIN)</button>
    <button disabled={!busy} onClick={cancel}>CANCEL ASR</button>
   </div>
  </>}
  <div className='v5LyricsImport'>
   <label className='v5LyricsFile'>IMPORT VERIFIED TIMED LYRICS · .LRC<input type='file' accept='.lrc,text/plain' onChange={e=>{const file=e.target.files?.[0];if(file)void loadLrc(file);e.currentTarget.value=''}}/></label>
   <input type='text' placeholder='Or type a line you know and place it at the playhead…' value={manual} onChange={e=>setManual(e.target.value)} maxLength={400}/>
   <button onClick={addManual} disabled={!manual.trim()||!buffer}>+ MANUAL PHRASE</button>
  </div>
  <div className='v5LyricsProgress' role='status'><span>{status} · {scanRange==='track'?'TRACK MODE':'PLAYHEAD WINDOW MODE'}</span>{busy&&<progress max={100} value={progress}/>}</div>
  {recognizedWithoutTime&&<p className='v5LyricsNotice'>Untimed transcription (not auto-placed): {recognizedWithoutTime}</p>}
  {error&&<p className='v5LyricsError' role='alert'>{error}</p>}
  {!!candidates.length&&<div className='v5LyricsList'>
   {candidates.slice(0,100).map(c=><div key={c.id} className='v5LyricRow'>
    <div className='v5LyricTime'>
     <label>START (s)<input type='number' min='0' max={duration} step='.01' value={c.start} onChange={e=>adjust(c.id,'start',Number(e.target.value))}/></label>
     <label>END (s)<input type='number' min='0' max={duration} step='.01' value={c.end} onChange={e=>adjust(c.id,'end',Number(e.target.value))}/></label>
     <button onClick={()=>onSeek(c.start)}>HEAR FROM HERE</button>
    </div>
    <label className='v5LyricText'>PROPOSED WORDS · {c.origin==='asr'?'LOCAL ASR UNVERIFIED':'LRC / USER'}
     <textarea rows={2} maxLength={400} value={c.text} onChange={e=>update(c.id,e.target.value)}/>
    </label>
    <div className='v5LyricActions'>
     <button onClick={()=>confirm(c.id)} disabled={c.reviewed||!c.text.trim()}>{c.reviewed?'REVIEWED ✓':'CONFIRM WORDS + TIMING'}</button>
     <button disabled={!c.reviewed||roomPending||originalLock||mode!=='stems'||events.length>=ORBIT_MAX_EVENTS} onClick={()=>approve(c)}>APPROVE → ORBIT</button>
     <button disabled={!c.reviewed||roomPending||originalLock||mode!=='stems'||!buffer||saturnEvents.length>=SATURN_MAX_EVENTS} onClick={()=>approveSaturn(c)}>APPROVE → SATURN HEAD ORBIT</button>
    </div>
   </div>)}
   {candidates.length>100&&<small>{candidates.length-100} additional candidates retained in session; inspect by scanning a shorter region or importing LRC.</small>}
  </div>}
  <small className='v5LyricsFooter'>Review gate: local ASR proposes text; you approve; only then can a vocal-only ORBIT or SATURN event be added. No inference on the BEAT. No automatic mastering changes. SATURN is an optional wet-only moving reflection, not certified 5.1 or head tracking. SATURN {saturnSettings.enabled?'ON':'OFF'}. {hasReviewed?'Musician review started.':'No lyrics approved yet.'}</small>
 </section>
}
