/*
 * Orbit UI, vanilla JavaScript. Original navigation content attribution:
 * 酷安@_小K同學 / https://github.com/Jackie1123/aNavigation
 * Original project: 2020-01-26, original navigation update: 2022-02-25.
 */
(() => {
  'use strict';
  const { groups, quick, engines } = window.NAVIGATION;
  const $ = selector => document.querySelector(selector);
  const storage = {
    get(key) { try { return localStorage.getItem(`orbit:${key}`); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(`orbit:${key}`, value); return true; } catch { return false; } }
  };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let motionReduced = storage.get('motion') === 'reduced' || reducedMotion.matches;
  const activeAnimations = new Set();
  function updateMotion() {
    document.body.classList.toggle('motion-reduced', motionReduced);
    if (motionReduced) activeAnimations.forEach(animation => animation.finish());
    $('#motion-toggle').setAttribute('aria-pressed', String(motionReduced));
    $('#motion-toggle').setAttribute('aria-label', motionReduced ? '开启动效' : '暂停动效');
    $('#motion-toggle').title = motionReduced ? '开启动效' : '暂停动效';
    $('#motion-toggle span').textContent = motionReduced ? '▷' : 'Ⅱ';
    $('#desk-motion').setAttribute('aria-pressed', String(motionReduced));
    $('#desk-motion span').textContent = motionReduced ? '▷' : 'Ⅱ';
    $('#desk-motion-label').textContent = motionReduced ? '开启动效' : '暂停动效';
    document.documentElement.style.scrollBehavior = motionReduced ? 'auto' : '';
    window.dispatchEvent(new Event('orbit:motionchange'));
  }
  $('#motion-toggle').addEventListener('click', () => {
    motionReduced = !motionReduced;
    storage.set('motion', motionReduced ? 'reduced' : 'full');
    updateMotion();
  });
  reducedMotion.addEventListener('change', event => { motionReduced = event.matches; updateMotion(); });
  updateMotion();

  // Preserve all 24 original time-based greetings verbatim.
  const hourlyTitles = [
    "主人你又在熬夜了",
    "25点了，别帮老板数钱了",
    "26点了，快去睡觉了",
    "27点，主人你是要修仙？",
    "28点，希望你是在补番",
    "29点，你是起得早？还是还没睡呢？",
    "6点钟，还有点早，好困",
    "7点了，主人早上好",
    "8点了，主人想吃什么呢",
    "9点了，学习了",
    "10点了，有没有犯困呢",
    "11点了，快想想去哪吃饭",
    "午时已到，好想睡觉",
    "下午一点，不如去看看剧？",
    "下午2点了，起来了，板砖去了",
    "三点几嘞，做做卵啊做，饮茶先拉",
    "下午四点你有什么事么？",
    "下午五点，准备好吃完饭了么",
    "下午六点了，开摆！",
    "下午七点了呢，走，约会去",
    "下午八点，太阳出来我晒太阳，月亮出来我晒月亮咯",
    "九点了，不过对于程序员应该还早",
    "晚上十点了，洗洗睡吧",
    "十一点了，今晚也要继续么？"
  ];
  let titleHour = -1;
  function updateClock() {
    const now = new Date();
    $('#clock').textContent = now.toLocaleTimeString('zh-CN', { hour12: false });
    $('#clock').dateTime = now.toISOString();
    $('#year').textContent = now.getFullYear();
    window.dispatchEvent(new CustomEvent('orbit:clock', { detail: now.getTime() }));
    if (titleHour !== now.getHours()) {
      titleHour = now.getHours();
      document.title = hourlyTitles[titleHour];
    }
  }
  updateClock();
  setInterval(updateClock, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateClock(); });

  const sakuraField = $('#sakura-field');
  for (let index = 0; index < 16; index++) {
    const petal = document.createElement('span'); petal.className = 'sakura-petal';
    petal.style.setProperty('--petal-x', `${(index * 37 + 3) % 100}%`);
    petal.style.setProperty('--petal-size', `${7 + index % 4 * 2}px`);
    petal.style.setProperty('--petal-time', `${13 + index % 7 * 2}s`);
    petal.style.setProperty('--petal-delay', `${-(index * 3.7 + 1)}s`);
    petal.style.setProperty('--petal-drift', `${10 + index % 5 * 5}vw`);
    petal.style.setProperty('--petal-turn', `${index % 2 ? -1 : 1}`);
    sakuraField.append(petal);
  }
  const twinkleField = $('#twinkle-field');
  for (let index = 0; index < 22; index++) {
    const star = document.createElement('span'); star.className = 'scene-star';
    star.style.left = `${(index * 41 + 7) % 100}%`;
    star.style.top = `${(index * 23 + 11) % 97}%`;
    star.style.setProperty('--star-time', `${2.5 + index % 6 * .6}s`);
    star.style.setProperty('--star-delay', `${-index * .7}s`);
    twinkleField.append(star);
  }

  // The response timer measures an HTTP connection from this visitor's browser,
  // not ICMP ping. CORS-opaque responses prove receipt, not HTTP status or health.
  // Same-origin requests use HEAD; external probes stop as soon as headers arrive.
  const probeCache = new Map();
  const pendingProbes = new Map();
  const probeQueue = [];
  const CACHE_MS = 60000;
  const TIMEOUT_MS = 5000;
  const MAX_CONCURRENT = 2;
  let activeProbes = 0;
  function drainQueue() {
    while (activeProbes < MAX_CONCURRENT && probeQueue.length) {
      const { run, resolve } = probeQueue.shift();
      activeProbes++;
      run().then(resolve).finally(() => { activeProbes--; drainQueue(); });
    }
  }
  function measure(url) {
    const isSameOrigin = url.origin === location.origin;
    // External sites get an anonymous, cache-busted favicon request, never a full page.
    const endpoint = isSameOrigin ? new URL(url.href) : new URL('/favicon.ico', url.origin);
    endpoint.hash = '';
    endpoint.search = `orbit_probe=${Date.now()}`;
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
    const start = performance.now();
    return fetch(endpoint.href, {
      method: isSameOrigin ? 'HEAD' : 'GET',
      mode: isSameOrigin ? 'same-origin' : 'no-cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal
    }).then(response => {
      const ms = Math.max(1, Math.round(performance.now() - start));
      if (response.body) response.body.cancel().catch(() => {});
      controller.abort();
      if (isSameOrigin && !response.ok) return { state: 'blocked', text: `HTTP ${response.status}`, detail: '本地入口未返回成功状态。' };
      return {
        state: ms < 300 ? 'fast' : ms < 1000 ? 'medium' : 'slow',
        text: `${ms} ms`,
        detail: `HTTP 连接响应约 ${ms} ms（含 DNS、TLS、网络与服务端响应）；并非 ICMP Ping。${isSameOrigin ? '' : '跨域请求仅确认收到响应，不代表目标页面可正常使用。'}`
      };
    }).catch(() => ({
      state: timedOut ? 'timeout' : 'blocked',
      text: timedOut ? '超时' : '无法测量',
      detail: timedOut ? '5 秒内未收到响应；不能据此判定网站离线。' : '浏览器安全策略、证书或网络限制使本次探测无法完成；不能据此判定网站离线。'
    })).finally(() => clearTimeout(timeout));
  }
  function probe(url) {
    const key = url.origin === location.origin ? url.pathname : url.origin;
    const cached = probeCache.get(key);
    if (cached && Date.now() - cached.time < CACHE_MS) return Promise.resolve(cached.result);
    if (pendingProbes.has(key)) return pendingProbes.get(key);
    const promise = new Promise(resolve => {
      probeQueue.push({ run: () => measure(url), resolve });
      drainQueue();
    }).then(result => { probeCache.set(key, { time: Date.now(), result }); return result; })
      .finally(() => pendingProbes.delete(key));
    pendingProbes.set(key, promise);
    return promise;
  }
  const probeHandlers = new WeakMap();
  window.OrbitProbe = Object.freeze({ test: link => probeHandlers.get(link)?.() || Promise.resolve(null) });
  function attachProbe(link, rawUrl) {
    const output = document.createElement('span');
    output.className = 'latency';
    output.setAttribute('aria-live', 'polite');
    link.append(output);
    if (!rawUrl) {
      link.setAttribute('aria-disabled', 'true');
      link.removeAttribute('target');
      link.addEventListener('click', event => event.preventDefault());
      output.textContent = '未配置';
      output.dataset.state = 'unconfigured';
      link.title = '此书签尚未配置地址';
      return;
    }
    link.title = '悬停或键盘聚焦以探测 HTTP 连接响应';
    link.dataset.probeUrl = rawUrl;
    let timer;
    let running = null;
    function test() {
      if (running) return running;
      running = (async () => {
        output.textContent = '探测中'; output.dataset.state = 'testing';
        const url = new URL(rawUrl, location.href);
        let result;
        if (!['http:', 'https:'].includes(url.protocol)) {
          result = { state: 'blocked', text: '无法测量', detail: '此协议无法进行 HTTP 探测。请使用本地 HTTP 预览。' };
        } else if (location.protocol === 'https:' && url.protocol === 'http:') {
          result = { state: 'blocked', text: '无法测量', detail: 'HTTPS 页面不能探测不安全的 HTTP 资源；原书签链接仍然保留。' };
        } else result = await probe(url);
        output.textContent = result.text; output.dataset.state = result.state; link.title = result.detail;
        return result;
      })().finally(() => { running = null; });
      return running;
    }
    probeHandlers.set(link, test);
    const schedule = () => { clearTimeout(timer); timer = setTimeout(test, 180); };
    const cancel = () => clearTimeout(timer);
    link.addEventListener('pointerenter', schedule);
    link.addEventListener('pointerleave', cancel);
    link.addEventListener('focus', schedule);
    link.addEventListener('blur', cancel);
    // A first touch previews latency; link activation is never blocked.
    link.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') test(); });
  }

  function animate(element, keyframes, options) {
    const animation = element.animate(keyframes, options);
    activeAnimations.add(animation);
    animation.finished.catch(() => {}).finally(() => activeAnimations.delete(animation));
    return animation;
  }

  // Animate out before removing a grid cell. A new query cancels the previous
  // batch so that rapid typing/deleting can never leave matching links hidden.
  function animatedFilter(records, afterFilter) {
    let revision = 0;
    let animations = [];
    return async function filter(value) {
      const currentRevision = ++revision;
      animations.forEach(animation => animation.cancel());
      animations = [];
      const query = value.trim().toLowerCase();
      const matches = records.map(record => !query || record.haystack.includes(query));
      const leaving = [];
      const entering = [];
      records.forEach(({ element }, index) => {
        element.classList.remove('is-falling');
        element.inert = false;
        if (matches[index]) {
          if (element.hidden) entering.push(element);
        } else if (!element.hidden) leaving.push(element);
      });
      if (!motionReduced) {
        leaving.forEach((element, index) => {
          element.classList.add('is-falling');
          element.inert = true;
          const tilt = (index % 2 ? 1 : -1) * (9 + index % 4 * 3);
          animations.push(animate(element, [
            { transform: 'translateY(0) rotate(0deg) scale(1)', opacity: 1, filter: 'blur(0)' },
            { transform: `translateY(9px) rotate(${tilt * .2}deg) scale(.99)`, opacity: .9, offset: .28 },
            { transform: `translateY(80px) rotate(${tilt}deg) scale(.82)`, opacity: 0, filter: 'blur(3px)' }
          ], { duration: 350, delay: Math.min(index, 4) * 14, easing: 'cubic-bezier(.4,0,.85,.5)', fill: 'both' }));
        });
        await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
      }
      if (currentRevision !== revision) return;
      const previous = new Map(records.filter(({ element }, index) => matches[index] && !element.hidden).map(({ element }) => [element, element.getBoundingClientRect()]));
      records.forEach(({ element }, index) => {
        element.hidden = !matches[index];
        element.inert = false;
        element.classList.remove('is-falling');
      });
      animations.forEach(animation => animation.cancel());
      animations = [];
      afterFilter(matches, query);
      if (!motionReduced) {
        records.forEach(({ element }, index) => {
          if (!matches[index]) return;
          const now = element.getBoundingClientRect();
          const before = previous.get(element);
          if (entering.includes(element)) {
            animations.push(animate(element, [
              { opacity: 0, transform: 'translateY(15px) scale(.9)' },
              { opacity: 1, transform: 'translateY(0) scale(1)' }
            ], { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' }));
          } else if (before && (before.x !== now.x || before.y !== now.y)) {
            animations.push(animate(element, [
              { transform: `translate(${before.x - now.x}px,${before.y - now.y}px)` },
              { transform: 'translate(0,0)' }
            ], { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' }));
          }
        });
      }
      await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
    };
  }

  const bookmarkRecords = [];
  const groupElements = [];
  // Keep category names, category order, and every link's original position.
  groups.forEach(group => {
    const section = document.createElement('section');
    section.className = 'bookmark-group';
    const heading = document.createElement('h2');
    const title = document.createElement('span'); title.textContent = group.name;
    const count = document.createElement('span'); count.className = 'group-count'; count.textContent = group.links.length;
    heading.append(title, count);
    const grid = document.createElement('div'); grid.className = 'group-grid';
    const records = group.links.map(item => {
      const link = document.createElement('a');
      link.className = 'bookmark-link';
      link.href = item.url || '#'; link.target = '_blank'; link.rel = 'noopener noreferrer';
      const name = document.createElement('span'); name.className = 'bookmark-name'; name.textContent = item.name;
      const description = document.createElement('span'); description.className = 'bookmark-description'; description.textContent = item.description;
      link.append(name, description); attachProbe(link, item.url); grid.append(link);
      const record = { element: link, haystack: `${item.name} ${item.description} ${item.url}`.toLowerCase() };
      bookmarkRecords.push(record); return record;
    });
    section.append(heading, grid); $('#bookmark-groups').append(section);
    groupElements.push({ section, count, records });
  });
  const empty = document.createElement('p'); empty.className = 'empty-bookmarks'; empty.textContent = '没有找到匹配的书签'; empty.hidden = true; empty.setAttribute('role', 'status');
  $('#bookmark-groups').append(empty);
  const totalBookmarks = bookmarkRecords.length;
  $('#bookmark-count').textContent = totalBookmarks;
  const filterBookmarks = animatedFilter(bookmarkRecords, (matches, query) => {
    groupElements.forEach(({ section, count, records }) => {
      const visible = records.filter(({ element }) => !element.hidden).length;
      section.hidden = visible === 0; count.textContent = visible;
    });
    const count = matches.filter(Boolean).length;
    empty.hidden = count > 0;
    $('#bookmark-count').textContent = query ? `${count}/${totalBookmarks}` : totalBookmarks;
    requestAnimationFrame(updateBookmarkScroll);
  });
  const bookmarkScrollbar = MujicaCharacters.scrollbar({
    character: false,
    viewport: $('#bookmark-groups'), rail: $('#bookmark-scrollbar'),
    thumb: $('#bookmark-scroll-thumb'), shell: $('#bookmark-scroll-shell'),
    observe: groupElements.map(({ section }) => section)
  });
  function updateBookmarkScroll() { bookmarkScrollbar.update(); }

  const bookmarkInput = $('#bookmark-filter');
  let bookmarkFilterTimer;
  let bookmarkComposing = false;
  let bookmarkFiltering = false;
  let pendingBookmarkQuery = null;
  let appliedBookmarkQuery = '';
  async function flushBookmarkFilter() {
    if (bookmarkFiltering || pendingBookmarkQuery === null) return;
    const query = pendingBookmarkQuery;
    pendingBookmarkQuery = null;
    if (query === appliedBookmarkQuery) return;
    bookmarkFiltering = true;
    try {
      await filterBookmarks(query);
      updateBookmarkScroll();
      appliedBookmarkQuery = query;
    } finally {
      bookmarkFiltering = false;
      if (pendingBookmarkQuery !== null) flushBookmarkFilter();
    }
  }
  function scheduleBookmarkFilter() {
    clearTimeout(bookmarkFilterTimer);
    // Replace queued text while the user is typing, without restarting the
    // current fall/reflow animation for every keystroke.
    pendingBookmarkQuery = null;
    if (bookmarkComposing) return;
    bookmarkFilterTimer = setTimeout(() => {
      pendingBookmarkQuery = bookmarkInput.value.trim().toLowerCase();
      flushBookmarkFilter();
    }, 350);
  }
  bookmarkInput.addEventListener('input', scheduleBookmarkFilter);
  bookmarkInput.addEventListener('compositionstart', () => { bookmarkComposing = true; clearTimeout(bookmarkFilterTimer); pendingBookmarkQuery = null; });
  bookmarkInput.addEventListener('compositionend', () => { bookmarkComposing = false; scheduleBookmarkFilter(); });
  bookmarkInput.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing || bookmarkComposing) return;
    clearTimeout(bookmarkFilterTimer);
    pendingBookmarkQuery = bookmarkInput.value.trim().toLowerCase();
    flushBookmarkFilter();
  });

  quick.forEach((item, index) => {
    const link = document.createElement('a'); link.className = 'shortcut';
    link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.style.setProperty('--delay', `${index * 25}ms`);
    link.style.setProperty('--icon-glow', `${item.color}24`);
    const icon = document.createElement('span'); icon.className = 'shortcut-icon';
    const image = document.createElement('img'); image.src = item.icon; image.alt = ''; image.width = 39; image.height = 39;
    const name = document.createElement('span'); name.className = 'shortcut-name'; name.textContent = item.name;
    icon.append(image); link.append(icon, name); $('#quick-grid').append(link);
  });
  function fitShortcutIcons(grid) {
    if (!grid.clientHeight) return;
    const style = getComputedStyle(grid);
    const columns = style.gridTemplateColumns.split(' ').length;
    const rows = Math.ceil(grid.children.length / columns);
    const gap = parseFloat(style.rowGap) || 0;
    const cellHeight = (grid.clientHeight - gap * (rows - 1)) / rows;
    const shortcut = grid.firstElementChild;
    if (!shortcut) return;
    const itemStyle = getComputedStyle(shortcut);
    const labelHeight = parseFloat(getComputedStyle(shortcut.querySelector('.shortcut-name')).lineHeight);
    const padding = parseFloat(itemStyle.paddingTop) + parseFloat(itemStyle.paddingBottom);
    const size = Math.max(18, Math.min(60, Math.floor(cellHeight - labelHeight - padding - parseFloat(itemStyle.rowGap))));
    grid.style.setProperty('--glass-size', `${size}px`);
  }
  const iconObserver = new ResizeObserver(entries => entries.forEach(({ target }) => fitShortcutIcons(target)));
  iconObserver.observe($('#quick-grid'));
  iconObserver.observe($('#engine-grid'));

  // Restore the original Baidu suggestion source for every search provider.
  // Local bookmark matches remain available when that source cannot be reached.
  const searchInput = $('#search-input');
  const suggestionList = $('#search-suggestions');
  const suggestionCache = new Map();
  let suggestions = [];
  let activeSuggestion = -1;
  let suggestionTimer;
  let suggestionRevision = 0;
  let suggestionRequest;
  let composing = false;
  let suggestionsDismissed = false;
  function closeSuggestions() {
    suggestionList.hidden = true;
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.removeAttribute('aria-activedescendant');
    activeSuggestion = -1;
  }
  function cancelSuggestionRequest() {
    if (suggestionRequest) { suggestionRequest(); suggestionRequest = null; }
  }
  function chooseSuggestion(index) {
    if (!suggestions[index]) return;
    searchInput.value = suggestions[index];
    closeSuggestions();
    $('#search-form').requestSubmit();
  }
  function renderSuggestions(values, query, revision) {
    if (revision !== suggestionRevision || searchInput.value.trim() !== query || document.activeElement !== searchInput || suggestionsDismissed) return;
    suggestions = [...new Set(values.filter(value => typeof value === 'string' && value.trim()).map(value => value.slice(0, 150)))].slice(0, 8);
    activeSuggestion = -1;
    searchInput.removeAttribute('aria-activedescendant');
    suggestionList.replaceChildren(...suggestions.map((text, index) => {
      const option = document.createElement('li');
      option.id = `suggestion-${index}`; option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false');
      const number = document.createElement('span'); number.className = 'suggestion-number'; number.textContent = index + 1; number.setAttribute('aria-hidden', 'true');
      const content = document.createElement('span'); content.className = 'suggestion-text'; content.textContent = text;
      const arrow = document.createElement('span'); arrow.className = 'suggestion-arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
      option.append(number, content, arrow);
      option.addEventListener('pointerdown', event => event.preventDefault());
      option.addEventListener('click', () => chooseSuggestion(index));
      return option;
    }));
    suggestionList.hidden = suggestions.length === 0;
    searchInput.setAttribute('aria-expanded', String(suggestions.length > 0));
  }
  function scheduleSuggestions() {
    clearTimeout(suggestionTimer);
    cancelSuggestionRequest();
    const revision = ++suggestionRevision;
    suggestions = [];
    const query = searchInput.value.trim();
    closeSuggestions();
    if (!query || composing) return;
    suggestionsDismissed = false;
    const local = [...quick, ...groups.flatMap(group => group.links)].filter(item => `${item.name} ${item.description || ''}`.toLowerCase().includes(query.toLowerCase())).map(item => item.name);
    renderSuggestions(local, query, revision);
    if (suggestionCache.has(query)) { renderSuggestions(suggestionCache.get(query), query, revision); return; }
    suggestionTimer = setTimeout(() => {
      if (revision !== suggestionRevision) return;
      const callback = `orbitSuggest${Date.now()}_${revision}`;
      const script = document.createElement('script');
      let timeout;
      let done = false;
      const clean = () => {
        if (done) return;
        done = true; clearTimeout(timeout); script.remove();
        // Keep a short-lived no-op so a late JSONP response is harmless.
        window[callback] = () => {};
        setTimeout(() => { delete window[callback]; }, 10000);
      };
      window[callback] = result => {
        const values = Array.isArray(result?.s) ? result.s : [];
        if (revision === suggestionRevision) {
          if (suggestionCache.size >= 40) suggestionCache.delete(suggestionCache.keys().next().value);
          if (values.length) suggestionCache.set(query, values);
          renderSuggestions(values.length ? values : local, query, revision);
        }
        clean();
      };
      script.src = `https://www.baidu.com/su?wd=${encodeURIComponent(query.slice(0, 100))}&cb=${callback}`;
      script.referrerPolicy = 'no-referrer'; script.async = true; script.onerror = clean;
      timeout = setTimeout(clean, 3500);
      suggestionRequest = clean;
      document.head.append(script);
    }, 240);
  }
  searchInput.addEventListener('input', scheduleSuggestions);
  searchInput.addEventListener('compositionstart', () => { composing = true; clearTimeout(suggestionTimer); cancelSuggestionRequest(); ++suggestionRevision; closeSuggestions(); });
  searchInput.addEventListener('compositionend', () => { composing = false; scheduleSuggestions(); });
  searchInput.addEventListener('focus', scheduleSuggestions);
  searchInput.addEventListener('blur', () => { suggestionsDismissed = true; closeSuggestions(); });
  searchInput.addEventListener('keydown', event => {
    if (event.isComposing || composing) return;
    if (event.key === 'Escape' && !suggestionList.hidden) {
      event.preventDefault(); event.stopPropagation(); suggestionsDismissed = true; closeSuggestions(); return;
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length) {
      event.preventDefault(); suggestionsDismissed = false; suggestionList.hidden = false;
      activeSuggestion = activeSuggestion < 0 ? (event.key === 'ArrowDown' ? 0 : suggestions.length - 1) : (activeSuggestion + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length;
      [...suggestionList.children].forEach((option, index) => option.setAttribute('aria-selected', String(index === activeSuggestion)));
      searchInput.setAttribute('aria-expanded', 'true');
      searchInput.setAttribute('aria-activedescendant', `suggestion-${activeSuggestion}`);
      suggestionList.children[activeSuggestion].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && !suggestionList.hidden && activeSuggestion >= 0) {
      event.preventDefault(); chooseSuggestion(activeSuggestion);
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('#search-form')) { suggestionsDismissed = true; closeSuggestions(); }
  });

  const engineNames = { bing: 'Bing', google: 'Google', baidu: '百度', yahoo: 'Yahoo', magi: 'Magi', sougou: '搜狗', wechat: '微信', quark: '夸克', taobao: '淘宝', jingdong: '京东', bilibili: '哔哩哔哩', github: 'GitHub', toutiao: '头条', weibo: '微博', zhihu: '知乎', kuaidi: '快递' };
  let selectedEngine = engines.find(engine => engine.name === storage.get('engine')) || engines[0];
  let enginesVisible = false;
  function showEngines(show) {
    enginesVisible = show;
    $('#folder').hidden = show; $('#engine-panel').hidden = !show;
    $('#panel-label').textContent = show ? '搜索引擎' : '书签';
    $('#panel-toggle').setAttribute('aria-expanded', String(show));
    $('#engine-logo').setAttribute('aria-expanded', String(show));
  }
  function setEngine(engine) {
    selectedEngine = engine;
    const name = engineNames[engine.name] || engine.name;
    $('#search-form').action = engine.url; $('#search-input').name = engine.param;
    $('#search-input').placeholder = engine.placeholder || `${name}搜索…`;
    const image = $('#engine-image');
    image.src = engine.icon.replace('-xs.png', '.png'); image.alt = name;
    image.classList.remove('logo-change'); void image.offsetWidth; image.classList.add('logo-change');
    $('#engine-logo').setAttribute('aria-label', `当前搜索引擎 ${name}，点击切换`);
    document.querySelectorAll('.engine-option').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.engine === engine.name)));
    storage.set('engine', engine.name);
  }
  engines.forEach((engine, index) => {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'shortcut engine-option'; button.dataset.engine = engine.name;
    button.style.setProperty('--delay', `${index * 25}ms`);
    button.style.setProperty('--icon-glow', `${engine.color.startsWith('#') ? engine.color : '#8ee8e2'}24`);
    const icon = document.createElement('span'); icon.className = 'shortcut-icon';
    const image = document.createElement('img'); image.src = engine.icon; image.alt = ''; image.width = 39; image.height = 39;
    const name = document.createElement('span'); name.className = 'shortcut-name'; name.textContent = engineNames[engine.name] || engine.name;
    icon.append(image); button.append(icon, name);
    button.addEventListener('click', () => { setEngine(engine); showEngines(false); $('#search-input').focus(); });
    $('#engine-grid').append(button);
  });
  $('#panel-toggle').addEventListener('click', () => showEngines(!enginesVisible));
  $('#engine-logo').addEventListener('click', () => showEngines(!enginesVisible));
  setEngine(selectedEngine);
  $('#search-form').addEventListener('submit', event => {
    event.preventDefault();
    const query = $('#search-input').value.trim();
    if (!query) { $('#search-input').focus(); return; }
    const url = new URL(selectedEngine.url); url.searchParams.set(selectedEngine.param, query); location.assign(url.href);
  });

  const overlay = $('#navigation-overlay');
  const workspace = $('#sidebar-workspace');
  const compactWorkspace = matchMedia('(max-width: 760px)');
  let previousFocus;
  function syncWorkspace() {
    const open = document.body.classList.contains('sidebar-open');
    const tools = document.body.classList.contains('workspace-mobile-open');
    overlay.inert = !open;
    $('#sidebar').inert = !open || (compactWorkspace.matches && tools);
    workspace.inert = !open || (compactWorkspace.matches && !tools);
    $('#main').inert = open;
  }
  function setWorkspaceMobile(show) {
    document.body.classList.toggle('workspace-mobile-open', show);
    syncWorkspace();
    window.dispatchEvent(new Event('orbit:workspace'));
    (show ? $('#desk-back') : $('#desk-toggle')).focus({ preventScroll: true });
  }
  function setSidebar(open) {
    if (open && !document.body.classList.contains('sidebar-open')) previousFocus = document.activeElement;
    document.body.classList.toggle('sidebar-open', open);
    if (!open) document.body.classList.remove('workspace-mobile-open');
    $('#open-sidebar').setAttribute('aria-expanded', String(open));
    syncWorkspace();
    window.dispatchEvent(new Event('orbit:workspace'));
    if (open) $('#close-sidebar').focus({ preventScroll: true });
    else previousFocus?.focus({ preventScroll: true });
  }
  $('#open-sidebar').addEventListener('click', () => setSidebar(true));
  $('#close-sidebar').addEventListener('click', () => setSidebar(false));
  $('#sidebar-backdrop').addEventListener('click', () => setSidebar(false));
  $('#desk-home').addEventListener('click', () => setSidebar(false));
  $('#desk-toggle').addEventListener('click', () => setWorkspaceMobile(true));
  $('#desk-back').addEventListener('click', () => setWorkspaceMobile(false));
  $('#desk-motion').addEventListener('click', () => { motionReduced = !motionReduced; storage.set('motion', motionReduced ? 'reduced' : 'full'); updateMotion(); });
  $('#sidebar').addEventListener('click', event => { if (event.target.closest('a') && !event.target.closest('[aria-disabled=true]')) setSidebar(false); });
  compactWorkspace.addEventListener('change', () => {
    syncWorkspace();
    if (document.body.classList.contains('sidebar-open') && document.activeElement.closest('[inert]')) $('#close-sidebar').focus({ preventScroll: true });
  });
  syncWorkspace();
  const note = $('#desk-note');
  note.value = storage.get('note') || '';
  function updateNoteCount() { $('#note-count').textContent = `${note.value.length} / 6000`; }
  updateNoteCount();
  if (note.value) $('#note-status').textContent = '已保存';
  let noteTimer;
  function saveNote() {
    clearTimeout(noteTimer);
    $('#note-status').textContent = storage.set('note', note.value) ? '已保存' : '当前会话';
  }
  note.addEventListener('input', () => {
    updateNoteCount(); $('#note-status').textContent = '保存中…';
    clearTimeout(noteTimer); noteTimer = setTimeout(saveNote, 250);
  });
  note.addEventListener('blur', saveNote);
  window.addEventListener('pagehide', saveNote);

  document.addEventListener('keydown', event => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    const open = document.body.classList.contains('sidebar-open');
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (open) setSidebar(false);
      $('#search-input').focus();
    } else if (event.key === '/' && !typing) {
      event.preventDefault(); if (!open) setSidebar(true);
      if (compactWorkspace.matches) setWorkspaceMobile(false); $('#bookmark-filter').focus();
    } else if (event.key === 'Escape') {
      if (open && compactWorkspace.matches && document.body.classList.contains('workspace-mobile-open')) setWorkspaceMobile(false);
      else if (open) setSidebar(false);
      else if (enginesVisible) { showEngines(false); $('#panel-toggle').focus(); }
      else document.activeElement.blur();
    } else if (event.key === 'Tab' && open) {
      const focusable = [...overlay.querySelectorAll('a[href], button, input, textarea, [role=scrollbar]')].filter(element => element.getClientRects().length && getComputedStyle(element).visibility === 'visible' && !element.closest('[hidden], [inert]'));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener('pointermove', event => {
    if (motionReduced || event.pointerType === 'touch') return;
    const shortcut = event.target.closest('.shortcut');
    if (!shortcut) return;
    const rect = shortcut.getBoundingClientRect();
    shortcut.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
    shortcut.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
    const x = Math.max(-.5, Math.min(.5, (event.clientX - rect.left) / rect.width - .5));
    const y = Math.max(-.5, Math.min(.5, (event.clientY - rect.top) / rect.height - .5));
    const icon = shortcut.querySelector('.shortcut-icon');
    icon.style.setProperty('--glass-rx', `${-y * 19}deg`);
    icon.style.setProperty('--glass-ry', `${x * 19}deg`);
    icon.style.setProperty('--glass-x', `${(x + .5) * 100}%`);
    icon.style.setProperty('--glass-y', `${(y + .5) * 100}%`);
    icon.style.setProperty('--shine-x', `${x * 12}px`);
    icon.style.setProperty('--shine-y', `${y * 12}px`);
    icon.style.setProperty('--image-x', `${x * 2.5}px`);
    icon.style.setProperty('--image-y', `${y * 2.5}px`);
  }, { passive: true });
  const shortcuts = [...document.querySelectorAll('.shortcut')];
  let pressedShortcut;
  function releaseGlass() {
    pressedShortcut?.classList.remove('is-pressed');
    pressedShortcut = null;
  }
  function resetGlass(shortcut) {
    shortcut.classList.remove('is-pressed');
    const icon = shortcut.querySelector('.shortcut-icon');
    ['--glass-rx', '--glass-ry', '--glass-x', '--glass-y', '--shine-x', '--shine-y', '--image-x', '--image-y'].forEach(property => icon.style.removeProperty(property));
  }
  shortcuts.forEach(shortcut => {
    shortcut.addEventListener('pointerleave', () => resetGlass(shortcut));
    shortcut.addEventListener('blur', () => resetGlass(shortcut));
    shortcut.addEventListener('pointerdown', event => {
      if (motionReduced || event.button !== 0) return;
      releaseGlass(); pressedShortcut = shortcut; shortcut.classList.add('is-pressed');
    });
    shortcut.addEventListener('keydown', event => {
      if (!motionReduced && !event.repeat && ['Enter', ' '].includes(event.key)) {
        releaseGlass(); pressedShortcut = shortcut; shortcut.classList.add('is-pressed');
      }
    });
  });
  document.addEventListener('pointerup', releaseGlass);
  document.addEventListener('pointercancel', releaseGlass);
  document.addEventListener('keyup', event => { if (['Enter', ' '].includes(event.key)) releaseGlass(); });
  window.addEventListener('blur', releaseGlass);
  window.addEventListener('orbit:motionchange', () => { releaseGlass(); shortcuts.forEach(resetGlass); });

  // A softly following halo, sparse star trail and click waves. Everything is
  // pointer-transparent and removed on completion; no perpetual render loop.
  const pointerEffects = $('#pointer-effects');
  const pointerAura = $('#pointer-aura');
  const pointerRing = $('#pointer-ring');
  const particleLayer = $('#pointer-particles');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let pointerFrame = 0;
  let pointerKnown = false;
  let targetX = 0, targetY = 0, followX = 0, followY = 0;
  let lastSparkTime = 0, lastSparkX = 0, lastSparkY = 0, sparkSequence = 0;
  function clearPointerEffects() {
    cancelAnimationFrame(pointerFrame); pointerFrame = 0; pointerKnown = false;
    pointerEffects.classList.remove('is-active', 'is-hovering');
    particleLayer.replaceChildren();
  }
  function pointerEnabled() { return !motionReduced && finePointer.matches && !document.hidden && !document.body.classList.contains('sidebar-open'); }
  function followPointer() {
    pointerFrame = 0;
    if (!pointerEnabled()) { clearPointerEffects(); return; }
    followX += (targetX - followX) * .22;
    followY += (targetY - followY) * .22;
    pointerAura.style.transform = `translate3d(${followX}px,${followY}px,0)`;
    pointerRing.style.transform = `translate3d(${followX}px,${followY}px,0)`;
    if (Math.abs(targetX - followX) + Math.abs(targetY - followY) > .3) pointerFrame = requestAnimationFrame(followPointer);
  }
  function particle(className, x, y, driftX = 0, driftY = 0) {
    if (particleLayer.childElementCount >= 60) return;
    const node = document.createElement('span'); node.className = className;
    node.style.left = `${x}px`; node.style.top = `${y}px`;
    node.style.setProperty('--drift-x', `${driftX}px`); node.style.setProperty('--drift-y', `${driftY}px`);
    node.style.setProperty('--spark-color', sparkSequence++ % 3 === 0 ? '#c3b7ff' : '#a1e5ed');
    node.style.setProperty('--life', `${650 + Math.random() * 350}ms`);
    node.addEventListener('animationend', () => node.remove(), { once: true });
    particleLayer.append(node);
  }
  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || !pointerEnabled()) return;
    targetX = event.clientX; targetY = event.clientY;
    if (!pointerKnown) { followX = targetX; followY = targetY; lastSparkX = targetX; lastSparkY = targetY; pointerKnown = true; }
    pointerEffects.classList.add('is-active');
    const overControl = !!event.target.closest('a,button,input');
    pointerEffects.classList.toggle('is-hovering', overControl);
    if (!pointerFrame) pointerFrame = requestAnimationFrame(followPointer);
    const now = performance.now();
    if (now - lastSparkTime > 30 && Math.hypot(targetX - lastSparkX, targetY - lastSparkY) > 9 && !event.target.closest('input,.search-suggestions')) {
      particle(`pointer-spark${sparkSequence % 5 === 0 ? ' star' : ''}`, targetX, targetY, (Math.random() - .5) * 28, 12 + Math.random() * 25);
      lastSparkTime = now; lastSparkX = targetX; lastSparkY = targetY;
    }
  }, { passive: true });
  document.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !pointerEnabled() || event.target.closest('input,.search-suggestions')) return;
    particle('pointer-ripple', event.clientX, event.clientY);
    particle('pointer-ripple echo', event.clientX, event.clientY);
    for (let index = 0; index < 8; index++) {
      const angle = index * Math.PI / 4;
      particle('pointer-spark star', event.clientX, event.clientY, Math.cos(angle) * 45, Math.sin(angle) * 45);
    }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', clearPointerEffects);
  document.addEventListener('visibilitychange', clearPointerEffects);
  window.addEventListener('blur', clearPointerEffects);
  window.addEventListener('orbit:motionchange', clearPointerEffects);
  finePointer.addEventListener('change', clearPointerEffects);
})();
