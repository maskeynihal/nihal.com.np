(() => {
'use strict';
/* ================= real copy (src/content/copy.ts, cv.ts, work.ts, oss.ts, writing.ts) ================= */
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const NAV=['desk','about','projects','open source','writing','cv','contact'];
const TB={name:'nihal maskey',kicker:'lead software engineer · kathmandu, nepal',line:'Lead engineer at Leapfrog Technology, where my team builds a US behavioural-health platform on AWS. Co-founder of Daboo Spaces, a coworking space in Sankhamul, Kathmandu. This site collects my projects, open-source contributions and writing.'};
const ABOUT=["I'm a software engineer in Kathmandu, Nepal. I've been building for the web since 2019, the last six at Leapfrog Technology, where I went from intern to lead engineer.",'Today I lead the team behind a US behavioural-health platform. The work is mostly TypeScript, React, Node.js and AWS: queues, Lambdas and Step Functions, with patient data that has to meet HIPAA and SOC 2. I care about fast pages, boring deploys and code the next person can read.','I work with people in the US, Australia and Nepal, so a lot of my job is writing things down clearly and running reviews that teach something.'];
const FACTS=[['location','Kathmandu, Nepal'],['role','Lead Engineer, Leapfrog Technology'],['co-founder','Daboo Spaces'],['stack','TypeScript, React, Node.js, Laravel, AWS'],['open to','mentorship, consulting, talks']];
const WORK=[
 ['trayt health','jan 2025 → · lead engineer','Leapfrog Technology, for Trayt Health','A behavioral-health platform for psychiatry access programs and managed care organizations. I joined the project as a senior engineer in 2023 and have led the engineering team since January 2025. My own code is mostly on AWS: SQS, EventBridge, Lambda and Step Functions for backups, metrics and notifications, plus the HIPAA and SOC 2 work that comes with health data.',[]],
 ['tz converter','nov 2026 · 0.8.1 in the chrome web store and firefox add-ons','Chrome, Edge, Brave, Firefox',"A browser extension, TypeScript, Manifest V3. Select a time on a page and a popover shows it in the zones you've chosen. It also has a full converter, an epoch converter, right-click convert, custom date formats, and a world clock at tz.nihal.com.np/clock. I built it because the people I work with are in Nepal, Australia and the US.",[['Chrome Web Store','https://chromewebstore.google.com/detail/tz-converter-%E2%80%94-timezone-t/cokhjgalkhboifkgoomlbaigocjpmhkk'],['Firefox Add-ons','https://addons.mozilla.org/en-US/firefox/addon/tz-converter-timezone-tools/'],['tz.nihal.com.np','https://tz.nihal.com.np/'],['GitHub','https://github.com/maskeynihal/tz-extension']]],
 ['space hog','oct 2026 · rust, egui','macOS, Linux','A desktop app that shows what is using your disk: largest files, drill-down by folder, breakdown by file type, cache cleanup suggestions, and a CLI mode. Universal build for macOS, and Linux.',[['GitHub','https://github.com/maskeynihal/space-hog']]],
 ['car sensors','oct 2026 · arduino uno r4 wifi','Arduino UNO R4 WiFi','Firmware for car sensors. A UNO R4 reads water temperature from a DS18B20 and air temperature and humidity from a DHT22, shows them on a small OLED, and sounds a buzzer on alarm. The repo is set up so a coding agent can build and run the firmware in a Wokwi emulator on a Mac before anything is flashed to the car.',[['GitHub','https://github.com/maskeynihal/sensor-for-cars'],['the write-up on Hashnode','https://nihalmaskey.hashnode.dev/i-built-a-water-air-monitor-on-an-arduino-and-the-buzzer-tried-to-kill-me']]],
 ['pac-man','aug 2020 · javascript, canvas','Leapfrog internship project','My internship project at Leapfrog, written to learn JavaScript and the canvas API. Easy, medium and hard modes, three power-ups (Red Cherry, Ghost Wrap, Blue Dot), and a two-player mode on WASD with a freeze and unfreeze mechanic. The ghosts use path-finding rather than random movement.',[['GitHub','https://github.com/maskeynihal/pacman'],['play standalone','https://maskeynihal.github.io/pacman/']]]];
const OSS=[['digitalocean/nginxconfig.io','independent scrolling in split-column mode','2023-06'],['digitalocean/nginxconfig.io','prettier via lint-staged','2023-10'],['spatie/holidays','Nepal holiday calendar, with tests','2024-10'],['kritish-dhaubanjar/dynamodb-dashboard','18 commits: validation, download, search fixes, demo videos','2023 → 2026'],['kritish-dhaubanjar/dev-auth-chrome-extension','Svelte rewrite, add-user form, token handling','2021 → 2022'],['benawad/dogehouse','Nepali translation, persist language','2021'],['supabase/supabase','null-check fix; docs','2021 → 2023']];
const POSTS=[['2026-10-26','I built a water + air monitor on an Arduino, and the buzzer tried to kill me','UNO R4 WiFi, DS18B20, DHT22, SH1106 OLED and a buzzer. The buzzer jammed because tone() and digitalWrite() shared a pin.'],['2024-05-11','SSH into Docker with Root User','SSH as root into a container.'],['2024-04-30','Running laravel on a server','Nginx, PHP 8.0-FPM, Composer and MySQL on Ubuntu.'],['2023-01-24','Accessing GitHub in the server using the deploy key','Per-repo deploy keys.'],['2022-01-22','Laravel: Testing, Factory, and Events','withoutEvents to fix a NOT NULL user_id set by a creating hook in tests.']];
const CV=[['2025 →','Lead Engineer','Leapfrog Technology',['Lead the engineering team for a US behavioural-health platform.','Own the AWS architecture for sensitive health data under HIPAA and SOC 2.','Mentor engineers and set code review and security practice.','Work with product and design on what ships next.']],['2023 → 2025','Senior Software Engineer','Leapfrog Technology',['Coordinated work across teams in the US, Australia and Nepal.','Cut the frontend bundle by 20% with tree-shaking and memoisation.','Made key backend APIs more than twice as fast.','Automated backups, metrics and notifications with SQS, EventBridge, Lambda and Step Functions.','Shaped the technical roadmap and wrote user stories.']],['2021 → 2023','Software Engineer','Leapfrog Technology',['Led a team of more than 15 across development, design, DevOps and QA.','Planned releases with product owners and shipped major versions.','Main contact for stakeholders and management.']],['2020 → 2021','Associate Software Engineer','Leapfrog Technology',['Built features with senior engineers and product owners.','Tracked down root causes in production bugs.','Built a browser extension the team used daily.']],['2020','Software Engineer Intern','Leapfrog Technology',['Learned JavaScript and the canvas API by rebuilding Pac-Man with path-finding ghosts.','First steps in Node.js and React.']],['2019 → 2020','Web Application Developer','Technorio, Kathmandu',['Shipped web apps for insurance management, video streaming and ticketing.','Set up GitHub Actions deploys.','Worked with business development on estimates.']]];
const CVCARDS=[['co-founder','Daboo Spaces, Kathmandu','A coworking space in Sankhamul Tower 1.'],['education','BE computer engineering','Kantipur Engineering College, Tribhuvan University, 2021.'],['skills','What I work with','TypeScript, JavaScript, React, Node.js, Laravel, PHP, AWS (Lambda, SQS, EventBridge, Step Functions), PostgreSQL, MySQL, HIPAA and SOC 2 work, team leadership.']];
const SOC=[['github','https://github.com/maskeynihal'],['linkedin','https://www.linkedin.com/in/maskeynihal'],['x','https://x.com/nihalmaskey'],['instagram','https://www.instagram.com/maskeynihal'],['hashnode','https://nihalmaskey.hashnode.dev']];

const SECS=[
 ['about','l',()=>ABOUT.map(p=>`<p>${esc(p)}</p>`).join('')+`<p>Outside work I co-founded <a href="https://daboospaces.com">Daboo Spaces</a>, a coworking space in Sankhamul, Kathmandu, with desks, private offices and a community of founders, freelancers and remote workers.</p><div class="panel"><p class="eyebrow">at a glance</p><dl>${FACTS.map(f=>`<dt>${f[0]}</dt><dd>${esc(f[1])}</dd>`).join('')}</dl></div>`],
 ['projects','r',()=>`<p>Side projects, each built to fix something that annoyed me.</p>`+WORK.map(w=>`<div class="panel"><p class="eyebrow">${esc(w[1])}</p><h3>${esc(w[0])}</h3><p class="meta">${esc(w[2])}</p><p>${esc(w[3])}</p>${w[4].length?`<div class="links">${w[4].map(l=>`<a href="${l[1]}">${esc(l[0])}</a>`).join('')}</div>`:''}</div>`).join('')],
 ['open source','l',()=>`<ul class="rows">${OSS.map(o=>`<li><b>${esc(o[0])}</b>${esc(o[1])}<br><span class="m">merged ${esc(o[2])}</span></li>`).join('')}</ul>`],
 ['writing','r',()=>`<p>Posts on Hashnode since 2022. Four are server and Laravel notes; the latest is the Arduino monitor.</p><ul class="rows">${POSTS.map(o=>`<li><span class="m">${o[0]}</span><b>${esc(o[1])}</b>${esc(o[2])}</li>`).join('')}</ul><p><a href="https://nihalmaskey.hashnode.dev">all posts on hashnode</a></p>`],
 ['cv','l',()=>`<ul class="rows">${CV.map(r=>`<li><span class="m">${esc(r[0])}</span><b>${esc(r[1])}, ${esc(r[2])}</b><ul>${r[3].map(d=>`<li style="border:0;padding:1px 0">${esc(d)}</li>`).join('')}</ul></li>`).join('')}</ul>`+CVCARDS.map(c=>`<div class="panel"><p class="eyebrow">${c[0]}</p><h3>${esc(c[1])}</h3><p>${esc(c[2])}</p></div>`).join('')],
 ['contact','r',()=>`<p>Email is fastest. I read everything and reply to most within a couple of days.</p><p><a href="mailto:contact@nihal.com.np">contact@nihal.com.np</a></p><p>Kathmandu is UTC+5:45 with no daylight saving.</p><p>${SOC.map(s=>`<a href="${s[1]}">${s[0]}</a>`).join(' · ')}</p><form onsubmit="return false"><label class="field"><span>your name</span><input autocomplete="off"></label><label class="field"><span>your email</span><input autocomplete="off"></label><label class="field"><span>what's this about</span><input autocomplete="off"></label><label class="field"><span>message</span><textarea rows="4"></textarea></label><button class="btn" type="button">send</button></form>`]
];
const sheet=document.getElementById('sheet'), idx=document.querySelector('.index');
sheet.insertAdjacentHTML('beforeend',`<header class="titleblock"><h1>${TB.name}</h1><p class="kick">${TB.kicker}</p><p>${esc(TB.line)}</p></header>`);
SECS.forEach(([h,side,body],i)=>{
  const txt=side, art=side==='r'?'l':'r';
  sheet.insertAdjacentHTML('beforeend',`<section class="section" id="${h.replace(' ','-')}"><div class="grid"><div class="txt ${txt}"><p class="eyebrow">sheet ${i+2}</p><h2>${h}</h2>${body()}</div><div class="empty-col ${art}" data-empty="${art}"></div></div></section>`);
});
sheet.insertAdjacentHTML('beforeend',`<div class="foot">© 2026 Nihal Maskey. Source on GitHub. · prototype: side art v2</div>`);
NAV.forEach((n,i)=>idx.insertAdjacentHTML('beforeend',`<div><b>${String(i+1).padStart(2,'0')}</b>${n}</div>`));

/* ================= engine ================= */
const TAU=Math.PI*2, PI=Math.PI;
const cv=document.getElementById('art'), g=cv.getContext('2d');
const root=document.documentElement;
const qs=new URLSearchParams(location.search);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||qs.get('rm')==='1';
const PAL={
  4:{rgb:'31,63,224',pg:'246,245,241',day:1},
  3:{rgb:'26,58,203',pg:'217,218,227',day:.78},
  2:{rgb:'20,47,184',pg:'179,180,198',day:.5},
  1:{rgb:'255,255,255',pg:'31,63,224',day:.2},
  0:{rgb:'232,236,255',pg:'10,19,72',day:0}
};
const E={tt:0,sy:0,H:innerHeight,W:innerWidth,lamp:1,day:.2,dayT:.2,rgb:PAL[1].rgb,pg:PAL[1].pg,reduced,sv:0,ref:0,cx:-9999,cy:-9999,present:false,ms:0,dpr:1,dark:true};
let cols=[], vi=1, pageH=0;
const VAR=[null];   // VAR[n] = {name,short,init,update,draw,tap}
const stats={}; for(let i=1;i<=8;i++) stats[i]={n:0,sum:0,max:0};

/* ---- seeded helpers ---- */
const rnd=(a,b=0)=>{const s=Math.sin(a*127.1+b*311.7+78.233)*43758.5453;return s-Math.floor(s)};
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, sm=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const mulberry=s=>()=>{s=(s+0x6D2B79F5)|0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296};
/* ---- drawing helpers (hand-drawn, wobble is seeded so it never flickers) ---- */
const SA=(a)=>`rgba(${E.rgb},${a})`, PG=(a=1)=>`rgba(${E.pg},${a})`;
function ink(a=.85,w=1.5){g.strokeStyle=SA(a);g.lineWidth=w;g.stroke()}
function fillS(a){g.fillStyle=SA(a);g.fill()}
function fillP(a=1){g.fillStyle=PG(a);g.fill()}
/* wobbly polyline through pts [[x,y],...]; adds to current path (starts with moveTo unless cont) */
function PL(pts,seed=1,amp=.8,close=false,cont=false,step=14){
  const n=pts.length; let k=0, first=true;
  const end=close?n:n-1;
  for(let i=0;i<end;i++){
    const a=pts[i], b=pts[(i+1)%n]; const dx=b[0]-a[0], dy=b[1]-a[1]; const L=Math.hypot(dx,dy)||1;
    const m=Math.max(1,Math.round(L/step)), nx=-dy/L, ny=dx/L;
    for(let j=0;j<m;j++){
      const t=j/m, r=(rnd(seed+k*3.17,i)-.5)*2*amp; k++;
      const x=a[0]+dx*t+nx*r, y=a[1]+dy*t+ny*r;
      if(first&&!cont){g.moveTo(x,y)}else g.lineTo(x,y); first=false;
    }
  }
  if(!close){const b=pts[n-1];g.lineTo(b[0]+(rnd(seed,99)-.5)*amp,b[1]+(rnd(seed,98)-.5)*amp)} else g.closePath();
}
function LN(x1,y1,x2,y2,seed,amp){PL([[x1,y1],[x2,y2]],seed,amp)}
/* smooth closed/open curve through points (quadratic through midpoints) */
function SM(pts,close=false){
  const n=pts.length; if(n<3){g.moveTo(pts[0][0],pts[0][1]);g.lineTo(pts[n-1][0],pts[n-1][1]);return}
  if(close){
    let mx=(pts[n-1][0]+pts[0][0])/2,my=(pts[n-1][1]+pts[0][1])/2; g.moveTo(mx,my);
    for(let i=0;i<n;i++){const p=pts[i],q=pts[(i+1)%n];g.quadraticCurveTo(p[0],p[1],(p[0]+q[0])/2,(p[1]+q[1])/2)}
    g.closePath();
  }else{
    g.moveTo(pts[0][0],pts[0][1]);
    for(let i=1;i<n-1;i++){const p=pts[i],q=pts[i+1];g.quadraticCurveTo(p[0],p[1],(p[0]+q[0])/2,(p[1]+q[1])/2)}
    g.lineTo(pts[n-1][0],pts[n-1][1]);
  }
}
/* hand-drawn ellipse */
function EL(x,y,rx,ry,seed=1,amp=.7,rot=0,a0=0,a1=TAU){
  const full=(a1-a0)>=TAU-.01, m=Math.max(10,Math.round(Math.max(rx,ry)*.9+8)), pts=[];
  const co=Math.cos(rot),si=Math.sin(rot), cnt=full?m:m+1;
  for(let i=0;i<cnt;i++){
    const a=a0+(a1-a0)*(full?i/m:i/m), j=1+(rnd(seed+i*1.7,5)-.5)*2*amp/Math.max(rx,ry,6);
    const px=Math.cos(a)*rx*j, py=Math.sin(a)*ry*j;
    pts.push([x+px*co-py*si,y+px*si+py*co]);
  }
  SM(pts,full);
}
function arcPts(x,y,r,a0,a1,n=12){const o=[];for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;o.push([x+Math.cos(a)*r,y+Math.sin(a)*r])}return o}
/* hatch fill inside a rect-ish region using clip: caller sets path+clip */
function hatch(x0,y0,x1,y1,gap,ang,a=.35,w=1){
  g.save(); g.beginPath(); const c=Math.cos(ang),s=Math.sin(ang);
  const cx=(x0+x1)/2,cy=(y0+y1)/2,R=Math.hypot(x1-x0,y1-y0)/2;
  for(let d=-R;d<=R;d+=gap){g.moveTo(cx+d*-s-c*R,cy+d*c-s*R);g.lineTo(cx+d*-s+c*R,cy+d*c+s*R)}
  g.strokeStyle=SA(a);g.lineWidth=w;g.stroke();g.restore();
}
function circ(x,y,r){g.beginPath();g.arc(x,y,r,0,TAU)}

/* ---- layout ---- */
function layout(){
  E.W=innerWidth;E.H=innerHeight;E.dpr=Math.min(devicePixelRatio||1,2);
  cv.width=Math.round(E.W*E.dpr);cv.height=Math.round(E.H*E.dpr);
  const sc=scrollY, phone=E.W<1024, old=cols; cols=[];
  document.querySelectorAll('.empty-col').forEach((el,i)=>{
    const r=el.getBoundingClientRect(); if(r.width<80) return;
    const sec=el.closest('.section').getBoundingClientRect();
    const side=el.dataset.empty;
    let l=r.left+(side==='r'&&!phone?6:0), rr=r.right-(side==='l'&&!phone?6:0);
    const t=(phone?r.top:sec.top)+sc, b=(phone?r.bottom:sec.bottom)+sc;
    const w=rr-l, h=b-t;
    const o=old[i]; let c;
    if(o&&Math.abs(o.w-w)<24&&Math.abs(o.h-h)<30&&o.phone===phone){c=o;c.w=w;c.h=h}
    else c={i,S:{},w,h,phone,seed:i*17+3,taps:[],mx:0,my:0};
    c.l=l;c.t=t;c.b=b;c.r=rr;c.side=side; cols.push(c);
  });
  pageH=document.documentElement.scrollHeight; kick();
}

/* ---- loop ---- */
let raf=0,last=0,running=false,lastSy=0,settleOnce=new Set();
function updateEnv(dt){
  E.tt+=dt; const sy=scrollY; E.sy=sy;
  const mx=Math.max(1,pageH-E.H), f=.35+.65*clamp(sy/mx,0,1); E.ref=sy+E.H*f;
  if(!E.init){lastSy=sy;E.init=1}
  const rv=clamp((sy-lastSy)/Math.max(dt,1e-3),-4000,4000); lastSy=sy;
  E.sv+=(rv-E.sv)*(1-Math.exp(-dt*7));
  E.dayT=PAL[E.lamp].day; E.day+=(E.dayT-E.day)*(1-Math.exp(-dt*2.2));
}
function prep(c){
  c.mx=E.cx-c.l; c.my=E.cy+E.sy-c.t;
  c.mIn=E.present&&c.mx>-24&&c.mx<c.w+24&&c.my>-24&&c.my<c.h+24;
  c.prog=clamp((E.ref-c.t)/c.h,0,1);
  c.v0=Math.max(0,E.sy-c.t-60); c.v1=Math.min(c.h,E.sy+E.H-c.t+60);
}
function visible(c){return c.t<E.sy+E.H+80&&c.b>E.sy-80}
function getS(c){
  const v=VAR[vi]; let s=c.S[vi]; if(!s){s=c.S[vi]=v.init(c)} return s;
}
function drawAll(dt,doUpdate){
  const vis=cols.filter(visible);
  g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,cv.width,cv.height);
  if(!vis.length) return 0;
  const v=VAR[vi];
  for(const c of vis){
    prep(c); const s=getS(c);
    if(doUpdate&&v.update) v.update(c,s,dt);
    g.setTransform(E.dpr,0,0,E.dpr,(c.l)*E.dpr,(c.t-E.sy)*E.dpr);
    g.save(); g.beginPath(); g.rect(-2,-2,c.w+4,c.h+4); g.clip();
    g.lineCap='round'; g.lineJoin='round';
    v.draw(c,s);
    g.restore();
  }
  g.setTransform(1,0,0,1,0,0);
  return vis.length;
}
function frame(now){
  raf=0; if(!running) return;
  const el=now-last; if(el<1000/30-3){raf=requestAnimationFrame(frame);return}
  last=now; const dt=Math.min(.05,el/1000);
  updateEnv(dt); E.ms*=Math.exp(-dt*5);
  const t0=performance.now(); const n=drawAll(dt,true); const cost=performance.now()-t0;
  const s=stats[vi]; if(n){s.n++;s.sum+=cost;if(cost>s.max)s.max=cost}
  if(!n){running=false;return}
  raf=requestAnimationFrame(frame);
}
function kick(){
  if(reduced){
    if(!raf) raf=requestAnimationFrame(()=>{raf=0;staticFrame()});return}
  if(document.hidden) return;
  if(!running){running=true;last=performance.now()-40}
  if(!raf) raf=requestAnimationFrame(frame);
}
function staticFrame(){
  updateEnv(1/30); E.day=E.dayT;
  const vis=cols.filter(visible);
  for(const c of vis){ prep(c); const s=getS(c); const key=vi+':'+c.i+':'+Math.round(c.h);
    if(!settleOnce.has(key)){settleOnce.add(key); const v=VAR[vi]; if(v.update) for(let i=0;i<120;i++){prep(c);v.update(c,s,1/30)}}}
  drawAll(0,false);
}

/* ---- input (window level; canvas never takes events) ---- */
const SKIP='a,button,input,textarea,select,label,.panel,.pick,.rows,form,h1,h2,h3';
let down=null;
addEventListener('pointermove',e=>{
  const nx=e.clientX,ny=e.clientY; E.ms=Math.min(1500,E.ms+Math.hypot(nx-E.cx,ny-E.cy)*30*(E.present?1:0)); E.cx=nx;E.cy=ny;E.present=true;kick();
},{passive:true});
document.documentElement.addEventListener('pointerleave',()=>{E.present=false});
addEventListener('blur',()=>{E.present=false});
function doTap(clientX,clientY){
  const py=clientY+scrollY; E.taps=(E.taps||0)+1;
  for(const c of cols){
    if(clientX>=c.l&&clientX<=c.r&&py>=c.t&&py<=c.b){
      prep(c); const s=getS(c); const v=VAR[vi]; if(v.tap) v.tap(c,s,clientX-c.l,py-c.t);
    }
  }
  kick(); if(reduced) staticFrame();
}
addEventListener('pointerdown',e=>{
  if(e.target.closest&&e.target.closest(SKIP)){down=null;return}
  down={x:e.clientX,y:e.clientY,t:performance.now()};
  E.cx=e.clientX;E.cy=e.clientY;E.present=true;
},{passive:true});
addEventListener('pointerup',e=>{
  if(!down) return; const d=down; down=null;
  if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<12&&performance.now()-d.t<600) doTap(e.clientX,e.clientY);
},{passive:true});
addEventListener('pointercancel',()=>{down=null});
addEventListener('scroll',kick,{passive:true});
addEventListener('resize',layout);
document.addEventListener('visibilitychange',()=>{if(document.hidden){running=false}else kick()});
if(window.ResizeObserver) new ResizeObserver(()=>layout()).observe(sheet);
addEventListener('load',layout);
