/* Offline workspace: time, focus, tasks, scientific math and function plotting. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const storage = {
    get(key, fallback = null) { try { const value = localStorage.getItem(`orbit:${key}`); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(`orbit:${key}`, JSON.stringify(value)); return true; } catch { return false; } }
  };
  const reduced = () => document.body.classList.contains('motion-reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('#focus-actor').append(MujicaCharacters.create('sakiko','walk'));
  $('#mutsumi-avatar').append(MujicaCharacters.create('mutsumi','portrait'));

  // Retain the common prefix and retype only the changed end of the clock.
  const clockLine=$('#desk-clock'),clockPrimary=document.createElement('span'),clockSeconds=document.createElement('span');
  clockPrimary.className='clock-primary';clockSeconds.className='clock-seconds';clockLine.replaceChildren(clockPrimary,clockSeconds);
  let clockTarget='',clockValue='',clockTyping=0;
  const clockVisible=()=>!document.hidden&&document.body.classList.contains('sidebar-open');
  function paintClock(value){clockValue=value;clockPrimary.textContent=value.slice(0,5);clockSeconds.textContent=value.slice(5);}
  function stopClock(){clearTimeout(clockTyping);clockTyping=0;clockLine.dataset.phase='idle';}
  function animateClock(){
    clockTyping=0;
    if(reduced()||!clockVisible()){paintClock(clockTarget);stopClock();return;}
    if(clockValue===clockTarget){stopClock();return;}
    const erasing=!clockTarget.startsWith(clockValue);
    clockLine.dataset.phase=erasing?'erase':'type';
    paintClock(erasing?clockValue.slice(0,-1):clockTarget.slice(0,clockValue.length+1));
    clockTyping=setTimeout(animateClock,erasing?26:42);
  }
  function clock(now = new Date(), force = false) {
    const next=now.toLocaleTimeString('zh-CN',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
    clockLine.dateTime=now.toISOString();clockLine.setAttribute('aria-label',`当前时间 ${next}`);
    if(next!==clockTarget||force){
      clockTarget=next;
      if(reduced()||!clockVisible()){stopClock();paintClock(next);}
      else if(!clockTyping){if(force)paintClock('');animateClock();}
    }
    $('#desk-date').textContent=now.toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'});
    $('#desk-date').dateTime=now.toISOString();$('#desk-weekday').textContent=now.toLocaleDateString('zh-CN',{weekday:'long'});
  }
  clock();
  window.addEventListener('orbit:workspace',()=>{if(clockVisible())clock(new Date(),true);else{stopClock();paintClock(clockTarget);}});
  window.addEventListener('orbit:motionchange',()=>{if(reduced()){stopClock();paintClock(clockTarget);}});

  let audio;
  let sound=storage.get('focus-sound',true);
  let notifications=storage.get('focus-notifications',false);
  function feedback(text){$('#focus-feedback').textContent=text;}
  function ensureAudio(){
    try{
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio){feedback('此浏览器不支持提示音');return null;}
      if(!audio) audio=new Audio();
      if(audio.state==='suspended')audio.resume().catch(()=>feedback('点击“试听”可启用提示音'));
      return audio;
    }catch{feedback('提示音暂不可用');return null;}
  }
  function chime(){
    const context=ensureAudio();if(!context)return;
    [523.25,659.25,783.99].forEach((frequency,index)=>{
      const oscillator=context.createOscillator(),gain=context.createGain();
      const start=context.currentTime+index*.22;oscillator.type='sine';oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.12,start+.025);gain.gain.exponentialRampToValueAtTime(.001,start+.8);
      oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start);oscillator.stop(start+.85);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    });
  }
  function soundUI(){$('#focus-sound').textContent=sound?'♫ 提示音开':'♫ 提示音关';$('#focus-sound').setAttribute('aria-pressed',String(sound));}
  function notificationUI(){
    const available='Notification'in window&&window.isSecureContext;
    $('#focus-notify').disabled=!available;
    $('#focus-test-notify').disabled=!available;
    $('#focus-notify').textContent=!available?'通知不可用':Notification.permission==='denied'?'通知已被阻止':notifications&&Notification.permission==='granted'?'通知已开启':'开启通知';
    $('#focus-notify').setAttribute('aria-pressed',String(available&&notifications&&Notification.permission==='granted'));
  }
  soundUI();notificationUI();
  $('#focus-sound').addEventListener('click',()=>{sound=!sound;storage.set('focus-sound',sound);if(sound)ensureAudio();soundUI();});
  $('#focus-test-sound').addEventListener('click',chime);
  const notificationText=$('#focus-notification-text');
  const savedText=storage.get('focus-notification-text','');notificationText.value=typeof savedText==='string'?savedText:'';
  let messageTimer;
  function saveMessage(){clearTimeout(messageTimer);storage.set('focus-notification-text',notificationText.value);}
  notificationText.addEventListener('input',()=>{clearTimeout(messageTimer);messageTimer=setTimeout(saveMessage,200);});
  notificationText.addEventListener('blur',saveMessage);window.addEventListener('pagehide',saveMessage);
  async function notificationPermission(){
    if(!('Notification'in window)||!window.isSecureContext){feedback('此浏览器无法发送系统通知');return false;}
    if(Notification.permission==='denied'){feedback('请在浏览器的网站设置中允许通知');return false;}
    try{const granted=Notification.permission==='granted'||await Notification.requestPermission()==='granted';if(!granted)feedback('未获得通知权限，暂时无法发送系统通知');return granted;}catch{feedback('此浏览器无法开启系统通知');return false;}
  }
  $('#focus-notify').addEventListener('click',async()=>{
    if(notifications&&Notification.permission==='granted'){notifications=false;storage.set('focus-notifications',false);notificationUI();return;}
    notifications=await notificationPermission();storage.set('focus-notifications',notifications);notificationUI();
    if(notifications)feedback('计时结束时将发送当前填写的通知内容');
  });
  const storedDuration=storage.get('focus-duration',25*60);
  const duration=Number.isInteger(storedDuration)&&storedDuration>=1&&storedDuration<=86400?storedDuration:25*60;
  const focus={total:duration,remaining:duration,deadline:0,running:false,completed:false};
  function notificationBody(){
    const custom=notificationText.value.trim();if(custom)return custom;
    const minutes=Math.floor(focus.total/60),seconds=focus.total%60;
    const time=[minutes?`${minutes} 分钟`:'',seconds?`${seconds} 秒`:''].filter(Boolean).join(' ');
    return `祥子已经走到终点，${time}专注已结束，休息一下吧。`;
  }
  function sendNotification(test=false){
    try{const notice=new Notification(test?'专注提醒 · 测试':'专注完成',{body:notificationBody(),icon:'img/icon.ico',tag:test?'orbit-focus-test':'orbit-focus-complete',silent:true});notice.onclick=()=>{window.focus();notice.close();};return true;}
    catch{feedback('此浏览器暂不支持桌面通知');return false;}
  }
  $('#focus-test-notify').addEventListener('click',async()=>{if(await notificationPermission()){saveMessage();if(sendNotification(true))feedback('测试通知已发送');}notificationUI();});
  function completed(){
    feedback('祥子到达终点，专注完成。');
    if(sound)chime();
    if(notifications&&'Notification'in window&&Notification.permission==='granted')sendNotification();
    $('#focus-ocean').classList.add('is-complete');
  }
  function renderFocus(now=Date.now()){
    if(focus.running){focus.remaining=Math.max(0,Math.ceil((focus.deadline-now)/1000));if(!focus.remaining){focus.running=false;focus.completed=true;completed();}}
    const minutes=Math.floor(focus.remaining/60),seconds=focus.remaining%60;
    $('#focus-time').textContent=`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    const percent=(1-focus.remaining/focus.total)*100;
    $('#focus-actor').style.left=`${percent}%`;$('#focus-actor').style.transform=`translateX(-${percent}%)`;
    $('#focus-ocean').classList.toggle('is-running',focus.running);
    const status=focus.completed?'本轮完成':focus.running?'专注中':focus.remaining<focus.total?'已暂停':'准备开始';
    if($('#focus-status').textContent!==status)$('#focus-status').textContent=status;
    $('#focus-toggle-label').textContent=focus.running?'暂停祥子':!focus.completed&&focus.remaining<focus.total?'继续专注':'若叶睦说：“祥，移动”';
  }
  function resetFocus(minutes=focus.total/60){
    focus.total=Math.round(minutes*60);focus.remaining=focus.total;focus.running=false;focus.completed=false;
    $('#focus-ocean').classList.remove('is-complete');feedback('');
    $('#focus-custom-minutes').value=Math.floor(focus.total/60);$('#focus-custom-seconds').value=focus.total%60;
    storage.set('focus-duration',focus.total);
    document.querySelectorAll('[data-focus-minutes]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.focusMinutes)*60===focus.total)));renderFocus();
  }
  $('#focus-custom').addEventListener('submit',event=>{
    event.preventDefault();const minutes=Number($('#focus-custom-minutes').value),seconds=Number($('#focus-custom-seconds').value),total=minutes*60+seconds;
    if(!Number.isInteger(minutes)||!Number.isInteger(seconds)||minutes<0||seconds<0||seconds>59||total<1||total>86400){feedback('请设置 1 秒至 24 小时的时长，秒数为 0–59');return;}
    resetFocus(total/60);
  });
  resetFocus(focus.total/60);
  $('#focus-toggle').addEventListener('click',()=>{if(focus.running){renderFocus();focus.running=false;}else{if(focus.completed)resetFocus();if(sound)ensureAudio();focus.deadline=Date.now()+focus.remaining*1000;focus.running=true;}renderFocus();});
  $('#focus-reset').addEventListener('click',()=>resetFocus());
  document.querySelectorAll('[data-focus-minutes]').forEach(button=>button.addEventListener('click',()=>resetFocus(Number(button.dataset.focusMinutes))));
  window.addEventListener('orbit:clock',event=>{clock(new Date(event.detail));renderFocus(event.detail);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){clock();renderFocus();}});renderFocus();

  let tasks=storage.get('todos',[]);
  if(!Array.isArray(tasks))tasks=[];
  tasks=tasks.filter(task=>task&&typeof task.id==='string'&&typeof task.text==='string');
  let lastCompleted=null;
  function saveTasks(){storage.set('todos',tasks);}
  function taskSummary(){const pending=tasks.filter(task=>!task.done).length;$('#todo-summary').textContent=`${pending} 项待办`;$('#todo-done-count').textContent=`已完成 ${tasks.length-pending} 项`;$('#todo-undo').hidden=!lastCompleted;}
  function renderTasks(){
    const list=$('#todo-list');list.replaceChildren();const pending=tasks.filter(task=>!task.done);
    if(!pending.length){const empty=document.createElement('p');empty.className='todo-empty';empty.textContent='先写下一件小事吧。';list.append(empty);}
    pending.forEach(task=>{
      const row=document.createElement('div');row.className='todo-row';row.dataset.id=task.id;
      const check=document.createElement('button');check.type='button';check.className='todo-check';check.setAttribute('aria-label',`完成：${task.text}`);check.textContent='✓';
      const text=document.createElement('span');text.className='todo-text';text.textContent=task.text;
      const remove=document.createElement('button');remove.type='button';remove.className='todo-remove';remove.setAttribute('aria-label',`删除：${task.text}`);remove.textContent='×';
      const collector=document.createElement('span');collector.className='todo-collector';collector.append(MujicaCharacters.create('sakiko','carry'));
      row.append(check,text,remove,collector);list.append(row);
      check.addEventListener('click',async()=>{
        if(row.classList.contains('is-collecting'))return;
        task.done=true;lastCompleted=task.id;saveTasks();check.disabled=true;remove.disabled=true;
        if(!reduced()){
          row.classList.add('is-collecting');
          const animation=row.animate([{opacity:1,height:`${row.offsetHeight}px`},{opacity:0,height:'0px',marginTop:'0px',marginBottom:'0px',paddingTop:'0px',paddingBottom:'0px'}],{duration:250,delay:950,easing:'ease-in',fill:'forwards'});
          await animation.finished.catch(()=>{});
        }
        renderTasks();$('#todo-feedback').textContent='祥子已收走一项，做得不错。';
      });
      remove.addEventListener('click',()=>{tasks=tasks.filter(item=>item.id!==task.id);saveTasks();renderTasks();});
    });taskSummary();
  }
  $('#todo-form').addEventListener('submit',event=>{event.preventDefault();const input=$('#todo-input'),text=input.value.trim();if(!text)return;if(tasks.filter(task=>!task.done).length>=100){$('#todo-feedback').textContent='先完成一些待办，再添加新任务。';return;}tasks.push({id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,text,done:false});saveTasks();input.value='';$('#todo-feedback').textContent='';renderTasks();});
  $('#todo-undo').addEventListener('click',()=>{const task=tasks.find(task=>task.id===lastCompleted);if(task)task.done=false;lastCompleted=null;saveTasks();renderTasks();$('#todo-feedback').textContent='已恢复上次完成的待办。';});renderTasks();

  // Scientific calculator. All operations use the shared expression parser.
  let degrees=false,answer=0;
  const calc=$('#calc-expression');
  const keys=['sin(','cos(','tan(','(',')','AC','ln(','log(','sqrt(','^','!','⌫','7','8','9','÷','pi','e','4','5','6','×','%','abs(','1','2','3','−','ans','1/','0','.','+','±',',','='];
  keys.forEach(value=>{const button=document.createElement('button');button.type='button';button.dataset.key=value;button.className=`calc-key${value==='='?' smear-button calc-equals':''}`;const label=document.createElement('span');label.textContent=({'sqrt(':'√','pi':'π','abs(':'abs','1/':'1/x'}[value]||value.replace('(',''));button.append(label);button.setAttribute('aria-label',value==='⌫'?'删除一位':value==='AC'?'清空':value);$('#calculator-keys').append(button);});
  function calculate(){try{const result=OrbitMath.compile(calc.value,{degrees,ans:answer})();if(!Number.isFinite(result))throw new Error('结果超出实数范围或发生除零');answer=Object.is(result,-0)?0:result;$('#calc-result').textContent=Number.parseFloat(answer.toPrecision(12)).toString();$('#calc-error').textContent='';}catch(error){$('#calc-error').textContent=error.message;}}
  function insertMath(value){const start=calc.selectionStart??calc.value.length,end=calc.selectionEnd??start;calc.setRangeText(value,start,end,'end');calc.focus({preventScroll:true});}
  $('#calculator-keys').addEventListener('click',event=>{const button=event.target.closest('[data-key]');if(!button)return;const key=button.dataset.key;if(key==='=')calculate();else if(key==='AC'){calc.value='';$('#calc-result').textContent='0';$('#calc-error').textContent='';}else if(key==='⌫'){const start=calc.selectionStart??calc.value.length,end=calc.selectionEnd??start;calc.setRangeText('',Math.max(0,start-(start===end?1:0)),end,'end');calc.focus({preventScroll:true});}else if(key==='±'){calc.value=calc.value?`-(${calc.value})`:'-';calc.focus({preventScroll:true});}else if(key==='1/'){calc.value=calc.value?`1/(${calc.value})`:'1/(';calc.focus({preventScroll:true});}else insertMath(key);});
  calc.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();calculate();}});
  $('#calc-angle').addEventListener('click',()=>{degrees=!degrees;$('#calc-angle').textContent=degrees?'DEG':'RAD';if(calc.value.trim())calculate();});

  // Explicit functions and implicit F(x,y)=0 contours share a uniform unit scale.
  const canvas=$('#graph-canvas'),context=canvas.getContext('2d');
  let view={xmin:-10,xmax:10,ymin:-10,ymax:10},relation=null,graphFrame=0,lastAspect=0;
  function resetGraphView(){const rect=canvas.getBoundingClientRect(),aspect=rect.width/Math.max(1,rect.height);lastAspect=aspect;const sx=20*Math.max(1,aspect),sy=20*Math.max(1,1/aspect);view={xmin:-sx/2,xmax:sx/2,ymin:-sy/2,ymax:sy/2};}
  function niceStep(span){const raw=span/8,power=10**Math.floor(Math.log10(raw)),ratio=raw/power;return(ratio<2?1:ratio<5?2:5)*power;}
  function drawGraph(){
    graphFrame=0;const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
    const width=rect.width,height=rect.height,aspect=width/height,dpr=Math.min(devicePixelRatio||1,2);
    if(!lastAspect)resetGraphView();
    else if(Math.abs(aspect-lastAspect)>.001){const cy=(view.ymin+view.ymax)/2,span=(view.xmax-view.xmin)/aspect;view.ymin=cy-span/2;view.ymax=cy+span/2;lastAspect=aspect;}
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);context.setTransform(dpr,0,0,dpr,0,0);
    context.fillStyle='#0c1825';context.fillRect(0,0,width,height);
    const px=x=>(x-view.xmin)/(view.xmax-view.xmin)*width,py=y=>height-(y-view.ymin)/(view.ymax-view.ymin)*height;
    context.lineWidth=1;context.font='10px monospace';context.textBaseline='top';
    const sx=niceStep(view.xmax-view.xmin),sy=niceStep(view.ymax-view.ymin);
    for(let x=Math.ceil(view.xmin/sx)*sx;x<=view.xmax;x+=sx){context.strokeStyle=Math.abs(x)<sx*.01?'#6a99ab77':'#8bbdd014';context.beginPath();context.moveTo(px(x),0);context.lineTo(px(x),height);context.stroke();context.fillStyle='#6b91a2';context.fillText(Number(x.toPrecision(4)).toString(),px(x)+3,Math.max(2,Math.min(height-13,py(0)+4)));}
    for(let y=Math.ceil(view.ymin/sy)*sy;y<=view.ymax;y+=sy){context.strokeStyle=Math.abs(y)<sy*.01?'#6a99ab77':'#8bbdd014';context.beginPath();context.moveTo(0,py(y));context.lineTo(width,py(y));context.stroke();if(Math.abs(y)>sy*.01){context.fillStyle='#6b91a2';context.fillText(Number(y.toPrecision(4)).toString(),Math.max(3,Math.min(width-35,px(0)+5)),py(y)+3);}}
    context.strokeStyle='#a2e4d9';context.lineWidth=1.8;context.beginPath();let segments=0;
    if(relation&&!relation.implicit){
      let previous=null;
      for(let pixel=0;pixel<=width;pixel++){
        const x=view.xmin+pixel/width*(view.xmax-view.xmin),value=relation.evaluate(x),y=py(value);
        if(!Number.isFinite(y)||Math.abs(y)>height*10){previous=null;continue;}
        if(previous&&Math.abs(y-previous)<height*.6){context.lineTo(pixel,y);segments++;}else context.moveTo(pixel,y);
        previous=y;
      }
    }else if(relation){
      const nx=Math.max(2,Math.ceil(width/4)),ny=Math.max(2,Math.ceil(height/4)),dx=width/nx,dy=height/ny;
      const grid=Array.from({length:ny+1},(_,j)=>Float64Array.from({length:nx+1},(_,i)=>relation.evaluate(view.xmin+i/nx*(view.xmax-view.xmin),view.ymax-j/ny*(view.ymax-view.ymin))));
      const pairs={1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[0,2]],11:[[1,2]],12:[[1,3]],13:[[0,1]],14:[[3,0]]};
      for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
        const v=[grid[j][i],grid[j][i+1],grid[j+1][i+1],grid[j+1][i]];
        if(v.some(value=>!Number.isFinite(value)))continue;
        const mask=v.reduce((bits,value,index)=>bits|(value>=0?1<<index:0),0);if(mask===0||mask===15)continue;
        let edges=pairs[mask];
        if(mask===5||mask===10){const center=relation.evaluate(view.xmin+(i+.5)/nx*(view.xmax-view.xmin),view.ymax-(j+.5)/ny*(view.ymax-view.ymin));const connected=mask===5?center>=0:center<0;edges=connected?[[0,1],[2,3]]:[[3,0],[1,2]];}
        const point=edge=>{const corners=[[0,1],[1,2],[2,3],[3,0]],positions=[[i*dx,j*dy],[(i+1)*dx,j*dy],[(i+1)*dx,(j+1)*dy],[i*dx,(j+1)*dy]],[a,b]=corners[edge],t=Math.max(0,Math.min(1,v[a]/(v[a]-v[b])));return[positions[a][0]+t*(positions[b][0]-positions[a][0]),positions[a][1]+t*(positions[b][1]-positions[a][1])];};
        for(const[a,b]of edges||[]){const from=point(a),to=point(b);if([...from,...to].every(Number.isFinite)){context.moveTo(...from);context.lineTo(...to);segments++;}}
      }
    }
    context.stroke();canvas.dataset.segments=String(segments);canvas.dataset.mode=relation?(relation.implicit?'implicit':'explicit'):'empty';canvas.dataset.range=`${view.xmin.toFixed(3)},${view.xmax.toFixed(3)},${view.ymin.toFixed(3)},${view.ymax.toFixed(3)}`;
  }
  function scheduleGraph(){if(!graphFrame)graphFrame=requestAnimationFrame(drawGraph);}
  function plot(){try{relation=$('#graph-expression').value.trim()?OrbitMath.relation($('#graph-expression').value):null;$('#graph-error').textContent='';scheduleGraph();}catch(error){$('#graph-error').textContent=error.message;}}
  $('#graph-form').addEventListener('submit',event=>{event.preventDefault();plot();});
  $('#graph-reset').addEventListener('click',()=>{resetGraphView();scheduleGraph();});
  let graphDrag=null;
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;graphDrag={x:event.clientX,y:event.clientY,view:{...view}};canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{if(!graphDrag)return;const rect=canvas.getBoundingClientRect(),dx=(event.clientX-graphDrag.x)/rect.width*(graphDrag.view.xmax-graphDrag.view.xmin),dy=(event.clientY-graphDrag.y)/rect.height*(graphDrag.view.ymax-graphDrag.view.ymin);view={xmin:graphDrag.view.xmin-dx,xmax:graphDrag.view.xmax-dx,ymin:graphDrag.view.ymin+dy,ymax:graphDrag.view.ymax+dy};scheduleGraph();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{graphDrag=null;});
  canvas.addEventListener('wheel',event=>{event.preventDefault();const rect=canvas.getBoundingClientRect(),factor=Math.exp(Math.max(-200,Math.min(200,event.deltaY))*.0018),span=view.xmax-view.xmin;if(span*factor<.02||span*factor>1e6)return;const x=view.xmin+(event.clientX-rect.left)/rect.width*span,y=view.ymax-(event.clientY-rect.top)/rect.height*(view.ymax-view.ymin);view={xmin:x+(view.xmin-x)*factor,xmax:x+(view.xmax-x)*factor,ymin:y+(view.ymin-y)*factor,ymax:y+(view.ymax-y)*factor};scheduleGraph();},{passive:false});
  new ResizeObserver(scheduleGraph).observe(canvas);window.addEventListener('orbit:workspace',scheduleGraph);

  // Album-style masonry: every card participates in the vertical layout.
  const album=$('#tool-deck'),cards=[...album.querySelectorAll('[data-tool-card]')];let albumFrame=0;
  function layoutAlbum(){albumFrame=0;const style=getComputedStyle(album),row=parseFloat(style.gridAutoRows),gap=parseFloat(style.rowGap);for(const card of cards){const span=Math.max(1,Math.ceil((card.getBoundingClientRect().height+gap)/(row+gap)));card.style.gridRowEnd=`span ${span}`;}}
  function scheduleAlbum(){if(!albumFrame)albumFrame=requestAnimationFrame(layoutAlbum);}
  const albumObserver=new ResizeObserver(scheduleAlbum);albumObserver.observe(album);cards.forEach(card=>albumObserver.observe(card));
  window.addEventListener('orbit:workspace',scheduleAlbum);
  MujicaCharacters.scrollbar({viewport:album,rail:$('#album-scrollbar'),thumb:$('#album-scroll-thumb'),shell:$('#tool-album-shell'),observe:cards});

  // Wrap labels once; new task buttons are styled separately to keep DOM handlers intact.
  document.querySelectorAll('.calculator-card button,.graph-card button').forEach(button=>{button.classList.remove('smear-button');button.classList.add('quick-button');});
  document.querySelectorAll('#sidebar-workspace button:not(.smear-button):not(.quick-button):not(.todo-check):not(.todo-remove)').forEach(button=>{button.classList.add('smear-button');if(!button.querySelector('span')){const label=document.createElement('span');label.textContent=button.textContent;button.replaceChildren(label);}});
})();
