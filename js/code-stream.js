/* Decorative, prewritten code streams. No model or external API is called. */
(() => {
  'use strict';
  const snippets = [
    { file: 'retrieval.py', language: 'Python', source: `from math import sqrt

def cosine_similarity(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sqrt(sum(x * x for x in a))
    norm_b = sqrt(sum(y * y for y in b))
    return dot / max(norm_a * norm_b, 1e-9)

def retrieve(query_vector, documents, k=5):
    ranked = sorted(
        documents,
        key=lambda doc: cosine_similarity(
            query_vector, doc["embedding"]
        ),
        reverse=True,
    )
    return ranked[:k]

context = retrieve(query_embedding, library)
passages = [item["text"] for item in context]` },
    { file: 'stream.js', language: 'JavaScript', source: `async function* readLines(body) {
  const reader = body
    .pipeThrough(new TextDecoderStream())
    .getReader();
  let pending = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += value;
      const lines = pending.split("\\n");
      pending = lines.pop();
      for (const line of lines) {
        if (line.trim()) yield line;
      }
    }
    if (pending.trim()) yield pending;
  } finally {
    reader.releaseLock();
  }
}` },
    { file: 'attention.py', language: 'Python', source: `from math import exp, sqrt

def softmax(values):
    peak = max(values)
    weights = [exp(x - peak) for x in values]
    total = sum(weights)
    return [weight / total for weight in weights]

def attend(query, keys, values):
    scale = sqrt(len(query))
    scores = [
        sum(q * k for q, k in zip(query, key))
        / scale
        for key in keys
    ]
    weights = softmax(scores)
    return [
        sum(w * row[i] for w, row in zip(
            weights, values
        ))
        for i in range(len(values[0]))
    ]` },
    { file: 'context-window.js', language: 'JavaScript', source: `function fitContext(messages, limit, count) {
  const system = messages.filter(
    message => message.role === "system"
  );
  let budget = limit - system.reduce(
    (sum, message) => sum + count(message), 0
  );
  const recent = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === "system") continue;
    const cost = count(message);
    if (cost > budget) break;
    budget -= cost;
    recent.unshift(message);
  }
  return [...system, ...recent];
}

const context = fitContext(history, 8192, tokens);
const remaining = 8192 - tokens(context);` },
    { file: 'binary-search.py', language: 'Python', source: `def lower_bound(values, target):
    left, right = 0, len(values)
    while left < right:
        middle = (left + right) // 2
        if values[middle] < target:
            left = middle + 1
        else:
            right = middle
    return left

def find_range(values, low, high):
    start = lower_bound(values, low)
    result = []
    while start < len(values):
        value = values[start]
        if value > high:
            break
        result.append(value)
        start += 1
    return result

matches = find_range([1, 3, 5, 8, 13], 3, 8)` },
    { file: 'async-pool.js', language: 'JavaScript', source: `async function mapLimit(items, limit, task) {
  if (limit < 1) throw new RangeError("limit");
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(
        items[index], index
      );
    }
  }
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

const results = await mapLimit(jobs, 3, runJob);` },
    { file: 'top-k.py', language: 'Python', source: `from heapq import heappush, heapreplace

def top_k(items, k, score):
    if k <= 0:
        return []
    heap = []
    for index, item in enumerate(items):
        candidate = (score(item), index, item)
        if len(heap) < k:
            heappush(heap, candidate)
        elif candidate[:2] > heap[0][:2]:
            heapreplace(heap, candidate)
    return [
        item for _, _, item in sorted(
            heap, reverse=True
        )
    ]

best = top_k(candidates, 5, score=relevance)
for rank, document in enumerate(best, 1):
    print(rank, document["title"])` },
    { file: 'lru-cache.js', language: 'JavaScript', source: `class LRUCache {
  constructor(capacity = 64) {
    this.capacity = Math.max(1, capacity);
    this.entries = new Map();
  }
  get(key) {
    if (!this.entries.has(key)) return;
    const value = this.entries.get(key);
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }
  set(key, value) {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next();
      this.entries.delete(oldest.value);
    }
  }
}` }
  ];
  const root = document.querySelector('#code-streams');
  const keyword = /^(?:async|await|function|return|const|let|if|else|for|of|in|new|try|finally|catch|throw|def|import|from|yield|None|False|True|class|as|with|while|lambda|break|continue|this)$/;
  function tokenize(source) {
    const pattern = /#[^\n]*|\/\/[^\n]*|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\b(?:async|await|function|return|const|let|if|else|for|of|in|new|try|finally|catch|throw|def|import|from|yield|None|False|True|class|as|with|while|lambda|break|continue|this)\b|\b\d+(?:\.\d+)?(?:e-?\d+)?\b|\b[A-Za-z_]\w*(?=\()/g;
    const tokens = []; let end = 0;
    for (const match of source.matchAll(pattern)) {
      if (match.index > end) tokens.push({ text: source.slice(end, match.index), start: end, type: '' });
      const text = match[0];
      const type = text.startsWith('#') || text.startsWith('//') ? 'comment' : /^["']/.test(text) ? 'string' : keyword.test(text) ? 'keyword' : /^\d/.test(text) ? 'number' : 'function';
      tokens.push({ text, start: match.index, type }); end = match.index + text.length;
    }
    if (end < source.length) tokens.push({ text: source.slice(end), start: end, type: '' });
    return tokens;
  }
  const streams = Array.from({ length: 1 }, (_, index) => {
    const card = document.createElement('div'); card.className = `code-stream stream-${index + 1}`;
    const header = document.createElement('div'); header.className = 'stream-header';
    const mark = document.createElement('span'); mark.className = 'stream-mark'; mark.textContent = '✦';
    const file = document.createElement('span'); file.className = 'stream-file';
    const language = document.createElement('span'); language.className = 'stream-language';
    header.append(mark, file, language);
    const pre = document.createElement('pre'); pre.className = 'stream-pre';
    const code = document.createElement('code'); pre.append(code);
    const footer = document.createElement('div'); footer.className = 'stream-footer';
    const status = document.createElement('span'); status.className = 'stream-status';
    const count = document.createElement('span'); count.className = 'stream-count';
    footer.append(status, count); card.append(header, pre, footer); root.append(card);
    return { card, file, language, pre, code, status, count, index, snippet: index, visible: 0, token: 0, next: 0, tokens: [], holdUntil: 0 };
  });
  function load(stream, index, now) {
    stream.snippet = index % snippets.length;
    const snippet = snippets[stream.snippet];
    stream.file.textContent = snippet.file; stream.language.textContent = snippet.language;
    stream.code.replaceChildren(); stream.tokens = tokenize(snippet.source);
    stream.tokens.forEach(token => {
      token.node = token.type ? document.createElement('span') : document.createTextNode('');
      if (token.type) token.node.className = `syntax-${token.type}`;
      stream.code.append(token.node);
    });
    const cursor = document.createElement('span'); cursor.className = 'stream-caret'; cursor.textContent = '▋'; stream.code.append(cursor);
    stream.visible = 0; stream.token = 0; stream.holdUntil = 0; stream.next = now + stream.index * 170;
    stream.status.textContent = '输出中'; stream.card.dataset.state = 'streaming'; stream.pre.scrollTop = 0;
    stream.count.textContent = `0 / ${snippet.source.length}`;
  }
  function showCharacters(stream, count) {
    const source = snippets[stream.snippet].source;
    const target = Math.min(source.length, count);
    while (stream.token < stream.tokens.length) {
      const token = stream.tokens[stream.token];
      if (target <= token.start) break;
      token.node.textContent = token.text.slice(0, target - token.start);
      if (target < token.start + token.text.length) break;
      stream.token++;
    }
    const scrollNeeded=source.slice(stream.visible,target).includes('\n')||target===source.length;
    stream.visible = target;
    stream.count.textContent = `${target} / ${source.length}`;
    // Follow newly emitted lines inside the decorative card, never the page.
    if(scrollNeeded)stream.pre.scrollTop = stream.pre.scrollHeight;
  }
  let timer=0;
  const systemMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const motionOff=()=>document.body.classList.contains('motion-reduced')||systemMotion.matches;
  function paused(){return document.hidden||motionOff()||document.body.classList.contains('effects-paused')||document.body.classList.contains('sidebar-open');}
  function tick(now){
    timer=0;if(paused())return;
    let nextWake=Infinity;
    streams.forEach(stream=>{
      if(!stream.card.getClientRects().length)return;
      const source=snippets[stream.snippet].source;
      if(stream.visible>=source.length){
        if(!stream.holdUntil){stream.holdUntil=now+4200;stream.status.textContent='输出完成';stream.card.dataset.state='complete';}
        if(now>=stream.holdUntil){load(stream,(stream.snippet+1+Math.floor(Math.random()*(snippets.length-1)))%snippets.length,now);nextWake=Math.min(nextWake,stream.next);}
        else nextWake=Math.min(nextWake,stream.holdUntil);
        return;
      }
      if(now>=stream.next){
        let target=stream.visible,emitted=0;
        while(now>=stream.next&&target<source.length&&emitted++<3){
          const character=source[target++];
          stream.next+=character==='\n'?75:/[;:}]/.test(character)?35:9;
        }
        // One DOM batch per tick, rather than a layout read for every character.
        if(target!==stream.visible)showCharacters(stream,target);
        if(stream.next<now-80)stream.next=now+9;
      }
      nextWake=Math.min(nextWake,stream.next);
    });
    // No frame polling while holding finished code. Typing wakes at most ~30 Hz.
    if(Number.isFinite(nextWake))timer=setTimeout(()=>tick(performance.now()),Math.max(32,nextWake-performance.now()));
  }
  function sync(){
    clearTimeout(timer);timer=0;
    const now=performance.now();
    streams.forEach(stream=>{
      if(paused()){
        if(motionOff()&&!stream.visible)showCharacters(stream,snippets[stream.snippet].source.length);
        stream.status.textContent='已暂停';stream.card.dataset.state='paused';
      }else{
        stream.next=now+30;stream.holdUntil=0;
        stream.status.textContent=stream.visible<snippets[stream.snippet].source.length?'输出中':'输出完成';
        stream.card.dataset.state=stream.visible<snippets[stream.snippet].source.length?'streaming':'complete';
      }
    });
    if(!paused())timer=setTimeout(()=>tick(performance.now()),32);
  }
  streams.forEach(stream=>load(stream,Math.floor(Math.random()*snippets.length),performance.now()));
  for(const event of ['orbit:motionchange','orbit:activitychange','orbit:workspace','resize'])window.addEventListener(event,sync);
  document.addEventListener('visibilitychange',sync);
  systemMotion.addEventListener('change',sync);
  sync();
})();
