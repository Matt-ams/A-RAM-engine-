/** BEAT RADIO LAB — isolated, explicitly opt-in audition on the raw BEAT stem.
 * Never changes ENGINE's loaded stem or master. Export a separate cleaned WAV
 * only after an A/B audition. Requires a GENUINE noise-only reference interval.
 */
import {useEffect,useState} from 'react';
import {spectralDenoise,type DenoiseSettings} from './audio/denoise';

type Props={beat:AudioBuffer|null};
type Preview={original:string;clean:string;removed:string;export:string;removedDb:number};
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
function rms(b:AudioBuffer){
 let sum=0,n=0;
 for(let c=0;c<Math.min(2,b.numberOfChannels);c++){
  const a=b.getChannelData(c),step=Math.max(1,Math.floor(a.length/180000));
  for(let i=0;i<a.length;i+=step){sum+=a[i]*a[i];n++}
 }
 return Math.sqrt(sum/Math.max(1,n));
}
function segment(b:AudioBuffer,seconds:number){
 const n=Math.min(b.length,Math.round(Math.max(2,seconds)*b.sampleRate));
 const out=new AudioBuffer({sampleRate:b.sampleRate,length:n,numberOfChannels:Math.min(2,b.numberOfChannels)});
 for(let c=0;c<out.numberOfChannels;c++)out.getChannelData(c).set(b.getChannelData(c).subarray(0,n));
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
 const [start,setStart]=useState(0),[end,setEnd]=useState(1.2);
 const [reduction,setReduction]=useState(.2),[preserve,setPreserve]=useState(.9);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState<Preview|null>(null);
 useEffect(()=>{setPreview(null);setError('')},[beat]);
 useEffect(()=>()=>{if(preview)for(const url of Object.values(preview).filter(x=>typeof x==='string'&&x.startsWith('blob:')))URL.revokeObjectURL(url)},[preview]);
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
   const original=URL.createObjectURL(wav24(segment(beat,20)));
   const clean=URL.createObjectURL(wav24(segment(result.buffer,20)));
   const removed=URL.createObjectURL(wav24(segment(result.removed,20)));
   const exported=URL.createObjectURL(wav24(result.buffer));
   const removedDb=20*Math.log10(Math.max(1e-9,rms(result.removed))/Math.max(1e-9,rms(beat)));
   setPreview({original,clean,removed,export:exported,removedDb});
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 };
 return <section aria-label='BEAT RADIO CLEANUP LAB' style={{border:'1px solid #46606a',borderRadius:12,padding:15,margin:'18px 0',background:'#101a22'}}>
  <h3 style={{margin:'0 0 8px'}}>BEAT RADIO LAB · TT4</h3>
  <p style={{fontSize:12,color:'#b8cbd4',margin:'0 0 12px'}}>Isolated diagnostic on the ORIGINAL BEAT stem. It will NOT modify the loaded BEAT, original master, ROOM, ORBIT or SATURN. A radio-like artifact baked into the Suno instrumental may not be removable without damaging the music.</p>
  {!beat?<small>Load the original BEAT stem above to enable this test.</small>:<>
   <p style={{fontSize:12,marginBottom:8}}>Noise-only reference: pick a portion containing the radio noise but NO kick, snare, hats, melody or vocal. If no such moment exists, do not use this denoiser profile as a cleanup claim.</p>
   <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
    <label>START (s)<input aria-label='BEAT noise profile start seconds' type='number' min='0' max={beat.duration} step='.1' value={start} onChange={e=>setStart(Number(e.target.value))} style={{width:85,marginLeft:5}}/></label>
    <label>END (s)<input aria-label='BEAT noise profile end seconds' type='number' min='0' max={beat.duration} step='.1' value={end} onChange={e=>setEnd(Number(e.target.value))} style={{width:85,marginLeft:5}}/></label>
    <label>REDUCE {Math.round(reduction*100)}%<input aria-label='BEAT denoise reduction' type='range' min='0' max='.6' step='.05' value={reduction} onChange={e=>setReduction(Number(e.target.value))}/></label>
    <label>PRESERVE {Math.round(preserve*100)}%<input aria-label='BEAT denoise preservation' type='range' min='.5' max='1' step='.05' value={preserve} onChange={e=>setPreserve(Number(e.target.value))}/></label>
   </div>
   <button type='button' disabled={busy||end-start<.1||end>beat.duration} onClick={()=>void prepare()} style={{margin:'10px 0'}}>{busy?'ANALYZING BEAT…':'PREPARE BEAT RADIO A/B'}</button>
   {error&&<p role='alert' style={{color:'#f1aaa3',fontSize:12}}>{error}</p>}
   {preview&&<div style={{display:'grid',gap:10}}>
    <label>ORIGINAL BEAT — first 20s<audio controls preload='metadata' src={preview.original} style={{width:'100%',display:'block'}}/></label>
    <label>DENOISED CANDIDATE — first 20s<audio controls preload='metadata' src={preview.clean} style={{width:'100%',display:'block'}}/></label>
    <label>REMOVED SIGNAL — what would be lost<audio controls preload='metadata' src={preview.removed} style={{width:'100%',display:'block'}}/></label>
    <p style={{fontSize:12,margin:0}}>Relative removed RMS: {preview.removedDb.toFixed(1)} dB vs BEAT. {preview.removedDb> -17?'CAUTION: substantial removal; listen for hats, snap and texture loss.':'This metric cannot certify musical transparency.'}</p>
    <a href={preview.export} download='ASRAM_TT4_BEAT_DENOISED_CANDIDATE_24BIT.wav' style={{color:'#a5d9ec'}}>DOWNLOAD CLEANED BEAT CANDIDATE · 24-BIT WAV</a>
    <small>Only import the cleaned BEAT back into ENGINE if you prefer it blind at comparable loudness and the REMOVED SIGNAL contains no wanted music. The original stem remains untouched.</small>
   </div>}
  </>}
 </section>
}
