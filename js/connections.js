/* Browser-local preferences, bounded automatic probes, and opt-in iframe preview. */
(() => {
  'use strict';
  const $=selector=>document.querySelector(selector);
  function read(key){try{return localStorage.getItem(`orbit:${key}`)==='true';}catch{return false;}}
  function save(key,value){try{localStorage.setItem(`orbit:${key}`,String(value));}catch{/* Preferences remain usable for this visit. */}}
  const previewToggle=$('#preview-enabled'),autoToggle=$('#auto-probe-enabled');
  previewToggle.checked=read('link-preview');autoToggle.checked=read('auto-probe');
  const sidebar=$('#sidebar'),frame=$('#bookmark-preview'),placeholder=$('#preview-placeholder');
  const links=[...sidebar.querySelectorAll('.bookmark-link[data-probe-url]')];
  const previewCard=$('#tool-preview');
  const previewViewport=frame.parentElement;
  const virtualWidth=1280,virtualHeight=800;
  function fitPreview(){
    const width=previewViewport.clientWidth,height=previewViewport.clientHeight;
    if(!width||!height)return;
    const scale=Math.min(width/virtualWidth,height/virtualHeight);
    frame.style.width=`${virtualWidth}px`;frame.style.height=`${virtualHeight}px`;
    frame.style.transform=`scale(${scale})`;frame.style.left=`${(width-virtualWidth*scale)/2}px`;frame.style.top=`${(height-virtualHeight*scale)/2}px`;
    frame.dataset.previewScale=String(scale);
  }
  new ResizeObserver(fitPreview).observe(previewViewport);
  window.addEventListener('orbit:workspace',fitPreview);
  fitPreview();
  let previewTimer,previewTimeout,currentURL='';
  function sidebarActive(){return document.body.classList.contains('sidebar-open')&&!document.hidden&&!sidebar.inert;}
  function setPlaceholder(message){placeholder.hidden=false;placeholder.querySelector('p').textContent=message;frame.hidden=true;}
  function unloadPreview(message){clearTimeout(previewTimer);clearTimeout(previewTimeout);currentURL='';frame.src='about:blank';setPlaceholder(message);}
  function showPreview(link){
    if(!previewToggle.checked||!sidebarActive()||!link)return;
    const raw=link.dataset.probeUrl;if(!raw)return;
    const url=new URL(raw,location.href);
    $('#preview-site-name').textContent=link.querySelector('.bookmark-name').textContent;
    $('#preview-open').href=url.href;$('#preview-open').hidden=false;
    if(!['http:','https:'].includes(url.protocol)||(location.protocol==='https:'&&url.protocol==='http:')){
      unloadPreview('当前页面无法嵌入此地址，请打开原网页');$('#preview-status').textContent='原书签地址保持不变。';return;
    }
    if(currentURL===url.href)return;
    currentURL=url.href;clearTimeout(previewTimeout);placeholder.hidden=true;frame.hidden=false;fitPreview();
    $('#preview-status').textContent='正在请求预览… 若目标站禁止嵌入，请打开原网页。';
    frame.src=url.href;
    const requestURL=currentURL;
    previewTimeout=setTimeout(()=>{if(currentURL===requestURL)$('#preview-status').textContent='未能确认加载；目标网站可能禁止嵌入，仍可打开原网页。';},6500);
    const album=$('#tool-deck'),card=previewCard.getBoundingClientRect(),viewport=album.getBoundingClientRect();
    if(card.top<viewport.top||card.bottom>viewport.bottom)album.scrollTo({top:album.scrollTop+card.top-viewport.top-8,behavior:document.body.classList.contains('motion-reduced')?'auto':'smooth'});
  }
  frame.addEventListener('load',()=>{
    if(!currentURL)return;clearTimeout(previewTimeout);fitPreview();
    // An iframe load event cannot prove that a cross-origin page rendered.
    $('#preview-status').textContent='已尝试嵌入；若留白或显示拒绝连接，请打开原网页。';
  });
  frame.addEventListener('error',()=>{if(currentURL)$('#preview-status').textContent='预览未能加载，可直接打开原网页。';});
  function schedulePreview(event){
    const link=event.target.closest('.bookmark-link[data-probe-url]');
    if(!link||(event.relatedTarget&&link.contains(event.relatedTarget)))return;
    clearTimeout(previewTimer);
    if(previewToggle.checked)previewTimer=setTimeout(()=>showPreview(link),380);
  }
  sidebar.addEventListener('pointerover',schedulePreview);sidebar.addEventListener('focusin',schedulePreview);
  sidebar.addEventListener('pointerout',event=>{const link=event.target.closest('.bookmark-link');if(link&&!link.contains(event.relatedTarget))clearTimeout(previewTimer);});
  sidebar.addEventListener('focusout',()=>clearTimeout(previewTimer));
  previewToggle.addEventListener('change',()=>{
    save('link-preview',previewToggle.checked);
    if(previewToggle.checked){setPlaceholder('悬停左侧书签，在这里预览网页');$('#preview-status').textContent='预览已开启，设置会保留到下次访问。';}
    else {unloadPreview('预览已关闭');$('#preview-status').textContent='悬停测速仍然可用；设置已记住。';}
  });
  if(previewToggle.checked)setPlaceholder('悬停左侧书签，在这里预览网页');

  let round=0,running=false,refreshTimer,done=0;
  const status=$('#auto-probe-status');
  function stopAuto(){round++;running=false;clearTimeout(refreshTimer);}
  function autoStatus(){
    if(!autoToggle.checked)status.textContent='自动测速已关闭 · 悬停仍可测速';
    else if(!sidebarActive())status.textContent='自动测速已开启 · 展开书签后开始';
    else if(running)status.textContent=`自动测速 ${done} / ${links.length} · 最多同时 2 个`;
    else status.textContent=`本轮 ${done} / ${links.length} · 两分钟后更新`;
  }
  async function runAuto(){
    if(running||!autoToggle.checked||!sidebarActive())return;
    clearTimeout(refreshTimer);running=true;done=0;const batch=++round;let cursor=0;autoStatus();
    async function worker(){
      while(batch===round&&autoToggle.checked&&sidebarActive()&&cursor<links.length){
        const link=links[cursor++];
        await window.OrbitProbe.test(link);
        if(batch!==round)return;
        done++;autoStatus();
        await new Promise(resolve=>setTimeout(resolve,90));
      }
    }
    await Promise.all([worker(),worker()]);
    if(batch!==round)return;
    running=false;autoStatus();
    if(autoToggle.checked&&sidebarActive())refreshTimer=setTimeout(runAuto,120000);
  }
  autoToggle.addEventListener('change',()=>{save('auto-probe',autoToggle.checked);stopAuto();autoStatus();if(autoToggle.checked)runAuto();});
  function sync(){
    if(!sidebarActive()){
      stopAuto();autoStatus();
      if(!document.body.classList.contains('sidebar-open')||document.hidden)unloadPreview(previewToggle.checked?'悬停左侧书签，在这里预览网页':'打开预览开关，再悬停左侧书签');
    }else {autoStatus();runAuto();}
  }
  window.addEventListener('orbit:workspace',sync);document.addEventListener('visibilitychange',sync);
  matchMedia('(max-width:760px)').addEventListener('change',sync);
  sync();
})();
