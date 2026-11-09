/** BEAT RADIO LAB — isolated, explicitly opt-in audition on the raw BEAT stem.
 * Never changes ENGINE's loaded stem or master. Export a separate cleaned WAV
 * only after an A/B audition. Requires a GENUINE noise-only reference interval.
 */
import {useEffect,useState} from 'react';
import {spectralDenoise,type DenoiseSettings} from './audio/denoise';
import {scanBeatIntegrity,type BeatIntegrity} from './audio/beatIntegrity';

type Props={beat:AudioBuffer|null};
type Preview={original:string;clean:string;removed:string;export:string;removedDb:number;monitorGainDb:number;auditionAt:number};
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
function rms(b:AudioBuffer){
 let sum=0,n=0;
 for(let c=0;c<Math.min(2,b.numberOfChannels);c++){
  const a=b.getChannelData(c),step=Math.max(1,Math.floor(a.length/180000));
  for(let i=0;i<a.length;i+=step){sum+=a[i]*a[i];n++}
 }
 return Math.sqrt(sum/Math.max(1,n));
}
function segment(b:AudioBuffer,seconds:number,startSeconds=0,scale=1){
 const offset=Math.min(Math.max(0,Math.floor(startSeconds*b.sampleRate)),Math.max(0,b.length-1));
 const n=Math.min(b.length-offset,Math.round(Math.max(.5,seconds)*b.sampleRate));
 const out=new AudioBuffer({sampleRate:b.sampleRate,length:Math.max(1,n),numberOfChannels:Math.min(2,b.numberOfChannels)});
 for(let c=0;c<out.numberOfChannels;c++){
  const src=b.getChannelData(c),dst=out.getChannelData(c);
  for(let i=0;i<dst.length;i++)dst[i]=clamp(src[offset+i]*scale,-1,1);
 }
 return out;
}
function wav24(b:AudioBuffer){
 const ch=Math.min(2,b.numberOfChannels),bytes=b.length*ch*3,ab=new ArrayBuffer(bytes+44),v=new DataView(ab);
 const str=(o:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
 str(0,'RIFF');v.setUint32(4,36+bytes,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);
 v.setUint16(22,ch,true);v.setUint32(24,b.sampleRate,true);v.setUint32(28,b.sampleRate*ch*3,true);
 v.setUint16(32,ch*3,true);v.setUint16(34,24,true);str(36,'data');v.setUint32(40,bytes,true);
 let o=44;for(let i=0;i<b.length;i++)for(let c=0;c<ch;c++){
  const x=clamp(b.getChannelData(c)[i],-1,1),q=Math.round(x<0?x*8388608:x*8388607);
  v.setUint8(o++,q&255);v.setUint8(o++,(q>>8)&255);v.setUint8(o++,(q>>16)&255);
 }
 return new Blob([ab],{type:'audio/wav'});
}
export default function BeatRadioLab({beat}:Props){
 const [start,setStart]=useState(0),[end,setEnd]=useState(0),[auditionAt,setAuditionAt]=useState(0);
 const [reduction,setReduction]=useState(.2),[preserve,setPreserve]=useState(.9);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState<Preview|null>(null);
 const [integrity,setIntegrity]=useState<BeatIntegrity|null>(null);
 useEffect(()=>{setPreview(null);setError('');setIntegrity(null)},[beat]);
 useEffect(()=>()=>{if(preview)for(const key of ['original','clean','removed','export'] as const)URL.revokeObjectURL(preview[key])},[preview]);
 const prepare=async()=>{
  if(!beat||busy)return;
  if(end-start<.1||start<0||end>beat.duration){setError('Choose at least 0.1 second of genuine noise-only audio inside the BEAT stem.');return}
  setBusy(true);setError('');setPreview(null);
  try{
   // Give React a chance to update the working indicator before synchronous FFT processing.
   await new Promise<void>(resolve=>setTimeout(resolve,20));
   const settings:DenoiseSettings={enabled:true,reduction,preserve,start,end};
   const result=spectralDenoise(beat,settings,true);
   if(!result.removed)throw Error('The noise-only audition did not render.');
   const originalClip=segment(beat,20,auditionAt);
   const cleanedClip=segment(result.buffer,20,auditionAt);
   const removedClip=segment(result.removed,20,auditionAt);
   const monitorRatio=rms(originalClip)/Math.max(1e-8,rms(cleanedClip));
   const monitorGain=clamp(monitorRatio,Math.pow(10,-2/20),Math.pow(10,2/20));
   const original=URL.createObjectURL(wav24(originalClip));
   const clean=URL.createObjectURL(wav24(segment(cleanedClip,20,0,monitorGain)));
   const removed=URL.createObjectURL(wav24(removedClip));
   const exported=URL.createObjectURL(wav24(result.buffer));
   const removedDb=20*Math.log10(Math.max(1e-9,rms(result.removed))/Math.max(1e-9,rms(beat)));
   const monitorGainDb=20*Math.log10(monitorGain);
   setPreview({original,clean,removed,export:exported,removedDb,monitorGainDb,auditionAt});
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 };
 return <section aria-label='BEAT RADIO CLEANUP LAB' style={{border:'1px solid #46606a',borderRadius:12,padding:15,margin:'18px 0',background:'#101a22'}}>
  <h3 style={{margin:'0 0 8px'}}>BEAT RADIO LAB · TT4</h3>
  <p style={{fontSize:12,color:'#b8cbd4',margin:'0 0 12px'}}>Isolated diagnostic on the ORIGINAL BEAT stem. It will NOT modify the loaded BEAT, original master, ROOM, ORBIT or SATURN. A radio-like artifact baked into the Suno instrumental may not be removable without damaging the music.</p>
  {!beat?<small>Load the original BEAT stem above to enable this test.</small>:<>
   <div className='v5BeatAudit'>
    <button type='button' disabled={busy} onClick={()=>{if(!beat)return;setIntegrity(scanBeatIntegrity(beat));}}>RUN V5 BEAT INTEGRITY SCAN · NO DSP</button>
    {integrity&&<div className='v5BeatScanReport' role='status'>
     <b>ORIGINAL BEAT · {integrity.sampleRate/1000} kHz · PEAK {integrity.peakDb.toFixed(1)} dBFS · NEAR-CLIPPED {integrity.clippedPercent.toFixed(3)}%</b>
     <p>Possible impulse positions: {integrity.impulseCandidates.length?integrity.impulseCandidates.slice(0,12).map(t=>t.toFixed(2)+'s').join(', '):'none found'}. Possible dropouts: {integrity.dropoutCandidates.length?integrity.dropoutCandidates.slice(0,12).map(t=>t.toFixed(2)+'s').join(', '):'none found'}.</p>
     {integrity.warnings.map((msg,i)=><p key={i}>{msg}</p>)}
     {[...integrity.impulseCandidates,...integrity.dropoutCandidates].length>0&&<button type='button' onClick={()=>setAuditionAt([...integrity.impulseCandidates,...integrity.dropoutCandidates].sort((a,b)=>a-b)[0])}>COMPARE FROM FIRST CANDIDATE</button>}
    </div>}
   </div>
   <p style={{fontSize:12,marginBottom:8}}>NOISE PROFILE REQUIRED: deliberately choose a passage with radio noise but NO kick, snare, hats, melody or vocal. No default noise section is assumed. If the radio effect overlaps the music throughout, this algorithm is NOT suitable for guaranteed restoration; compare versions of the Suno generation or investigate a source-specific repair.</p>
   <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
    <label>START (s)<input aria-label='BEAT noise profile start seconds' type='number' min='0' max={beat.duration} step='.1' value={start} onChange={e=>setStart(Number(e.target.value))} style={{width:85,marginLeft:5}}/></label>
    <label>END (s)<input aria-label='BEAT noise profile end seconds' type='number' min='0' max={beat.duration} step='.1' value={end} onChange={e=>setEnd(Number(e.target.value))} style={{width:85,marginLeft:5}}/></label>
    <label>COMPARE FROM (s)<input aria-label='BEAT A/B comparison start seconds' type='number' min='0' max={Math.max(0,beat.duration-.5)} step='.1' value={auditionAt} onChange={e=>setAuditionAt(clamp(Number(e.target.value)||0,0,Math.max(0,beat.duration-.5)))} style={{width:85,marginLeft:5}}/></label>
    <label>REDUCE {Math.round(reduction*100)}%<input aria-label='BEAT denoise reduction' type='range' min='0' max='.6' step='.05' value={reduction} onChange={e=>setReduction(Number(e.target.value))}/></label>
    <label>PRESERVE {Math.round(preserve*100)}%<input aria-label='BEAT denoise preservation' type='range' min='.5' max='1' step='.05' value={preserve} onChange={e=>setPreserve(Number(e.target.value))}/></label>
   </div>
   <button type='button' disabled={busy||end-start<.1||end>beat.duration} onClick={()=>void prepare()} style={{margin:'10px 0'}}>{busy?'ANALYZING BEAT…':'PREPARE BEAT RADIO A/B'}</button>
   {error&&<p role='alert' style={{color:'#f1aaa3',fontSize:12}}>{error}</p>}
   <small style={{display:'block',color:'#9aafbe',margin:'4px 0 12px'}}>Each PREPARE analyses the full stem; the three playback clips start at COMPARE FROM and are limited to 20s. Use low volume first. Never compare perceived quality using an unverified noise profile.</small>
   {preview&&<div style={{display:'grid',gap:10}}>
    <label>ORIGINAL BEAT — from {preview.auditionAt.toFixed(1)}s, next 20s<audio controls preload='metadata' src={preview.original} style={{width:'100%',display:'block'}}/></label>
    <label>DENOISED CANDIDATE — from {preview.auditionAt.toFixed(1)}s, MONITOR matched within ±2dB<audio controls preload='metadata' src={preview.clean} style={{width:'100%',display:'block'}}/></label>
    <label>REMOVED SIGNAL — what would be lost from same passage<audio controls preload='metadata' src={preview.removed} style={{width:'100%',display:'block'}}/></label>
    <p style={{fontSize:12,margin:0}}>Removed RMS vs original: {preview.removedDb.toFixed(1)} dB. Monitor-only gain for cleaned excerpt: {preview.monitorGainDb.toFixed(1)} dB, NOT exported. {preview.removedDb> -17?'CAUTION: substantial removal; listen for hats, snap and texture loss.':'This metric cannot certify musical transparency.'}</p>
    <a href={preview.export} download='ASRAM_TT4_BEAT_DENOISED_CANDIDATE_24BIT.wav' style={{color:'#a5d9ec'}}>DOWNLOAD CLEANED BEAT CANDIDATE · 24-BIT WAV</a>
    <small>Only import the cleaned BEAT back into ENGINE if you prefer it blind at comparable loudness and the REMOVED SIGNAL contains no wanted music. The original stem remains untouched.</small>
   </div>}
  </>}
 </section>
}
