/** Full-length 4x polyphase true-peak estimator (windowed sinc).
 * No sample skipping. Not a certified ITU-R BS.1770 conformance implementation.
 */
export function estimateTruePeakFull(b:AudioBuffer):number{
 const taps=8,phases=4,coeff:number[][]=[];
 for(let p=0;p<phases;p++){
  const f=p/phases,arr:number[]=[];let sum=0;
  for(let k=-taps;k<=taps;k++){const d=f-k,s=Math.abs(d)<1e-12?1:Math.sin(Math.PI*d)/(Math.PI*d),w=.5+.5*Math.cos(Math.PI*d/(taps+1));arr.push(s*w);sum+=s*w}
  coeff.push(arr.map(x=>x/sum));
 }
 let peak=0;
 for(let c=0;c<Math.min(2,b.numberOfChannels);c++){
  const x=b.getChannelData(c);
  for(let i=0;i<x.length;i++){
   peak=Math.max(peak,Math.abs(x[i]));
   for(let p=1;p<4;p++){
    let y=0;const h=coeff[p];
    for(let k=-taps;k<=taps;k++){const j=i+k;if(j>=0&&j<x.length)y+=x[j]*h[k+taps]}
    peak=Math.max(peak,Math.abs(y));
   }
  }
 }
 return 20*Math.log10(Math.max(1e-12,peak));
}
export function safeMonoCompatibility(buffer:AudioBuffer):AudioBuffer{
 if(buffer.numberOfChannels<2)return buffer;
 const l=buffer.getChannelData(0),r=buffer.getChannelData(1);
 let cross=0,ll=0,rr=0;
 for(let i=0;i<l.length;i+=8){cross+=l[i]*r[i];ll+=l[i]*l[i];rr+=r[i]*r[i]}
 const correlation=cross/Math.sqrt(Math.max(1e-12,ll*rr));
 if(correlation>=.05)return buffer;
 // Gently reduce only side content when sustained correlation indicates potential mono cancellation.
 const amount=Math.min(.3,(.05-correlation)*.2);
 for(let i=0;i<l.length;i++){const m=(l[i]+r[i])*.5,s=(l[i]-r[i])*.5*(1-amount);l[i]=m+s;r[i]=m-s}
 return buffer;
}
