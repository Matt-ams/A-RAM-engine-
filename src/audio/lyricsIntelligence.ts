/** A$RAM ENGINE V5 — exact lyrics are always review-only until musician approves.
 * This module has no audio DSP and cannot change an existing sound master.
 */
export type LyricCandidate={id:string;start:number;end:number;text:string;origin:'asr'|'lrc';reviewed:boolean};
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
export function safeLyricCandidate(value:unknown,duration:number):value is LyricCandidate{
 if(!value||typeof value!=='object')return false;
 const x=value as Partial<LyricCandidate>;
 return typeof x.id==='string'&&x.id.length<=96&&
  Number.isFinite(x.start)&&Number.isFinite(x.end)&&x.start!>=0&&x.end!>x.start!&&x.end!<=duration+.5&&
  typeof x.text==='string'&&x.text.trim().length>0&&x.text.length<=400&&
  (x.origin==='asr'||x.origin==='lrc')&&typeof x.reviewed==='boolean';
}
export function parseTimedLyrics(input:string,duration:number):LyricCandidate[]{
 if(input.length>250000)throw Error('Lyric file exceeds 250kB text limit');
 const list:Array<{start:number;text:string}>=[];
 const time=/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;
 for(const line of input.split(/\r?\n/)){
  const matches=[...line.matchAll(time)];if(!matches.length)continue;
  const words=line.replace(time,'').trim().slice(0,400);
  if(!words)continue;
  for(const match of matches){
   const mins=Number(match[1]),secs=Number(match[2]),decimal=match[3]?Number('0.'+match[3]):0;
   if(secs>=60)continue;
   const start=mins*60+secs+decimal;
   if(!Number.isFinite(start)||start>=duration||start<0)continue;
   list.push({start,text:words});
  }
 }
 list.sort((a,b)=>a.start-b.start);
 const out:LyricCandidate[]=[];
 for(let i=0;i<list.length&&out.length<500;i++){
  const row=list[i],next=list.find((v,j)=>j>i&&v.start>row.start+.01)?.start??row.start+3.25;
  const end=Math.min(duration,row.start+6.5,next-.03);
  if(end<=row.start+.1)continue;
  out.push({id:'lrc-'+i,start:Math.round(row.start*100)/100,end:Math.round(end*100)/100,text:row.text,origin:'lrc',reviewed:true});
 }
 return out;
}
export type TimestampWord={text:string;start:number;end:number};
export function groupTranscriptWords(words:TimestampWord[],offset:number,totalDuration:number):LyricCandidate[]{
 const sorted=words.filter(w=>typeof w.text==='string'&&w.text.trim()&&Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.end>w.start&&w.start>=0).sort((a,b)=>a.start-b.start);
 const out:LyricCandidate[]=[];
 let active:TimestampWord[]=[];
 const flush=()=>{
  if(!active.length)return;
  const text=active.map(w=>w.text).join(' ').replace(/\s+([,.!?;:])/g,'$1').replace(/\s+/g,' ').trim().slice(0,400);
  const start=clamp(offset+active[0].start,0,totalDuration),end=clamp(offset+active[active.length-1].end,0,totalDuration);
  if(text&&end-start>=.12)out.push({id:'asr-'+Math.round(start*1000)+'-'+out.length,start:Math.round(start*100)/100,end:Math.round(end*100)/100,text,origin:'asr',reviewed:false});
  active=[];
 };
 for(const item of sorted){
  if(item.start<0||item.end+offset>totalDuration+.5)continue;
  const last=active[active.length-1];
  if(last&&(item.start-last.end>.48||item.end-active[0].start>6.2||/[.!?]$/.test(last.text.trim())))flush();
  active.push(item);
 }
 flush();
 return out;
}
export function lyricToOrbit(candidate:LyricCandidate,id:number,source:'lead'|'doubles'|'adlibs',duration:number){
 const at=clamp(candidate.start,0,Math.max(0,duration-.15));
 const length=clamp(candidate.end-candidate.start+.22,.15,6.5);
 return {id,source,at:Math.round(at*100)/100,duration:Math.min(length,Math.max(.15,duration-at)),
   path:'front-left-right' as const,band:'voice' as const,level:.86,note:candidate.text.slice(0,120)};
}
