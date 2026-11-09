/** V5 source BEAT integrity diagnosis. NO denoising and NO audio mutation.
 * Flags only candidate digital defects, not musical/stylistic 'radio' texture.
 */
export type BeatIntegrity={duration:number;sampleRate:number;peakDb:number;clippedPercent:number;
 impulseCandidates:number[];dropoutCandidates:number[];checkedSamples:number;warnings:string[]};
const rms=(data:Float32Array,start:number,end:number)=>{
 let sum=0,n=0;for(let i=start;i<end;i+=4){sum+=data[i]*data[i];n++}
 return Math.sqrt(sum/Math.max(1,n));
};
export function scanBeatIntegrity(buffer:AudioBuffer):BeatIntegrity{
 const sampleRate=buffer.sampleRate,length=buffer.length,channels=Math.min(2,buffer.numberOfChannels);
 const spikes:number[]=[],dropouts:number[]=[];let peak=0,clipped=0,checked=0;
 for(let c=0;c<channels;c++){
  const d=buffer.getChannelData(c);
  for(let i=2;i<length-2;i++){
   const p=d[i];const a=Math.abs(p);peak=Math.max(peak,a);if(a>.999)clipped++;checked++;
   // Isolated bipolar digital impulse with immediate return, unlike most kick hits.
   if(spikes.length<120&&a>.5&&Math.abs(p-d[i-1])>.53&&Math.abs(p-d[i+1])>.53&&Math.abs(d[i-1]-d[i+1])<.18){
    const time=i/sampleRate;if(!spikes.some(t=>Math.abs(t-time)<.075))spikes.push(time);
   }
  }
  // A silent gap BETWEEN audible windows is a possible dropout, not a certainty.
  const stride=Math.max(16,Math.round(sampleRate*.01)),activeRms=.02,quietRms=.00008;
  for(let i=stride*3;i+stride*3<length;i+=stride){
   if(dropouts.length>=120)break;
   const level=rms(d,i,i+stride),before=rms(d,i-2*stride,i-stride),after=rms(d,i+stride,i+2*stride);
   if(level<quietRms&&before>activeRms&&after>activeRms){
    const time=i/sampleRate;if(!dropouts.some(t=>Math.abs(t-time)<.1))dropouts.push(time);
   }
  }
 }
 const clippedPercent=100*clipped/Math.max(1,checked);
 const warnings:string[]=[];
 if(clippedPercent>.08)warnings.push('Clipping-like near-full-scale samples: inspect original BEAT source for overs/saturation.');
 if(spikes.length)warnings.push('Possible isolated digital impulses (false positives possible for musical transients).');
 if(dropouts.length)warnings.push('Possible sudden audio gaps; compare candidate timecodes against the unprocessed Suno BEAT.');
 if(!warnings.length)warnings.push('No obvious isolated digital impulses, clipped sample saturation or sudden dropouts by this limited scan.');
 warnings.push('Radio/static coloration embedded continuously in instrumentation cannot be reliably diagnosed or removed using this simple waveform check.');
 return {duration:buffer.duration,sampleRate,peakDb:20*Math.log10(Math.max(peak,1e-9)),
  clippedPercent,impulseCandidates:spikes.slice(0,30).map(x=>Math.round(x*100)/100),
  dropoutCandidates:dropouts.slice(0,30).map(x=>Math.round(x*100)/100),
  checkedSamples:checked,warnings};
}
