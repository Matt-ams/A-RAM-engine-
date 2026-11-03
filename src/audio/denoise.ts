/** Noise-only STFT profile denoiser, stereo-linked to preserve spatial relationships.
 * Disabled by default. NOISE AUDITION is a monitoring signal; it must never be exported.
 * This is experimental spectral suppression, not guaranteed artifact-free restoration.
 */
export type DenoiseSettings={enabled:boolean;reduction:number;preserve:number;start:number;end:number};
export const denoiseDefaults:DenoiseSettings={enabled:false,reduction:.28,preserve:.75,start:0,end:2};
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const N=1024,HOP=256;
function fft(re:Float64Array,im:Float64Array,inverse=false){
 const n=re.length;
 for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
 for(let size=2;size<=n;size*=2){
  const angle=(inverse?2:-2)*Math.PI/size,wr=Math.cos(angle),wi=Math.sin(angle);
  for(let start=0;start<n;start+=size){let r=1,ii=0;
   for(let k=0;k<size/2;k++){const a=start+k,b=a+size/2,tr=r*re[b]-ii*im[b],ti=r*im[b]+ii*re[b];re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const nr=r*wr-ii*wi;ii=r*wi+ii*wr;r=nr}
  }
 }
 if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n}
}
export function spectralDenoise(src:AudioBuffer,settings:DenoiseSettings,noiseAudition=false):{buffer:AudioBuffer;removed:AudioBuffer|null}{
 const ch=Math.min(2,src.numberOfChannels),n=src.length,sr=src.sampleRate;
 if(!settings.enabled||settings.reduction<=0)return{buffer:src,removed:null};
 const start=Math.floor(clamp(settings.start,0,src.duration)*sr),end=Math.floor(clamp(settings.end,0,src.duration)*sr);
 if(end-start<Math.round(.08*sr)||end<=start)throw new Error('Select at least 80 ms of noise-only audio for DENOISER profile.');
 const out=new AudioBuffer({length:n,numberOfChannels:ch,sampleRate:sr});
 const removed=noiseAudition?new AudioBuffer({length:n,numberOfChannels:ch,sampleRate:sr}):null;
 const input=Array.from({length:ch},(_,c)=>src.getChannelData(c));
 const output=Array.from({length:ch},(_,c)=>out.getChannelData(c));
 const window=Float64Array.from({length:N},(_,i)=>Math.sqrt(.5-.5*Math.cos(2*Math.PI*(i+.5)/N)));
 const noise=new Float64Array(N/2+1),profileRe=new Float64Array(N),profileIm=new Float64Array(N);let frames=0;
 const first=Math.max(0,Math.floor((start-N)/HOP)),last=Math.ceil(end/HOP);
 for(let f=first;f<=last;f++){const offset=f*HOP;
  if(offset<start||offset+N>end)continue;
  const power=new Float64Array(noise.length);
  for(let c=0;c<ch;c++){
   profileRe.fill(0);profileIm.fill(0);
   for(let i=0;i<N;i++)profileRe[i]=input[c][offset+i]*window[i];
   fft(profileRe,profileIm);
   for(let k=0;k<power.length;k++)power[k]+=(profileRe[k]**2+profileIm[k]**2)/ch;
  }
  for(let k=0;k<power.length;k++)noise[k]+=power[k];
  frames++;
 }
 if(!frames)throw new Error('Noise profile region is too short for spectral processing.');
 for(let k=0;k<noise.length;k++)noise[k]/=frames;
 const reduction=clamp(settings.reduction,0,1),preserve=clamp(settings.preserve,0,1);
 const floor=1-.88*reduction*(1-.25*preserve);
 const strength=.35+2.2*reduction*(1-.4*preserve);
 const real=Array.from({length:ch},()=>new Float64Array(N)),imag=Array.from({length:ch},()=>new Float64Array(N));
 const weights=new Float32Array(n),prevGain=new Float32Array(N/2+1).fill(1),gains=new Float64Array(N/2+1);
 // Pad both ends so the Hann overlap doesn't silence initial and final samples.
 for(let offset=-N+HOP;offset<n;offset+=HOP){
  const spectra=new Float64Array(N/2+1);
  for(let c=0;c<ch;c++){
   real[c].fill(0);imag[c].fill(0);
   for(let i=0;i<N;i++){const j=offset+i;if(j>=0&&j<n)real[c][i]=input[c][j]*window[i]}
   fft(real[c],imag[c]);
   for(let k=0;k<spectra.length;k++)spectra[k]+=(real[c][k]**2+imag[c][k]**2)/ch;
  }
  for(let k=0;k<gains.length;k++){
   const snr=spectra[k]/Math.max(1e-12,noise[k]);
   const raw=clamp(1-strength/Math.sqrt(Math.max(1e-10,snr)),floor,1);
   // Temporal smoothing suppresses granular/musical-noise jumps.
   gains[k]=prevGain[k]*.75+raw*.25;
  }
  for(let k=1;k<gains.length-1;k++)gains[k]=.2*gains[k-1]+.6*gains[k]+.2*gains[k+1];
  for(let k=0;k<gains.length;k++)prevGain[k]=gains[k];
  for(let c=0;c<ch;c++){
   for(let k=0;k<gains.length;k++){real[c][k]*=gains[k];imag[c][k]*=gains[k];if(k>0&&k<N/2){real[c][N-k]*=gains[k];imag[c][N-k]*=gains[k]}}
   fft(real[c],imag[c],true);
   for(let i=0;i<N;i++){const j=offset+i;if(j>=0&&j<n)output[c][j]+=real[c][i]*window[i]}
  }
  for(let i=0;i<N;i++){const j=offset+i;if(j>=0&&j<n)weights[j]+=window[i]*window[i]}
 }
 for(let i=0;i<n;i++){const norm=1/Math.max(1e-6,weights[i]);for(let c=0;c<ch;c++){const signal=output[c][i]*norm;output[c][i]=signal;if(removed)removed.getChannelData(c)[i]=input[c][i]-signal}}
 return{buffer:out,removed};
}
