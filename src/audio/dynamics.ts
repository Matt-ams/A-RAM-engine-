/** A$RAM V4.1 — single linked stereo compressor. No hidden second compression stage.
 * The detector alone is high-passed: the audible bass signal is never filtered.
 */
export type DynamicsOptions={knee:number;parallel:number;detectorHz:number;maxReduction:number};
export type DynamicsReport={averageGrDb:number;peakGrDb:number;activeFrames:number};
export const dynamicsDefaults:DynamicsOptions={knee:14,parallel:.7,detectorHz:115,maxReduction:4};
const linear=(db:number)=>Math.pow(10,db/20);
const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));
export function linkedDynamics(src:AudioBuffer,threshold:number,ratio:number,attack:number,release:number,options:DynamicsOptions=dynamicsDefaults):{buffer:AudioBuffer;report:DynamicsReport}{
 const count=Math.min(2,src.numberOfChannels),n=src.length,sr=src.sampleRate;
 const out=new AudioBuffer({numberOfChannels:count,length:n,sampleRate:sr});
 const input=Array.from({length:count},(_,ch)=>src.getChannelData(ch));
 const output=Array.from({length:count},(_,ch)=>out.getChannelData(ch));
 const knee=clamp(options.knee,0,30),parallel=clamp(options.parallel,0,1),maxGr=clamp(options.maxReduction,0,12);
 const a=Math.exp(-2*Math.PI*clamp(options.detectorHz,40,350)/sr);
 const atk=Math.exp(-1/(sr*clamp(attack,.005,.3))),rel=Math.exp(-1/(sr*clamp(release,.05,2)));
 let lp=0,envelope=0,sum=0,peak=0,activeFrames=0;
 for(let i=0;i<n;i++){
  const mono=count===2?(input[0][i]+input[1][i])*.5:input[0][i];
  lp=a*lp+(1-a)*mono;
  const high=mono-lp;
  // High-frequency transients are heard by the detector, deep kicks cannot dominate it.
  const detector=Math.max(Math.abs(high)*.82,Math.abs(mono)*.32);
  envelope=(detector>envelope?atk:rel)*envelope+(1-(detector>envelope?atk:rel))*detector;
  const level=20*Math.log10(Math.max(1e-8,envelope));
  const over=level-threshold;
  let reduction=0;
  if(knee>0&&over>-knee*.5&&over<knee*.5){
   const x=over+knee*.5;
   reduction=(1-1/Math.max(1,ratio))*x*x/(2*knee);
  }else if(over>=knee*.5)reduction=(1-1/Math.max(1,ratio))*over;
  reduction=clamp(reduction,0,maxGr);
  const wet=linear(-reduction),g=1-parallel+parallel*wet;
  for(let ch=0;ch<count;ch++)output[ch][i]=input[ch][i]*g;
  if(reduction>.02)activeFrames++;
  sum+=reduction;peak=Math.max(peak,reduction);
 }
 return{buffer:out,report:{averageGrDb:sum/Math.max(1,n),peakGrDb:peak,activeFrames}};
}
