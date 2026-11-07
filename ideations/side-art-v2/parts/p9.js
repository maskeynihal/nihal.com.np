
/* ================= picker ================= */
const $=id=>document.getElementById(id), pick=$('pick'), g8=$('g8'), lampsEl=$('lamps');
for(let i=1;i<=8;i++){ if(!VAR[i]) continue; const b=document.createElement('button'); b.dataset.v=i; b.innerHTML=`<b>${i}</b><small>${VAR[i].short}</small>`; b.setAttribute('aria-label',`Variation ${i}, ${VAR[i].name}`); g8.appendChild(b)}
for(const l of [4,3,2,1,0]){const b=document.createElement('button');b.dataset.l=l;b.textContent=l;b.setAttribute('aria-label','Lamp level '+l);lampsEl.appendChild(b)}
const CAPT={1:'tap: drop',2:'tap: spin',3:'tap: gust',4:'tap: bloom',5:'move: nudge',6:'tap: pulse',7:'tap: wish',8:'tap: ball'};
const CAPL={1:'Tap or click the art to drop a marble; scrolling tips the track.',2:'Tap or click near the mobile to spin and swing it; scroll sets it swaying.',3:'Tap or click for a gust; the kite leans to the pointer.',4:'Tap or click to grow a flower; the butterfly lands near the pointer.',5:'Move the pointer near the pen to nudge it; scroll to plot.',6:'Tap or click a component to fire a pulse down the board.',7:'Tap or click to make a wish; switch the lamp to change the sky.',8:'Tap or click to throw the ball; move the pointer and the dog follows.'};
function setVar(n){
  if(!VAR[n]) return; vi=n; $('curN').textContent=n; $('curT').textContent=VAR[n].short; $('curC').textContent=CAPT[n];$('hint').textContent=VAR[n].name+'. '+CAPL[n]+' Keys: 1-8 variation, L lamp.';
  g8.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.v===n));
  const u=new URL(location.href);u.searchParams.set('v',n);u.searchParams.set('l',E.lamp);try{history.replaceState(null,'',u)}catch(e){}
  kick();
}
function setLamp(l){
  E.lamp=l; root.dataset.lamp=l; E.rgb=PAL[l].rgb; E.pg=PAL[l].pg; E.dark=l<=1; $('curL').textContent=l;
  lampsEl.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.l===l));
  const u=new URL(location.href);u.searchParams.set('l',l);try{history.replaceState(null,'',u)}catch(e){}
  if(reduced) E.day=E.dayT=PAL[l].day; kick();
}
function setOpen(o){pick.classList.toggle('open',o);$('toggle').setAttribute('aria-expanded',o);$('toggle').setAttribute('aria-label',o?'Collapse the picker':'Open the picker')}
g8.addEventListener('click',e=>{const b=e.target.closest('button');if(b)setVar(+b.dataset.v)});
lampsEl.addEventListener('click',e=>{const b=e.target.closest('button');if(b)setLamp(+b.dataset.l)});
$('toggle').addEventListener('click',()=>setOpen(!pick.classList.contains('open')));
$('prev').addEventListener('click',()=>setVar(vi===1?8:vi-1));
$('next').addEventListener('click',()=>setVar(vi===8?1:vi+1));
$('lampcyc').addEventListener('click',()=>{const o=[4,3,2,1,0];setLamp(o[(o.indexOf(E.lamp)+1)%5])});
addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey||e.altKey||/input|textarea/i.test(e.target.tagName)) return;
  if(/^[1-8]$/.test(e.key)) setVar(+e.key);
  if(e.key==='l'||e.key==='L') $('lampcyc').click();
});
setLamp(clamp(+(qs.get('l')??1),0,4)|0);E.day=E.dayT;
setVar(clamp(+(qs.get('v')||1),1,8)|0);
setOpen(qs.get('panel')==='1');

/* ================= test hooks ================= */
window.__art={
  stats,E,get cols(){return cols},setVar,setLamp,setOpen,
  tap(x,y){doTap(x,y)},
  pointer(x,y){E.cx=x;E.cy=y;E.present=true;kick()},
  advance(sec){const n=Math.round(sec*30);for(let i=0;i<n;i++){updateEnv(1/30);drawAll(1/30,true)}},
  bench(v,frames,flush){
    const prev=vi; vi=v; const arr=[]; const sy=scrollY;
    for(let i=0;i<frames;i++){const t0=performance.now();updateEnv(1/30);drawAll(1/30,true);if(flush)g.getImageData(0,0,1,1);arr.push(performance.now()-t0)}
    vi=prev;arr.sort((a,b)=>a-b);return {avg:arr.reduce((a,b)=>a+b,0)/arr.length,p95:arr[Math.floor(arr.length*.95)],max:arr[arr.length-1],vis:cols.filter(visible).length};
  }
};
layout();
})();
</script>
</body>
</html>
