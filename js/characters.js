/* Local bitmap characters and independent draggable scrollbars. */
(() => {
  'use strict';
  const assets={sakiko:{name:'丰川祥子',src:'img/characters/sakiko-idle.png'},uika:{name:'三角初华（初音）',src:'img/characters/uika-crawl-transparent.png'},mutsumi:{name:'若叶睦',src:'img/characters/mutsumi.png'}};
  function create(name='sakiko',pose='walk'){
    const asset=assets[name]||assets.sakiko;
    const wrapper=document.createElement('span');
    wrapper.className=`mujica-actor actor-${name} pose-${pose}`;wrapper.dataset.character=asset.name;wrapper.setAttribute('aria-hidden','true');
    const picture=document.createElement('img');picture.src=asset.src;picture.alt='';picture.draggable=false;picture.decoding='async';wrapper.append(picture);
    if(name==='sakiko'){
      const frames=document.createElement('span');frames.className='sakiko-frames';wrapper.append(frames);
    }
    return wrapper;
  }
  function scrollbar({viewport,rail,thumb,shell,observe=[],character=true}){
    let chain;
    if(character){
      rail.classList.add('character-scrollbar');thumb.classList.add('character-scroll-thumb');thumb.replaceChildren(create('uika','crawl'));
      chain=document.createElement('span');chain.className='character-chain';chain.setAttribute('aria-hidden','true');
      const anchor=document.createElement('span');anchor.className='chain-anchor';anchor.setAttribute('aria-hidden','true');rail.prepend(chain,anchor);
    }
    const crawl=character?thumb.querySelector('.actor-uika>img'):null;
    let frame=0,idle,drag=null,lastScroll=viewport.scrollTop,crawlDistance=0;
    function update(){
      frame=0;const delta=viewport.scrollTop-lastScroll;lastScroll=viewport.scrollTop;
      // Advance PNG poses only when the viewport actually moves. No idle loop:
      // holding the handle still freezes this exact pose, including during a drag.
      if(crawl&&delta&&!document.hidden&&!document.body.classList.contains('motion-reduced')&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
        crawlDistance+=Math.min(32,Math.abs(delta));
        const pose=Math.floor(crawlDistance/16)%12;
        crawl.style.setProperty('--crawl-frame',pose);crawl.dataset.frame=pose;
      }
      const max=viewport.scrollHeight-viewport.clientHeight,scrollable=max>1;rail.hidden=!scrollable;shell.classList.toggle('has-more',scrollable&&viewport.scrollTop<max-2);
      if(!scrollable)return;
      const height=character?Math.min(92,rail.clientHeight):Math.min(rail.clientHeight,Math.max(34,rail.clientHeight*viewport.clientHeight/viewport.scrollHeight)),ratio=Math.max(0,Math.min(1,viewport.scrollTop/max)),y=ratio*(rail.clientHeight-height);
      thumb.style.setProperty('--thumb-height',`${height}px`);thumb.style.setProperty('--thumb-y',`${y}px`);if(chain)chain.style.height=`${y+16}px`;
      rail.setAttribute('aria-valuenow',Math.round(ratio*100));rail.setAttribute('aria-valuetext',`${character?'初华的位置':'书签滚动位置'}：${Math.round(ratio*100)}%`);
    }
    function schedule(){if(!frame)frame=requestAnimationFrame(update);}
    function stopScroll(){clearTimeout(idle);shell.classList.remove('is-scrolling');}
    viewport.addEventListener('scroll',()=>{schedule();shell.classList.add('is-scrolling');clearTimeout(idle);idle=setTimeout(stopScroll,character?120:650);},{passive:true});
    const observer=new ResizeObserver(schedule);observer.observe(viewport);observe.forEach(element=>observer.observe(element));
    function move(y){const box=rail.getBoundingClientRect(),height=thumb.getBoundingClientRect().height,travel=box.height-height;if(travel<=0)return;viewport.scrollTop=Math.max(0,Math.min(1,(y-box.top-drag)/travel))*(viewport.scrollHeight-viewport.clientHeight);update();}
    rail.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();rail.focus({preventScroll:true});const box=thumb.getBoundingClientRect();drag=thumb.contains(event.target)?event.clientY-box.top:box.height/2;shell.classList.add('is-dragging');rail.setPointerCapture(event.pointerId);move(event.clientY);});
    rail.addEventListener('pointermove',event=>{if(drag!==null)move(event.clientY);});
    function end(){drag=null;shell.classList.remove('is-dragging');if(character)stopScroll();}
    for(const event of ['pointerup','pointercancel','lostpointercapture'])rail.addEventListener(event,end);
    window.addEventListener('blur',end);
    rail.addEventListener('keydown',event=>{const steps={ArrowDown:48,ArrowUp:-48,PageDown:viewport.clientHeight*.8,PageUp:-viewport.clientHeight*.8};if(event.key in steps){event.preventDefault();viewport.scrollTop+=steps[event.key];}else if(event.key==='Home'||event.key==='End'){event.preventDefault();viewport.scrollTop=event.key==='Home'?0:viewport.scrollHeight;}});
    window.addEventListener('orbit:workspace',()=>{schedule();if(character&&!document.body.classList.contains('sidebar-open'))stopScroll();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stopScroll();});
    update();return{update};
  }
  window.MujicaCharacters=Object.freeze({create,scrollbar});
})();
