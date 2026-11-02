/* Small expression parser shared by the scientific calculator and plotter.
 * Expressions become an AST; user input is never passed to eval/Function. */
(() => {
  'use strict';
  const functions = new Set(['sin','cos','tan','asin','acos','atan','sqrt','abs','ln','log','exp','floor','ceil','round','min','max','pow']);
  function compile(expression, options = {}) {
    const source = expression.replace(/π/g,'pi').replace(/×/g,'*').replace(/[÷]/g,'/').replace(/[−–]/g,'-').replace(/²/g,'^2').replace(/³/g,'^3');
    if (!source.trim()) throw new Error('请输入表达式');
    if (source.length > 500) throw new Error('表达式过长');
    const tokens = []; let cursor = 0;
    while (cursor < source.length) {
      if (/\s/.test(source[cursor])) { cursor++; continue; }
      const rest = source.slice(cursor);
      const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
      if (number) { tokens.push({ type:'number', value:Number(number[0]) }); cursor += number[0].length; continue; }
      const name = rest.match(/^[A-Za-z]+/);
      if (name) { tokens.push({ type:'name', value:name[0].toLowerCase() }); cursor += name[0].length; continue; }
      if ('+-*/^!%(),'.includes(source[cursor])) { tokens.push({ type:source[cursor], value:source[cursor] }); cursor++; continue; }
      throw new Error(`不支持的字符：${source[cursor]}`);
    }
    // Adjacent values imply multiplication: 2pi, 2x, 2sin(x), (x+1)(x-1).
    const expanded = [];
    tokens.forEach((token, index) => {
      const previous = tokens[index - 1];
      const endsValue = previous && (previous.type === 'number' || [')','!','%'].includes(previous.type) || (previous.type === 'name' && !functions.has(previous.value)));
      const startsValue = ['number','name','('].includes(token.type);
      if (endsValue && startsValue) expanded.push({type:'*'});
      expanded.push(token);
    });
    expanded.push({type:'end'}); let position = 0;
    const peek = () => expanded[position];
    const take = type => { if (peek().type !== type) throw new Error(type === ')' ? '缺少右括号' : '表达式不完整'); return expanded[position++]; };
    function atom() {
      const token = peek();
      if (token.type === 'number') { position++; return { kind:'number', value:token.value }; }
      if (token.type === '(') { position++; const node = sum(); take(')'); return node; }
      if (token.type === 'name') {
        position++;
        if (functions.has(token.value)) {
          take('('); const args = [sum()];
          while (peek().type === ',') { position++; args.push(sum()); }
          take(')');
          const valid = ['min','max'].includes(token.value) ? args.length >= 1 : token.value === 'pow' ? args.length === 2 : args.length === 1;
          if (!valid) throw new Error(`${token.value} 参数数量不正确`);
          return { kind:'call', name:token.value, args };
        }
        if (['pi','e','ans'].includes(token.value)) return { kind:'constant', name:token.value };
        if (token.value === 'x' && options.allowX) return { kind:'x' };
        if (token.value === 'y' && options.allowY) return { kind:'y' };
        throw new Error(`未知名称：${token.value}`);
      }
      throw new Error('请检查数字、运算符和括号');
    }
    function postfix() { let node = atom(); while (['!','%'].includes(peek().type)) node = {kind:'postfix', op:expanded[position++].type, value:node}; return node; }
    function power() { const node = postfix(); if (peek().type === '^') { position++; return {kind:'binary',op:'^',left:node,right:unary()}; } return node; }
    function unary() { if (['+','-'].includes(peek().type)) return {kind:'unary',op:expanded[position++].type,value:unary()}; return power(); }
    function product() { let node = unary(); while (['*','/'].includes(peek().type)) node = {kind:'binary',op:expanded[position++].type,left:node,right:unary()}; return node; }
    function sum() { let node = product(); while (['+','-'].includes(peek().type)) node = {kind:'binary',op:expanded[position++].type,left:node,right:product()}; return node; }
    const ast = sum(); if (peek().type !== 'end') throw new Error('请检查多余的括号或逗号');
    function evaluate(node, x, y) {
      switch (node.kind) {
        case 'number': return node.value;
        case 'x': return x;
        case 'y': return y;
        case 'constant': return node.name === 'pi' ? Math.PI : node.name === 'e' ? Math.E : Number(options.ans || 0);
        case 'unary': return (node.op === '-' ? -1 : 1) * evaluate(node.value,x,y);
        case 'postfix': {
          const value = evaluate(node.value,x,y);
          if (node.op === '%') return value / 100;
          if (!Number.isInteger(value) || value < 0 || value > 170) return NaN;
          let result = 1; for (let i=2;i<=value;i++) result *= i; return result;
        }
        case 'binary': {
          const a=evaluate(node.left,x,y),b=evaluate(node.right,x,y);
          return node.op==='+'?a+b:node.op==='-'?a-b:node.op==='*'?a*b:node.op==='/'?a/b:Math.pow(a,b);
        }
        case 'call': {
          const args=node.args.map(arg=>evaluate(arg,x,y));
          const degrees=options.degrees;
          const name=node.name;
          if (['sin','cos','tan'].includes(name)) return Math[name](degrees?args[0]*Math.PI/180:args[0]);
          if (['asin','acos','atan'].includes(name)) return Math[name](args[0])*(degrees?180/Math.PI:1);
          if (name==='ln') return Math.log(args[0]);
          if (name==='log') return Math.log10(args[0]);
          return Math[name](...args);
        }
      }
    }
    return (x,y) => evaluate(ast,x,y);
  }
  function relation(expression) {
    const parts=expression.replace(/＝/g,'=').split('=');
    if(parts.length===1)return {implicit:false,evaluate:compile(parts[0],{allowX:true})};
    if(parts.length!==2||parts.some(part=>!part.trim()))throw new Error('请输入一个完整的方程');
    if(parts[0].trim().toLowerCase()==='y'&&!/\by\b/i.test(parts[1]))return {implicit:false,evaluate:compile(parts[1],{allowX:true})};
    const left=compile(parts[0],{allowX:true,allowY:true}),right=compile(parts[1],{allowX:true,allowY:true});
    return {implicit:true,evaluate:(x,y)=>left(x,y)-right(x,y)};
  }
  window.OrbitMath = Object.freeze({compile,relation});
})();
