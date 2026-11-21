const $=id=>document.getElementById(id);
let mode='classic', phase='idle', scores=[], runs=[], timer, frame, onset, direction, audio, audible=false;
const names={classic:'Classic',choice:'Choice',lights:'Lights Out',duel:'Local Duel'};
let points=[0,0];
try { const saved=JSON.parse(localStorage.getItem('reflexRuns')||'[]'); runs=saved.filter(r=>['classic','choice','lights'].includes(r.mode)&&Number.isFinite(r.avg)); } catch {}
const mean=a=>Math.round(a.reduce((sum,n)=>sum+n,0)/a.length);
function cancel(){clearTimeout(timer);cancelAnimationFrame(frame)}
function view(state,title,help,button){
 phase=state;$('arena').className='arena '+state;$('headline').textContent=title;$('prompt').textContent=help;
 $('status').textContent='● '+({idle:'STANDBY',wait:'ARMED',go:'SIGNAL',miss:'RETRY',next:'RECORDED',done:'COMPLETE'}[state]);
 $('action').hidden=!button;$('action').textContent=button||'';
 for(const side of ['left','right']) $(side).hidden=!(state==='go'&&mode==='choice');
 if(mode==='duel'){for(const side of ['left','right']) $(side).hidden=!['go','wait'].includes(state)}
 document.querySelector('.bolt').textContent=state==='go'&&mode==='choice'?(direction==='left'?'←':'→'):'ϟ';
 $('round').textContent='ROUND 0'+Math.min(5,scores.length+(state==='next'?0:1))+' / 05';
 if(mode==='duel') $('round').textContent='FIRST TO FIVE';
}
function telemetry(){
 if(mode==='duel'){
 $('average').textContent=points.join(' : ');
 $('rows').innerHTML=points.map((p,i)=>'<div class="row"><span>Player '+(i+1)+'</span><b>'+p+' / 5</b></div>').join('');
 return;
 }
 $('average').textContent=scores.length?mean(scores):'—';
 $('rows').innerHTML=Array.from({length:5},(_,i)=>'<div class="row"><span>Round 0'+(i+1)+'</span><span>'+(scores[i]===undefined?'—':scores[i]+' ms')+'</span></div>').join('');
 const subset=runs.filter(r=>r.mode===mode);
 $('best').textContent=subset.length?subset.reduce((n,r)=>Math.min(n,r.avg),Infinity)+' ms':'—';
 $('past').innerHTML=runs.slice(-5).reverse().map(r=>'<div class="hist"><span>'+ names[r.mode]+' · 5 rounds</span><b>'+r.avg+' ms</b></div>').join('')||'<p>Complete a run to see your results here.</p>';
}
function idle(){
 cancel();points=[0,0];scores=[];
 const duel=mode==='duel', lights=mode==='lights';
 document.querySelector('.card .tag').textContent=duel?'MATCH SCORE':'LIVE AVERAGE';
 document.querySelector('.metric').lastChild.textContent=duel?'':' ms';
 document.querySelector('.record').hidden=duel;
 $('format').textContent=duel?'FIRST TO FIVE':'5 ROUNDS';
 $('left').textContent=duel?'P1 · A':'Left ←';$('right').textContent=duel?'P2 · L':'Right →';
 $('lamps').hidden=!lights;setLights(0);document.querySelector('.target').hidden=lights;
 view('idle','On your mark.',duel?'Player 1 uses A. Player 2 uses L. Wait for green.':lights?'Launch when all five red lights go dark.':mode==='classic'?'React the instant the signal turns green.':'Match the arrow when the signal appears.','Start run');telemetry();
 $('keys').textContent=duel?'A / L OR TAP YOUR SIDE':mode!=='choice'?'SPACE / CLICK / TAP':'LEFT / RIGHT ARROW OR TAP';
}
function setLights(n){Array.from($('lamps').children).forEach((lamp,i)=>lamp.classList.toggle('lit',i<n))}
function startingGrid(n){
 setLights(n);
 if(n<5){timer=setTimeout(()=>startingGrid(n+1),520);return}
 timer=setTimeout(()=>{frame=requestAnimationFrame(()=>{setLights(0);view('go','Launch!','Click, tap or press Space.',null);onset=performance.now()})},650+Math.random()*2400);
}
function arm(){
 cancel();view('wait','Hold steady…','Wait for the signal.','');
 if(mode==='lights'){view('wait','On the grid…','Hold until the lights go out.','');startingGrid(1);return}
 timer=setTimeout(()=>{frame=requestAnimationFrame(()=>{direction=Math.random()<.5?'left':'right';view('go',mode!=='choice'?'React now!':'Match the arrow!',mode==='duel'?'Player 1: A · Player 2: L':mode==='classic'?'Click, tap or press Space.':'Use the arrow keys or tap a side.',null);onset=performance.now()})},1200+Math.random()*2900);
}
function tone(){
 if(!audio||!audible)return;
 const osc=audio.createOscillator(),gain=audio.createGain();osc.connect(gain);gain.connect(audio.destination);gain.gain.value=.045;osc.frequency.value=620;gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.1);osc.start();osc.stop(audio.currentTime+.11);
}
function input(side){
 if(mode==='duel'&&side&&!['wait','go'].includes(phase))return;
 if(phase==='idle'||phase==='done'){points=[0,0];scores=[];telemetry();arm();return}
 if(phase==='next'||phase==='miss'){arm();return}
 if(mode==='duel'){
 if(!side)return;
 const early=phase==='wait', player=side==='left'?0:1, winner=early?1-player:player;
 cancel();points[winner]++;tone();telemetry();
 const done=points[winner]===5;
 view(done?'done':'next','Player '+(winner+1)+(done?' wins!':' scores!'),early?'False start by Player '+(player+1)+'.':Math.round(performance.now()-onset)+' ms reaction',done?'Rematch':'Next round');return;
 }
 if(phase==='wait'||(mode==='choice'&&side!==direction)){
 cancel();view('miss',phase==='wait'?'Too soon!':'Wrong direction.','Try this round again.','Retry round');return;
 }
 const elapsed=Math.round(performance.now()-onset);scores.push(elapsed);tone();
 if(scores.length===5){
 const avg=mean(scores), prior=runs.filter(r=>r.mode===mode);
 runs.push({mode,avg});try{localStorage.setItem('reflexRuns',JSON.stringify(runs))}catch{}
 view('done',avg+' ms',prior.every(r=>r.avg>avg)?'Personal best! Five rounds complete.':'Run complete. Fastest round: '+Math.min(...scores)+' ms.','Play again');
 }else view('next',elapsed+' ms','Round '+scores.length+' complete.','Next round');
 telemetry();
}
function handle(target){
 const side=['left','right'].includes(target.id)?target.id:null;
 if(phase==='go'&&mode==='choice'&&!side)return;
 input(side);
}
$('arena').onpointerdown=e=>{if(e.isPrimary&&e.button===0)handle(e.target)};
$('arena').onclick=e=>{if(e.detail===0)handle(e.target)};
document.onkeydown=e=>{
 if(e.altKey||e.ctrlKey||e.metaKey||e.repeat)return;
 if(mode==='duel'&&['KeyA','KeyL'].includes(e.code)){e.preventDefault();input(e.code==='KeyA'?'left':'right');return}
 if(e.code==='Space'&&!(e.target.closest('button')&&!$('arena').contains(e.target))){e.preventDefault();if(!(phase==='go'&&mode==='choice'))input(null)}
 if(mode==='choice'&&['ArrowLeft','ArrowRight'].includes(e.key)&&['go','wait'].includes(phase)){e.preventDefault();input(e.key==='ArrowLeft'?'left':'right')}
};
document.querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>{if(mode===btn.dataset.mode)return;mode=btn.dataset.mode;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b===btn));idle();btn.blur()});
$('sound').onclick=()=>{try{audio??=new AudioContext();audio.resume();audible=!audible;$('sound').setAttribute('aria-pressed',audible);$('sound').textContent=audible?'Sound on':'Sound off';tone()}catch{}};
document.onvisibilitychange=()=>{if(document.hidden&&['wait','go'].includes(phase)){cancel();view('miss','Round paused.','Resume when you’re ready.','Resume round')}};
$('headline').setAttribute('aria-live','polite');idle();
