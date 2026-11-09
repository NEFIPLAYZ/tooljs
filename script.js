/* ===== pure ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

// @ts-nocheck

/* ================= PURE HELPERS (koi DOM nahi) ================= */

/* ---- JSON ---- */
function cleanJSON(raw){
  var t = String(raw == null ? '' : raw);
  var notes = [];
  if(/```/.test(t)){ t = t.replace(/```[a-zA-Z]*\n?/g, ''); notes.push('code fence hataaya'); }
  var before = t;
  t = t.replace(/^\s*[`'"\u2018\u2019\u201c\u201d]+/, '').replace(/[`'"\u2018\u2019\u201c\u201d]+\s*$/, '');
  if(t !== before){ notes.push('shuru/aakhir ke extra quote hataaye'); }
  before = t;
  t = t.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
  if(t !== before){ notes.push('curly quotes theek kiye'); }
  before = t;
  t = t.replace(/,\s*([}\]])/g, '$1');
  if(t !== before){ notes.push('extra comma hataaya'); }
  return { text: t.trim(), notes: notes };
}

function describeError(raw, err){
  var msg = (err && err.message) ? err.message : String(err);
  var m = msg.match(/position\s+(\d+)/i);
  if(!m){ return msg; }
  var pos = parseInt(m[1], 10);
  var start = Math.max(0, pos - 30), end = Math.min(raw.length, pos + 30);
  var snippet = raw.slice(start, end).replace(/\n/g, ' ');
  var caret = new Array(pos - start + 1).join(' ') + '^';
  var atEnd = pos >= raw.length;
  var near = atEnd ? 'input yahin khatam ho gaya' : ('"' + raw.charAt(pos) + '"');
  var hint = '';
  if(atEnd){
    var oc = (raw.match(/\{/g) || []).length - (raw.match(/\}/g) || []).length;
    var ob = (raw.match(/\[/g) || []).length - (raw.match(/\]/g) || []).length;
    var miss = [];
    if(oc > 0){ miss.push(oc + ' closing }'); }
    if(ob > 0){ miss.push(ob + ' closing ]'); }
    hint = miss.length ? '\n\nIshara: ' + miss.join(' aur ') + ' chhoot gaya hai.'
                       : '\n\nIshara: aakhir mein kuch kaat gaya hai.';
  }
  return msg + '\n\n' + snippet + '\n' + caret + '\n\nYahan dikkat hai: ' + near + hint;
}

function sortKeys(v){
  if(Array.isArray(v)){ return v.map(sortKeys); }
  if(v && typeof v === 'object'){
    var o = {};
    Object.keys(v).sort().forEach(function(k){ o[k] = sortKeys(v[k]); });
    return o;
  }
  return v;
}

function queryPath(obj, path){
  var p = String(path || '').trim();
  if(!p || p === '.'){ return { ok: true, value: obj }; }
  p = p.replace(/^\$\.?/, '').replace(/\[(\d+)\]/g, '.$1');
  var parts = p.split('.').filter(function(x){ return x !== ''; });
  var cur = obj;
  for(var i = 0; i < parts.length; i++){
    var k = parts[i];
    if(cur === null || cur === undefined){ return { ok: false, error: 'path toot gaya: "' + k + '" se pehle kuch nahi mila' }; }
    if(typeof cur !== 'object'){ return { ok: false, error: '"' + k + '" tak pahunchne se pehle value object nahi hai' }; }
    if(!(k in cur)){ return { ok: false, error: '"' + k + '" key nahi mili. Uplabdh: ' + Object.keys(cur).join(', ') }; }
    cur = cur[k];
  }
  return { ok: true, value: cur };
}

function diffJSON(a, b){
  var out = [];
  function show(v){
    if(typeof v === 'string'){ return JSON.stringify(v); }
    if(v === undefined){ return 'undefined'; }
    try{ return JSON.stringify(v); }catch(e){ return String(v); }
  }
  function walk(x, y, path){
    if(x === y){ return; }
    var px = path || '(root)';
    var tx = Array.isArray(x) ? 'array' : (x === null ? 'null' : typeof x);
    var ty = Array.isArray(y) ? 'array' : (y === null ? 'null' : typeof y);
    if(tx !== ty || (tx !== 'object' && tx !== 'array')){
      out.push('~ ' + px + ': ' + show(x) + ' -> ' + show(y));
      return;
    }
    if(tx === 'array'){
      var n = Math.max(x.length, y.length);
      for(var i = 0; i < n; i++){
        if(i >= x.length){ out.push('+ ' + px + '[' + i + ']: ' + show(y[i])); }
        else if(i >= y.length){ out.push('- ' + px + '[' + i + ']: ' + show(x[i])); }
        else { walk(x[i], y[i], px + '[' + i + ']'); }
      }
      return;
    }
    var keys = Object.keys(x).concat(Object.keys(y)).filter(function(k, i, arr){ return arr.indexOf(k) === i; });
    keys.forEach(function(k){
      var hx = Object.prototype.hasOwnProperty.call(x, k);
      var hy = Object.prototype.hasOwnProperty.call(y, k);
      var p = (path ? path + '.' : '') + k;
      if(hx && !hy){ out.push('- ' + p + ': ' + show(x[k])); }
      else if(!hx && hy){ out.push('+ ' + p + ': ' + show(y[k])); }
      else { walk(x[k], y[k], p); }
    });
  }
  walk(a, b, '');
  return out;
}

/* ---- CSV ---- */
function parseCSV(text){
  var rows = [], row = [], field = '', q = false;
  for(var i = 0; i < text.length; i++){
    var c = text[i];
    if(q){
      if(c === '"'){
        if(text[i+1] === '"'){ field += '"'; i++; } else { q = false; }
      } else { field += c; }
    } else {
      if(c === '"'){ q = true; }
      else if(c === ','){ row.push(field); field = ''; }
      else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
      else if(c === '\r'){ /* skip */ }
      else { field += c; }
    }
  }
  if(field.length > 0 || row.length > 0){ row.push(field); rows.push(row); }
  return rows.filter(function(r){ return r.length > 1 || (r.length === 1 && r[0] !== ''); });
}

function csvToArray(text, hasHeader){
  var rows = parseCSV(text);
  if(!rows.length){ return []; }
  if(!hasHeader){ return rows; }
  var head = rows[0];
  return rows.slice(1).map(function(r){
    var o = {};
    head.forEach(function(h, i){ o[h.trim()] = r[i] !== undefined ? r[i].trim() : ''; });
    return o;
  });
}

function arrayToCsv(data){
  if(!Array.isArray(data) || !data.length){ return ''; }
  var cols = [];
  data.forEach(function(r){
    if(r && typeof r === 'object' && !Array.isArray(r)){
      Object.keys(r).forEach(function(k){ if(cols.indexOf(k) === -1){ cols.push(k); } });
    }
  });
  function esc(v){
    var s = (v === null || v === undefined) ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  if(!cols.length){ return data.map(function(r){ return r.join(','); }).join('\n'); }
  var lines = [cols.join(',')];
  data.forEach(function(r){ lines.push(cols.map(function(c){ return esc(r[c]); }).join(',')); });
  return lines.join('\n');
}

/* ---- JSON -> TypeScript ---- */
function jsonToTS(root, rootName){
  var name = String(rootName || 'Root').replace(/[^A-Za-z0-9_$]/g, '') || 'Root';
  var out = [];
  function cap(s){ return String(s).replace(/[^a-zA-Z0-9]+(.)/g, function(_m, c){ return c.toUpperCase(); })
    .replace(/^./, function(c){ return c.toUpperCase(); }); }
  function key(k){ return /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k); }
  function typeOf(v, hint){
    if(v === null){ return 'null'; }
    if(Array.isArray(v)){
      if(!v.length){ return 'any[]'; }
      var types = [];
      v.forEach(function(x){
        var t = typeOf(x, hint + 'Item');
        if(types.indexOf(t) === -1){ types.push(t); }
      });
      return (types.length === 1 ? types[0] : '(' + types.join(' | ') + ')') + '[]';
    }
    if(typeof v === 'object'){ iface(v, hint); return hint; }
    if(typeof v === 'number'){ return 'number'; }
    if(typeof v === 'boolean'){ return 'boolean'; }
    return 'string';
  }
  function iface(obj, nm){
    var lines = Object.keys(obj).map(function(k){
      return '  ' + key(k) + ': ' + typeOf(obj[k], cap(nm) + cap(k)) + ';';
    });
    out.push('export interface ' + cap(nm) + ' {\n' + lines.join('\n') + '\n}');
  }
  if(Array.isArray(root)){ iface(root[0] || {}, name); }
  else if(root && typeof root === 'object'){ iface(root, name); }
  else { return '// Root object ya array hona chahiye'; }
  return out.join('\n\n');
}

/* ---- mock data ---- */
function mockRecords(n){
  var first = ['Asha','Ravi','Neha','Arjun','Priya','Kiran','Vikram','Meera','Rohan','Sana','Dev','Tara'];
  var last = ['Sharma','Patel','Iyer','Nair','Khan','Reddy','Gupta','Joshi','Das','Menon'];
  var city = ['Pune','Mumbai','Bengaluru','Delhi','Chennai','Hyderabad','Kolkata','Jaipur','Indore','Surat'];
  var out = [];
  for(var i = 0; i < n; i++){
    var f = first[Math.floor(Math.random() * first.length)];
    var l = last[Math.floor(Math.random() * last.length)];
    var c = city[Math.floor(Math.random() * city.length)];
    var d = new Date(2023, 0, 1 + Math.floor(Math.random() * 700));
    out.push({
      id: i + 1,
      name: f + ' ' + l,
      email: (f + '.' + l).toLowerCase() + '@example.com',
      city: c,
      amount: Math.round((Math.random() * 9000 + 100) * 100) / 100,
      active: Math.random() > 0.3,
      joined: d.toISOString().slice(0, 10)
    });
  }
  return out;
}

/* ---- text ---- */
function toTitle(t){ return String(t).toLowerCase().replace(/\b\w/g, function(c){ return c.toUpperCase(); }); }
function toSentence(t){
  var s = String(t).toLowerCase();
  return s.replace(/(^\s*\w|[.!?]\s+\w)/g, function(c){ return c.toUpperCase(); });
}
function words(t){ return String(t).trim().split(/\s+/).filter(Boolean); }
function toCamel(t){
  var w = words(t).map(function(x){ return x.replace(/[^\w]/g, '').toLowerCase(); }).filter(Boolean);
  return w.map(function(x, i){ return i ? x.charAt(0).toUpperCase() + x.slice(1) : x; }).join('');
}
function toPascal(t){ var c = toCamel(t); return c.charAt(0).toUpperCase() + c.slice(1); }
function toSnake(t){ return words(t).map(function(x){ return x.replace(/[^\w]/g, '').toLowerCase(); }).filter(Boolean).join('_'); }
function toKebab(t){ return words(t).map(function(x){ return x.replace(/[^\w]/g, '').toLowerCase(); }).filter(Boolean).join('-'); }
function toConstant(t){ return toSnake(t).toUpperCase(); }

function sortLines(t, desc){
  var a = String(t).split('\n').sort(function(x, y){ return x.localeCompare(y); });
  if(desc){ a.reverse(); }
  return a.join('\n');
}
function reverseLines(t){ return String(t).split('\n').reverse().join('\n'); }
function dedupeLines(t){
  var seen = {}, out = [];
  String(t).split('\n').forEach(function(l){ if(!seen[l]){ seen[l] = 1; out.push(l); } });
  return out.join('\n');
}
function dropEmptyLines(t){ return String(t).split('\n').filter(function(l){ return l.trim() !== ''; }).join('\n'); }
function numberLines(t){
  return String(t).split('\n').map(function(l, i){ return (i + 1) + '. ' + l; }).join('\n');
}
function shuffleLines(t){
  var a = String(t).split('\n');
  for(var i = a.length - 1; i > 0; i--){
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a.join('\n');
}
function trimLines(t){ return String(t).split('\n').map(function(l){ return l.trim(); }).join('\n'); }

function replacePlain(t, find, repl){ if(!find){ return t; } return String(t).split(find).join(repl); }

function regexRun(text, pattern, flags){
  var re;
  try{ re = new RegExp(pattern, flags || 'g'); }
  catch(e){ return { error: 'Regex galat hai: ' + e.message }; }
  var hits = [];
  var m;
  if(re.global){
    var guard = 0;
    while((m = re.exec(text)) !== null){
      hits.push({ match: m[0], index: m.index, groups: m.slice(1) });
      if(m.index === re.lastIndex){ re.lastIndex++; }
      if(++guard > 5000){ break; }
    }
  } else {
    m = re.exec(text);
    if(m){ hits.push({ match: m[0], index: m.index, groups: m.slice(1) }); }
  }
  return { hits: hits };
}

function lineDiff(a, b){
  var A = String(a).split('\n'), B = String(b).split('\n');
  if(A.length > 1500 || B.length > 1500){ return { error: 'Bahut bada hai — 1500 lines tak hi chalta hai.' }; }
  var n = A.length, m = B.length;
  var dp = [];
  for(var i = 0; i <= n; i++){ dp.push(new Array(m + 1).fill(0)); }
  for(i = n - 1; i >= 0; i--){
    for(var j = m - 1; j >= 0; j--){
      dp[i][j] = (A[i] === B[j]) ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
    }
  }
  var lines = [], add = 0, del = 0, same = 0;
  i = 0; j = 0;
  while(i < n && j < m){
    if(A[i] === B[j]){ lines.push('  ' + A[i]); same++; i++; j++; }
    else if(dp[i+1][j] >= dp[i][j+1]){ lines.push('- ' + A[i]); del++; i++; }
    else { lines.push('+ ' + B[j]); add++; j++; }
  }
  while(i < n){ lines.push('- ' + A[i]); del++; i++; }
  while(j < m){ lines.push('+ ' + B[j]); add++; j++; }
  return { lines: lines, add: add, del: del, same: same };
}

function textStats(t){
  var s = String(t);
  var ws = words(s);
  var sentences = s.split(/[.!?]+/).filter(function(x){ return x.trim() !== ''; }).length;
  var paras = s.split(/\n\s*\n/).filter(function(x){ return x.trim() !== ''; }).length;
  var readMin = ws.length / 200;
  return {
    characters: s.length,
    charsNoSpace: s.replace(/\s/g, '').length,
    words: ws.length,
    sentences: sentences,
    paragraphs: paras,
    lines: s.split('\n').length,
    readingTime: readMin < 1 ? Math.max(1, Math.round(readMin * 60)) + ' sec' : Math.round(readMin) + ' min'
  };
}

function slugify(t){
  return String(t)
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function loremText(paras, sents){
  var w = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore ' +
    'et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea ' +
    'commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur ' +
    'excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum').split(' ');
  var out = [];
  for(var p = 0; p < paras; p++){
    var s = [];
    for(var q = 0; q < sents; q++){
      var len = 8 + Math.floor(Math.random() * 8);
      var arr = [];
      for(var k = 0; k < len; k++){ arr.push(w[Math.floor(Math.random() * w.length)]); }
      var str = arr.join(' ');
      s.push(str.charAt(0).toUpperCase() + str.slice(1) + '.');
    }
    out.push(s.join(' '));
  }
  return out.join('\n\n');
}

/* ---- encode ---- */
function b64encode(s){
  var bytes = new TextEncoder().encode(String(s));
  var bin = '';
  for(var i = 0; i < bytes.length; i++){ bin += String.fromCharCode(bytes[i]); }
  return btoa(bin);
}
function b64decode(s){
  var bin = atob(String(s).replace(/\s+/g, ''));
  var bytes = new Uint8Array(bin.length);
  for(var i = 0; i < bin.length; i++){ bytes[i] = bin.charCodeAt(i); }
  return new TextDecoder().decode(bytes);
}
function b64urlDecode(s){
  var t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while(t.length % 4){ t += '='; }
  return b64decode(t);
}
function htmlEscape(s){
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function htmlUnescape(s){
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

/* ---- web ---- */
function decodeJwt(token){
  var t = String(token).trim().replace(/^Bearer\s+/i, '');
  var parts = t.split('.');
  if(parts.length < 2){ return { error: 'JWT mein kam se kam 2 parts hone chahiye (header.payload.signature)' }; }
  var res = {};
  try{ res.header = JSON.parse(b64urlDecode(parts[0])); }
  catch(e){ return { error: 'Header decode nahi hua: ' + e.message }; }
  try{ res.payload = JSON.parse(b64urlDecode(parts[1])); }
  catch(e){ return { error: 'Payload decode nahi hua: ' + e.message }; }
  res.notes = [];
  var p = res.payload;
  if(p && p.exp){ res.notes.push('exp: ' + new Date(p.exp * 1000).toUTCString() + (Date.now() / 1000 > p.exp ? ' — EXPIRE ho chuka hai' : ' — valid hai')); }
  if(p && p.iat){ res.notes.push('iat: ' + new Date(p.iat * 1000).toUTCString()); }
  if(parts.length === 2){ res.notes.push('Signature nahi hai — sirf header aur payload mile.'); }
  return res;
}

function parseUrlParts(u){
  var url;
  try{ url = new URL(String(u).trim()); }
  catch(e){ return { error: 'Valid URL nahi hai. http:// ya https:// se shuru kijiye.' }; }
  var params = [];
  url.searchParams.forEach(function(v, k){ params.push({ key: k, value: v }); });
  return {
    protocol: url.protocol,
    host: url.host,
    hostname: url.hostname,
    port: url.port || '(default)',
    path: url.pathname,
    hash: url.hash || '(koi nahi)',
    params: params
  };
}

function makeUuid(){
  if(typeof crypto !== 'undefined' && crypto.randomUUID){ return crypto.randomUUID(); }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
    var r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function tsToDate(input){
  var s = String(input).trim();
  if(!/^\d+$/.test(s)){ return { error: 'Timestamp sirf digits hona chahiye, jaise 1700000000' }; }
  var n = parseInt(s, 10);
  var ms = s.length > 12 ? n : n * 1000;
  var d = new Date(ms);
  if(isNaN(d.getTime())){ return { error: 'Ye timestamp valid nahi hai.' }; }
  var ist = new Date(ms + 5.5 * 3600 * 1000);
  return {
    text: 'UTC    : ' + d.toUTCString() + '\n' +
          'IST    : ' + ist.toISOString().replace('T', ' ').slice(0, 19) + ' (Asia/Kolkata)\n' +
          'Seconds: ' + Math.floor(ms / 1000) + '\n' +
          'Millis : ' + ms
  };
}
function dateToTs(input){
  var d = new Date(String(input).trim());
  if(isNaN(d.getTime())){ return { error: 'Date padh nahi paaya. Format: 2024-05-01 ya 2024-05-01T10:30:00' }; }
  var ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  return {
    text: 'Seconds: ' + Math.floor(d.getTime() / 1000) + '\n' +
          'Millis : ' + d.getTime() + '\n' +
          'UTC    : ' + d.toUTCString() + '\n' +
          'IST    : ' + ist.toISOString().replace('T', ' ').slice(0, 19)
  };
}

/* ---- colour ---- */
function hexToRgb(hex){
  var h = String(hex).replace('#', '').trim();
  if(h.length === 3){ h = h.split('').map(function(c){ return c + c; }).join(''); }
  if(!/^[0-9a-fA-F]{6}$/.test(h)){ return null; }
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function rgbToHsl(r, g, b){
  r /= 255; g /= 255; b /= 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h = 0, s = 0, l = (max + min) / 2;
  if(max !== min){
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if(max === r){ h = ((g - b) / d + (g < b ? 6 : 0)); }
    else if(max === g){ h = (b - r) / d + 2; }
    else { h = (r - g) / d + 4; }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}
function hslToRgb(h, s, l){
  h = ((h % 360) + 360) % 360 / 360; s /= 100; l /= 100;
  if(s === 0){ var v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  function hue(p, q, t){
    if(t < 0){ t += 1; }
    if(t > 1){ t -= 1; }
    if(t < 1/6){ return p + (q - p) * 6 * t; }
    if(t < 1/2){ return q; }
    if(t < 2/3){ return p + (q - p) * (2/3 - t) * 6; }
    return p;
  }
  var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  var p = 2 * l - q;
  return {
    r: Math.round(hue(p, q, h + 1/3) * 255),
    g: Math.round(hue(p, q, h) * 255),
    b: Math.round(hue(p, q, h - 1/3) * 255)
  };
}
function parseColor(input){
  var s = String(input).trim().toLowerCase();
  if(s.startsWith('#')){ var c = hexToRgb(s); return c ? { rgb: c } : null; }
  var m = s.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if(m){ return { rgb: { r: +m[1], g: +m[2], b: +m[3] } }; }
  m = s.match(/^hsl\s*\(\s*(-?\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)$/);
  if(m){ return { rgb: hslToRgb(+m[1], +m[2], +m[3]) }; }
  return null;
}
function relLuminance(rgb){
  function ch(c){ c = c / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  return 0.2126 * ch(rgb.r) + 0.7152 * ch(rgb.g) + 0.0722 * ch(rgb.b);
}
function colorFormats(rgb){
  function h2(n){ var x = n.toString(16); return x.length === 1 ? '0' + x : x; }
  var hex = '#' + h2(rgb.r) + h2(rgb.g) + h2(rgb.b);
  var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  var lum = relLuminance(rgb);
  return {
    hex: hex,
    rgb: 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')',
    hsl: 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)',
    luminance: Math.round(lum * 100) / 100,
    contrastWithWhite: Math.round((1.05 / (lum + 0.05)) * 10) / 10,
    contrastWithBlack: Math.round(((lum + 0.05) / 0.05) * 10) / 10
  };
}

/* ---- number base ---- */
function parseBigInt(s, radix){
  var digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  var r = BigInt(radix), v = BigInt(0);
  s = String(s).toLowerCase();
  if(!s.length){ return null; }
  for(var i = 0; i < s.length; i++){
    var d = digits.indexOf(s.charAt(i));
    if(d < 0 || d >= radix){ return null; }
    v = v * r + BigInt(d);
  }
  return v;
}
function baseConvert(value, from, to){
  var s = String(value).trim().replace(/^0[xX]/, '').replace(/^0[bB]/, '').replace(/^0[oO]/, '');
  var neg = s.charAt(0) === '-';
  if(neg){ s = s.slice(1); }
  s = s.replace(/[\s_]/g, '');
  var v = parseBigInt(s, from);
  if(v === null){ return { error: 'Ye number base ' + from + ' mein valid nahi hai.' }; }
  var out = v.toString(to);
  return { text: neg ? '-' + out : out, value: v };
}
function baseAll(value, from){
  var r = baseConvert(value, from, 10);
  if(r.error){ return r; }
  return {
    text: 'Binary : ' + baseConvert(value, from, 2).text + '\n' +
          'Octal  : ' + baseConvert(value, from, 8).text + '\n' +
          'Decimal: ' + baseConvert(value, from, 10).text + '\n' +
          'Hex    : ' + baseConvert(value, from, 16).text.toUpperCase() + '\n' +
          'Base36 : ' + baseConvert(value, from, 36).text
  };
}

/* ---- money / numbers ---- */
function inr(n){
  var s = (Math.round(n * 100) / 100).toFixed(2);
  var parts = s.split('.');
  var x = parts[0];
  var last3 = x.slice(-3);
  var rest = x.slice(0, -3);
  if(rest){ rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ','); }
  return (rest ? rest + ',' : '') + last3 + '.' + parts[1];
}
function emiCalc(P, annualRate, months){
  P = Number(P); annualRate = Number(annualRate); months = Number(months);
  if(!(P > 0) || !(months > 0)){ return { error: 'Loan amount aur months 0 se bade hone chahiye.' }; }
  if(annualRate < 0){ return { error: 'Interest rate negative nahi ho sakta.' }; }
  var r = annualRate / 12 / 100;
  var emi;
  if(r === 0){ emi = P / months; }
  else {
    var f = Math.pow(1 + r, months);
    emi = P * r * f / (f - 1);
  }
  var total = emi * months;
  return {
    emi: emi, total: total, interest: total - P, principal: P, months: months,
    text: 'EMI             : ₹' + inr(emi) + ' per month\n' +
          'Total payment   : ₹' + inr(total) + '\n' +
          'Total interest  : ₹' + inr(total - P) + '\n' +
          'Principal       : ₹' + inr(P) + '\n' +
          'Tenure          : ' + months + ' months (' + (Math.round(months / 12 * 10) / 10) + ' saal)\n' +
          'Interest share  : ' + Math.round((total - P) / total * 1000) / 10 + '% of total payment'
  };
}
function gstCalc(amount, rate, mode){
  amount = Number(amount); rate = Number(rate);
  if(!(amount > 0)){ return { error: 'Amount 0 se bada hona chahiye.' }; }
  var base, gst, total;
  if(mode === 'incl'){
    base = amount / (1 + rate / 100);
    gst = amount - base;
    total = amount;
  } else {
    base = amount;
    gst = amount * rate / 100;
    total = amount + gst;
  }
  return {
    text: 'Base amount : ₹' + inr(base) + '\n' +
          'GST @ ' + rate + '%  : ₹' + inr(gst) + '\n' +
          'Total       : ₹' + inr(total) + '\n\n' +
          'CGST (half) : ₹' + inr(gst / 2) + '\n' +
          'SGST (half) : ₹' + inr(gst / 2) + '\n' +
          '(IGST poora: ₹' + inr(gst) + ')'
  };
}
function percentCalc(a, b){
  a = Number(a); b = Number(b);
  if(isNaN(a) || isNaN(b)){ return { error: 'Dono numbers daaliye.' }; }
  var change = a === 0 ? null : ((b - a) / Math.abs(a)) * 100;
  return {
    text: a + ' ka ' + b + '%        = ' + Math.round(b / 100 * a * 1000) / 1000 + '\n' +
          a + ', ' + b + ' ka kitna %  = ' + (b === 0 ? 'undefined (B 0 hai)' : Math.round(a / b * 1000) / 10 + '%') + '\n' +
          a + ' se ' + b + ' tak change = ' + (change === null ? 'undefined (A 0 hai)' : (change > 0 ? '+' : '') + Math.round(change * 10) / 10 + '%') + '\n' +
          'Difference            = ' + (Math.round((b - a) * 1000) / 1000)
  };
}

/* ---- units ---- */
var UNITS = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, 'in': 0.0254 },
  weight: { kg: 1, g: 0.001, mg: 0.000001, t: 1000, lb: 0.45359237, oz: 0.0283495231 },
  data:   { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 }
};
function unitConvert(cat, value, from, to){
  value = Number(value);
  if(isNaN(value)){ return { error: 'Value ek number honi chahiye.' }; }
  if(cat === 'temp'){
    var c;
    if(from === 'C'){ c = value; }
    else if(from === 'F'){ c = (value - 32) * 5 / 9; }
    else { c = value - 273.15; }
    var out;
    if(to === 'C'){ out = c; }
    else if(to === 'F'){ out = c * 9 / 5 + 32; }
    else { out = c + 273.15; }
    return { value: out, text: value + ' °' + from + ' = ' + (Math.round(out * 1000) / 1000) + ' °' + to };
  }
  var table = UNITS[cat];
  if(!table || !(from in table) || !(to in table)){ return { error: 'Ye unit support nahi hai.' }; }
  var base = value * table[from];
  var res = base / table[to];
  return { value: res, text: value + ' ' + from + ' = ' + (Math.round(res * 1000000) / 1000000) + ' ' + to };
}

/* ---- password ---- */
function randomInt(max){
  if(typeof crypto !== 'undefined' && crypto.getRandomValues){
    var a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % max;
  }
  return Math.floor(Math.random() * max);
}
function makePassword(len, opts){
  var sets = [];
  if(opts.upper){ sets.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ'); }
  if(opts.lower){ sets.push('abcdefghijklmnopqrstuvwxyz'); }
  if(opts.digit){ sets.push('0123456789'); }
  if(opts.symbol){ sets.push('!@#$%^&*()-_=+[]{};:,.?'); }
  if(!sets.length){ return { error: 'Kam se kam ek character type chuniye.' }; }
  var all = sets.join('');
  var chars = [];
  sets.forEach(function(s){ chars.push(s.charAt(randomInt(s.length))); });
  while(chars.length < len){ chars.push(all.charAt(randomInt(all.length))); }
  for(var i = chars.length - 1; i > 0; i--){
    var j = randomInt(i + 1);
    var t = chars[i]; chars[i] = chars[j]; chars[j] = t;
  }
  return { password: chars.slice(0, len).join('') };
}

/* ===== pure2 ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

// @ts-nocheck

/* ---- markdown ---- */
function mdToHtml(src){
  function esc(x){ return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function inline(x){
    x = esc(x);
    x = x.replace(/`([^`]+)`/g, '<code>$1</code>');
    x = x.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    x = x.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    x = x.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return x;
  }
  var lines = String(src).replace(/\r/g, '').split('\n');
  var out = [], inCode = false, buf = [], listType = null, listBuf = [];
  function flushList(){
    if(listType){ out.push('<' + listType + '>' + listBuf.join('') + '</' + listType + '>'); }
    listType = null; listBuf = [];
  }
  for(var i = 0; i < lines.length; i++){
    var line = lines[i];
    if(/^\s*```/.test(line)){
      if(inCode){ out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>'); buf = []; inCode = false; }
      else { flushList(); inCode = true; }
      continue;
    }
    if(inCode){ buf.push(line); continue; }
    var h = line.match(/^(#{1,6})\s+(.*)$/);
    if(h){ flushList(); var lv = h[1].length; out.push('<h' + lv + '>' + inline(h[2]) + '</h' + lv + '>'); continue; }
    if(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)){ flushList(); out.push('<hr>'); continue; }
    if(/^>\s?/.test(line)){ flushList(); out.push('<blockquote>' + inline(line.replace(/^>\s?/, '')) + '</blockquote>'); continue; }
    var ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if(ul){ if(listType !== 'ul'){ flushList(); listType = 'ul'; } listBuf.push('<li>' + inline(ul[1]) + '</li>'); continue; }
    var ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if(ol){ if(listType !== 'ol'){ flushList(); listType = 'ol'; } listBuf.push('<li>' + inline(ol[1]) + '</li>'); continue; }
    if(line.trim() === ''){ flushList(); continue; }
    flushList(); out.push('<p>' + inline(line) + '</p>');
  }
  if(inCode && buf.length){ out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>'); }
  flushList();
  return out.join('\n');
}

/* ---- JSON -> YAML ---- */
function yamlScalar(v){
  if(v === null || v === undefined){ return 'null'; }
  if(typeof v === 'number' || typeof v === 'boolean'){ return String(v); }
  if(Array.isArray(v)){ return '[' + v.map(yamlScalar).join(', ') + ']'; }
  if(typeof v === 'object'){ return '{}'; }
  var t = String(v);
  var needQuote = t === '' || /^\s|\s$/.test(t) ||
    /[:#\[\]{},&*?|<>=!%@`"']/.test(t) ||
    /^(true|false|null|yes|no|on|off|~|-?\d+(\.\d+)?)$/i.test(t) ||
    /^-/.test(t);
  return needQuote ? JSON.stringify(t) : t;
}
function yamlLines(v, ind, out){
  var pad = new Array(ind + 1).join('  ');
  if(Array.isArray(v)){
    if(!v.length){ out.push(pad + '[]'); return; }
    v.forEach(function(x){
      if(x && typeof x === 'object' && Object.keys(x).length){
        out.push(pad + '-');
        yamlLines(x, ind + 1, out);
      } else {
        out.push(pad + '- ' + yamlScalar(x));
      }
    });
    return;
  }
  if(v && typeof v === 'object'){
    var keys = Object.keys(v);
    if(!keys.length){ out.push(pad + '{}'); return; }
    keys.forEach(function(k){
      var val = v[k];
      var emptyObj = val && typeof val === 'object' && Object.keys(val).length === 0;
      if(val && typeof val === 'object' && !emptyObj){
        out.push(pad + k + ':');
        yamlLines(val, ind + 1, out);
      } else {
        out.push(pad + k + ': ' + yamlScalar(val));
      }
    });
    return;
  }
  out.push(pad + yamlScalar(v));
}
function jsonToYaml(obj){
  var out = [];
  yamlLines(obj, 0, out);
  return out.join('\n');
}

/* ---- JSON -> SQL ---- */
function jsonToSql(data, table){
  if(!Array.isArray(data) || !data.length){ return { error: 'JSON array chahiye, jaise [{"a":1}]' }; }
  var cols = [];
  data.forEach(function(r){
    if(r && typeof r === 'object' && !Array.isArray(r)){
      Object.keys(r).forEach(function(k){ if(cols.indexOf(k) === -1){ cols.push(k); } });
    }
  });
  if(!cols.length){ return { error: 'Array ke andar objects chahiye.' }; }
  var tn = String(table || 'my_table').replace(/[^A-Za-z0-9_]/g, '') || 'my_table';
  function q(v){
    if(v === null || v === undefined){ return 'NULL'; }
    if(typeof v === 'number'){ return String(v); }
    if(typeof v === 'boolean'){ return v ? 'TRUE' : 'FALSE'; }
    var str = (typeof v === 'object') ? JSON.stringify(v) : String(v);
    return "'" + str.replace(/'/g, "''") + "'";
  }
  var lines = data.map(function(r){
    return 'INSERT INTO ' + tn + ' (' + cols.join(', ') + ') VALUES (' +
      cols.map(function(c){ return q(r[c]); }).join(', ') + ');';
  });
  return { sql: lines.join('\n'), count: data.length };
}

/* ---- cron ---- */
function cronFieldValues(field, min, max){
  var names = { JAN:1, FEB:2, MAR:3, APR:4, MAY:5, JUN:6, JUL:7, AUG:8, SEP:9, OCT:10, NOV:11, DEC:12,
    SUN:0, MON:1, TUE:2, WED:3, THU:4, FRI:5, SAT:6 };
  var set = {};
  var parts = String(field).toUpperCase().split(',');
  for(var i = 0; i < parts.length; i++){
    var part = parts[i].trim();
    var step = 1;
    var sm = part.match(/^(.*)\/(\d+)$/);
    if(sm){ part = sm[1] || '*'; step = parseInt(sm[2], 10); }
    var lo, hi;
    if(part === '*'){ lo = min; hi = max; }
    else if(part.indexOf('-') > 0){
      var seg = part.split('-');
      lo = isNaN(Number(seg[0])) ? names[seg[0]] : parseInt(seg[0], 10);
      hi = isNaN(Number(seg[1])) ? names[seg[1]] : parseInt(seg[1], 10);
    } else {
      var one = isNaN(Number(part)) ? names[part] : parseInt(part, 10);
      lo = one; hi = one;
    }
    if(lo === undefined || hi === undefined || isNaN(lo) || isNaN(hi)){ return null; }
    if(lo > hi){ var t = lo; lo = hi; hi = t; }
    for(var v = lo; v <= hi; v += step){ set[v] = true; }
  }
  return set;
}
function cronExplain(expr){
  var parts = String(expr || '').trim().split(/\s+/);
  if(parts.length !== 5 && parts.length !== 6){
    return { error: '5 fields chahiye: minute hour din month weekday (jaise */15 9-18 * * 1-5)' };
  }
  if(parts.length === 6){ parts = parts.slice(1); }
  var names = ['minute', 'hour', 'din', 'month', 'weekday'];
  var ranges = [[0,59],[0,23],[1,31],[1,12],[0,6]];
  var sets = [];
  for(var i = 0; i < 5; i++){
    var st = cronFieldValues(parts[i], ranges[i][0], ranges[i][1]);
    if(!st){ return { error: names[i] + ' field galat hai: "' + parts[i] + '"' }; }
    sets.push(st);
  }
  var descs = [];
  function isAll(st, lo, hi){ for(var v = lo; v <= hi; v++){ if(!st[v]){ return false; } } return true; }
  descs.push(isAll(sets[0], 0, 59) ? 'har minute' : 'minute ' + Object.keys(sets[0]).join(','));
  descs.push(isAll(sets[1], 0, 23) ? 'har ghanta' : 'ghante ' + Object.keys(sets[1]).join(','));
  descs.push(isAll(sets[2], 1, 31) ? 'har din' : 'tarikh ' + Object.keys(sets[2]).join(','));
  descs.push(isAll(sets[3], 1, 12) ? 'har mahina' : 'mahine ' + Object.keys(sets[3]).join(','));
  var wdNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  descs.push(isAll(sets[4], 0, 6) ? 'har weekday' : Object.keys(sets[4]).map(function(k){ return wdNames[k]; }).join(', '));

  var next = [];
  var d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  var guard = 0;
  while(next.length < 5 && guard < 600000){
    guard++;
    if(sets[0][d.getMinutes()] && sets[1][d.getHours()] && sets[2][d.getDate()] &&
       sets[3][d.getMonth() + 1] && sets[4][d.getDay()]){
      next.push(new Date(d.getTime()));
    }
    d.setMinutes(d.getMinutes() + 1);
  }
  return { desc: descs.join(' | '), next: next };
}

/* ---- notes ---- */
function notesSave(storage, text){ try{ storage.setItem('dt-notes', text); return true; }catch(e){ return false; } }
function notesLoad(storage){ try{ return storage.getItem('dt-notes') || ''; }catch(e){ return ''; } }

/* ===== pure4 ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

// @ts-nocheck

/* ---- money ---- */
function sipCalc(monthly, annualRate, years){
  var P = Number(monthly), r = Number(annualRate), y = Number(years);
  if(!(P > 0) || !(y > 0)){ return { error: 'Monthly amount aur saal 0 se bade hone chahiye.' }; }
  if(r < 0){ return { error: 'Return negative nahi ho sakta.' }; }
  var i = r / 12 / 100, n = Math.round(y * 12);
  var fv;
  if(i === 0){ fv = P * n; }
  else { fv = P * ((Math.pow(1 + i, n) - 1) / i) * (1 + i); }
  var invested = P * n;
  return { invested: invested, maturity: fv, gain: fv - invested, months: n,
    text: 'Har mahine      : ₹' + inr(P) + '\n' +
          'Total invest    : ₹' + inr(invested) + ' (' + n + ' mahine)\n' +
          'Maturity value  : ₹' + inr(fv) + '\n' +
          'Kul munafa      : ₹' + inr(fv - invested) + '\n' +
          'Munafa ka hissa : ' + Math.round((fv - invested) / fv * 1000) / 10 + '%' };
}
function compoundCalc(P, rate, years, perYear){
  P = Number(P); rate = Number(rate); years = Number(years); perYear = Number(perYear) || 1;
  if(!(P > 0) || !(years > 0)){ return { error: 'Principal aur saal 0 se bade hone chahiye.' }; }
  var A = P * Math.pow(1 + (rate / 100) / perYear, perYear * years);
  var interest = A - P;
  return { text: 'Principal      : ₹' + inr(P) + '\n' +
    'Rate           : ' + rate + '% per year (' + perYear + 'x compounding)\n' +
    'Time           : ' + years + ' saal\n\n' +
    'Maturity value : ₹' + inr(A) + '\n' +
    'Interest       : ₹' + inr(interest) + '\n' +
    'Growth         : ' + Math.round(interest / P * 1000) / 10 + '%' };
}
function discountCalc(price, pct, gstPct){
  price = Number(price); pct = Number(pct) || 0;
  if(!(price > 0)){ return { error: 'Price 0 se bada hona chahiye.' }; }
  if(pct < 0 || pct > 100){ return { error: 'Discount 0 se 100 ke beech hona chahiye.' }; }
  var afterDisc = price * (1 - pct / 100);
  var saved = price - afterDisc;
  var gst = gstPct ? afterDisc * Number(gstPct) / 100 : 0;
  return { text: 'MRP            : ₹' + inr(price) + '\n' +
    'Discount       : ' + pct + '%  (−₹' + inr(saved) + ')\n' +
    'Discount ke baad: ₹' + inr(afterDisc) + '\n' +
    (gstPct ? 'GST @ ' + gstPct + '%   : ₹' + inr(gst) + '\n' : '') +
    'Final price    : ₹' + inr(afterDisc + gst) + '\n' +
    'Aapne bachaye  : ₹' + inr(saved) };
}

/* ---- number to words (Indian) ---- */
var ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
var TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function twoDigit(n){
  if(n < 20){ return ONES[n]; }
  var t = TENS[Math.floor(n / 10)];
  var o = ONES[n % 10];
  return o ? t + '-' + o : t;
}
function threeDigit(n){
  var h = Math.floor(n / 100), rest = n % 100;
  var parts = [];
  if(h){ parts.push(ONES[h] + ' hundred'); }
  if(rest){ parts.push(twoDigit(rest)); }
  return parts.join(' ');
}
function numberToWordsIndian(num){
  var n = Math.floor(Math.abs(Number(num)));
  if(isNaN(n)){ return null; }
  if(n === 0){ return 'zero'; }
  var crore = Math.floor(n / 10000000); n = n % 10000000;
  var lakh = Math.floor(n / 100000); n = n % 100000;
  var thousand = Math.floor(n / 1000); n = n % 1000;
  var rest = n;
  var out = [];
  if(crore){ out.push(numberToWordsIndian(crore) + ' crore'); }
  if(lakh){ out.push(twoDigit(lakh) + ' lakh'); }
  if(thousand){ out.push(twoDigit(thousand) + ' thousand'); }
  if(rest){ out.push(threeDigit(rest)); }
  return out.join(' ');
}
function amountToWords(amount){
  var a = Number(String(amount).replace(/,/g, ''));
  if(isNaN(a)){ return { error: 'Number sahi daaliye.' }; }
  var rupees = Math.floor(Math.abs(a));
  var paise = Math.round((Math.abs(a) - rupees) * 100);
  var words = numberToWordsIndian(rupees) + ' rupees';
  if(paise){ words += ' aur ' + twoDigit(paise) + ' paise'; }
  return { text: (a < 0 ? 'minus ' : '') + words.charAt(0).toUpperCase() + words.slice(1) };
}

/* ---- roman ---- */
function toRoman(num){
  var n = Math.floor(Number(num));
  if(!(n > 0) || n > 3999){ return { error: '1 se 3999 ke beech ka number daaliye.' }; }
  var map = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],
    [50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  var out = '';
  map.forEach(function(p){ while(n >= p[0]){ out += p[1]; n -= p[0]; } });
  return { text: out };
}
function fromRoman(str){
  var s = String(str).toUpperCase().trim();
  if(!/^[IVXLCDM]+$/.test(s)){ return { error: 'Sirf I, V, X, L, C, D, M allowed hain.' }; }
  var val = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  var total = 0;
  for(var i = 0; i < s.length; i++){
    var cur = val[s.charAt(i)], next = val[s.charAt(i + 1)] || 0;
    total += (cur < next) ? -cur : cur;
  }
  return { text: String(total) };
}

/* ---- html -> text ---- */
function htmlToText(html){
  var t = String(html);
  t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n');
  t = t.replace(/<li[^>]*>/gi, '- ');
  t = t.replace(/<[^>]+>/g, '');
  t = htmlUnescape(t);
  t = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  return t.trim();
}
function csvToHtmlTable(csvText, hasHeader){
  var rows = parseCSV(csvText);
  if(!rows.length){ return { error: 'CSV khaali hai.' }; }
  function esc(v){ return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var out = ['<table>'];
  rows.forEach(function(r, idx){
    var cell = (hasHeader && idx === 0) ? 'th' : 'td';
    out.push('  <tr>' + r.map(function(c){ return '<' + cell + '>' + esc(c) + '</' + cell + '>'; }).join('') + '</tr>');
  });
  out.push('</table>');
  return { html: out.join('\n'), rows: rows.length };
}

/* ---- dates ---- */
function dateAdd(dateStr, days, months, years){
  var d = new Date(String(dateStr).trim());
  if(isNaN(d.getTime())){ return { error: 'Tareekh samajh nahi aayi. 2026-10-28 jaisa likhiye.' }; }
  var dayShift = parseInt(days, 10) || 0;
  var monthShift = parseInt(months, 10) || 0;
  var yearShift = parseInt(years, 10) || 0;
  var res = new Date(d.getTime());
  if(yearShift){ res.setFullYear(res.getFullYear() + yearShift); }
  if(monthShift){ res.setMonth(res.getMonth() + monthShift); }
  if(dayShift){ res.setDate(res.getDate() + dayShift); }
  var wd = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][res.getDay()];
  return { date: res, iso: res.toISOString().slice(0, 10), weekday: wd };
}

/* ---- aspect ---- */
function gcd(a, b){ a = Math.abs(a); b = Math.abs(b); while(b){ var t = b; b = a % b; a = t; } return a; }
function aspectCalc(w, h, newW){
  w = Number(w); h = Number(h);
  if(!(w > 0) || !(h > 0)){ return { error: 'Width aur height 0 se bade hone chahiye.' }; }
  var g = gcd(Math.round(w), Math.round(h)) || 1;
  var rw = Math.round(w / g), rh = Math.round(h / g);
  var lines = ['Ratio     : ' + rw + ':' + rh,
               'Decimal   : ' + (Math.round(w / h * 1000) / 1000) + ':1'];
  if(newW && Number(newW) > 0){
    var nh = Math.round(Number(newW) * h / w);
    lines.push('Nayi width ' + Number(newW) + ' par height = ' + nh + ' px');
    lines.push('Nayi height ' + Number(newW) + ' par width  = ' + Math.round(Number(newW) * w / h) + ' px');
  }
  return { text: lines.join('\n'), ratio: rw + ':' + rh };
}

/* ===== pure3 ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

// @ts-nocheck

/* ---- YAML -> JSON (aasan subset) ---- */
function parseYaml(text){
  var lines = String(text).replace(/\r/g, '').split('\n')
    .filter(function(l){ return l.trim() !== '' && !/^\s*#/.test(l); })
    .map(function(l){ return { indent: (l.match(/^ */) || [''])[0].length, text: l.trim() }; });
  var i = 0;
  function scalar(s){
    s = String(s).trim();
    if(s === ''){ return null; }
    if(/^".*"$/.test(s)){ return s.slice(1, -1); }
    if(/^'.*'$/.test(s)){ return s.slice(1, -1); }
    if(s === 'null' || s === '~'){ return null; }
    if(s === 'true'){ return true; }
    if(s === 'false'){ return false; }
    if(/^-?\d+$/.test(s)){ return parseInt(s, 10); }
    if(/^-?\d*\.\d+$/.test(s)){ return parseFloat(s); }
    if(/^\[.*\]$/.test(s)){
      var inner = s.slice(1, -1).trim();
      if(!inner){ return []; }
      return inner.split(',').map(function(x){ return scalar(x); });
    }
    return s;
  }
  function parseBlock(indent){
    if(i >= lines.length){ return null; }
    var isList = /^-(\s|$)/.test(lines[i].text);
    return isList ? parseList(indent) : parseMap(indent);
  }
  function parseList(indent){
    var arr = [];
    while(i < lines.length && lines[i].indent === indent && /^-(\s|$)/.test(lines[i].text)){
      var rest = lines[i].text.replace(/^-\s?/, '');
      i++;
      if(rest === ''){
        arr.push((i < lines.length && lines[i].indent > indent) ? parseBlock(lines[i].indent) : null);
      } else if(/^[^:\s]+\s*:/.test(rest)){
        var obj = {};
        var m = rest.match(/^([^:]+):\s*(.*)$/);
        obj[m[1].trim()] = m[2] ? scalar(m[2]) : null;
        while(i < lines.length && lines[i].indent > indent){
          var sub = parseMap(lines[i].indent);
          if(!sub){ break; }
          Object.keys(sub).forEach(function(k){ obj[k] = sub[k]; });
        }
        arr.push(obj);
      } else {
        arr.push(scalar(rest));
      }
    }
    return arr;
  }
  function parseMap(indent){
    var obj = {};
    while(i < lines.length && lines[i].indent === indent && !/^-(\s|$)/.test(lines[i].text)){
      var m = lines[i].text.match(/^([^:]+):\s*(.*)$/);
      if(!m){ i++; continue; }
      var key = m[1].trim();
      var rest = m[2];
      i++;
      if(rest === ''){
        obj[key] = (i < lines.length && lines[i].indent > indent) ? parseBlock(lines[i].indent) : null;
      } else {
        obj[key] = scalar(rest);
      }
    }
    return obj;
  }
  if(!lines.length){ return null; }
  return parseBlock(lines[0].indent);
}

/* ---- XML -> JSON ---- */
function xmlToJson(src){
  var s = String(src).replace(/<\?[\s\S]*?\?>/g, '').replace(/\x3C!--[\s\S]*?-->/g, '').trim();
  var i = 0;
  function parseNode(){
    if(s.charAt(i) !== '<'){ return null; }
    var end = s.indexOf('>', i);
    if(end < 0){ throw new Error('tag band nahi hua'); }
    var raw = s.slice(i + 1, end).trim();
    var selfClose = /\/$/.test(raw);
    if(selfClose){ raw = raw.slice(0, -1).trim(); }
    var name = raw.split(/\s+/)[0];
    var attrs = {};
    raw.replace(/([\w:-]+)\s*=\s*"([^"]*)"/g, function(m, k, v){ attrs[k] = v; return m; });
    raw.replace(/([\w:-]+)\s*=\s*'([^']*)'/g, function(m, k, v){ attrs[k] = v; return m; });
    i = end + 1;
    var node = { name: name, attrs: attrs, children: [], text: '' };
    if(selfClose){ return node; }
    while(i < s.length){
      if(s.substr(i, 2) === '</'){
        var close = s.indexOf('>', i);
        if(close < 0){ throw new Error('closing tag toota hua hai'); }
        i = close + 1;
        return node;
      }
      if(s.charAt(i) === '<'){
        var child = parseNode();
        if(child){ node.children.push(child); }
      } else {
        var next = s.indexOf('<', i);
        if(next < 0){ next = s.length; }
        node.text += s.slice(i, next);
        i = next;
      }
    }
    return node;
  }
  function toObj(n){
    var o = {};
    if(Object.keys(n.attrs).length){ o['@attributes'] = n.attrs; }
    var txt = n.text.trim();
    if(n.children.length){
      var groups = {};
      n.children.forEach(function(c){
        var v = toObj(c);
        if(Object.prototype.hasOwnProperty.call(groups, c.name)){
          if(!Array.isArray(groups[c.name])){ groups[c.name] = [groups[c.name]]; }
          groups[c.name].push(v);
        } else {
          groups[c.name] = v;
        }
      });
      Object.keys(groups).forEach(function(k){ o[k] = groups[k]; });
      if(txt){ o['#text'] = txt; }
    } else if(Object.keys(o).length){
      if(txt){ o['#text'] = txt; }
    } else {
      return txt;
    }
    return o;
  }
  var root = parseNode();
  if(!root){ throw new Error('XML padh nahi paaya'); }
  var out = {};
  out[root.name] = toObj(root);
  return out;
}

/* ---- AES ---- */
function bytesToB64(bytes){
  var bin = '';
  for(var i = 0; i < bytes.length; i++){ bin += String.fromCharCode(bytes[i]); }
  return btoa(bin);
}
function b64ToBytes(b64){
  var bin = atob(String(b64).replace(/\s+/g, ''));
  var arr = new Uint8Array(bin.length);
  for(var i = 0; i < bin.length; i++){ arr[i] = bin.charCodeAt(i); }
  return arr;
}
async function deriveAesKey(pass, salt){
  var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt, iterations: 150000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function aesEncrypt(text, pass){
  if(!(crypto && crypto.subtle)){ throw new Error('Browser mein crypto support nahi hai'); }
  var salt = crypto.getRandomValues(new Uint8Array(16));
  var iv = crypto.getRandomValues(new Uint8Array(12));
  var key = await deriveAesKey(pass, salt);
  var ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(text));
  var out = new Uint8Array(16 + 12 + ct.byteLength);
  out.set(salt, 0); out.set(iv, 16); out.set(new Uint8Array(ct), 28);
  return bytesToB64(out);
}
async function aesDecrypt(payload, pass){
  var data = b64ToBytes(payload);
  if(data.length < 29){ throw new Error('Ye encrypted text jaisa nahi lagta'); }
  var salt = data.slice(0, 16), iv = data.slice(16, 28), ct = data.slice(28);
  var key = await deriveAesKey(pass, salt);
  var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
  return new TextDecoder().decode(pt);
}

/* ---- list ops ---- */
function listOf(text){
  var seen = {};
  return String(text).split('\n').map(function(l){ return l.trim(); })
    .filter(function(l){ if(!l){ return false; } if(seen[l]){ return false; } seen[l] = 1; return true; });
}
function setOps(aText, bText, op){
  var a = listOf(aText), b = listOf(bText);
  var inB = {}; b.forEach(function(x){ inB[x] = 1; });
  var inA = {}; a.forEach(function(x){ inA[x] = 1; });
  if(op === 'common'){ return a.filter(function(x){ return inB[x]; }); }
  if(op === 'onlyA'){ return a.filter(function(x){ return !inB[x]; }); }
  if(op === 'onlyB'){ return b.filter(function(x){ return !inA[x]; }); }
  var all = a.slice();
  b.forEach(function(x){ if(!inA[x]){ all.push(x); } });
  return all;
}

/* ---- css helpers ---- */
function gradientCss(c1, c2, angle, type){
  var a = String(c1 || '').trim(), b = String(c2 || '').trim();
  if(!parseColor(a) || !parseColor(b)){ return { error: 'Rang sahi format mein daaliye (#3fb950)' }; }
  if(type === 'radial'){
    return { css: 'background: radial-gradient(circle, ' + a + ' 0%, ' + b + ' 100%);',
             style: 'radial-gradient(circle, ' + a + ' 0%, ' + b + ' 100%)' };
  }
  var ang = parseInt(angle, 10);
  if(isNaN(ang)){ ang = 135; }
  return { css: 'background: linear-gradient(' + ang + 'deg, ' + a + ' 0%, ' + b + ' 100%);',
           style: 'linear-gradient(' + ang + 'deg, ' + a + ' 0%, ' + b + ' 100%)' };
}
function shadowCss(x, y, blur, spread, color, inset){
  var parts = [x + 'px', y + 'px', blur + 'px', spread + 'px', color];
  var val = (inset ? 'inset ' : '') + parts.join(' ');
  return { css: 'box-shadow: ' + val + ';', style: val };
}
function paletteFrom(hex){
  var rgb = hexToRgb(hex);
  if(!rgb){ return { error: 'Hex colour daaliye, jaise #3fb950' }; }
  var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  var out = [];
  [95, 85, 75, 65, 55, 45, 35, 25, 15, 8].forEach(function(l){
    var c = hslToRgb(hsl.h, hsl.s, l);
    var h2 = function(n){ var t = n.toString(16); return t.length === 1 ? '0' + t : t; };
    out.push('#' + h2(c.r) + h2(c.g) + h2(c.b));
  });
  return { colors: out, hsl: hsl };
}

/* ---- dates ---- */
function dateDiffParts(aStr, bStr){
  var a = new Date(aStr), b = new Date(bStr);
  if(isNaN(a.getTime()) || isNaN(b.getTime())){ return { error: 'Tareekh samajh nahi aayi. 2024-01-15 jaisa likhiye.' }; }
  var past = a, future = b;
  if(a > b){ past = b; future = a; }
  var y = future.getFullYear() - past.getFullYear();
  var m = future.getMonth() - past.getMonth();
  var d = future.getDate() - past.getDate();
  if(d < 0){
    m--;
    var prevMonth = new Date(future.getFullYear(), future.getMonth(), 0).getDate();
    d += prevMonth;
  }
  if(m < 0){ y--; m += 12; }
  var days = Math.round((future - past) / 86400000);
  return { years: y, months: m, days: d, totalDays: days, totalWeeks: Math.floor(days / 7),
           totalHours: Math.round((future - past) / 3600000), swapped: a > b };
}

var TZ_LIST = [
  ['Asia/Kolkata', 'India (IST)'],
  ['UTC', 'UTC'],
  ['America/New_York', 'New York'],
  ['Europe/London', 'London'],
  ['Asia/Dubai', 'Dubai'],
  ['Asia/Singapore', 'Singapore'],
  ['Asia/Tokyo', 'Tokyo'],
  ['Australia/Sydney', 'Sydney']
];
function tzFromIst(input){
  var s = String(input).trim().replace('T', ' ');
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ ]+(\d{1,2}):(\d{2}))?$/);
  if(!m){ return { error: 'Format: 2026-10-28 15:30 (IST maan kar)' }; }
  var utcMs = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) - 330 * 60000;
  return { ms: utcMs };
}
function tzFormat(ms, zone){
  try{
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date(ms));
  }catch(e){ return 'n/a'; }
}

/* ---- readability ---- */
function countSyllables(word){
  var w = String(word).toLowerCase().replace(/[^a-z]/g, '');
  if(!w){ return 0; }
  if(w.length <= 3){ return 1; }
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  var m = w.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}
function readability(t){
  var text = String(t);
  var ws = text.trim().split(/\s+/).filter(Boolean);
  if(!ws.length){ return { error: 'Pehle text daaliye.' }; }
  var sentences = text.split(/[.!?]+/).filter(function(x){ return x.trim() !== ''; }).length || 1;
  var syll = 0;
  ws.forEach(function(w){ syll += countSyllables(w); });
  var wps = ws.length / sentences;
  var spw = syll / ws.length;
  var flesch = 206.835 - (1.015 * wps) - (84.6 * spw);
  flesch = Math.max(0, Math.min(100, Math.round(flesch * 10) / 10));
  var grade = Math.max(0, Math.round((0.39 * wps + 11.8 * spw - 15.59) * 10) / 10);
  var label;
  if(flesch >= 80){ label = 'Bahut aasan (bacchon ke liye)'; }
  else if(flesch >= 60){ label = 'Aasan (aam pathak)'; }
  else if(flesch >= 40){ label = 'Thoda mushkil (college level)'; }
  else { label = 'Mushkil (specialist)'; }
  return { flesch: flesch, grade: grade, label: label, words: ws.length,
           sentences: sentences, syllables: syll, wps: Math.round(wps * 10) / 10 };
}

/* ---- password strength ---- */
function passwordStrength(pw){
  var p = String(pw);
  if(!p){ return { error: 'Password daaliye.' }; }
  var pool = 0;
  if(/[a-z]/.test(p)){ pool += 26; }
  if(/[A-Z]/.test(p)){ pool += 26; }
  if(/[0-9]/.test(p)){ pool += 10; }
  if(/[^A-Za-z0-9]/.test(p)){ pool += 32; }
  var entropy = p.length * (pool ? Math.log2(pool) : 0);
  var guesses = Math.pow(2, entropy);
  var perSec = 1e10;
  var secs = guesses / perSec;
  function human(s){
    if(s < 1){ return 'turant'; }
    var units = [[60,'second'],[60,'minute'],[24,'hour'],[365,'day'],[100,'year']];
    var v = s, name = 'second';
    for(var i = 0; i < units.length; i++){
      if(v < units[i][0]){ break; }
      v = v / units[i][0]; name = units[i][1];
    }
    return Math.round(v) + ' ' + name + (Math.round(v) === 1 ? '' : 's');
  }
  var warnings = [];
  if(p.length < 8){ warnings.push('bahut chhota (8+ chahiye)'); }
  if(/^(123|abc|qwe|pass|admin)/i.test(p)){ warnings.push('aam shuruaat'); }
  if(/(.)\1{2,}/.test(p)){ warnings.push('ek hi character repeat'); }
  if(/^[0-9]+$/.test(p)){ warnings.push('sirf digits'); }
  var level = entropy < 30 ? 'kamzor' : (entropy < 50 ? 'theek' : (entropy < 70 ? 'mazboot' : 'bahut mazboot'));
  return { entropy: Math.round(entropy), level: level, crack: human(secs), warnings: warnings,
           pool: pool, length: p.length };
}

/* ---- random ---- */
function randomOf(kind, a, b, listText){
  if(kind === 'coin'){ return randomInt(2) ? 'HEADS' : 'TAILS'; }
  if(kind === 'dice'){ return String(1 + randomInt(6)); }
  if(kind === 'number'){
    var lo = parseInt(a, 10), hi = parseInt(b, 10);
    if(isNaN(lo) || isNaN(hi)){ return null; }
    if(lo > hi){ var t = lo; lo = hi; hi = t; }
    return String(lo + randomInt(hi - lo + 1));
  }
  var items = String(listText).split('\n').map(function(x){ return x.trim(); }).filter(Boolean);
  if(!items.length){ return null; }
  return items[randomInt(items.length)];
}

/* ===== pure5 ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

// @ts-nocheck

/* ---- HTML -> XML ---- */
function htmlToXml(html, fragmentOnly){
  var src = String(html || '');
  if(!src.trim()){ return { error: 'Pehle HTML daaliye.' }; }
  if(typeof DOMParser === 'undefined'){ return { error: 'Is browser mein HTML parser nahi hai.' }; }
  var doc;
  try{
    doc = new DOMParser().parseFromString(src, 'text/html');
  }catch(e){ return { error: 'HTML padh nahi paaya: ' + e.message }; }
  var VOID = { area:1, base:1, br:1, col:1, embed:1, hr:1, img:1, input:1,
               link:1, meta:1, param:1, source:1, track:1, wbr:1 };
  var out = [], count = 0;
  function esc(t){ return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escAttr(t){ return esc(t).replace(/"/g, '&quot;'); }
  function pad(d){ return new Array(d + 1).join('  '); }
  function walk(node, depth){
    if(node.nodeType === 1){
      count++;
      var tag = node.tagName.toLowerCase();
      var attrs = '';
      for(var i = 0; i < node.attributes.length; i++){
        var a = node.attributes[i];
        attrs += ' ' + a.name + '="' + escAttr(a.value) + '"';
      }
      if(VOID[tag]){ out.push(pad(depth) + '<' + tag + attrs + '/>'); return; }
      var kids = [];
      for(var k = 0; k < node.childNodes.length; k++){
        var n = node.childNodes[k];
        if(n.nodeType === 1){ kids.push(n); }
        else if(n.nodeType === 3 && n.nodeValue.trim() !== ''){ kids.push(n); }
        else if(n.nodeType === 8){ kids.push(n); }
      }
      if(!kids.length){ out.push(pad(depth) + '<' + tag + attrs + '></' + tag + '>'); return; }
      if(kids.length === 1 && kids[0].nodeType === 3){
        out.push(pad(depth) + '<' + tag + attrs + '>' + esc(kids[0].nodeValue.trim()) + '</' + tag + '>');
        return;
      }
      out.push(pad(depth) + '<' + tag + attrs + '>');
      kids.forEach(function(kid){ walk(kid, depth + 1); });
      out.push(pad(depth) + '</' + tag + '>');
      return;
    }
    if(node.nodeType === 3){
      var t = node.nodeValue.trim();
      if(t){ out.push(pad(depth) + esc(t)); }
      return;
    }
    if(node.nodeType === 8){ out.push(pad(depth) + '\x3C!--' + node.nodeValue + '-->'); }
  }
  var autoFragment = false;
  if(!fragmentOnly && !/<html[\s>]/i.test(src)){ fragmentOnly = true; autoFragment = true; }
  var startNodes;
  if(fragmentOnly){
    var body = doc.body;
    startNodes = body ? Array.prototype.slice.call(body.childNodes) : [];
    startNodes = startNodes.filter(function(n){
      return n.nodeType === 1 || (n.nodeType === 3 && n.nodeValue.trim() !== '') || n.nodeType === 8;
    });
  } else {
    startNodes = [doc.documentElement];
  }
  startNodes.forEach(function(n){ walk(n, 0); });
  if(!out.length){ return { error: 'Koi tag nahi mila — HTML khaali lagta hai.' }; }
  return { xml: '<?xml version="1.0" encoding="UTF-8"?>\n' + out.join('\n'), count: count, autoFragment: autoFragment };
}

/* ===== pure7 ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

// @ts-nocheck

/* ---- Blogger helpers ---- */
function bloggerBodyMarkup(html){
  // HTML se body ka markup + CSS alag karta hai (void tags self-closing)
  if(typeof DOMParser === 'undefined'){ return { error: 'Browser mein parser nahi hai.' }; }
  var doc;
  try{ doc = new DOMParser().parseFromString(String(html), 'text/html'); }
  catch(e){ return { error: 'HTML padh nahi paaya: ' + e.message }; }
  var VOID = { area:1, base:1, br:1, col:1, embed:1, hr:1, img:1, input:1,
               link:1, meta:1, param:1, source:1, track:1, wbr:1 };
  var out = [], cssParts = [], links = [], title = '';
  var titleEl = doc.querySelector('title');
  if(titleEl){ title = (titleEl.textContent || '').trim(); }
  // head aur body dono ke <style> ikattha karo
  Array.prototype.forEach.call(doc.querySelectorAll('style'), function(st){
    var t = (st.textContent || '').trim();
    if(t){ cssParts.push(t); }
  });
  Array.prototype.forEach.call(doc.querySelectorAll('link[rel="stylesheet"]'), function(l){
    var href = l.getAttribute('href');
    if(href){ links.push(href); }
  });
  function esc(t){ return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escA(t){ return esc(t).replace(/"/g, '&quot;'); }
  function pad(d){ return new Array(d + 1).join('  '); }
  function walk(node, depth){
    if(node.nodeType === 1){
      var tag = node.tagName.toLowerCase();
      if(tag === 'style' || tag === 'link' || tag === 'meta' || tag === 'title'){ return; }
      var attrs = '';
      for(var i = 0; i < node.attributes.length; i++){
        var a = node.attributes[i];
        attrs += ' ' + a.name + '="' + escA(a.value) + '"';
      }
      if(VOID[tag]){ out.push(pad(depth) + '<' + tag + attrs + '/>'); return; }
      var kids = [];
      for(var k = 0; k < node.childNodes.length; k++){
        var n = node.childNodes[k];
        if(n.nodeType === 1 || n.nodeType === 8 || (n.nodeType === 3 && n.nodeValue.trim() !== '')){ kids.push(n); }
      }
      if(!kids.length){ out.push(pad(depth) + '<' + tag + attrs + '/>'); return; }
      if(kids.length === 1 && kids[0].nodeType === 3){
        out.push(pad(depth) + '<' + tag + attrs + '>' + esc(kids[0].nodeValue.trim()) + '</' + tag + '>');
        return;
      }
      out.push(pad(depth) + '<' + tag + attrs + '>');
      kids.forEach(function(kid){ walk(kid, depth + 1); });
      out.push(pad(depth) + '</' + tag + '>');
      return;
    }
    if(node.nodeType === 8){ out.push(pad(depth) + '<' + '!--' + node.nodeValue + '--' + '>'); return; }
    if(node.nodeType === 3){
      var t = node.nodeValue.trim();
      if(t){ out.push(pad(depth) + esc(t)); }
    }
  }
  var body = doc.body;
  if(body){
    for(var i = 0; i < body.childNodes.length; i++){
      var nd = body.childNodes[i];
      if(nd.nodeType === 1 || nd.nodeType === 8 || (nd.nodeType === 3 && nd.nodeValue.trim() !== '')){ walk(nd, 2); }
    }
  }
  if(!out.length){ return { error: 'HTML mein koi content nahi mila.' }; }
  return { markup: out.join('\n'), css: cssParts.join('\n\n'), links: links, title: title };
}

function bloggerWrap(html, title){
  var r = bloggerBodyMarkup(html);
  if(r.error){ return { error: r.error }; }
  var t = String(title || '').trim() || r.title || 'My Blog';
  t = t.replace(/[<>&"']/g, '');
  var css = (r.css || '').replace(/\]\]>/g, ']] >');
  var headLines = [
    '  <meta charset="UTF-8"/>',
    '  <meta content="width=device-width, initial-scale=1" name="viewport"/>',
    "  <b:include data='blog' name='all-head-content'/>",
    '  <title>' + t + '</title>'
  ];
  (r.links || []).forEach(function(h){
    headLines.push('  <link href="' + h.replace(/"/g, '&quot;') + '" rel="stylesheet"/>');
  });
  headLines.push('  <b:skin><![CDATA[');
  headLines.push(css || '  /* CSS yahan likhiye */');
  headLines.push('  ]]></b:skin>');

  // body wala <style> XML mein safe rahe, isliye & aur < ko CSS escape mein badlo
  var cssXmlSafe = css.replace(/&/g, '\\26 ').replace(/</g, '\\3C ');
  var styleBlock = cssXmlSafe ? ['  <style>', cssXmlSafe, '  </style>'] : [];
  var lines = [
    "<?xml version='1.0' encoding='UTF-8' ?>",
    "<!DOCTYPE html>",
    "<html b:css='false' b:defaultwidgetversion='2' b:layoutsVersion='3' b:responsive='true'",
    "      expr:dir='data:blog.languageDirection'",
    "      xmlns='http://www.w3.org/1999/xhtml'",
    "      xmlns:b='http://www.google.com/2005/gml/b'",
    "      xmlns:data='http://www.google.com/2005/gml/data'",
    "      xmlns:expr='http://www.google.com/2005/gml/expr'>",
    "<head>"
  ].concat(headLines).concat([
    "</head>",
    "<body>",
    "  \x3C!-- CSS yahan bhi hai, taaki file browser mein kholne par bhi design dikhe -->"
  ].concat(styleBlock).concat([
    "  \x3C!-- aapka content -->",
    r.markup,
    "",
    "  \x3C!-- Blogger widgets ke liye khaali jagah -->",
    "  <b:section id='main' showaddelement='yes'/>",
    "</body>",
    "</html>"
  ]));
  return { xml: lines.join('\n'), cssLen: css.length, title: t };
}

function bloggerToHtml(src){
  if(typeof DOMParser === 'undefined'){ return { error: 'Browser mein parser nahi hai.' }; }
  var text = String(src);
  var datas = 0;

  // 1. b:skin ka CSS seedha <style> mein daal do
  text = text.replace(/<b:skin[^>]*>([\s\S]*?)<\/b:skin>/gi, function(m, inner){
    var css = inner.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
    return '<style>' + '\n' + css + '\n</style>';
  });

  // 2. Blogger ke include/placeholder tags hata do
  text = text.replace(/<b:include[^>]*\/?>/gi, '');
  text = text.replace(/<data:[^>]*?\/?>/gi, function(){ datas++; return ''; });

  // 3. XML declaration aur doctype hata do
  text = text.replace(/<\?xml[\s\S]*?\?>/gi, '').replace(/<!DOCTYPE[^>]*>/gi, '');

  var doc;
  try{ doc = new DOMParser().parseFromString(text, 'text/html'); }
  catch(e){ return { error: 'File padh nahi paaya: ' + e.message }; }

  var VOID = { area:1, base:1, br:1, col:1, embed:1, hr:1, img:1, input:1,
               link:1, meta:1, param:1, source:1, track:1, wbr:1 };
  var out = [], removed = 0;
  function esc(t){ return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escA(t){ return esc(t).replace(/"/g, '&quot;'); }
  function pad(d){ return new Array(d + 1).join('  '); }
  function walk(node, depth){
    if(node.nodeType === 1){
      var tag = (node.tagName || '').toLowerCase();
      if(tag.indexOf('b:') === 0){
        removed++;
        for(var k = 0; k < node.childNodes.length; k++){ walk(node.childNodes[k], depth); }
        return;
      }
      var attrs = '';
      for(var i = 0; i < node.attributes.length; i++){
        var a = node.attributes[i];
        var nm = a.name.toLowerCase();
        if(nm.indexOf('b:') === 0 || nm.indexOf('expr:') === 0 || nm.indexOf('xmlns') === 0){ continue; }
        attrs += ' ' + a.name + '="' + escA(a.value) + '"';
      }
      if(VOID[tag]){ out.push(pad(depth) + '<' + tag + attrs + '>'); return; }
      if(tag === 'style' || tag === 'script'){
        var inner = node.textContent || '';
        out.push(pad(depth) + '<' + tag + attrs + '>' + '\n' + inner.trim() + '\n' + pad(depth) + '</' + tag + '>');
        return;
      }
      var kids = [];
      for(var j = 0; j < node.childNodes.length; j++){
        var n2 = node.childNodes[j];
        if(n2.nodeType === 1 || n2.nodeType === 8 || (n2.nodeType === 3 && n2.nodeValue.trim() !== '')){ kids.push(n2); }
      }
      if(!kids.length){ out.push(pad(depth) + '<' + tag + attrs + '></' + tag + '>'); return; }
      if(kids.length === 1 && kids[0].nodeType === 3){
        out.push(pad(depth) + '<' + tag + attrs + '>' + esc(kids[0].nodeValue.trim()) + '</' + tag + '>');
        return;
      }
      out.push(pad(depth) + '<' + tag + attrs + '>');
      kids.forEach(function(kid){ walk(kid, depth + 1); });
      out.push(pad(depth) + '</' + tag + '>');
      return;
    }
    if(node.nodeType === 8){ out.push(pad(depth) + '<' + '!--' + node.nodeValue + '--' + '>'); return; }
    if(node.nodeType === 3){
      var t = node.nodeValue.trim();
      if(t){ out.push(pad(depth) + esc(t)); }
    }
  }
  var root = doc.documentElement;
  if(!root){ return { error: 'Kuch padh nahi paaya.' }; }
  walk(root, 0);
  if(!out.length){ return { error: 'HTML nahi bana — file khaali ya kharab lagti hai.' }; }
  return { html: '<!DOCTYPE html>' + '\n' + out.join('\n'), removed: removed, datas: datas };
}

/* ===== script ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

// @ts-nocheck

/* ================= UI ================= */
function closeAllGroups(){
  document.querySelectorAll('.grp-list').forEach(function(l){ l.classList.remove('open'); });
  document.querySelectorAll('.grp-btn').forEach(function(b){ b.classList.remove('open'); });
}

function burgerClick(){
  var aside = document.querySelector('aside');
  var burger = document.getElementById('burgerBtn');
  if(!aside){ return; }
  var closed = aside.classList.toggle('menu-closed');
  if(burger){ burger.classList.toggle('on', !closed); }
  /* menu band karte waqt andar ke khule group bhi band ho jaayein */
  if(closed){
    document.querySelectorAll('.grp-list.open').forEach(function(l){ l.classList.remove('open'); });
    document.querySelectorAll('.grp-btn.open').forEach(function(b){ b.classList.remove('open'); });
  }
}

function toggleAllGroups(){
  var lists = document.querySelectorAll('.grp-list');
  var btns = document.querySelectorAll('.grp-btn');
  var anyClosed = false;
  lists.forEach(function(l){ if(!l.classList.contains('open')){ anyClosed = true; } });
  lists.forEach(function(l){
    if(anyClosed){ l.classList.add('open'); } else { l.classList.remove('open'); }
  });
  btns.forEach(function(b){
    if(anyClosed){ b.classList.add('open'); } else { b.classList.remove('open'); }
  });
  var burger = document.getElementById('burgerBtn');
  if(burger){ burger.classList.toggle('on', anyClosed); }
}

function toggleGroup(id, btn){
  var list = document.getElementById('g-' + id);
  if(!list){ return; }
  var wasOpen = list.classList.contains('open');
  closeAllGroups();               // ek waqt mein sirf ek group khula
  if(!wasOpen){
    list.classList.add('open');
    btn.classList.add('open');
  }
}

function openGroup(id){
  var list = document.getElementById('g-' + id);
  var btn = document.querySelector('.grp-btn[data-g="' + id + '"]');
  closeAllGroups();
  if(list){ list.classList.add('open'); }
  if(btn){ btn.classList.add('open'); }
}

function openTool(id, btn){
  /* user ne tool chuna — search band ho jaaye */
  if(!window.__searchAuto){
    var si = document.getElementById('toolSearch');
    if(si && si.value){
      si.value = '';
      var scb = document.getElementById('searchClear');
      if(scb){ scb.style.display = 'none'; }
      if(window.runToolSearch){ window.runToolSearch(); }
    }
  }
  document.querySelectorAll('.tool').forEach(function(s){ s.classList.remove('active'); });
  var el = document.getElementById('t-' + id);
  if(el){ el.classList.add('active'); }
  document.querySelectorAll('.nav').forEach(function(n){ n.classList.remove('active'); });
  if(btn){ btn.classList.add('active'); }
  /* mobile par tool chunne ke baad menu band ho jaaye */
  if(window.innerWidth <= 760){
    var asideEl = document.querySelector('aside');
    if(asideEl){ asideEl.classList.add('menu-closed'); }
    var bg = document.getElementById('burgerBtn');
    if(bg){ bg.classList.remove('on'); }
  }
  window.scrollTo(0, 0);
}

function $(id){ return document.getElementById(id); }
function val(id){ var e = $(id); return e ? e.value : ''; }
function setVal(id, v){ var e = $(id); if(e){ e.value = v; } }
function setStatus(id, msg, cls){
  var e = $(id);
  if(!e){ return; }
  e.textContent = msg;
  e.className = 'status ' + (cls || '');
}
function clearIn(){
  for(var i = 0; i < arguments.length; i++){
    var e = $(arguments[i]);
    if(!e){ continue; }
    if(e.className && e.className.indexOf('status') !== -1){ e.textContent = ''; e.className = 'status'; }
    else { e.value = ''; }
  }
}
function copyOut(id){
  var e = $(id);
  if(!e || !e.value){ return; }
  e.select();
  document.execCommand('copy');
  if(window.getSelection){ window.getSelection().removeAllRanges(); }
}
function mimeFor(name){
  var m = String(name).match(/\.([a-z0-9]+)$/i);
  var e = m ? m[1].toLowerCase() : 'txt';
  if(e === 'xml'){ return 'application/xml'; }
  if(e === 'json'){ return 'application/json'; }
  if(e === 'csv'){ return 'text/csv'; }
  if(e === 'html'){ return 'text/html'; }
  if(e === 'yaml' || e === 'yml'){ return 'text/yaml'; }
  if(e === 'sql'){ return 'application/sql'; }
  return 'text/plain';
}

function openOut(id, filename){
  var e = $(id);
  if(!e || !e.value.trim()){ statusNear(e, 'Output khaali hai — pehle convert kijiye.', 'info'); return; }
  try{
    var blob = new Blob([e.value], { type: mimeFor(filename || 'file.txt') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var w = window.open(url, '_blank');
    if(!w){ statusNear(e, 'Browser ne naya tab roka — popup allow kijiye, ya Copy karke Notepad mein save kariye.', 'bad'); return; }
    statusNear(e, 'Naye tab mein khul gaya — wahan Ctrl+S dabakar ' + (filename || 'file') + ' naam se save kar lijiye.', 'ok');
  }catch(err){ statusNear(e, 'Nahi khul paaya: ' + err.message, 'bad'); }
}

function statusNear(el, msg, cls){
  var sec = (el && el.closest) ? el.closest('.tool') : null;
  if(!sec){ return; }
  var st = sec.querySelector('.status');
  if(st){ st.textContent = msg; st.className = 'status ' + (cls || ''); }
}

function downloadOut(id, filename){
  var e = $(id);
  if(!e){ return; }

  // output khaali ho to pehle khud convert kar lo
  if(!e.value || !e.value.trim()){
    var auto = {
      hxOut: function(){ doHtmlXml(); },
      y2Out: function(){ doYaml2(); },
      xmlOut: function(){ doXml(); },
      mdOut: function(){ doMd(); },
      ctOut: function(){ doCsvTable(); },
      jsonOut: function(){ jsonFormat(); },
      csvOut: function(){ csvToJson(); }
    };
    if(auto[id]){ try{ auto[id](); }catch(err){} }
  }

  if(!e.value || !e.value.trim()){
    statusNear(e, 'Output khaali hai — pehle "Create XML" dabaiye, phir Download kijiye.', 'info');
    return;
  }

  try{
    var blob = new Blob([e.value], { type: mimeFor(filename) + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    statusNear(e, filename + ' download shuru — agar file na dikhe to browser ke Downloads folder mein dekhiye.', 'ok');
  }catch(err){
    statusNear(e, 'Download nahi ho paaya: ' + err.message, 'bad');
  }
}

/* drag & drop */
document.querySelectorAll('textarea[data-drop]').forEach(function(ta){
  ta.addEventListener('dragover', function(e){ e.preventDefault(); ta.classList.add('drop'); });
  ta.addEventListener('dragleave', function(){ ta.classList.remove('drop'); });
  ta.addEventListener('drop', function(e){
    e.preventDefault();
    ta.classList.remove('drop');
    var f = e.dataTransfer.files && e.dataTransfer.files[0];
    if(!f){ return; }
    var r = new FileReader();
    r.onload = function(){ ta.value = r.result; };
    r.readAsText(f);
  });
});

/* ---- JSON ---- */
function readJSON(taId, statusId){
  var raw = val(taId).trim();
  if(!raw){ setStatus(statusId, 'Pehle JSON paste kijiye.', 'info'); return null; }
  var c = cleanJSON(raw);
  var note = c.notes.length ? 'Auto-fix: ' + c.notes.join(', ') + '. ' : '';
  try{ return { obj: JSON.parse(c.text), note: note }; }
  catch(e){
    var msg = '';
    try{ JSON.parse(raw); }catch(e2){ msg = describeError(raw, e2); }
    setStatus(statusId, note + 'Invalid JSON.\n\n' + msg, 'bad');
    return null;
  }
}
function jsonFormat(){
  var r = readJSON('jsonIn', 'jsonStatus'); if(!r){ return; }
  setVal('jsonOut', JSON.stringify(r.obj, null, 2));
  setStatus('jsonStatus', r.note + 'Valid JSON — formatted.', 'ok');
}
function jsonMinify(){
  var r = readJSON('jsonIn', 'jsonStatus'); if(!r){ return; }
  setVal('jsonOut', JSON.stringify(r.obj));
  setStatus('jsonStatus', r.note + 'Minified.', 'ok');
}
function jsonValidate(){
  var r = readJSON('jsonIn', 'jsonStatus'); if(!r){ return; }
  var t = Array.isArray(r.obj) ? 'array' : typeof r.obj;
  var n = Array.isArray(r.obj) ? r.obj.length : (t === 'object' ? Object.keys(r.obj).length : 0);
  setStatus('jsonStatus', r.note + 'Valid JSON. Root: ' + t + ', size: ' + n, 'ok');
}
function jsonSort(){
  var r = readJSON('jsonIn', 'jsonStatus'); if(!r){ return; }
  setVal('jsonOut', JSON.stringify(sortKeys(r.obj), null, 2));
  setStatus('jsonStatus', r.note + 'Keys A-Z sort ho gayi.', 'ok');
}
function jsonQuery(){
  var r = readJSON('jsonIn', 'jsonStatus'); if(!r){ return; }
  var res = queryPath(r.obj, val('jsonPath'));
  if(!res.ok){ setStatus('jsonStatus', res.error, 'bad'); return; }
  setVal('jsonOut', (typeof res.value === 'object') ? JSON.stringify(res.value, null, 2) : String(res.value));
  setStatus('jsonStatus', 'Mil gaya: ' + (val('jsonPath') || '(root)'), 'ok');
}

/* ---- compare ---- */
function jsonCompare(){
  var a = readJSON('cmpA', 'cmpStatus'); if(!a){ return; }
  var b = readJSON('cmpB', 'cmpStatus'); if(!b){ return; }
  var d = diffJSON(a.obj, b.obj);
  if(!d.length){ setVal('cmpOut', 'Dono JSON bilkul same hain.'); setStatus('cmpStatus', 'Koi difference nahi.', 'ok'); return; }
  setVal('cmpOut', d.join('\n'));
  var add = d.filter(function(l){ return l.charAt(0) === '+'; }).length;
  var del = d.filter(function(l){ return l.charAt(0) === '-'; }).length;
  var chg = d.filter(function(l){ return l.charAt(0) === '~'; }).length;
  setStatus('cmpStatus', d.length + ' difference — ' + chg + ' badle, ' + add + ' naye, ' + del + ' hate.', 'info');
}

/* ---- csv ---- */
function csvToJson(){
  var raw = val('csvIn');
  if(!raw.trim()){ setStatus('csvStatus', 'Pehle CSV daaliye.', 'info'); return; }
  var data = csvToArray(raw, $('hasHeader').checked);
  if(!data.length){ setStatus('csvStatus', 'CSV padh nahi paaya.', 'bad'); return; }
  setVal('csvOut', JSON.stringify(data, null, 2));
  setStatus('csvStatus', 'CSV se JSON: ' + data.length + ' rows.', 'ok');
}
function jsonToCsv(){
  var r = readJSON('jsonForCsv', 'csvStatus'); if(!r){ return; }
  if(!Array.isArray(r.obj)){ setStatus('csvStatus', 'JSON array hona chahiye.', 'bad'); return; }
  setVal('csvOut', arrayToCsv(r.obj));
  setStatus('csvStatus', 'JSON se CSV: ' + r.obj.length + ' rows.', 'ok');
}

/* ---- json -> ts ---- */
function jsonToTs(){
  var r = readJSON('tsIn', 'tsStatus'); if(!r){ return; }
  var out = jsonToTS(r.obj, val('tsName') || 'Root');
  setVal('tsOut', out);
  var count = (out.match(/export interface/g) || []).length;
  setStatus('tsStatus', count + ' interface bane.', 'ok');
}

/* ---- mock ---- */
function makeMock(){
  var n = parseInt(val('mockCount'), 10) || 5;
  n = Math.max(1, Math.min(200, n));
  var data = mockRecords(n);
  setVal('mockOut', JSON.stringify(data, null, 2));
  setStatus('mockStatus', n + ' records bane.', 'ok');
}

/* ---- case ---- */
function doCase(kind){
  var t = val('caseIn');
  if(!t){ setStatus('caseStatus', 'Pehle text daaliye.', 'info'); return; }
  var out;
  if(kind === 'upper'){ out = t.toUpperCase(); }
  else if(kind === 'lower'){ out = t.toLowerCase(); }
  else if(kind === 'title'){ out = toTitle(t); }
  else if(kind === 'sentence'){ out = toSentence(t); }
  else if(kind === 'camel'){ out = toCamel(t); }
  else if(kind === 'pascal'){ out = toPascal(t); }
  else if(kind === 'snake'){ out = toSnake(t); }
  else if(kind === 'kebab'){ out = toKebab(t); }
  else { out = toConstant(t); }
  setVal('caseOut', out);
  setStatus('caseStatus', out.length + ' characters.', 'ok');
}

/* ---- lines ---- */
function doLines(op){
  var t = val('linesIn');
  if(!t){ setStatus('linesStatus', 'Pehle lines daaliye.', 'info'); return; }
  var out;
  if(op === 'sort'){ out = sortLines(t, false); }
  else if(op === 'sortdesc'){ out = sortLines(t, true); }
  else if(op === 'reverse'){ out = reverseLines(t); }
  else if(op === 'dedupe'){ out = dedupeLines(t); }
  else if(op === 'empty'){ out = dropEmptyLines(t); }
  else if(op === 'number'){ out = numberLines(t); }
  else if(op === 'shuffle'){ out = shuffleLines(t); }
  else { out = trimLines(t); }
  setVal('linesOut', out);
  setStatus('linesStatus', out.split('\n').length + ' lines.', 'ok');
}

/* ---- replace ---- */
function doReplace(){
  var t = val('repIn');
  var find = val('repFind');
  var withText = val('repWith');
  if(!t){ setStatus('repStatus', 'Pehle text daaliye.', 'info'); return; }
  if(!find){ setStatus('repStatus', 'Dhoondhne wala word daaliye.', 'info'); return; }
  if($('repRegex').checked){
    var re;
    try{ re = new RegExp(find, 'g'); }
    catch(e){ setStatus('repStatus', 'Regex galat hai: ' + e.message, 'bad'); return; }
    var count = (t.match(re) || []).length;
    setVal('repOut', t.replace(re, withText));
    setStatus('repStatus', count + ' match replace hue (regex).', count ? 'ok' : 'info');
  } else {
    var c = t.split(find).length - 1;
    setVal('repOut', replacePlain(t, find, withText));
    setStatus('repStatus', c + ' jagah replace hua.', c ? 'ok' : 'info');
  }
}

/* ---- regex ---- */
function doRegex(){
  var t = val('rxIn');
  var p = val('rxPattern');
  if(!p){ setStatus('rxStatus', 'Pattern daaliye.', 'info'); return; }
  var r = regexRun(t, p, val('rxFlags') || 'g');
  if(r.error){ setStatus('rxStatus', r.error, 'bad'); return; }
  if(!r.hits.length){ setVal('rxOut', ''); setStatus('rxStatus', 'Koi match nahi mila.', 'info'); return; }
  var lines = r.hits.map(function(h, i){
    var s = (i + 1) + '. "' + h.match + '"  (index ' + h.index + ')';
    if(h.groups.length){ s += '\n   groups: ' + h.groups.map(function(g, gi){ return '[' + (gi + 1) + '] ' + g; }).join(', '); }
    return s;
  });
  setVal('rxOut', lines.join('\n'));
  setStatus('rxStatus', r.hits.length + ' match mile.', 'ok');
}

/* ---- text diff ---- */
function doTextDiff(){
  var a = val('tdA'), b = val('tdB');
  if(!a && !b){ setStatus('tdStatus', 'Dono text boxes bhariye.', 'info'); return; }
  var r = lineDiff(a, b);
  if(r.error){ setStatus('tdStatus', r.error, 'bad'); return; }
  setVal('tdOut', r.lines.join('\n'));
  setStatus('tdStatus', r.add + ' lines B mein nayi, ' + r.del + ' lines hataayi, ' + r.same + ' same.', 'info');
}

/* ---- stats ---- */
function doStats(){
  var t = val('stIn');
  if(!t){ setStatus('stStatus', 'Pehle text daaliye.', 'info'); return; }
  var s = textStats(t);
  setVal('stOut',
    'Characters       : ' + s.characters + '\n' +
    'Characters (no space): ' + s.charsNoSpace + '\n' +
    'Words            : ' + s.words + '\n' +
    'Sentences        : ' + s.sentences + '\n' +
    'Paragraphs       : ' + s.paragraphs + '\n' +
    'Lines            : ' + s.lines + '\n' +
    'Reading time     : ' + s.readingTime);
  setStatus('stStatus', 'Ho gaya.', 'ok');
}

/* ---- slug ---- */
function doSlug(){
  var t = val('slugIn');
  if(!t){ setStatus('slugStatus', 'Pehle title daaliye.', 'info'); return; }
  var s = slugify(t);
  setVal('slugOut', s);
  setStatus('slugStatus', s ? 'Slug ban gaya.' : 'Is title se slug nahi bana.', s ? 'ok' : 'info');
}

/* ---- lorem ---- */
function doLorem(){
  var p = Math.max(1, Math.min(20, parseInt(val('loremPara'), 10) || 1));
  var s = Math.max(1, Math.min(12, parseInt(val('loremSent'), 10) || 4));
  setVal('loremOut', loremText(p, s));
}

/* ---- base64 ---- */
function doB64(mode){
  var t = val('b64In');
  if(!t){ setStatus('b64Status', 'Pehle text daaliye.', 'info'); return; }
  try{
    setVal('b64Out', mode === 'enc' ? b64encode(t) : b64decode(t));
    setStatus('b64Status', mode === 'enc' ? 'Encode ho gaya.' : 'Decode ho gaya.', 'ok');
  }catch(e){ setStatus('b64Status', 'Base64 galat hai: ' + e.message, 'bad'); }
}

/* ---- html ---- */
function doHtml(mode){
  var t = val('htmlIn');
  if(!t){ setStatus('htmlStatus', 'Pehle text daaliye.', 'info'); return; }
  setVal('htmlOut', mode === 'esc' ? htmlEscape(t) : htmlUnescape(t));
  setStatus('htmlStatus', mode === 'esc' ? 'Escape ho gaya.' : 'Unescape ho gaya.', 'ok');
}

/* ---- file -> base64 ---- */
function filePicked(){
  var f = $('filePick').files[0];
  if(!f){ return; }
  if(f.size > 5 * 1024 * 1024){
    setStatus('fileStatus', 'File 5 MB se badi hai — browser dheema ho sakta hai, phir bhi try kar raha hoon.', 'info');
  }
  var r = new FileReader();
  r.onload = function(){
    setVal('fileOut', r.result);
    setStatus('fileStatus', f.name + ' (' + Math.round(f.size / 1024) + ' KB) ka base64 taiyaar.', 'ok');
  };
  r.onerror = function(){ setStatus('fileStatus', 'File padh nahi paaya.', 'bad'); };
  r.readAsDataURL(f);
}

/* ---- jwt ---- */
function doJwt(){
  var t = val('jwtIn');
  if(!t.trim()){ setStatus('jwtStatus', 'Token paste kijiye.', 'info'); return; }
  var r = decodeJwt(t);
  if(r.error){ setStatus('jwtStatus', r.error, 'bad'); return; }
  setVal('jwtOut', 'HEADER\n' + JSON.stringify(r.header, null, 2) + '\n\nPAYLOAD\n' + JSON.stringify(r.payload, null, 2));
  setStatus('jwtStatus', r.notes.join('\n'), 'ok');
}

/* ---- url ---- */
function doUrl(){
  var t = val('urlIn');
  if(!t.trim()){ setStatus('urlStatus', 'URL daaliye.', 'info'); return; }
  var r = parseUrlParts(t);
  if(r.error){ setStatus('urlStatus', r.error, 'bad'); return; }
  var lines = [
    'Protocol : ' + r.protocol,
    'Host     : ' + r.host,
    'Hostname : ' + r.hostname,
    'Port     : ' + r.port,
    'Path     : ' + r.path,
    'Hash     : ' + r.hash,
    '',
    'Query parameters (' + r.params.length + '):'
  ];
  r.params.forEach(function(p){ lines.push('  ' + p.key + ' = ' + p.value); });
  setVal('urlOut', lines.join('\n'));
  setStatus('urlStatus', r.params.length + ' parameters mile.', 'ok');
}

/* ---- hash ---- */
function doHash(algo){
  var t = val('hashIn');
  if(!t){ setStatus('hashStatus', 'Pehle text daaliye.', 'info'); return; }
  if(!(window.crypto && crypto.subtle)){ setStatus('hashStatus', 'Is browser mein hash support nahi hai.', 'bad'); return; }
  crypto.subtle.digest(algo, new TextEncoder().encode(t)).then(function(buf){
    var hex = Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2, '0'); }).join('');
    setVal('hashOut', hex);
    setStatus('hashStatus', algo + ' hash bana (' + hex.length + ' hex chars).', 'ok');
  }).catch(function(e){ setStatus('hashStatus', 'Hash nahi bana: ' + e.message, 'bad'); });
}

/* ---- uuid ---- */
function doUuid(){
  var n = Math.max(1, Math.min(100, parseInt(val('uuidCount'), 10) || 1));
  var out = [];
  for(var i = 0; i < n; i++){ out.push(makeUuid()); }
  setVal('uuidOut', out.join('\n'));
  setStatus('uuidStatus', n + ' UUID bane.', 'ok');
}

/* ---- time ---- */
function doTime(kind){
  var t = val('timeIn');
  if(kind === 'now'){
    var now = Date.now();
    setVal('timeOut', tsToDate(String(Math.floor(now / 1000))).text);
    setStatus('timeStatus', 'Now ka time.', 'ok');
    return;
  }
  if(!t.trim()){ setStatus('timeStatus', 'Value daaliye.', 'info'); return; }
  var r = (kind === 'ts2date') ? tsToDate(t) : dateToTs(t);
  if(r.error){ setStatus('timeStatus', r.error, 'bad'); return; }
  setVal('timeOut', r.text);
  setStatus('timeStatus', 'Ho gaya.', 'ok');
}

/* ---- colour ---- */
function doColor(){
  var t = val('colorIn');
  var p = parseColor(t);
  if(!p){ setStatus('colorStatus', 'Format samajh nahi aaya. #3fb950 ya rgb(63,185,80) ya hsl(128,49%,49%) daaliye.', 'bad'); return; }
  var f = colorFormats(p.rgb);
  setVal('colorOut',
    'HEX : ' + f.hex + '\n' +
    'RGB : ' + f.rgb + '\n' +
    'HSL : ' + f.hsl + '\n\n' +
    'Luminance          : ' + f.luminance + '\n' +
    'Contrast vs white  : ' + f.contrastWithWhite + ':1\n' +
    'Contrast vs black  : ' + f.contrastWithBlack + ':1\n' +
    '(WCAG AA text ke liye 4.5:1 chahiye)');
  var sw = $('colorSwatch');
  if(sw){ sw.style.background = f.hex; }
  setStatus('colorStatus', 'Convert ho gaya.', 'ok');
}

/* ---- base ---- */
function doBase(){
  var t = val('baseIn');
  if(!t.trim()){ setStatus('baseStatus', 'Number daaliye.', 'info'); return; }
  var r = baseAll(t, parseInt(val('baseFrom'), 10));
  if(r.error){ setStatus('baseStatus', r.error, 'bad'); return; }
  setVal('baseOut', r.text);
  setStatus('baseStatus', 'Ho gaya.', 'ok');
}

/* ---- emi ---- */
function doEmi(){
  var r = emiCalc(val('emiP'), val('emiR'), val('emiN'));
  if(r.error){ setStatus('emiStatus', r.error, 'bad'); return; }
  setVal('emiOut', r.text);
  setStatus('emiStatus', 'EMI ₹' + inr(r.emi) + ' per month.', 'ok');
}

/* ---- gst ---- */
function doGst(){
  var r = gstCalc(val('gstAmount'), val('gstRate'), val('gstMode'));
  if(r.error){ setStatus('gstStatus', r.error, 'bad'); return; }
  setVal('gstOut', r.text);
  setStatus('gstStatus', 'Ho gaya.', 'ok');
}

/* ---- percent ---- */
function doPercent(){
  if(!val('pcA').trim() || !val('pcB').trim()){ setStatus('pcStatus', 'Dono numbers daaliye.', 'info'); return; }
  var r = percentCalc(val('pcA'), val('pcB'));
  if(r.error){ setStatus('pcStatus', r.error, 'bad'); return; }
  setVal('pcOut', r.text);
  setStatus('pcStatus', 'Ho gaya.', 'ok');
}

/* ---- unit ---- */
var UNIT_LIST = {
  length: ['m', 'km', 'cm', 'mm', 'mi', 'yd', 'ft', 'in'],
  weight: ['kg', 'g', 'mg', 't', 'lb', 'oz'],
  temp: ['C', 'F', 'K'],
  data: ['B', 'KB', 'MB', 'GB', 'TB']
};
function fillUnits(){
  var cat = val('unitCat');
  var list = UNIT_LIST[cat] || [];
  ['unitFrom', 'unitTo'].forEach(function(id, idx){
    var sel = $(id);
    if(!sel){ return; }
    sel.innerHTML = '';
    list.forEach(function(u, i){
      var o = document.createElement('option');
      o.value = u; o.textContent = u;
      if(idx === 1 && i === 1){ o.selected = true; }
      sel.appendChild(o);
    });
  });
}
function doUnit(){
  var r = unitConvert(val('unitCat'), val('unitVal'), val('unitFrom'), val('unitTo'));
  if(r.error){ setStatus('unitStatus', r.error, 'bad'); return; }
  setVal('unitOut', r.text);
  setStatus('unitStatus', 'Ho gaya.', 'ok');
}

/* ---- password ---- */
function doPassword(){
  var len = Math.max(6, Math.min(128, parseInt(val('pwLen'), 10) || 16));
  var r = makePassword(len, {
    upper: $('pwUpper').checked,
    lower: $('pwLower').checked,
    digit: $('pwDigit').checked,
    symbol: $('pwSymbol').checked
  });
  if(r.error){ setStatus('pwStatus', r.error, 'bad'); return; }
  setVal('pwOut', r.password);
  var strength = len >= 16 ? 'mazboot' : (len >= 12 ? 'theek' : 'kamzor');
  setStatus('pwStatus', len + ' characters — ' + strength + '.', 'ok');
}


/* ---- markdown ---- */
function doMd(){
  var src = val('mdIn');
  if(!src){ setStatus('mdStatus', 'Pehle markdown likhiye.', 'info'); return; }
  var html = mdToHtml(src);
  setVal('mdOut', html);
  var prev = $('mdPreview');
  if(prev){ prev.innerHTML = html; }
  setStatus('mdStatus', html.length + ' characters ka HTML bana.', 'ok');
}

/* ---- yaml ---- */
function doYaml(){
  var r = readJSON('yamlIn', 'yamlStatus'); if(!r){ return; }
  setVal('yamlOut', jsonToYaml(r.obj));
  setStatus('yamlStatus', r.note + 'YAML taiyaar.', 'ok');
}

/* ---- sql ---- */
function doSql(){
  var r = readJSON('sqlIn', 'sqlStatus'); if(!r){ return; }
  var out = jsonToSql(r.obj, val('sqlTable'));
  if(out.error){ setStatus('sqlStatus', out.error, 'bad'); return; }
  setVal('sqlOut', out.sql);
  setStatus('sqlStatus', out.count + ' INSERT statements bane.', 'ok');
}

/* ---- image ---- */
var _imgEl = null, _imgBlob = null, _imgName = 'resized.jpg';
function doResize(){
  var f = $('imgPick').files[0];
  if(!f){ setStatus('imgStatus', 'Pehle image chuniye.', 'info'); return; }
  var maxW = parseInt(val('imgMax'), 10) || 800;
  var q = parseInt(val('imgQuality'), 10) || 80;
  var reader = new FileReader();
  reader.onload = function(){
    var img = new Image();
    img.onload = function(){
      var scale = Math.min(1, maxW / img.width);
      var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      var prev = $('imgPrev');
      if(prev){ prev.src = cv.toDataURL('image/jpeg', q / 100); prev.style.display = 'block'; }
      cv.toBlob(function(blob){
        _imgBlob = blob;
        var kb = Math.round(blob.size / 1024);
        _imgName = (f.name || 'image').replace(/\.[^.]+$/, '') + '-resized.jpg';
        setStatus('imgStatus', 'Naya size: ' + w + '×' + h + ' px, weight: ' + kb + ' KB (pehle ' +
          Math.round(f.size / 1024) + ' KB). Download dabaiye.', 'ok');
      }, 'image/jpeg', q / 100);
    };
    img.onerror = function(){ setStatus('imgStatus', 'Image padh nahi paaya.', 'bad'); };
    img.src = reader.result;
  };
  reader.readAsDataURL(f);
}
function downloadImage(){
  if(!_imgBlob){ setStatus('imgStatus', 'Pehle Resize dabaiye.', 'info'); return; }
  var a = document.createElement('a');
  a.href = URL.createObjectURL(_imgBlob);
  a.download = _imgName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
}

/* ---- file hash ---- */
function fileHashPicked(){
  var f = $('fhPick').files[0];
  if(!f){ return; }
  if(!(window.crypto && crypto.subtle)){ setStatus('fhStatus', 'Is browser mein hash support nahi hai.', 'bad'); return; }
  setStatus('fhStatus', 'Padh raha hoon: ' + f.name + ' (' + Math.round(f.size / 1024) + ' KB)...', 'info');
  var reader = new FileReader();
  reader.onload = function(){
    crypto.subtle.digest('SHA-256', reader.result).then(function(buf){
      var hex = Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2, '0'); }).join('');
      setVal('fhOut', hex);
      setStatus('fhStatus', f.name + ' ka SHA-256 taiyaar.', 'ok');
    }).catch(function(e){ setStatus('fhStatus', 'Hash nahi bana: ' + e.message, 'bad'); });
  };
  reader.onerror = function(){ setStatus('fhStatus', 'File padh nahi paaya.', 'bad'); };
  reader.readAsArrayBuffer(f);
}

/* ---- cron ---- */
function doCron(){
  var r = cronExplain(val('cronIn'));
  if(r.error){ setStatus('cronStatus', r.error, 'bad'); return; }
  var lines = ['Matlab: ' + r.desc, '', 'Agle 5 run:'];
  r.next.forEach(function(d){
    var ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
    lines.push('  ' + ist.toISOString().replace('T', ' ').slice(0, 16) + ' IST');
  });
  setVal('cronOut', lines.join('\n'));
  setStatus('cronStatus', r.next.length ? 'Samajh gaya.' : 'Agla run nahi mila.', r.next.length ? 'ok' : 'info');
}

/* ---- tts ---- */
function doTts(){
  var t = val('ttsIn');
  if(!t){ setStatus('ttsStatus', 'Pehle text likhiye.', 'info'); return; }
  if(!(window.speechSynthesis)){ setStatus('ttsStatus', 'Is browser mein speech support nahi hai.', 'bad'); return; }
  speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(t);
  u.rate = (parseInt(val('ttsRate'), 10) || 100) / 100;
  u.onend = function(){ setStatus('ttsStatus', 'Padh liya.', 'ok'); };
  u.onerror = function(e){ setStatus('ttsStatus', 'Awaaz nahi nikli: ' + (e.error || 'error'), 'bad'); };
  speechSynthesis.speak(u);
  setStatus('ttsStatus', 'Bol raha hoon...', 'info');
}
function stopTts(){
  if(window.speechSynthesis){ speechSynthesis.cancel(); }
  setStatus('ttsStatus', 'Ruk gaya.', 'info');
}

/* ---- notes ---- */
function saveNotes(){
  var ok = notesSave(window.localStorage, val('notesIn'));
  setStatus('notesStatus', ok ? 'Save ho gaya (' + new Date().toLocaleTimeString() + ').' : 'Save nahi ho paaya.', ok ? 'ok' : 'bad');
}
function clearNotes(){
  setVal('notesIn', '');
  notesSave(window.localStorage, '');
  setStatus('notesStatus', 'Mita diya.', 'info');
}
function loadNotes(){
  var t = notesLoad(window.localStorage);
  if(t){ setVal('notesIn', t); }
}

/* ---- theme ---- */
function applyTheme(light){
  document.body.classList.toggle('light', light);
  var ico = $('themeIco');
  if(ico){ ico.innerHTML = light ? '&#9728;' : '&#9790;'; }
  var lbl = $('themeLbl');
  if(lbl){ lbl.textContent = light ? 'Light mode' : 'Dark mode'; }
  var b = $('themeBtn');
  if(b){ b.title = light ? 'Switch to dark' : 'Switch to light'; }
  try{ window.localStorage.setItem('dt-theme', light ? 'light' : 'dark'); }catch(e){}
  /* search box ka rang pakka karo — CSS order ki wajah se override ho raha tha */
  var srch = $('toolSearch');
  if(srch){
    if(light){
      srch.style.setProperty('background', '#ffffff', 'important');
      srch.style.setProperty('color', '#0f1c1a', 'important');
      srch.style.setProperty('border-color', '#d5e2df', 'important');
    } else {
      srch.style.removeProperty('background');
      srch.style.removeProperty('color');
      srch.style.removeProperty('border-color');
    }
  }
}
function toggleTheme(){
  var light = !document.body.classList.contains('light');
  applyTheme(light);
}
function loadTheme(){
  var t = '';
  try{ t = window.localStorage.getItem('dt-theme') || ''; }catch(e){}
  /* default white theme; user ne dark chuna ho to dark */
  applyTheme(t !== 'dark');
}


/* ---- sip ---- */
function doSip(){
  var r = sipCalc(val('sipAmt'), val('sipRate'), val('sipYears'));
  if(r.error){ setStatus('sipStatus', r.error, 'bad'); return; }
  setVal('sipOut', r.text);
  setStatus('sipStatus', 'Maturity ₹' + inr(r.maturity), 'ok');
}
/* ---- compound ---- */
function doCompound(){
  var r = compoundCalc(val('ciP'), val('ciR'), val('ciY'), val('ciN'));
  if(r.error){ setStatus('ciStatus', r.error, 'bad'); return; }
  setVal('ciOut', r.text);
  setStatus('ciStatus', 'Ho gaya.', 'ok');
}
/* ---- discount ---- */
function doDiscount(){
  var r = discountCalc(val('dcPrice'), val('dcPct'), val('dcGst'));
  if(r.error){ setStatus('dcStatus', r.error, 'bad'); return; }
  setVal('dcOut', r.text);
  setStatus('dcStatus', 'Ho gaya.', 'ok');
}
/* ---- html -> text ---- */
function doHtmlText(){
  var t = val('htIn');
  if(!t.trim()){ setStatus('htStatus', 'Pehle HTML daaliye.', 'info'); return; }
  var out = htmlToText(t);
  setVal('htOut', out);
  setStatus('htStatus', out.length + ' characters ka text.', 'ok');
}
/* ---- csv -> table ---- */
function doCsvTable(){
  var t = val('ctIn');
  if(!t.trim()){ setStatus('ctStatus', 'Pehle CSV daaliye.', 'info'); return; }
  var r = csvToHtmlTable(t, $('ctHeader').checked);
  if(r.error){ setStatus('ctStatus', r.error, 'bad'); return; }
  setVal('ctOut', r.html);
  setStatus('ctStatus', r.rows + ' rows ka table bana.', 'ok');
}
/* ---- words ---- */
function doWords(){
  var r = amountToWords(val('nwIn'));
  if(r.error){ setStatus('nwStatus', r.error, 'bad'); return; }
  setVal('nwOut', r.text);
  setStatus('nwStatus', 'Ho gaya.', 'ok');
}
/* ---- roman ---- */
function doRoman(){
  var t = val('rnIn').trim();
  if(!t){ setStatus('rnStatus', 'Number ya Roman daaliye.', 'info'); return; }
  var r = /^[IVXLCDMivxlcdm]+$/.test(t) ? fromRoman(t) : toRoman(t);
  if(r.error){ setStatus('rnStatus', r.error, 'bad'); return; }
  setVal('rnOut', r.text);
  setStatus('rnStatus', 'Ho gaya.', 'ok');
}
/* ---- date add ---- */
function doDateAdd(){
  var r = dateAdd(val('daDate'), val('daDays'), val('daMonths'), val('daYears'));
  if(r.error){ setStatus('daStatus', r.error, 'bad'); return; }
  setVal('daOut', r.iso + '  (' + r.weekday + ')');
  setStatus('daStatus', r.iso, 'ok');
}
/* ---- aspect ---- */
function doAspect(){
  var r = aspectCalc(val('arW'), val('arH'), val('arNew'));
  if(r.error){ setStatus('arStatus', r.error, 'bad'); return; }
  setVal('arOut', r.text);
  setStatus('arStatus', 'Ratio ' + r.ratio, 'ok');
}
/* ---- base64 image ---- */
function doB64Img(){
  var t = val('biIn').trim();
  if(!t){ setStatus('biStatus', 'Pehle base64 paste kijiye.', 'info'); return; }
  if(!/^data:image\//.test(t)){ setStatus('biStatus', 'Ye data:image/... se shuru hona chahiye.', 'bad'); return; }
  var img = $('biPrev');
  if(!img){ return; }
  img.onload = function(){
    setStatus('biStatus', 'Image mil gayi: ' + img.naturalWidth + '×' + img.naturalHeight + ' px.', 'ok');
  };
  img.onerror = function(){ setStatus('biStatus', 'Base64 kharab hai — image khuli nahi.', 'bad'); };
  img.src = t;
  img.style.display = 'block';
}


/* ---- yaml2 ---- */
function doYaml2(){
  var t = val('y2In');
  if(!t.trim()){ setStatus('y2Status', 'Pehle YAML daaliye.', 'info'); return; }
  try{
    var obj = parseYaml(t);
    setVal('y2Out', JSON.stringify(obj, null, 2));
    setStatus('y2Status', 'JSON taiyaar.', 'ok');
  }catch(e){ setStatus('y2Status', 'YAML padh nahi paaya: ' + e.message, 'bad'); }
}
/* ---- xml ---- */
function doXml(){
  var t = val('xmlIn');
  if(!t.trim()){ setStatus('xmlStatus', 'Pehle XML daaliye.', 'info'); return; }
  try{
    var obj = xmlToJson(t);
    setVal('xmlOut', JSON.stringify(obj, null, 2));
    setStatus('xmlStatus', 'JSON taiyaar.', 'ok');
  }catch(e){ setStatus('xmlStatus', 'XML padh nahi paaya: ' + e.message, 'bad'); }
}
/* ---- aes ---- */
function doAes(mode){
  var t = val('aesIn');
  var pass = val('aesPass');
  if(!t){ setStatus('aesStatus', 'Pehle text daaliye.', 'info'); return; }
  if(!pass){ setStatus('aesStatus', 'Password daaliye.', 'info'); return; }
  setStatus('aesStatus', 'Kaam chal raha hai...', 'info');
  var task = (mode === 'enc') ? aesEncrypt(t, pass) : aesDecrypt(t, pass);
  task.then(function(res){
    setVal('aesOut', res);
    setStatus('aesStatus', mode === 'enc' ? 'Encrypt ho gaya. Password sambhal kar rakhiye.' : 'Decrypt ho gaya.', 'ok');
  }).catch(function(e){
    setStatus('aesStatus', mode === 'enc' ? ('Encrypt nahi hua: ' + e.message) : ('Decrypt nahi hua — password galat ya text kharab hai.'), 'bad');
  });
}
/* ---- sets ---- */
function doSets(op){
  var a = val('setA'), b = val('setB');
  if(!a.trim() && !b.trim()){ setStatus('setsStatus', 'Pehle list daaliye.', 'info'); return; }
  var res = setOps(a, b, op);
  setVal('setsOut', res.join('\n'));
  setStatus('setsStatus', res.length + ' items.', 'ok');
}
/* ---- gradient ---- */
function doGrad(){
  var r = gradientCss(val('gradA'), val('gradB'), val('gradAngle'), val('gradType'));
  if(r.error){ setStatus('gradStatus', r.error, 'bad'); return; }
  setVal('gradOut', r.css);
  var pv = $('gradPreview');
  if(pv){ pv.style.background = r.style; }
  setStatus('gradStatus', 'CSS taiyaar.', 'ok');
}
/* ---- shadow ---- */
function doShadow(){
  var r = shadowCss(parseInt(val('shX'), 10) || 0, parseInt(val('shY'), 10) || 0,
    parseInt(val('shBlur'), 10) || 0, parseInt(val('shSpread'), 10) || 0,
    val('shColor') || 'rgba(0,0,0,0.4)', $('shInset').checked);
  setVal('shOut', r.css);
  var pv = $('shPreview');
  if(pv){ pv.style.boxShadow = r.style; }
  setStatus('shStatus', 'CSS taiyaar.', 'ok');
}
/* ---- palette ---- */
function doPalette(){
  var r = paletteFrom(val('palIn'));
  if(r.error){ setStatus('palStatus', r.error, 'bad'); return; }
  setVal('palOut', r.colors.join('\n'));
  var strip = $('palStrip');
  if(strip){
    strip.innerHTML = '';
    r.colors.forEach(function(c){
      var d = document.createElement('div');
      d.style.background = c;
      d.style.width = '52px';
      d.style.height = '52px';
      d.style.borderRadius = '8px';
      d.style.border = '1px solid rgba(255,255,255,0.12)';
      d.title = c;
      strip.appendChild(d);
    });
  }
  setStatus('palStatus', r.colors.length + ' shades bane.', 'ok');
}
/* ---- date diff ---- */
function doDateDiff(){
  var a = val('ddA').trim(), b = val('ddB').trim();
  if(!a){ setStatus('ddStatus', 'Pehli tareekh daaliye.', 'info'); return; }
  if(!b){ b = new Date().toISOString().slice(0, 10); }
  var r = dateDiffParts(a, b);
  if(r.error){ setStatus('ddStatus', r.error, 'bad'); return; }
  setVal('ddOut',
    (r.swapped ? '(tareekhein ulti thi — chhoti wali se badi tak)\n\n' : '') +
    'Years   : ' + r.years + '\n' +
    'Months  : ' + r.months + '\n' +
    'Days    : ' + r.days + '\n\n' +
    'Total days   : ' + r.totalDays + '\n' +
    'Total weeks  : ' + r.totalWeeks + '\n' +
    'Total hours  : ' + r.totalHours);
  setStatus('ddStatus', r.years + ' saal, ' + r.months + ' mahine, ' + r.days + ' din.', 'ok');
}
/* ---- tz ---- */
function doTz(mode){
  var input = val('tzIn');
  if(mode === 'now'){
    input = new Date().toISOString().slice(0, 16).replace('T', ' ');
    setVal('tzIn', input);
  }
  if(!input.trim()){ setStatus('tzStatus', 'Waqt daaliye, jaise 2026-10-28 15:30', 'info'); return; }
  var r = tzFromIst(input);
  if(r.error){ setStatus('tzStatus', r.error, 'bad'); return; }
  var lines = ['Ye waqt IST maan kar (' + input + '):', ''];
  TZ_LIST.forEach(function(z){ lines.push(z[1].padEnd(14, ' ') + ': ' + tzFormat(r.ms, z[0])); });
  setVal('tzOut', lines.join('\n'));
  setStatus('tzStatus', '8 zones ke liye convert ho gaya.', 'ok');
}
/* ---- readability ---- */
function doRead(){
  var r = readability(val('readIn'));
  if(r.error){ setStatus('readStatus', r.error, 'info'); return; }
  setVal('readOut',
    'Flesch reading ease : ' + r.flesch + ' / 100\n' +
    'Level               : ' + r.label + '\n' +
    'Grade level         : ' + r.grade + '\n\n' +
    'Words               : ' + r.words + '\n' +
    'Sentences           : ' + r.sentences + '\n' +
    'Syllables           : ' + r.syllables + '\n' +
    'Words per sentence  : ' + r.wps);
  setStatus('readStatus', 'Score: ' + r.flesch, 'ok');
}
/* ---- password strength ---- */
function doPwStrength(){
  var r = passwordStrength(val('pwcIn'));
  if(r.error){ setStatus('pwcStatus', r.error, 'info'); return; }
  setVal('pwcOut',
    'Length    : ' + r.length + '\n' +
    'Entropy   : ' + r.entropy + ' bits\n' +
    'Level     : ' + r.level + '\n' +
    'Crack time: ' + r.crack + ' (10 arab guesses/second par)\n' +
    (r.warnings.length ? '\nDhyan dijiye: ' + r.warnings.join(', ') : ''));
  setStatus('pwcStatus', r.level + ' — ' + r.entropy + ' bits', 'ok');
}
/* ---- random ---- */
function doRandom(kind){
  var res = randomOf(kind, val('rndMin'), val('rndMax'), val('rndList'));
  if(res === null){
    setStatus('rndStatus', kind === 'list' ? 'List mein kuch likhiye.' : 'Numbers sahi daaliye.', 'info');
    return;
  }
  setVal('rndOut', res);
  setStatus('rndStatus', 'Nikla: ' + res, 'ok');
}


/* ---- html -> xml ---- */
function doHtmlXml(){
  var t = val('hxIn');
  if(!t.trim()){ setStatus('hxStatus', 'Pehle Paste HTML or file upload kariye.', 'info'); return; }
  var frag = $('hxFragment') && $('hxFragment').checked;
  var r = htmlToXml(t, frag);
  if(r.error){ setStatus('hxStatus', r.error, 'bad'); return; }
  setVal('hxOut', r.xml);
  setStatus('hxStatus', r.count + ' tags ka XML bana (' + r.xml.length + ' characters).' +
    (r.autoFragment ? '\n(Paste mein <html> tag nahi tha, isliye sirf diya hua hissa liya.)' : ''), 'ok');
}
function htmlFilePicked(){
  var f = $('hxFile').files[0];
  if(!f){ return; }
  setStatus('hxStatus', 'Padh raha hoon: ' + f.name + '...', 'info');
  var reader = new FileReader();
  reader.onload = function(){
    setVal('hxIn', reader.result);
    doHtmlXml();
  };
  reader.onerror = function(){ setStatus('hxStatus', 'File padh nahi paaya.', 'bad'); };
  reader.readAsText(f);
}



/* ---- blogger ---- */
function doBlogger(mode){
  var src = val('bgIn');
  if(!src.trim()){ setStatus('bgStatus', 'Pehle code paste kijiye ya file upload kariye.', 'info'); return; }
  if(mode === 'wrap'){
    var r = bloggerWrap(src, val('bgTitle'));
    if(r.error){ setStatus('bgStatus', r.error, 'bad'); return; }
    setVal('bgOut', r.xml);
    setVal('bgName', 'template.xml');
    setStatus('bgStatus', 'Blogger template taiyaar — ' + r.xml.split('\n').length + ' lines, CSS ' + r.cssLen + ' characters (b:skin mein). Blogger → Theme → Edit HTML → poora code paste karke Save kijiye.', 'ok');
  } else {
    var h = bloggerToHtml(src);
    if(h.error){ setStatus('bgStatus', h.error, 'bad'); return; }
    setVal('bgOut', h.html);
    setVal('bgName', 'index.html');
    setStatus('bgStatus', 'Saaf HTML bana. ' + h.removed + ' b: tags hataye, ' + h.datas + ' data: placeholder chhode.', 'ok');
  }
}
function downloadBlogger(){
  if(!val('bgOut').trim()){ setStatus('bgStatus', 'Pehle upar se koi ek button dabaiye.', 'info'); return; }
  var name = (val('bgName') || 'template.xml').trim().replace(/[\\/:*?"<>|]/g, '');
  if(!/\.[a-z0-9]+$/i.test(name)){ name += '.xml'; }
  setVal('bgName', name);
  downloadOut('bgOut', name);
}
function bloggerFilePicked(){
  var f = $('bgFile').files[0];
  if(!f){ return; }
  setStatus('bgStatus', 'Padh raha hoon: ' + f.name + '...', 'info');
  var reader = new FileReader();
  reader.onload = function(){
    setVal('bgIn', reader.result);
    var isXml = /\.xml$/i.test(f.name) || /<\?xml|b:section|b:skin/i.test(reader.result.slice(0, 4000));
    doBlogger(isXml ? 'unwrap' : 'wrap');
  };
  reader.onerror = function(){ setStatus('bgStatus', 'File padh nahi paaya.', 'bad'); };
  reader.readAsText(f);
}

/* ---- init ---- */
fillUnits();
loadTheme();
loadNotes();
var _bg = $('bgFile');
if(_bg){ _bg.addEventListener('change', bloggerFilePicked); }
var _hx = $('hxFile');
if(_hx){ _hx.addEventListener('change', htmlFilePicked); }
var _dd = $('ddB');
if(_dd && !_dd.value){ _dd.value = new Date().toISOString().slice(0, 10); }
var _fp = $('filePick');
if(_fp){ _fp.addEventListener('change', filePicked); }
var _fh = $('fhPick');
if(_fh){ _fh.addEventListener('change', fileHashPicked); }
var _iq = $('imgQuality');
if(_iq){
  _iq.addEventListener('input', function(){ var e = $('imgQVal'); if(e){ e.textContent = _iq.value + '%'; } });
}
var _tr = $('ttsRate');
if(_tr){
  _tr.addEventListener('input', function(){ var e = $('ttsRateVal'); if(e){ e.textContent = (_tr.value / 100).toFixed(2).replace(/0$/, '') + 'x'; } });
}
var _nt = $('notesIn');
if(_nt){ _nt.addEventListener('input', function(){ notesSave(window.localStorage, _nt.value); }); }

/* ===== imagetools ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

// @ts-nocheck

/* ===================================================================
   IMAGE TOOLS — dev-toolkit ke andar
   Sab kuch browser mein. Koi library nahi, koi upload nahi.
   =================================================================== */

var IMG_TOOLS = [
  { id:'img-jpg2png',  name:'JPG \u2192 PNG',        kind:'convert', from:'image/jpeg', to:'image/png',  ext:'png', desc:'JPG ko PNG mein badliye — quality loss nahi.' },
  { id:'img-png2jpg',  name:'PNG \u2192 JPG',        kind:'convert', from:'image/png',  to:'image/jpeg', ext:'jpg', desc:'PNG ko JPG mein. Pardeep hissa safed ho jaata hai.' },
  { id:'img-jpg2webp', name:'JPG \u2192 WebP',       kind:'convert', from:'image/jpeg', to:'image/webp', ext:'webp', desc:'Same quality, chhoti file.' },
  { id:'img-png2webp', name:'PNG \u2192 WebP',       kind:'convert', from:'image/png',  to:'image/webp', ext:'webp', desc:'Transparency bani rehti hai.' },
  { id:'img-webp2jpg', name:'WebP \u2192 JPG',       kind:'convert', from:'image/webp', to:'image/jpeg', ext:'jpg', desc:'Purane apps ke liye JPG.' },
  { id:'img-webp2png', name:'WebP \u2192 PNG',       kind:'convert', from:'image/webp', to:'image/png',  ext:'png', desc:'WebP se PNG, transparency ke saath.' },
  { id:'img-svg2png',  name:'SVG \u2192 PNG',        kind:'convert', from:'image/svg+xml', to:'image/png', ext:'png', desc:'SVG logo ko PNG mein badliye.' },

  { id:'img-b64',      name:'Image \u2192 Base64',   kind:'b64enc', desc:'Image ka base64 code — CSS ya HTML mein daalne ke liye.' },
  { id:'img-b64dec',   name:'Base64 \u2192 Image',   kind:'b64dec', desc:'Base64 ya data URL paste kijiye, image wapas paaiye.' },
  { id:'img-dataurl',  name:'Image \u2192 Data URL', kind:'dataurl', desc:'Poora data:image/... URL — seedha src mein use kijiye.' },

  { id:'img-resize',   name:'Image Resizer',    kind:'resize',   desc:'Width/height ya percentage se size badliye.' },
  { id:'img-crop',     name:'Image Cropper',    kind:'crop',     desc:'Image par dabba kheench kar crop kijiye.' },
  { id:'img-rotate',   name:'Image Rotator',    kind:'rotate',   desc:'90/180/270 ya koi bhi angle.' },
  { id:'img-flip',     name:'Image Flipper',    kind:'flip',     desc:'Ulta kijiye — horizontal ya vertical.' },
  { id:'img-compress', name:'Image Compressor', kind:'compress', desc:'Quality kam karke file ka size ghatiye.' },

  { id:'img-gray',      name:'Grayscale',            kind:'filter', filter:'grayscale', desc:'Rang hata kar black & white.' },
  { id:'img-invert',    name:'Negative / Invert',    kind:'filter', filter:'invert',    desc:'Rang ulte kar dijiye.' },
  { id:'img-sepia',     name:'Sepia',                kind:'filter', filter:'sepia',     desc:'Purane photo jaisa bhootiya rang.' },
  { id:'img-blur',      name:'Blur',                 kind:'filter', filter:'blur',      desc:'Image ko dhundhla kijiye.' },
  { id:'img-bright',    name:'Brightness / Contrast',kind:'filter', filter:'bright',    desc:'Roshni aur contrast adjust kijiye.' },
  { id:'img-threshold', name:'Threshold',            kind:'filter', filter:'threshold', desc:'Do rangon mein tod dijiye — black aur white.' },
  { id:'img-pixelate',  name:'Pixelate',             kind:'filter', filter:'pixelate',  desc:'Chhote box jaise pixels bana dijiye.' },

  { id:'img-pdf',      name:'Image \u2192 PDF',      kind:'pdf',     desc:'Ek image ko PDF mein. A4 ya image ke size ka page.' },
  { id:'img-multipdf', name:'Multiple \u2192 PDF',   kind:'multipdf',desc:'Kai images — har ek alag page par.' },

  { id:'img-info',     name:'Image info',        kind:'info',        desc:'Size, type, dimensions, transparency.' },
  { id:'img-color',    name:'Colour picker',     kind:'colorpicker', desc:'Image par click karke uska rang lijiye.' },
  { id:'img-palette',  name:'Palette extractor', kind:'palette',     desc:'Image ke mukhya 8 rang nikaaliye.' }
];

var IMG = {};   /* per-tool state */
function istate(id){ if(!IMG[id]){ IMG[id] = { img:null, name:'', size:0, blob:null, outName:'', list:[], angle:0 }; } return IMG[id]; }
function imId(id, part){ return id + '-' + part; }
function imSet(id, msg, cls){
  var e = $(imId(id, 'st'));
  if(!e){ return; }
  e.innerHTML = msg;
  e.className = 'status ' + (cls || '');
}
function imBusy(id, msg){
  imSet(id, '<span class="spin"></span>' + String(msg || 'Kaam chal raha hai...').replace(/&/g,'&amp;').replace(/</g,'&lt;'), 'info');
}
function imSize(b){
  if(b < 1024){ return b + ' B'; }
  if(b < 1048576){ return Math.round(b / 1024) + ' KB'; }
  return (Math.round(b / 1048576 * 10) / 10) + ' MB';
}
function imSave(blob, name){
  var a = document.createElement('a');
  var u = URL.createObjectURL(blob);
  a.href = u; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(u); }, 4000);
}
function imBase(name){ return String(name || 'image').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '') || 'image'; }
function imCanvas(w, h){ var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function imDraw(img, w, h, bg){
  var c = imCanvas(w || img.naturalWidth, h || img.naturalHeight);
  var ctx = c.getContext('2d');
  if(bg){ ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
function imBlob(canvas, mime, q){
  return new Promise(function(res, rej){
    canvas.toBlob(function(b){ b ? res(b) : rej(new Error('Is browser mein ' + mime + ' support nahi hai.')); }, mime, q);
  });
}
function imNeedsWhite(mime){ return mime === 'image/jpeg'; }

/* ---------- loading ---------- */
function imLoadFile(id, file){
  if(!file){ return; }
  if(!/^image\//.test(file.type || '') && !/\.svg$/i.test(file.name || '')){
    imSet(id, 'Ye image file nahi hai (' + (file.type || 'unknown') + ').', 'bad'); return;
  }
  imBusy(id, 'Image load ho rahi hai...');
  var fr = new FileReader();
  fr.onload = function(){
    var img = new Image();
    img.onload = function(){ imLoaded(id, img, file.name, file.size); };
    img.onerror = function(){ imSet(id, 'Image khul nahi paayi — file kharab lagti hai.', 'bad'); };
    img.src = fr.result;
  };
  fr.onerror = function(){ imSet(id, 'File padh nahi paayi.', 'bad'); };
  fr.readAsDataURL(file);
}
function imLoadUrl(id){
  var u = (val(imId(id, 'url')) || '').trim();
  if(!u){ imSet(id, 'URL khaali hai.', 'info'); return; }
  if(!/^https?:\/\//i.test(u) && !/^data:image\//i.test(u)){
    imSet(id, 'URL http:// , https:// ya data:image/ se shuru hona chahiye.', 'bad'); return;
  }
  imBusy(id, 'URL se image laa raha hoon...');
  var img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function(){ imLoaded(id, img, (u.split('/').pop() || 'image').split('?')[0], 0); };
  img.onerror = function(){
    imSet(id, 'URL se image nahi khuli. Ho sakta hai site CORS rok rahi ho — file download karke upload kijiye.', 'bad');
  };
  img.src = u;
}
function imLoaded(id, img, name, size){
  var s = istate(id);
  s.img = img; s.name = name || 'image'; s.size = size || 0; s.blob = null;
  var p = $(imId(id, 'prev'));
  if(p){ p.src = img.src; p.style.display = 'block'; }
  var dl = $(imId(id, 'dl')); if(dl){ dl.disabled = true; }
  if($(imId(id, 'canvas'))){ imCropInit(id); }
  var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  var extra = '';
  if(id === 'img-info'){ extra = imInfoText(img, name, size); }
  if(id === 'img-palette'){ extra = imPaletteText(img); }
  if(id === 'img-color'){ extra = 'Image par click kijiye — uska rang neeche dikhega.'; }
  imSet(id, extra || ('Image taiyaar \u2014 ' + w + '\u00d7' + h + ' px' + (size ? ', ' + imSize(size) : '') + '.'), 'ok');
  if(id === 'img-color'){ imColorBind(id); }
}

/* ---------- info / palette ---------- */
function imInfoText(img, name, size){
  var w = img.naturalWidth, h = img.naturalHeight;
  var lines = [
    'Naam      : ' + (name || 'image'),
    'Dimensions: ' + w + ' \u00d7 ' + h + ' px',
    'Aspect    : ' + imRatio(w, h),
    'Type      : ' + (img.src.slice(0, 30).replace('data:', '')),
    'File size : ' + (size ? imSize(size) : 'pata nahi (URL se aayi)')
  ];
  var alpha = imHasAlpha(img);
  lines.push('Transparency: ' + (alpha === null ? 'check nahi ho paayi' : (alpha ? 'haan, kuch pixels pardeep hain' : 'nahi, poori image bhari hui hai')));
  return lines.join('\n');
}
function imRatio(w, h){
  function gcd(a, b){ a = Math.abs(a); b = Math.abs(b); while(b){ var t = b; b = a % b; a = t; } return a; }
  var g = gcd(Math.round(w), Math.round(h)) || 1;
  return Math.round(w / g) + ':' + Math.round(h / g) + ' (' + (Math.round(w / h * 1000) / 1000) + ':1)';
}
function imHasAlpha(img){
  try{
    var w = Math.min(200, img.naturalWidth), h = Math.min(200, img.naturalHeight);
    var c = imCanvas(w, h), ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    var d = ctx.getImageData(0, 0, w, h).data;
    for(var i = 3; i < d.length; i += 4){ if(d[i] < 250){ return true; } }
    return false;
  }catch(e){ return null; }
}
function imPaletteText(img){
  try{
    var w = Math.min(160, img.naturalWidth), h = Math.min(160, img.naturalHeight);
    var c = imCanvas(w, h), ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    var d = ctx.getImageData(0, 0, w, h).data;
    var buckets = {};
    for(var i = 0; i < d.length; i += 4){
      if(d[i + 3] < 40){ continue; }
      var r = d[i] >> 4, g = d[i + 1] >> 4, b = d[i + 2] >> 4;
      var k = r + ',' + g + ',' + b;
      buckets[k] = (buckets[k] || 0) + 1;
    }
    var arr = Object.keys(buckets).map(function(k){
      var p = k.split(',').map(Number);
      return { hex: imHex(p[0] * 17, p[1] * 17, p[2] * 17), n: buckets[k] };
    }).sort(function(a, b){ return b.n - a.n; }).slice(0, 8);
    var total = arr.reduce(function(t, x){ return t + x.n; }, 0) || 1;
    return arr.map(function(x){ return x.hex + '  ' + Math.round(x.n / total * 100) + '%'; }).join('\n');
  }catch(e){ return 'Palette nahi nikli: ' + e.message; }
}
function imHex(r, g, b){
  function h2(n){ var s = n.toString(16); return s.length === 1 ? '0' + s : s; }
  return '#' + h2(r) + h2(g) + h2(b);
}

/* ---------- colour picker ---------- */
function imColorBind(id){
  var cv = $(imId(id, 'canvas'));
  if(!cv){ return; }
  var s = istate(id);
  var maxW = Math.min(640, (document.querySelector('main') || document.body).clientWidth - 40);
  var sc = Math.min(1, maxW / (s.img.naturalWidth || 1));
  cv.width = Math.round(s.img.naturalWidth * sc);
  cv.height = Math.round(s.img.naturalHeight * sc);
  var ctx = cv.getContext('2d');
  ctx.drawImage(s.img, 0, 0, cv.width, cv.height);
  cv.onclick = function(e){
    var r = cv.getBoundingClientRect();
    var x = Math.round((e.clientX - r.left) * (cv.width / r.width));
    var y = Math.round((e.clientY - r.top) * (cv.height / r.height));
    try{
      var d = ctx.getImageData(x, y, 1, 1).data;
      var hex = imHex(d[0], d[1], d[2]);
      imSet(id, hex + '   rgb(' + d[0] + ', ' + d[1] + ', ' + d[2] + ')   alpha ' + d[3] + '\nPixel: ' + x + ', ' + y, 'ok');
      var box = $(imId(id, 'swatch'));
      if(box){ box.style.background = hex; box.style.display = 'inline-block'; }
    }catch(err){ imSet(id, 'Rang nahi padh paaya: ' + err.message, 'bad'); }
  };
}

/* ---------- crop ---------- */
var CROP = { dragging:false, sx:0, sy:0, x:0, y:0, w:0, h:0, scale:1 };
function imCropInit(id){
  var s = istate(id), cv = $(imId(id, 'canvas'));
  if(!cv || !s.img){ return; }
  var maxW = Math.min(640, (document.querySelector('main') || document.body).clientWidth - 40);
  var sc = Math.min(1, maxW / (s.img.naturalWidth || 1));
  cv.width = Math.round(s.img.naturalWidth * sc);
  cv.height = Math.round(s.img.naturalHeight * sc);
  cv.getContext('2d').drawImage(s.img, 0, 0, cv.width, cv.height);
  CROP.scale = sc; CROP.x = CROP.y = CROP.w = CROP.h = 0;
  var box = $(imId(id, 'box'));
  if(box){ box.style.display = 'none'; }
}
function imCropWire(id){
  var wrap = $(imId(id, 'wrap'));
  if(!wrap){ return; }
  var box = $(imId(id, 'box'));
  function pt(e){
    var r = wrap.getBoundingClientRect();
    var p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    return { x: Math.max(0, Math.min(r.width, p.clientX - r.left)),
             y: Math.max(0, Math.min(r.height, p.clientY - r.top)) };
  }
  function start(e){
    if(!istate(id).img){ return; }
    e.preventDefault();
    var p = pt(e);
    CROP.dragging = true; CROP.sx = p.x; CROP.sy = p.y;
    box.style.display = 'block';
    box.style.left = p.x + 'px'; box.style.top = p.y + 'px';
    box.style.width = '0px'; box.style.height = '0px';
  }
  function move(e){
    if(!CROP.dragging){ return; }
    e.preventDefault();
    var p = pt(e);
    var x = Math.min(CROP.sx, p.x), y = Math.min(CROP.sy, p.y);
    var w = Math.abs(p.x - CROP.sx), h = Math.abs(p.y - CROP.sy);
    box.style.left = x + 'px'; box.style.top = y + 'px';
    box.style.width = w + 'px'; box.style.height = h + 'px';
    CROP.x = x; CROP.y = y; CROP.w = w; CROP.h = h;
    var sc = CROP.scale || 1;
    var info = $(imId(id, 'cropinfo'));
    if(info){ info.textContent = Math.round(w / sc) + '\u00d7' + Math.round(h / sc) + ' px chuna gaya'; }
  }
  function end(){
    if(!CROP.dragging){ return; }
    CROP.dragging = false;
    if(CROP.w < 5 || CROP.h < 5){
      box.style.display = 'none'; CROP.w = CROP.h = 0;
      var info = $(imId(id, 'cropinfo'));
      if(info){ info.textContent = 'Dabba bahut chhota tha — dobara kheenchiye'; }
    }
  }
  wrap.addEventListener('mousedown', start);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  wrap.addEventListener('touchstart', start, { passive: false });
  wrap.addEventListener('touchmove', move, { passive: false });
  wrap.addEventListener('touchend', end);
}

/* ---------- filters ---------- */
function imFilterPixels(canvas, fn){
  var ctx = canvas.getContext('2d');
  var d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var px = d.data;
  for(var i = 0; i < px.length; i += 4){
    var out = fn(px[i], px[i + 1], px[i + 2], px[i + 3]);
    px[i] = out[0]; px[i + 1] = out[1]; px[i + 2] = out[2];
  }
  ctx.putImageData(d, 0, 0);
  return canvas;
}
function imApplyFilter(kind, canvas, opts){
  opts = opts || {};
  if(kind === 'grayscale'){
    return imFilterPixels(canvas, function(r, g, b){ var v = Math.round(0.299 * r + 0.587 * g + 0.114 * b); return [v, v, v]; });
  }
  if(kind === 'invert'){
    return imFilterPixels(canvas, function(r, g, b){ return [255 - r, 255 - g, 255 - b]; });
  }
  if(kind === 'sepia'){
    return imFilterPixels(canvas, function(r, g, b){
      return [Math.min(255, r * 0.393 + g * 0.769 + b * 0.189),
              Math.min(255, r * 0.349 + g * 0.686 + b * 0.168),
              Math.min(255, r * 0.272 + g * 0.534 + b * 0.131)];
    });
  }
  if(kind === 'threshold'){
    var t = opts.threshold || 128;
    return imFilterPixels(canvas, function(r, g, b){
      var v = (0.299 * r + 0.587 * g + 0.114 * b) >= t ? 255 : 0;
      return [v, v, v];
    });
  }
  if(kind === 'blur'){
    var radius = opts.radius || 4;
    var ctx = canvas.getContext('2d');
    if('filter' in ctx){
      var copy = imCanvas(canvas.width, canvas.height);
      copy.getContext('2d').drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.filter = 'blur(' + radius + 'px)';
      ctx.drawImage(copy, 0, 0);
      ctx.filter = 'none';
      return canvas;
    }
    return imBoxBlur(canvas, Math.max(1, Math.round(radius)));
  }
  if(kind === 'bright'){
    var br = opts.brightness === undefined ? 0 : opts.brightness;
    var ct = opts.contrast === undefined ? 0 : opts.contrast;
    var f = 1 + ct / 100;
    return imFilterPixels(canvas, function(r, g, b){
      function adj(v){ return Math.max(0, Math.min(255, (v - 128) * f + 128 + br)); }
      return [adj(r), adj(g), adj(b)];
    });
  }
  if(kind === 'pixelate'){
    var size = Math.max(2, opts.size || 10);
    var small = imCanvas(Math.max(1, Math.round(canvas.width / size)), Math.max(1, Math.round(canvas.height / size)));
    var sctx = small.getContext('2d');
    sctx.drawImage(canvas, 0, 0, small.width, small.height);
    var ctx2 = canvas.getContext('2d');
    ctx2.clearRect(0, 0, canvas.width, canvas.height);
    ctx2.imageSmoothingEnabled = false;
    ctx2.drawImage(small, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
  return canvas;
}
function imBoxBlur(canvas, r){
  var ctx = canvas.getContext('2d');
  var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var src = img.data, w = canvas.width, h = canvas.height;
  var out = ctx.createImageData(w, h), dst = out.data;
  for(var y = 0; y < h; y++){
    for(var x = 0; x < w; x++){
      var tr = 0, tg = 0, tb = 0, n = 0;
      for(var dy = -r; dy <= r; dy++){
        var yy = y + dy; if(yy < 0 || yy >= h){ continue; }
        for(var dx = -r; dx <= r; dx++){
          var xx = x + dx; if(xx < 0 || xx >= w){ continue; }
          var i = (yy * w + xx) * 4;
          tr += src[i]; tg += src[i + 1]; tb += src[i + 2]; n++;
        }
      }
      var o = (y * w + x) * 4;
      dst[o] = tr / n; dst[o + 1] = tg / n; dst[o + 2] = tb / n; dst[o + 3] = src[o + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/* ---------- PDF (koi library nahi) ---------- */
function imJpegBytes(canvas, q){
  return new Promise(function(res, rej){
    canvas.toBlob(function(b){
      if(!b){ rej(new Error('JPEG nahi bana.')); return; }
      var fr = new FileReader();
      fr.onload = function(){
        var bin = atob(String(fr.result).split(',')[1]);
        var arr = new Uint8Array(bin.length);
        for(var i = 0; i < bin.length; i++){ arr[i] = bin.charCodeAt(i); }
        res(arr);
      };
      fr.onerror = function(){ rej(new Error('JPEG padh nahi paaya.')); };
      fr.readAsDataURL(b);
    }, 'image/jpeg', q || 0.9);
  });
}
function imBuildPdf(pages){
  var chunks = [], len = 0, offs = [];
  function put(d){
    var u = (typeof d === 'string') ? new TextEncoder().encode(d) : d;
    chunks.push(u); len += u.length;
  }
  function r2(n){ return Math.round(n * 100) / 100; }
  put('%PDF-1.4\n');
  put(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
  var n = pages.length, first = 3, kids = [];
  for(var i = 0; i < n; i++){ kids.push((first + i * 3) + ' 0 R'); }
  offs[1] = len; put('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  offs[2] = len; put('2 0 obj\n<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>\nendobj\n');
  for(var p = 0; p < n; p++){
    var pg = pages[p], po = first + p * 3, co = po + 1, io = po + 2;
    offs[po] = len;
    put(po + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + r2(pg.pageW) + ' ' + r2(pg.pageH) +
        '] /Resources << /XObject << /Im0 ' + io + ' 0 R >> >> /Contents ' + co + ' 0 R >>\nendobj\n');
    var content = 'q\n' + r2(pg.drawW) + ' 0 0 ' + r2(pg.drawH) + ' ' + r2(pg.x) + ' ' + r2(pg.y) + ' cm\n/Im0 Do\nQ\n';
    offs[co] = len;
    put(co + ' 0 obj\n<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream\nendobj\n');
    offs[io] = len;
    put(io + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + pg.w + ' /Height ' + pg.h +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + pg.jpeg.length +
        ' >>\nstream\n');
    put(pg.jpeg);
    put('\nendstream\nendobj\n');
  }
  var total = 2 + n * 3, xref = len;
  var table = 'xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n';
  for(var o = 1; o <= total; o++){
    var s = String(offs[o] || 0);
    while(s.length < 10){ s = '0' + s; }
    table += s + ' 00000 n \n';
  }
  put(table);
  put('trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  var out = new Uint8Array(len), at = 0;
  chunks.forEach(function(c){ out.set(c, at); at += c.length; });
  return out;
}
function imPdfPages(images, mode){
  var A4W = 595.28, A4H = 841.89;
  return Promise.all(images.map(function(item){
    var img = item.img;
    var w = img.naturalWidth, h = img.naturalHeight;
    var canvas = imDraw(img, w, h, '#ffffff');
    return imJpegBytes(canvas, 0.9).then(function(jpeg){
      var pageW, pageH, drawW, drawH, x, y;
      if(mode === 'image'){ pageW = w; pageH = h; drawW = w; drawH = h; x = 0; y = 0; }
      else {
        var portrait = h >= w;
        pageW = portrait ? A4W : A4H;
        pageH = portrait ? A4H : A4W;
        var m = 28, mw = pageW - m * 2, mh = pageH - m * 2;
        var sc = Math.min(mw / w, mh / h);
        drawW = w * sc; drawH = h * sc;
        x = (pageW - drawW) / 2; y = (pageH - drawH) / 2;
      }
      return { jpeg: jpeg, w: w, h: h, pageW: pageW, pageH: pageH, drawW: drawW, drawH: drawH, x: x, y: y };
    });
  }));
}

/* ---------- run ---------- */
function imRun(id){
  var t = IMG_TOOLS.filter(function(x){ return x.id === id; })[0];
  var s = istate(id);
  if(!t){ return; }

  if(t.kind === 'multipdf'){
    if(!s.list.length){ imSet(id, 'Pehle images chuniye.', 'info'); return; }
    imBusy(id, 'PDF ban raha hai...');
    imPdfPages(s.list, 'a4').then(function(pages){
      var blob = new Blob([imBuildPdf(pages)], { type: 'application/pdf' });
      s.blob = blob; s.outName = 'images.pdf';
      imSet(id, s.list.length + ' page ka PDF taiyaar \u2014 ' + imSize(blob.size) + '. Download dabaiye.', 'ok');
      $(imId(id, 'dl')).disabled = false;
    }).catch(function(e){ imSet(id, e.message, 'bad'); });
    return;
  }
  if(t.kind === 'b64dec'){ return imFromBase64(id); }
  if(!s.img){ imSet(id, 'Pehle image chuniye ya URL daaliye.', 'info'); return; }

  var img = s.img;

  if(t.kind === 'convert'){
    imBusy(id, 'Convert ho raha hai...');
    var cv = imDraw(img, img.naturalWidth, img.naturalHeight, imNeedsWhite(t.to) ? '#ffffff' : null);
    imBlob(cv, t.to, 0.92).then(function(b){
      s.blob = b; s.outName = imBase(s.name) + '.' + t.ext;
      imSet(id, 'Taiyaar \u2014 ' + img.naturalWidth + '\u00d7' + img.naturalHeight + ' px, ' + imSize(b.size) + '. Download dabaiye.', 'ok');
      $(imId(id, 'dl')).disabled = false;
    }).catch(function(e){ imSet(id, e.message, 'bad'); });
    return;
  }

  if(t.kind === 'b64enc' || t.kind === 'dataurl'){
    imBusy(id, 'Base64 ban raha hai...');
    var c2 = imDraw(img, img.naturalWidth, img.naturalHeight, null);
    imBlob(c2, 'image/png', 1).then(function(b){
      var fr = new FileReader();
      fr.onload = function(){
        var dataUrl = String(fr.result);
        var text = (t.kind === 'dataurl') ? dataUrl : dataUrl.split(',')[1];
        var out = $(imId(id, 'out'));
        if(out){ out.value = text; out.style.display = 'block'; }
        s.blob = b; s.outName = imBase(s.name) + (t.kind === 'dataurl' ? '.txt' : '-base64.txt');
        imSet(id, text.length + ' characters ka ' + (t.kind === 'dataurl' ? 'data URL' : 'base64') + ' taiyaar. Copy ya Download dabaiye.', 'ok');
        $(imId(id, 'dl')).disabled = false;
      };
      fr.readAsDataURL(b);
    }).catch(function(e){ imSet(id, e.message, 'bad'); });
    return;
  }

  if(t.kind === 'resize'){
    var wIn = parseInt(val(imId(id, 'w')), 10), hIn = parseInt(val(imId(id, 'h')), 10);
    var pct = parseFloat(val(imId(id, 'pct')));
    var fmt = val(imId(id, 'fmt')) || 'image/png';
    var ow = img.naturalWidth, oh = img.naturalHeight, w = ow, h = oh;
    if(!isNaN(pct) && pct > 0){ w = Math.round(ow * pct / 100); h = Math.round(oh * pct / 100); }
    else if(!isNaN(wIn) && wIn > 0 && !isNaN(hIn) && hIn > 0){ w = wIn; h = hIn; }
    else if(!isNaN(wIn) && wIn > 0){ w = wIn; h = Math.round(oh * wIn / ow); }
    else if(!isNaN(hIn) && hIn > 0){ h = hIn; w = Math.round(ow * hIn / oh); }
    else { imSet(id, 'Width, height ya percentage — kuch ek daaliye.', 'info'); return; }
    if(w < 1 || h < 1 || w > 8000 || h > 8000){ imSet(id, 'Size 1 se 8000 px ke beech hona chahiye.', 'bad'); return; }
    imBusy(id, 'Resize ho raha hai...');
    var rc = imDraw(img, w, h, imNeedsWhite(fmt) ? '#ffffff' : null);
    var rq = (parseInt(val(imId(id, 'q')), 10) || 92) / 100;
    imBlob(rc, fmt, rq).then(function(b){
      s.blob = b; s.outName = imBase(s.name) + '-' + w + 'x' + h + ({ 'image/png':'.png', 'image/jpeg':'.jpg', 'image/webp':'.webp' }[fmt] || '.png');
      imSet(id, 'Naya size ' + w + '\u00d7' + h + ' px, ' + imSize(b.size) + '. Download dabaiye.', 'ok');
      $(imId(id, 'dl')).disabled = false;
    }).catch(function(e){ imSet(id, e.message, 'bad'); });
    return;
  }

  if(t.kind === 'crop'){
    var sc = CROP.scale || 1;
    var cw = Math.round(CROP.w / sc), ch = Math.round(CROP.h / sc);
    if(!cw || !ch){ imSet(id, 'Pehle image par dabba kheenchiye (mouse ya ungli se).', 'info'); return; }
    var cx = Math.round(CROP.x / sc), cy = Math.round(CROP.y / sc);
    var cfmt = val(imId(id, 'fmt')) || 'image/png';
    imBusy(id, 'Crop ho raha hai...');
    var cc = imCanvas(cw, ch), cctx = cc.getContext('2d');
    if(imNeedsWhite(cfmt)){ cctx.fillStyle = '#ffffff'; cctx.fillRect(0, 0, cw, ch); }
    cctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
    imBlob(cc, cfmt, 0.92).then(function(b){
      s.blob = b; s.outName = imBase(s.name) + '-crop-' + cw + 'x' + ch + (imNeedsWhite(cfmt) ? '.jpg' : '.png');
      imSet(id, 'Crop taiyaar \u2014 ' + cw + '\u00d7' + ch + ' px, ' + imSize(b.size) + '. Download dabaiye.', 'ok');
      $(imId(id, 'dl')).disabled = false;
    }).catch(function(e){ imSet(id, e.message, 'bad'); });
    return;
  }

  if(t.kind === 'rotate'){
    var deg = parseFloat(val(imId(id, 'deg'))) || 0;
    var rfmt = val(imId(id, 'fmt')) || 'image/png';
    var rad = deg * Math.PI / 180;
    var ow2 = img.naturalWidth, oh2 = img.naturalHeight;
    var cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
    var nw = Math.round(ow2 * cos + oh2 * sin), nh = Math.round(ow2 * sin + oh2 * cos);
    var cvr = imCanvas(nw, nh), ctxr = cvr.getContext('2d');
    if(imNeedsWhite(rfmt)){ ctxr.fillStyle = '#ffffff'; ctxr.fillRect(0, 0, nw, nh); }
    ctxr.translate(nw / 2, nh / 2);
    ctxr.rotate(rad);
    ctxr.drawImage(img, -ow2 / 2, -oh2 / 2);
    imBusy(id, 'Ghooma raha hoon...');
    imBlob(cvr, rfmt, 0.92).then(function(b){
      s.blob = b; s.outName = imBase(s.name) + '-rot' + deg + (imNeedsWhite(rfmt) ? '.jpg' : '.png');
      imSet(id, 'Rotate ho gaya (' + deg + '\u00b0) \u2014 ' + nw + '\u00d7' + nh + ' px, ' + imSize(b.size) + '.', 'ok');
      $(imId(id, 'dl')).disabled = false;
    }).catch(function(e){ imSet(id, e.message, 'bad'); });
    return;
  }

  if(t.kind === 'flip'){
    var dir = val(imId(id, 'dir')) || 'h';
    var ffmt = val(imId(id, 'fmt')) || 'image/png';
    var fw = img.naturalWidth, fh = img.naturalHeight;
    var cvc = imCanvas(fw, fh), ctxc = cvc.getContext('2d');
    if(imNeedsWhite(ffmt)){ ctxc.fillStyle = '#ffffff'; ctxc.fillRect(0, 0, fw, fh); }
    ctxc.translate(dir === 'h' ? fw : 0, dir === 'v' ? fh : 0);
    ctxc.scale(dir === 'h' ? -1 : 1, dir === 'v' ? -1 : 1);
    ctxc.drawImage(img, 0, 0);
    imBusy(id, 'Flip ho raha hai...');
    imBlob(cvc, ffmt, 0.92).then(function(b){
      s.blob = b; s.outName = imBase(s.name) + '-flip-' + dir + (imNeedsWhite(ffmt) ? '.jpg' : '.png');
      imSet(id, 'Flip ho gaya. ' + imSize(b.size) + '. Download dabaiye.', 'ok');
      $(imId(id, 'dl')).disabled = false;
    }).catch(function(e){ imSet(id, e.message, 'bad'); });
    return;
  }

  if(t.kind === 'compress'){
    var q = parseInt(val(imId(id, 'q')), 10) / 100;
    var cfmt2 = val(imId(id, 'fmt')) || 'image/jpeg';
    imBusy(id, 'Compress ho raha hai...');
    var cvc2 = imDraw(img, img.naturalWidth, img.naturalHeight, imNeedsWhite(cfmt2) ? '#ffffff' : null);
    imBlob(cvc2, cfmt2, q).then(function(b){
      s.blob = b;
      s.outName = imBase(s.name) + '-compressed' + ({ 'image/jpeg':'.jpg', 'image/png':'.png', 'image/webp':'.webp' }[cfmt2] || '.jpg');
      var saved = s.size ? Math.round((1 - b.size / s.size) * 100) : null;
      imSet(id, 'Naya size ' + imSize(b.size) + (s.size ? ' (pehle ' + imSize(s.size) + ')' : '') +
        (saved !== null ? ' \u2014 ' + saved + '% kam' : '') + '. Download dabaiye.', 'ok');
      $(imId(id, 'dl')).disabled = false;
    }).catch(function(e){ imSet(id, e.message, 'bad'); });
    return;
  }

  if(t.kind === 'filter'){
    var opts = {};
    if(t.filter === 'blur'){ opts.radius = parseInt(val(imId(id, 'radius')), 10) || 4; }
    if(t.filter === 'threshold'){ opts.threshold = parseInt(val(imId(id, 'threshold')), 10) || 128; }
    if(t.filter === 'bright'){
      opts.brightness = parseInt(val(imId(id, 'brightness')), 10) || 0;
      opts.contrast = parseInt(val(imId(id, 'contrast')), 10) || 0;
    }
    if(t.filter === 'pixelate'){ opts.size = parseInt(val(imId(id, 'size')), 10) || 10; }
    var ffmt2 = val(imId(id, 'fmt')) || 'image/png';
    imBusy(id, 'Filter lag raha hai...');
    setTimeout(function(){
      try{
        var cf = imDraw(img, img.naturalWidth, img.naturalHeight, imNeedsWhite(ffmt2) ? '#ffffff' : null);
        imApplyFilter(t.filter, cf, opts);
        imBlob(cf, ffmt2, 0.92).then(function(b){
          s.blob = b; s.outName = imBase(s.name) + '-' + t.filter + (imNeedsWhite(ffmt2) ? '.jpg' : '.png');
          imSet(id, 'Filter lag gaya \u2014 ' + imSize(b.size) + '. Download dabaiye.', 'ok');
          $(imId(id, 'dl')).disabled = false;
        }).catch(function(e){ imSet(id, e.message, 'bad'); });
      }catch(e){ imSet(id, 'Filter fail: ' + e.message, 'bad'); }
    }, 30);
    return;
  }

  if(t.kind === 'pdf'){
    var mode = val(imId(id, 'size')) || 'a4';
    imBusy(id, 'PDF ban raha hai...');
    imPdfPages([{ img: img, name: s.name }], mode).then(function(pages){
      var blob = new Blob([imBuildPdf(pages)], { type: 'application/pdf' });
      s.blob = blob; s.outName = imBase(s.name) + '.pdf';
      imSet(id, 'PDF taiyaar \u2014 ' + imSize(blob.size) + '. Download dabaiye.', 'ok');
      $(imId(id, 'dl')).disabled = false;
    }).catch(function(e){ imSet(id, e.message, 'bad'); });
    return;
  }

  if(t.kind === 'info'){
    imSet(id, imInfoText(img, s.name, s.size), 'ok');
    return;
  }
  if(t.kind === 'palette'){
    imSet(id, imPaletteText(img), 'ok');
    return;
  }
  if(t.kind === 'colorpicker'){
    imColorBind(id);
    imSet(id, 'Image par click kijiye.', 'info');
    return;
  }
}

function imFromBase64(id){
  var raw = (val(imId(id, 'b64in')) || '').trim();
  if(!raw){ imSet(id, 'Base64 ya data URL paste kijiye.', 'info'); return; }
  var url = /^data:image\//i.test(raw) ? raw : ('data:image/png;base64,' + raw.replace(/\s+/g, ''));
  imBusy(id, 'Image bana raha hoon...');
  var img = new Image();
  img.onload = function(){
    var s = istate(id);
    s.img = img; s.name = 'from-base64.png'; s.size = 0; s.blob = null;
    var p = $(imId(id, 'prev'));
    if(p){ p.src = img.src; p.style.display = 'block'; }
    imSet(id, 'Image mil gayi \u2014 ' + img.naturalWidth + '\u00d7' + img.naturalHeight + ' px. Download dabaiye.', 'ok');
    $(imId(id, 'dl')).disabled = false;
  };
  img.onerror = function(){ imSet(id, 'Base64 kharab hai \u2014 image nahi bani.', 'bad'); };
  img.src = url;
}

function imDownload(id){
  var s = istate(id);
  if(id === 'img-b64dec'){
    if(!s.img){ imSet(id, 'Pehle base64 daaliye.', 'info'); return; }
    var c = imDraw(s.img, s.img.naturalWidth, s.img.naturalHeight, null);
    imBlob(c, 'image/png', 1).then(function(b){ imSave(b, 'image-from-base64.png'); });
    return;
  }
  if(!s.blob){ imSet(id, 'Pehle tool chala kar file banaiye.', 'info'); return; }
  imSave(s.blob, s.outName || 'output');
}

function imCopy(id){
  var out = $(imId(id, 'out'));
  if(!out || !out.value){ imSet(id, 'Pehle banaiye, phir copy kijiye.', 'info'); return; }
  out.select();
  document.execCommand('copy');
  imSet(id, 'Copy ho gaya.', 'ok');
}

/* ---------- panel building ---------- */
function imPanelHtml(t){
  var id = t.id, h = [];
  h.push('<section id="t-' + id + '" class="tool">');
  h.push('<h2>' + t.name + '</h2>');
  h.push('<p class="desc">' + t.desc + '</p>');

  if(t.kind === 'b64dec'){
    h.push('<textarea id="' + imId(id, 'b64in') + '" class="short" placeholder="data:image/png;base64,... or just base64"></textarea>');
    h.push('<div class="row"><button class="act pri" onclick="imRun(\'' + id + '\')">Create image</button>');
    h.push('<button class="act" onclick="imDownload(\'' + id + '\')">Download</button></div>');
    h.push('<img id="' + imId(id, 'prev') + '" class="prev" style="display:none" alt="">');
    h.push('<div class="status" id="' + imId(id, 'st') + '"></div>');
    h.push('</section>');
    return h.join('');
  }

  if(t.kind === 'multipdf'){
    h.push('<div class="row"><input type="file" id="' + imId(id, 'file') + '" accept="image/*" multiple></div>');
  } else {
    h.push('<div class="row"><input type="file" id="' + imId(id, 'file') + '" accept="' + (t.from || 'image/*') + '"></div>');
  }
  h.push('<div class="drop" id="' + imId(id, 'drop') + '">Image yahan drag kijiye, ya upar se chuniye</div>');

  if(t.kind !== 'multipdf'){
    h.push('<div class="row"><input type="text" id="' + imId(id, 'url') + '" placeholder="or paste an image URL" style="flex:1">');
    h.push('<button class="act" onclick="imLoadUrl(\'' + id + '\')">Load from URL</button></div>');
  }

  if(t.kind === 'resize'){
    h.push('<div class="row"><input type="number" id="' + imId(id, 'w') + '" placeholder="width px" style="width:110px">');
    h.push('<input type="number" id="' + imId(id, 'h') + '" placeholder="height px" style="width:110px">');
    h.push('<input type="number" id="' + imId(id, 'pct') + '" placeholder="or %" style="width:80px">');
    h.push('<select id="' + imId(id, 'fmt') + '"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></div>');
    h.push('<div class="row"><span class="lbl">quality</span>' +
      '<input type="range" id="' + imId(id, 'q') + '" min="20" max="100" value="92" style="flex:1;max-width:200px" ' +
      'oninput="document.getElementById(\'' + imId(id, 'qv') + '\').textContent=this.value+\'%\'">' +
      '<span class="lbl" id="' + imId(id, 'qv') + '">92%</span></div>');
  }
  if(t.kind === 'crop'){
    h.push('<div class="cropwrap" id="' + imId(id, 'wrap') + '"><canvas id="' + imId(id, 'canvas') + '"></canvas><div class="cropbox" id="' + imId(id, 'box') + '"></div></div>');
    h.push('<div class="row"><span class="lbl" id="' + imId(id, 'cropinfo') + '">Image load kijiye, phir dabba kheenchiye</span></div>');
    h.push('<div class="row"><select id="' + imId(id, 'fmt') + '"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></div>');
  }
  if(t.kind === 'rotate'){
    h.push('<div class="row"><select id="' + imId(id, 'deg') + '"><option value="90">90\u00b0</option><option value="180">180\u00b0</option><option value="270">270\u00b0</option><option value="45">45\u00b0</option><option value="15">15\u00b0</option></select>');
    h.push('<select id="' + imId(id, 'fmt') + '"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option></select></div>');
  }
  if(t.kind === 'flip'){
    h.push('<div class="row"><select id="' + imId(id, 'dir') + '"><option value="h">Horizontal (baayein-daayein)</option><option value="v">Vertical (top-bottom)</option></select>');
    h.push('<select id="' + imId(id, 'fmt') + '"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option></select></div>');
  }
  if(t.kind === 'compress'){
    h.push('<div class="row"><span class="lbl">quality</span>');
    h.push('<input type="range" id="' + imId(id, 'q') + '" min="20" max="100" value="70" style="flex:1;max-width:200px" oninput="document.getElementById(\'' + imId(id, 'qv') + '\').textContent=this.value+\'%\'">');
    h.push('<span class="lbl" id="' + imId(id, 'qv') + '">70%</span>');
    h.push('<select id="' + imId(id, 'fmt') + '"><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option><option value="image/png">PNG</option></select></div>');
  }
  if(t.kind === 'filter'){
    if(t.filter === 'blur'){
      h.push('<div class="row"><span class="lbl">radius</span><input type="number" id="' + imId(id, 'radius') + '" value="4" min="1" max="30" style="width:90px">');
    }
    if(t.filter === 'threshold'){
      h.push('<div class="row"><span class="lbl">threshold</span><input type="number" id="' + imId(id, 'threshold') + '" value="128" min="0" max="255" style="width:90px">');
    }
    if(t.filter === 'bright'){
      h.push('<div class="row"><span class="lbl">brightness</span><input type="number" id="' + imId(id, 'brightness') + '" value="20" min="-100" max="100" style="width:90px">');
      h.push('<span class="lbl">contrast</span><input type="number" id="' + imId(id, 'contrast') + '" value="10" min="-100" max="100" style="width:90px"></div>');
    }
    if(t.filter === 'pixelate'){
      h.push('<div class="row"><span class="lbl">pixel size</span><input type="number" id="' + imId(id, 'size') + '" value="10" min="2" max="60" style="width:90px">');
    }
    h.push('<div class="row"><select id="' + imId(id, 'fmt') + '"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></div>');
  }
  if(t.kind === 'pdf'){
    h.push('<div class="row"><span class="lbl">page</span><select id="' + imId(id, 'size') + '"><option value="a4">A4 (fit)</option><option value="image">Match image size</option></select></div>');
  }

  if(t.kind === 'colorpicker'){
    h.push('<div class="cropwrap" id="' + imId(id, 'wrap') + '"><canvas id="' + imId(id, 'canvas') + '"></canvas></div>');
    h.push('<div class="row"><span id="' + imId(id, 'swatch') + '" style="display:none;width:36px;height:36px;border-radius:8px;border:1px solid var(--line)"></span></div>');
  } else if(t.kind !== 'crop'){
    h.push('<img id="' + imId(id, 'prev') + '" class="prev" style="display:none" alt="">');
  }

  if(t.kind === 'multipdf'){ h.push('<div class="thumbs" id="' + imId(id, 'thumbs') + '"></div>'); }
  if(t.kind === 'b64enc' || t.kind === 'dataurl'){
    h.push('<textarea id="' + imId(id, 'out') + '" class="short" style="display:none" placeholder="Base64 appears here..."></textarea>');
  }

  h.push('<div class="row">');
  h.push('<button class="act pri" id="' + imId(id, 'go') + '" onclick="imRun(\'' + id + '\')">' +
    (t.kind === 'compress' ? 'Compress' : t.kind === 'resize' ? 'Resize' : t.kind === 'crop' ? 'Crop' :
     t.kind === 'pdf' || t.kind === 'multipdf' ? 'PDF banao' : t.kind === 'filter' ? 'Apply' :
     t.kind === 'info' ? 'View' : t.kind === 'palette' ? 'Palette nikalo' : 'Convert') + '</button>');
  h.push('<button class="act" id="' + imId(id, 'dl') + '" onclick="imDownload(\'' + id + '\')" disabled>Download</button>');
  if(t.kind === 'b64enc' || t.kind === 'dataurl'){
    h.push('<button class="act" onclick="imCopy(\'' + id + '\')">Copy</button>');
  }
  h.push('</div>');
  h.push('<div class="status" id="' + imId(id, 'st') + '"></div>');
  h.push('</section>');
  return h.join('\n');
}

function imBuildPanels(){
  var aside = document.querySelector('aside');
  var main = document.querySelector('main');
  if(!aside || !main){ return; }
  var menu = [], panels = [];
  menu.push('<button class="grp-btn" data-g="img" onclick="toggleGroup(\'img\',this)">');
  menu.push('  <span>Image tools</span>');
  menu.push('  <span class="count">' + IMG_TOOLS.length + '</span>');
  menu.push('');
  menu.push('</button>');
  menu.push('<div class="grp-list" id="g-img">');
  IMG_TOOLS.forEach(function(t){
    menu.push('  <button class="nav" title="' + t.name + '" onclick="openTool(\'' + t.id + '\',this)">' + t.name + '</button>');
    panels.push(imPanelHtml(t));
  });
  menu.push('</div>');
  aside.insertAdjacentHTML('beforeend', menu.join('\n'));
  main.insertAdjacentHTML('beforeend', panels.join('\n'));

  IMG_TOOLS.forEach(function(t){
    var inp = $(imId(t.id, 'file'));
    var drop = $(imId(t.id, 'drop'));
    if(inp){
      inp.addEventListener('change', function(){
        if(t.kind === 'multipdf'){ imMulti(t.id, inp.files); }
        else { imLoadFile(t.id, inp.files[0]); }
      });
    }
    if(drop){
      drop.addEventListener('click', function(){ if(inp){ inp.click(); } });
      ['dragenter','dragover'].forEach(function(ev){
        drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.add('over'); });
      });
      ['dragleave','drop'].forEach(function(ev){
        drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.remove('over'); });
      });
      drop.addEventListener('drop', function(e){
        var f = e.dataTransfer && e.dataTransfer.files;
        if(!f || !f.length){ return; }
        if(t.kind === 'multipdf'){ imMulti(t.id, f); }
        else { imLoadFile(t.id, f[0]); }
      });
    }
    if(t.kind === 'crop'){ imCropWire(t.id); }
  });
}

function imMulti(id, files){
  var list = Array.prototype.slice.call(files || []);
  if(!list.length){ return; }
  imBusy(id, list.length + ' images load ho rahi hain...');
  var loaded = [], pending = list.length;
  list.forEach(function(f){
    var fr = new FileReader();
    fr.onload = function(){
      var img = new Image();
      img.onload = function(){ loaded.push({ img: img, name: f.name }); if(--pending === 0){ done(); } };
      img.onerror = function(){ if(--pending === 0){ done(); } };
      img.src = fr.result;
    };
    fr.onerror = function(){ if(--pending === 0){ done(); } };
    fr.readAsDataURL(f);
  });
  function done(){
    var s = istate(id);
    s.list = loaded;
    imThumbs(id);
    imSet(id, loaded.length + ' images taiyaar. PDF banao dabaiye.', loaded.length ? 'ok' : 'bad');
  }
}
function imThumbs(id){
  var s = istate(id), box = $(imId(id, 'thumbs'));
  if(!box){ return; }
  box.innerHTML = '';
  s.list.forEach(function(it, i){
    var d = document.createElement('div');
    d.className = 'thumb';
    var im = document.createElement('img');
    im.src = it.img.src;
    var b = document.createElement('button');
    b.textContent = '\u00d7';
    b.onclick = function(){ s.list.splice(i, 1); imThumbs(id); imSet(id, s.list.length + ' images bache.', 'info'); };
    d.appendChild(im); d.appendChild(b); box.appendChild(d);
  });
}

/* start */
imBuildPanels();

/* ===== imagetools2 ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

// @ts-nocheck

/* ===================================================================
   IMAGE TOOLS — batch 2 (editing + design + info)
   =================================================================== */

var EXTRA_TOOLS = [
  { id:'x-round',   name:'Rounded corners', kind:'round',   desc:'Kono ko gol kijiye. PNG mein transparency bani rehti hai.' },
  { id:'x-border',  name:'Border & padding', kind:'border', desc:'Chaaron taraf border aur khaali jagah (padding) jodiye.' },
  { id:'x-shadow',  name:'Photo shadow',    kind:'shadow',  desc:'Image ke peeche halki parchhai.' },
  { id:'x-water',   name:'Watermark',       kind:'water',   desc:'Image par apna naam ya text likhiye.' },
  { id:'x-tile',    name:'Tile repeater',   kind:'tile',    desc:'Image ko baar-baar dohra kar bada pattern banaiye.' },
  { id:'x-split4',  name:'Split into 4',    kind:'split4',  desc:'Image ko chaar barabar hisson mein kaatiye.' },

  { id:'x-text',    name:'Text to PNG',     kind:'text',    desc:'Likhe hue text ki PNG image banaiye.' },
  { id:'x-meme',    name:'Meme generator',  kind:'meme',    desc:'Image par top-bottom likhaai — classic meme style.' },
  { id:'x-social',  name:'Social resizer',  kind:'social',  desc:'Instagram, YouTube, WhatsApp ke ready sizes.' },
  { id:'x-grid',    name:'Photo grid',      kind:'grid',    desc:'Kai images ko ek grid mein jodiye.' },
  { id:'x-grad',    name:'Gradient maker',  kind:'grad',    desc:'Do rangon ka gradient background PNG.' },

  { id:'x-dpi',     name:'DPI & print size', kind:'dpi',    desc:'Image kitne inch/cm mein print hogi.' },
  { id:'x-favicon', name:'Favicon generator',kind:'favicon',desc:'16, 32, 48 aur 180 px ki icon files.' }
];

var XS = {};
function xstate(id){ if(!XS[id]){ XS[id] = { img:null, name:'', size:0, outputs:[], list:[] }; } return XS[id]; }
function xId(id, p){ return id + '-' + p; }
function xSet(id, msg, cls){
  var e = $(xId(id, 'st'));
  if(!e){ return; }
  e.innerHTML = msg;
  e.className = 'status ' + (cls || '');
}
function xBusy(id, msg){
  xSet(id, '<span class="spin"></span>' + String(msg || 'Kaam chal raha hai...').replace(/&/g,'&amp;').replace(/</g,'&lt;'), 'info');
}

/* ---------- panel ---------- */
function xPanelHtml(t){
  var id = t.id, h = [];
  h.push('<section id="t-' + id + '" class="tool">');
  h.push('<h2>' + t.name + '</h2>');
  h.push('<p class="desc">' + t.desc + '</p>');

  var needsImage = (t.kind !== 'text' && t.kind !== 'logo' && t.kind !== 'grad');
  if(needsImage){
    if(t.kind === 'grid'){
      h.push('<div class="row"><span class="lbl">kai</span><input type="file" id="' + xId(id, 'file') + '" accept="image/*" multiple></div>');
    } else {
      h.push('<div class="row"><input type="file" id="' + xId(id, 'file') + '" accept="image/*"></div>');
      h.push('<div class="drop" id="' + xId(id, 'drop') + '">Image yahan drag kijiye, ya upar se chuniye</div>');
      h.push('<div class="row"><input type="text" id="' + xId(id, 'url') + '" placeholder="or image URL" style="flex:1">');
      h.push('<button class="act" onclick="xLoadUrl(\'' + id + '\')">Load from URL</button></div>');
    }
  }

  if(t.kind === 'round'){
    h.push('<div class="row"><span class="lbl">radius</span><input type="range" id="' + xId(id, 'r') + '" min="2" max="120" value="32" style="flex:1;max-width:200px">');
    h.push('<select id="' + xId(id, 'fmt') + '"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option></select></div>');
  }
  if(t.kind === 'border'){
    h.push('<div class="row"><input type="number" id="' + xId(id, 'bw') + '" value="12" placeholder="border px" style="width:110px">');
    h.push('<input type="text" id="' + xId(id, 'bc') + '" value="#1a56db" style="width:110px">');
    h.push('<input type="number" id="' + xId(id, 'pad') + '" value="24" placeholder="padding px" style="width:120px">');
    h.push('<input type="text" id="' + xId(id, 'bg') + '" value="#ffffff" style="width:110px"></div>');
  }
  if(t.kind === 'shadow'){
    h.push('<div class="row"><input type="number" id="' + xId(id, 'blur') + '" value="24" placeholder="blur" style="width:90px">');
    h.push('<input type="number" id="' + xId(id, 'off') + '" value="12" placeholder="offset" style="width:90px">');
    h.push('<input type="text" id="' + xId(id, 'bg') + '" value="#ffffff" style="width:110px"></div>');
  }
  if(t.kind === 'water'){
    h.push('<div class="row"><input type="text" id="' + xId(id, 'txt') + '" value="My Website" placeholder="watermark text" style="flex:1">');
    h.push('<select id="' + xId(id, 'pos') + '"><option value="br">bottom-right</option><option value="bl">bottom-left</option>' +
      '<option value="tr">top-right</option><option value="tl">top-left</option><option value="c">middle</option></select></div>');
    h.push('<div class="row"><span class="lbl">size</span><input type="number" id="' + xId(id, 'fs') + '" value="28" style="width:80px">');
    h.push('<span class="lbl">opacity</span><input type="number" id="' + xId(id, 'op') + '" value="55" min="10" max="100" style="width:80px"></div>');
  }
  if(t.kind === 'tile'){
    h.push('<div class="row"><span class="lbl">kitni baar</span>');
    h.push('<input type="number" id="' + xId(id, 'nx') + '" value="3" min="1" max="10" style="width:70px">');
    h.push('<span class="lbl">x</span>');
    h.push('<input type="number" id="' + xId(id, 'ny') + '" value="3" min="1" max="10" style="width:70px"></div>');
  }
  if(t.kind === 'text' || t.kind === 'logo'){
    h.push('<div class="row"><input type="text" id="' + xId(id, 'txt') + '" value="Your Text" placeholder="text" style="flex:1"></div>');
    h.push('<div class="row"><span class="lbl">size</span><input type="number" id="' + xId(id, 'fs') + '" value="' + (t.kind === 'logo' ? 96 : 48) + '" style="width:90px">');
    h.push('<input type="text" id="' + xId(id, 'fg') + '" value="' + (t.kind === 'logo' ? '#ffffff' : '#111111') + '" style="width:100px">');
    h.push('<input type="text" id="' + xId(id, 'bg') + '" value="' + (t.kind === 'logo' ? '#1a56db' : 'transparent') + '" style="width:120px">');
    h.push('<span class="lbl">padding</span><input type="number" id="' + xId(id, 'pad') + '" value="32" style="width:80px"></div>');
  }
  if(t.kind === 'meme'){
    h.push('<div class="row"><input type="text" id="' + xId(id, 'top') + '" placeholder="top text" style="flex:1">');
    h.push('<input type="text" id="' + xId(id, 'bottom') + '" placeholder="bottom text" style="flex:1"></div>');
    h.push('<div class="row"><span class="lbl">font size</span><input type="number" id="' + xId(id, 'fs') + '" value="48" style="width:90px"></div>');
  }
  if(t.kind === 'social'){
    h.push('<div class="row"><select id="' + xId(id, 'preset') + '">' +
      '<option value="1080x1080">Instagram post 1080\u00d71080</option>' +
      '<option value="1080x1920">Instagram story 1080\u00d71920</option>' +
      '<option value="1280x720">YouTube thumbnail 1280\u00d7720</option>' +
      '<option value="1500x500">Twitter/X header 1500\u00d7500</option>' +
      '<option value="851x315">Facebook cover 851\u00d7315</option>' +
      '<option value="500x500">WhatsApp DP 500\u00d7500</option>' +
      '<option value="1200x628">Facebook post 1200\u00d7628</option>' +
      '</select></div>');
  }
  if(t.kind === 'grid'){
    h.push('<div class="row"><select id="' + xId(id, 'cols') + '"><option value="2">2 column</option><option value="3">3 column</option><option value="4">4 column</option></select>');
    h.push('<input type="number" id="' + xId(id, 'gap') + '" value="8" placeholder="gap" style="width:80px">');
    h.push('<input type="text" id="' + xId(id, 'bg') + '" value="#ffffff" style="width:100px"></div>');
  }
  if(t.kind === 'grad'){
    h.push('<div class="row"><input type="text" id="' + xId(id, 'c1') + '" value="#3fb950" style="width:110px">');
    h.push('<input type="text" id="' + xId(id, 'c2') + '" value="#4493f8" style="width:110px">');
    h.push('<input type="number" id="' + xId(id, 'ang') + '" value="135" style="width:80px">');
    h.push('<input type="number" id="' + xId(id, 'w') + '" value="1080" style="width:90px">');
    h.push('<input type="number" id="' + xId(id, 'h') + '" value="1080" style="width:90px"></div>');
  }
  if(t.kind === 'dpi'){
    h.push('<div class="row"><span class="lbl">DPI</span><input type="number" id="' + xId(id, 'dpi') + '" value="300" style="width:90px"></div>');
  }

  if(t.kind !== 'grid' && t.kind !== 'text' && t.kind !== 'logo' && t.kind !== 'grad'){
    h.push('<img id="' + xId(id, 'prev') + '" class="prev" style="display:none" alt="">');
  }
  if(t.kind === 'grid'){ h.push('<div class="thumbs" id="' + xId(id, 'thumbs') + '"></div>'); }

  h.push('<div class="row"><button class="act pri" id="' + xId(id, 'go') + '" onclick="xRun(\'' + id + '\')">' +
    (t.kind === 'meme' ? 'Meme banao' : t.kind === 'social' ? 'Resize' : t.kind === 'dpi' ? 'Calculate' :
     t.kind === 'favicon' ? 'Icons banao' : t.kind === 'split4' ? 'Kaato' : 'Apply') + '</button></div>');
  h.push('<div class="row" id="' + xId(id, 'outs') + '"></div>');
  h.push('<div class="status" id="' + xId(id, 'st') + '"></div>');
  h.push('</section>');
  return h.join('\n');
}

/* ---------- load ---------- */
function xLoadFile(id, file){
  if(!file){ return; }
  xBusy(id, 'Image load ho rahi hai...');
  var fr = new FileReader();
  fr.onload = function(){
    var img = new Image();
    img.onload = function(){
      var s = xstate(id);
      s.img = img; s.name = file.name || 'image'; s.size = file.size || 0;
      var p = $(xId(id, 'prev'));
      if(p){ p.src = img.src; p.style.display = 'block'; }
      xSet(id, 'Image taiyaar \u2014 ' + img.naturalWidth + '\u00d7' + img.naturalHeight + ' px.', 'ok');
    };
    img.onerror = function(){ xSet(id, 'Image khul nahi paayi.', 'bad'); };
    img.src = fr.result;
  };
  fr.onerror = function(){ xSet(id, 'File padh nahi paayi.', 'bad'); };
  fr.readAsDataURL(file);
}
function xLoadUrl(id){
  var u = (val(xId(id, 'url')) || '').trim();
  if(!u){ xSet(id, 'URL khaali hai.', 'info'); return; }
  xBusy(id, 'URL se image laa raha hoon...');
  var img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function(){
    var s = xstate(id);
    s.img = img; s.name = (u.split('/').pop() || 'image').split('?')[0]; s.size = 0;
    var p = $(xId(id, 'prev'));
    if(p){ p.src = img.src; p.style.display = 'block'; }
    xSet(id, 'Image taiyaar \u2014 ' + img.naturalWidth + '\u00d7' + img.naturalHeight + ' px.', 'ok');
  };
  img.onerror = function(){ xSet(id, 'URL se image nahi khuli (CORS ya galat link). File upload kijiye.', 'bad'); };
  img.src = u;
}
function xGridFiles(id, files){
  var list = Array.prototype.slice.call(files || []);
  if(!list.length){ return; }
  var loaded = [], pending = list.length;
  list.forEach(function(f){
    var fr = new FileReader();
    fr.onload = function(){
      var img = new Image();
      img.onload = function(){ loaded.push({ img: img, name: f.name }); if(--pending === 0){ done(); } };
      img.onerror = function(){ if(--pending === 0){ done(); } };
      img.src = fr.result;
    };
    fr.onerror = function(){ if(--pending === 0){ done(); } };
    fr.readAsDataURL(f);
  });
  function done(){
    var s = xstate(id);
    s.list = loaded;
    var box = $(xId(id, 'thumbs'));
    if(box){
      box.innerHTML = '';
      loaded.forEach(function(it){
        var d = document.createElement('div');
        d.className = 'thumb';
        var im = document.createElement('img');
        im.src = it.img.src;
        d.appendChild(im); box.appendChild(d);
      });
    }
    xSet(id, loaded.length + ' images taiyaar.', loaded.length ? 'ok' : 'bad');
  }
}

/* ---------- outputs ---------- */
function xOutputs(id, items){
  var box = $(xId(id, 'outs'));
  if(!box){ return; }
  box.innerHTML = '';
  items.forEach(function(it){
    var b = document.createElement('button');
    b.className = 'act';
    b.textContent = 'Download ' + it.name;
    b.onclick = function(){ imSave(it.blob, it.name); };
    box.appendChild(b);
  });
  xstate(id).outputs = items;
  if(items.length === 1){
    var b2 = document.createElement('button');
    b2.className = 'act pri';
    b2.textContent = 'Download';
    b2.onclick = function(){ imSave(items[0].blob, items[0].name); };
    box.appendChild(b2);
  }
}

/* ---------- helpers ---------- */
function xHexOrClear(c){
  var v = String(c || '').trim();
  if(v === 'transparent' || v === ''){ return null; }
  return v;
}
function xFmt(id){ return val(xId(id, 'fmt')) || 'image/png'; }
function xExt(mime){ return mime === 'image/jpeg' ? '.jpg' : (mime === 'image/webp' ? '.webp' : '.png'); }

/* ---------- run ---------- */
function xRun(id){
  var t = EXTRA_TOOLS.filter(function(x){ return x.id === id; })[0];
  if(!t){ return; }
  var s = xstate(id);
  try{
    if(t.kind === 'text' || t.kind === 'logo'){ return xTextTool(id, t); }
    if(t.kind === 'grad'){ return xGradient(id); }
    if(t.kind === 'grid'){
      if(!s.list || s.list.length < 2){ xSet(id, 'Kam se kam 2 images chuniye.', 'info'); return; }
      return xGrid(id);
    }
    if(!s.img){ xSet(id, 'Pehle image chuniye ya URL daaliye.', 'info'); return; }
    if(t.kind === 'round'){ return xRound(id, t); }
    if(t.kind === 'border'){ return xBorder(id); }
    if(t.kind === 'shadow'){ return xShadow(id); }
    if(t.kind === 'water'){ return xWatermark(id); }
    if(t.kind === 'tile'){ return xTile(id); }
    if(t.kind === 'split4'){ return xSplit4(id); }
    if(t.kind === 'meme'){ return xMeme(id); }
    if(t.kind === 'social'){ return xSocial(id); }
    if(t.kind === 'dpi'){ return xDpi(id); }
    if(t.kind === 'favicon'){ return xFavicon(id); }
  }catch(e){
    xSet(id, 'Fail: ' + e.message, 'bad');
  }
}

function xRound(id, t){
  var s = xstate(id), img = s.img, fmt = xFmt(id);
  var r = parseInt(val(xId(id, 'r')), 10) || 32;
  var w = img.naturalWidth, h = img.naturalHeight;
  var c = imCanvas(w, h), ctx = c.getContext('2d');
  if(fmt === 'image/jpeg'){ ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
  var rr = Math.min(r, Math.min(w, h) / 2);
  ctx.beginPath();
  ctx.moveTo(rr, 0);
  ctx.lineTo(w - rr, 0); ctx.quadraticCurveTo(w, 0, w, rr);
  ctx.lineTo(w, h - rr); ctx.quadraticCurveTo(w, h, w - rr, h);
  ctx.lineTo(rr, h); ctx.quadraticCurveTo(0, h, 0, h - rr);
  ctx.lineTo(0, rr); ctx.quadraticCurveTo(0, 0, rr, 0);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, 0, 0);
  xBusy(id, 'Kaam chal raha hai...');
  imBlob(c, fmt, 0.92).then(function(b){
    xOutputs(id, [{ blob: b, name: imBase(s.name) + '-rounded' + xExt(fmt) }]);
    xSet(id, 'Taiyaar \u2014 ' + imSize(b.size) + '. Neeche download dabaiye.', 'ok');
  }).catch(function(e){ xSet(id, e.message, 'bad'); });
}

function xBorder(id){
  var s = xstate(id), img = s.img;
  var bw = parseInt(val(xId(id, 'bw')), 10) || 0;
  var bc = val(xId(id, 'bc')) || '#000000';
  var pad = parseInt(val(xId(id, 'pad')), 10) || 0;
  var bg = xHexOrClear(val(xId(id, 'bg'))) || '#ffffff';
  var w = img.naturalWidth, h = img.naturalHeight;
  var c = imCanvas(w + (bw + pad) * 2, h + (bw + pad) * 2);
  var ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
  if(bw > 0){ ctx.fillStyle = bc; ctx.fillRect(pad, pad, w + bw * 2, h + bw * 2); }
  ctx.drawImage(img, pad + bw, pad + bw);
  xBusy(id, 'Kaam chal raha hai...');
  imBlob(c, 'image/png', 1).then(function(b){
    xOutputs(id, [{ blob: b, name: imBase(s.name) + '-border.png' }]);
    xSet(id, 'Taiyaar \u2014 ' + c.width + '\u00d7' + c.height + ' px, ' + imSize(b.size) + '.', 'ok');
  }).catch(function(e){ xSet(id, e.message, 'bad'); });
}

function xShadow(id){
  var s = xstate(id), img = s.img;
  var blur = parseInt(val(xId(id, 'blur')), 10) || 24;
  var off = parseInt(val(xId(id, 'off')), 10) || 12;
  var bg = xHexOrClear(val(xId(id, 'bg'))) || '#ffffff';
  var w = img.naturalWidth, h = img.naturalHeight;
  var m = Math.max(blur * 2, off * 2);
  var c = imCanvas(w + m * 2, h + m * 2), ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
  ctx.save();
  if('filter' in ctx){ ctx.filter = 'blur(' + blur + 'px)'; }
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(m + off, m + off, w, h);
  ctx.restore();
  ctx.drawImage(img, m, m);
  xBusy(id, 'Kaam chal raha hai...');
  imBlob(c, 'image/png', 1).then(function(b){
    xOutputs(id, [{ blob: b, name: imBase(s.name) + '-shadow.png' }]);
    xSet(id, 'Taiyaar \u2014 ' + imSize(b.size) + '.', 'ok');
  }).catch(function(e){ xSet(id, e.message, 'bad'); });
}

function xWatermark(id){
  var s = xstate(id), img = s.img;
  var txt = val(xId(id, 'txt')) || 'watermark';
  var pos = val(xId(id, 'pos')) || 'br';
  var fs = parseInt(val(xId(id, 'fs')), 10) || 28;
  var op = (parseInt(val(xId(id, 'op')), 10) || 55) / 100;
  var w = img.naturalWidth, h = img.naturalHeight;
  var c = imCanvas(w, h), ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.font = 'bold ' + fs + 'px sans-serif';
  ctx.globalAlpha = op;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = Math.max(2, fs / 10);
  var tw = ctx.measureText(txt).width;
  var pad = Math.max(12, fs / 2);
  var x = pad, y = h - pad;
  if(pos === 'br'){ x = w - tw - pad; }
  if(pos === 'tr'){ x = w - tw - pad; y = fs + pad; }
  if(pos === 'tl'){ y = fs + pad; }
  if(pos === 'c'){ x = (w - tw) / 2; y = (h + fs) / 2; }
  ctx.strokeText(txt, x, y);
  ctx.fillText(txt, x, y);
  xBusy(id, 'Kaam chal raha hai...');
  imBlob(c, 'image/png', 1).then(function(b){
    xOutputs(id, [{ blob: b, name: imBase(s.name) + '-watermark.png' }]);
    xSet(id, 'Taiyaar \u2014 ' + imSize(b.size) + '.', 'ok');
  }).catch(function(e){ xSet(id, e.message, 'bad'); });
}

function xTile(id){
  var s = xstate(id), img = s.img;
  var nx = Math.max(1, Math.min(10, parseInt(val(xId(id, 'nx')), 10) || 3));
  var ny = Math.max(1, Math.min(10, parseInt(val(xId(id, 'ny')), 10) || 3));
  var w = img.naturalWidth, h = img.naturalHeight;
  var c = imCanvas(w * nx, h * ny), ctx = c.getContext('2d');
  for(var y = 0; y < ny; y++){
    for(var x = 0; x < nx; x++){ ctx.drawImage(img, x * w, y * h); }
  }
  xBusy(id, 'Kaam chal raha hai...');
  imBlob(c, 'image/png', 1).then(function(b){
    xOutputs(id, [{ blob: b, name: imBase(s.name) + '-tile' + nx + 'x' + ny + '.png' }]);
    xSet(id, 'Taiyaar \u2014 ' + c.width + '\u00d7' + c.height + ' px, ' + imSize(b.size) + '.', 'ok');
  }).catch(function(e){ xSet(id, e.message, 'bad'); });
}

function xSplit4(id){
  var s = xstate(id), img = s.img;
  var w = Math.floor(img.naturalWidth / 2), h = Math.floor(img.naturalHeight / 2);
  var parts = [['tl', 0, 0], ['tr', w, 0], ['bl', 0, h], ['br', w, h]];
  xBusy(id, 'Kaat raha hoon...');
  Promise.all(parts.map(function(p){
    var c = imCanvas(w, h);
    c.getContext('2d').drawImage(img, p[1], p[2], w, h, 0, 0, w, h);
    return imBlob(c, 'image/png', 1).then(function(b){ return { blob: b, name: imBase(s.name) + '-' + p[0] + '.png' }; });
  })).then(function(items){
    xOutputs(id, items);
    xSet(id, '4 hisse taiyaar \u2014 har ek ' + w + '\u00d7' + h + ' px.', 'ok');
  }).catch(function(e){ xSet(id, e.message, 'bad'); });
}

function xTextTool(id, t){
  var txt = val(xId(id, 'txt')) || 'Text';
  var fs = parseInt(val(xId(id, 'fs')), 10) || 48;
  var fg = xHexOrClear(val(xId(id, 'fg'))) || '#111111';
  var bg = xHexOrClear(val(xId(id, 'bg')));
  var pad = parseInt(val(xId(id, 'pad')), 10) || 32;
  var c = imCanvas(10, 10), ctx = c.getContext('2d');
  ctx.font = 'bold ' + fs + 'px sans-serif';
  var tw = Math.ceil(ctx.measureText(txt).width);
  var w = tw + pad * 2, h = fs + pad * 2;
  c = imCanvas(w, h); ctx = c.getContext('2d');
  if(bg){ ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  ctx.font = 'bold ' + fs + 'px sans-serif';
  ctx.fillStyle = fg;
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, pad, h / 2);
  xBusy(id, 'Bana raha hoon...');
  imBlob(c, 'image/png', 1).then(function(b){
    xOutputs(id, [{ blob: b, name: (t.kind === 'logo' ? 'logo' : 'text') + '.png' }]);
    xSet(id, 'Taiyaar \u2014 ' + w + '\u00d7' + h + ' px, ' + imSize(b.size) + '.', 'ok');
  }).catch(function(e){ xSet(id, e.message, 'bad'); });
}

function xMeme(id){
  var s = xstate(id), img = s.img;
  var top = val(xId(id, 'top')) || '';
  var bottom = val(xId(id, 'bottom')) || '';
  var fs = parseInt(val(xId(id, 'fs')), 10) || 48;
  var w = img.naturalWidth, h = img.naturalHeight;
  var c = imCanvas(w, h), ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  function draw(text, y, baseline){
    if(!text){ return; }
    ctx.font = 'bold ' + fs + 'px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = baseline;
    ctx.lineWidth = Math.max(3, fs / 8);
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#ffffff';
    ctx.strokeText(text, w / 2, y, w - 20);
    ctx.fillText(text, w / 2, y, w - 20);
  }
  draw(top, fs * 0.4 + 10, 'top');
  draw(bottom, h - 10, 'bottom');
  xBusy(id, 'Meme ban raha hai...');
  imBlob(c, 'image/png', 1).then(function(b){
    xOutputs(id, [{ blob: b, name: 'meme.png' }]);
    xSet(id, 'Taiyaar \u2014 ' + imSize(b.size) + '.', 'ok');
  }).catch(function(e){ xSet(id, e.message, 'bad'); });
}

function xSocial(id){
  var s = xstate(id), img = s.img;
  var preset = (val(xId(id, 'preset')) || '1080x1080').split('x');
  var tw = parseInt(preset[0], 10), th = parseInt(preset[1], 10);
  var sw = img.naturalWidth, sh = img.naturalHeight;
  var scale = Math.max(tw / sw, th / sh);           /* cover */
  var dw = sw * scale, dh = sh * scale;
  var c = imCanvas(tw, th), ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, tw, th);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (tw - dw) / 2, (th - dh) / 2, dw, dh);
  xBusy(id, 'Resize ho raha hai...');
  imBlob(c, 'image/jpeg', 0.92).then(function(b){
    xOutputs(id, [{ blob: b, name: 'social-' + tw + 'x' + th + '.jpg' }]);
    xSet(id, 'Taiyaar \u2014 ' + tw + '\u00d7' + th + ' px, ' + imSize(b.size) + '.', 'ok');
  }).catch(function(e){ xSet(id, e.message, 'bad'); });
}

function xGrid(id){
  var s = xstate(id);
  var cols = parseInt(val(xId(id, 'cols')), 10) || 2;
  var gap = parseInt(val(xId(id, 'gap')), 10) || 0;
  var bg = xHexOrClear(val(xId(id, 'bg'))) || '#ffffff';
  var n = s.list.length;
  var rows = Math.ceil(n / cols);
  var cellW = 0, cellH = 0;
  s.list.forEach(function(it){
    cellW = Math.max(cellW, it.img.naturalWidth);
    cellH = Math.max(cellH, it.img.naturalHeight);
  });
  cellW = Math.min(cellW, 800); cellH = Math.min(cellH, 800);
  var W = cols * cellW + (cols + 1) * gap;
  var H = rows * cellH + (rows + 1) * gap;
  if(W > 6000 || H > 6000){ xSet(id, 'Grid bahut bada ho raha hai — images chhoti kijiye.', 'bad'); return; }
  var c = imCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  s.list.forEach(function(it, i){
    var cx = gap + (i % cols) * (cellW + gap);
    var cy = gap + Math.floor(i / cols) * (cellH + gap);
    var sc = Math.min(cellW / it.img.naturalWidth, cellH / it.img.naturalHeight);
    var dw = it.img.naturalWidth * sc, dh = it.img.naturalHeight * sc;
    ctx.drawImage(it.img, cx + (cellW - dw) / 2, cy + (cellH - dh) / 2, dw, dh);
  });
  xBusy(id, 'Grid ban raha hai...');
  imBlob(c, 'image/png', 1).then(function(b){
    xOutputs(id, [{ blob: b, name: 'grid.png' }]);
    xSet(id, 'Taiyaar \u2014 ' + W + '\u00d7' + H + ' px, ' + imSize(b.size) + '.', 'ok');
  }).catch(function(e){ xSet(id, e.message, 'bad'); });
}

function xGradient(id){
  var c1 = val(xId(id, 'c1')) || '#3fb950';
  var c2 = val(xId(id, 'c2')) || '#4493f8';
  var ang = parseInt(val(xId(id, 'ang')), 10) || 135;
  var w = Math.max(16, Math.min(4000, parseInt(val(xId(id, 'w')), 10) || 1080));
  var h = Math.max(16, Math.min(4000, parseInt(val(xId(id, 'h')), 10) || 1080));
  var c = imCanvas(w, h), ctx = c.getContext('2d');
  var rad = ang * Math.PI / 180;
  var x2 = w / 2 + Math.cos(rad) * w / 2, y2 = h / 2 + Math.sin(rad) * h / 2;
  var g = ctx.createLinearGradient(w / 2 - Math.cos(rad) * w / 2, h / 2 - Math.sin(rad) * h / 2, x2, y2);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  xBusy(id, 'Bana raha hoon...');
  imBlob(c, 'image/png', 1).then(function(b){
    xOutputs(id, [{ blob: b, name: 'gradient-' + w + 'x' + h + '.png' }]);
    xSet(id, 'Taiyaar \u2014 ' + w + '\u00d7' + h + ' px, ' + imSize(b.size) + '.', 'ok');
  }).catch(function(e){ xSet(id, e.message, 'bad'); });
}

function xDpi(id){
  var s = xstate(id);
  if(!s.img){ xSet(id, 'Pehle image chuniye.', 'info'); return; }
  var dpi = parseInt(val(xId(id, 'dpi')), 10) || 300;
  var w = s.img.naturalWidth, h = s.img.naturalHeight;
  var iw = w / dpi, ih = h / dpi;
  var lines = [
    'Pixels      : ' + w + ' \u00d7 ' + h,
    'DPI         : ' + dpi,
    'Print size  : ' + (Math.round(iw * 100) / 100) + ' \u00d7 ' + (Math.round(ih * 100) / 100) + ' inch',
    '            : ' + (Math.round(iw * 2.54 * 100) / 100) + ' \u00d7 ' + (Math.round(ih * 2.54 * 100) / 100) + ' cm',
    '',
    'A4 (8.27 \u00d7 11.69 inch) par: ' + (iw >= 8.27 && ih >= 11.69 ? 'poora fit ho jaayega' : 'fit nahi hoga, chhota karna padega'),
    'Passport (35 \u00d7 45 mm) ke liye: ' + (iw >= 1.38 && ih >= 1.77 ? 'theek hai' : 'thoda chhota hai')
  ];
  xSet(id, lines.join('\n'), 'ok');
}

function xFavicon(id){
  var s = xstate(id);
  if(!s.img){ xSet(id, 'Pehle image chuniye.', 'info'); return; }
  var sizes = [16, 32, 48, 180];
  xBusy(id, 'Icons bana raha hoon...');
  Promise.all(sizes.map(function(sz){
    var c = imCanvas(sz, sz), ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    var sc = Math.max(sz / s.img.naturalWidth, sz / s.img.naturalHeight);
    var dw = s.img.naturalWidth * sc, dh = s.img.naturalHeight * sc;
    ctx.drawImage(s.img, (sz - dw) / 2, (sz - dh) / 2, dw, dh);
    return imBlob(c, 'image/png', 1).then(function(b){
      return { blob: b, name: 'icon-' + sz + 'x' + sz + '.png' };
    });
  })).then(function(items){
    xOutputs(id, items);
    xSet(id, 'Chaar icon taiyaar (16, 32, 48, 180 px).', 'ok');
  }).catch(function(e){ xSet(id, e.message, 'bad'); });
}

/* ---------- build ---------- */
function xBuild(){
  var aside = document.querySelector('aside');
  var main = document.querySelector('main');
  if(!aside || !main || !$('g-img')){ return; }
  var navHtml = [], panels = [];
  EXTRA_TOOLS.forEach(function(t){
    navHtml.push('<button class="nav" title="' + t.name + '" onclick="openTool(\'' + t.id + '\',this)">' + t.name + '</button>');
    panels.push(xPanelHtml(t));
  });
  $('g-img').insertAdjacentHTML('beforeend', navHtml.join('\n'));
  main.insertAdjacentHTML('beforeend', panels.join('\n'));
  var cnt = document.querySelector('[data-g="img"] .count');
  if(cnt){ cnt.textContent = String(document.querySelectorAll('#g-img .nav').length); }
  IMG_TOOLS = IMG_TOOLS.concat(EXTRA_TOOLS);

  EXTRA_TOOLS.forEach(function(t){
    var inp = $(xId(t.id, 'file'));
    var drop = $(xId(t.id, 'drop'));
    if(inp){
      inp.addEventListener('change', function(){
        if(t.kind === 'grid'){ xGridFiles(t.id, inp.files); }
        else { xLoadFile(t.id, inp.files[0]); }
      });
    }
    if(drop){
      drop.addEventListener('click', function(){ if(inp){ inp.click(); } });
      ['dragenter','dragover'].forEach(function(ev){
        drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.add('over'); });
      });
      ['dragleave','drop'].forEach(function(ev){
        drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.remove('over'); });
      });
      drop.addEventListener('drop', function(e){
        var f = e.dataTransfer && e.dataTransfer.files;
        if(!f || !f.length){ return; }
        if(t.kind === 'grid'){ xGridFiles(t.id, f); }
        else { xLoadFile(t.id, f[0]); }
      });
    }
  });
}
xBuild();

/* ===== imagetools3 ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

// @ts-nocheck

/* ===================================================================
   IMAGE TOOLS — batch 3: baaki saare tools
   =================================================================== */

var TOOLS3 = [
  /* ---- editing ---- */
  { id:'y-rgb',      name:'RGB colour balance', kind:'rgb',      desc:'R, G, B channel alag-alag badhayein ya ghataayein.' },
  { id:'y-duotone',  name:'Duotone',            kind:'duotone',  desc:'Do rangon mein tasveer — dark se light.' },
  { id:'y-sketch',   name:'Pencil sketch',      kind:'sketch',   desc:'Photo ko pencil drawing jaisa banaiye.' },
  { id:'y-channels', name:'RGB channel split',  kind:'channels', desc:'Red, green, blue channel alag-alag files mein.' },
  { id:'y-overlay',  name:'Image overlay',      kind:'overlay',  desc:'Do image ek doosre par, opacity ke saath.' },
  { id:'y-split',    name:'Image splitter',     kind:'split',    desc:'Rows aur columns mein kaatiye — har hissa alag file.' },
  { id:'y-mosaic',   name:'Photo mosaic',       kind:'mosaic',   desc:'Chhote tukdon se bani mosaic image.' },
  { id:'y-noise',    name:'Noise effect',       kind:'noise',    desc:'Purane film jaisa dana-dana noise.' },
  { id:'y-compare',  name:'Before / after',     kind:'compare',  desc:'Slider se pehle aur baad ka farak dekhiye.' },
  { id:'y-merge',    name:'Image merger',       kind:'merge',    desc:'Kai images ko top-bottom ya side-by-side jodiye.' },

  /* ---- design ---- */
  { id:'y-ytthumb',  name:'YouTube thumbnail',  kind:'ytthumb',  desc:'1280x720 thumbnail, title text ke saath.' },
  { id:'y-ytbanner', name:'YouTube banner',     kind:'ytbanner', desc:'2048x1152 banner, safe area ke saath.' },
  { id:'y-pfp',      name:'Gaming profile pic', kind:'pfp',      desc:'Gol profile picture, 1000x1000.' },
  { id:'y-strip',    name:'Photo strip',        kind:'strip',    desc:'Photobooth jaisi lambi patti.' },
  { id:'y-contact',  name:'Contact sheet',      kind:'contact',  desc:'Kai photos ka grid, naam ke saath.' },
  { id:'y-frame',    name:'Photo frame',        kind:'frame',    desc:'Tasveer ke chaaron taraf frame aur mat.' },
  { id:'y-checker',  name:'Checkerboard',       kind:'checker',  desc:'Transparency wala checkerboard pattern.' },
  { id:'y-blank',    name:'Transparent canvas', kind:'blank',    desc:'Khaali pardeep PNG, kisi bhi size ki.' },
  { id:'y-passport', name:'Passport photo',     kind:'passport', desc:'Ek photo se passport size ki poori sheet.' },

  /* ---- info ---- */
  { id:'y-meta',     name:'Metadata viewer',    kind:'meta',     desc:'EXIF aur file ki jaankari.' },
  { id:'y-hist',     name:'Histogram',          kind:'hist',     desc:'R, G, B ka histogram graph.' },
  { id:'y-auto',     name:'Auto brightness',    kind:'auto',     desc:'Andheri ya dhundhli photo apne aap theek.' },

  /* ---- utility ---- */
  { id:'y-qr',       name:'QR code',            kind:'qr',       desc:'Text ya link ka QR code — bina internet.' },
  { id:'y-sbs',      name:'Side by side',       kind:'sbs',      desc:'Do images ko baayein-daayein jodiye.' },
  { id:'y-palgrad',  name:'Palette gradient',   kind:'palgrad',  desc:'Image ke rangon se gradient banaiye.' }
];

var YS = {};
function ystate(id){ if(!YS[id]){ YS[id] = { img:null, list:[], outputs:[], name:'', size:0 }; } return YS[id]; }
function yId(id, p){ return id + '-' + p; }
function ySet(id, msg, cls){
  var e = $(yId(id, 'st'));
  if(!e){ return; }
  e.innerHTML = msg;
  e.className = 'status ' + (cls || '');
}
function yBusy(id, msg){
  ySet(id, '<span class="spin"></span>' + String(msg || 'Kaam chal raha hai...').replace(/&/g,'&amp;').replace(/</g,'&lt;'), 'info');
}
function yOut(id, items, note){
  var box = $(yId(id, 'outs'));
  if(box){
    box.innerHTML = '';
    items.forEach(function(it){
      var b = document.createElement('button');
      b.className = 'act';
      b.textContent = 'Download ' + it.name;
      b.onclick = function(){ imSave(it.blob, it.name); };
      box.appendChild(b);
    });
    if(items.length === 1){
      var b2 = document.createElement('button');
      b2.className = 'act pri';
      b2.textContent = 'Download';
      b2.onclick = function(){ imSave(items[0].blob, items[0].name); };
      box.appendChild(b2);
    }
  }
  ystate(id).outputs = items;
  ySet(id, note || ('Taiyaar — ' + items.length + ' file. Neeche download dabaiye.'), 'ok');
}
function yCol(v, d){ var s = String(v || '').trim(); return (s === '' || s === 'transparent') ? d : s; }
function yNum(id, p, d){ var n = parseFloat(val(yId(id, p))); return isNaN(n) ? d : n; }

/* ---------------- panel ---------------- */
function yPanel(t){
  var id = t.id, h = [];
  var noImage = ['checker','blank','qr','palgrad'].indexOf(t.kind) >= 0;
  var multi = ['merge','strip','contact','sbs'].indexOf(t.kind) >= 0;
  var two = (t.kind === 'overlay');

  h.push('<section id="t-' + id + '" class="tool">');
  h.push('<h2>' + t.name + '</h2>');
  h.push('<p class="desc">' + t.desc + '</p>');

  if(t.kind === 'sign'){
    h.push('<div class="cropwrap"><canvas id="' + yId(id, 'canvas') + '" width="700" height="260" style="background:#fff;touch-action:none"></canvas></div>');
    h.push('<div class="row"><span class="lbl">Yahan ungli ya mouse se signature kijiye</span></div>');
  } else if(multi){
    h.push('<div class="row"><input type="file" id="' + yId(id, 'file') + '" accept="image/*" multiple></div>');
    h.push('<div class="drop" id="' + yId(id, 'drop') + '">Images yahan drag kijiye</div>');
    h.push('<div class="thumbs" id="' + yId(id, 'thumbs') + '"></div>');
  } else if(two){
    h.push('<div class="row"><span class="lbl">base image</span><input type="file" id="' + yId(id, 'file') + '" accept="image/*"></div>');
    h.push('<div class="row"><span class="lbl">upar wali image</span><input type="file" id="' + yId(id, 'file2') + '" accept="image/*"></div>');
  } else if(!noImage){
    h.push('<div class="row"><input type="file" id="' + yId(id, 'file') + '" accept="image/*"></div>');
    h.push('<div class="drop" id="' + yId(id, 'drop') + '">Image yahan drag kijiye, ya upar se chuniye</div>');
    h.push('<div class="row"><input type="text" id="' + yId(id, 'url') + '" placeholder="or image URL" style="flex:1">');
    h.push('<button class="act" onclick="yLoadUrl(\'' + id + '\')">Load from URL</button></div>');
  }

  /* options */
  if(t.kind === 'rgb'){
    h.push('<div class="row"><span class="lbl">R</span><input type="number" id="' + yId(id,'r') + '" value="110" min="0" max="250" style="width:80px">');
    h.push('<span class="lbl">G</span><input type="number" id="' + yId(id,'g') + '" value="100" min="0" max="250" style="width:80px">');
    h.push('<span class="lbl">B</span><input type="number" id="' + yId(id,'b') + '" value="90" min="0" max="250" style="width:80px"></div>');
  }
  if(t.kind === 'duotone'){
    h.push('<div class="row"><span class="lbl">dark</span><input type="text" id="' + yId(id,'c1') + '" value="#0b1f3a" style="width:110px">');
    h.push('<span class="lbl">light</span><input type="text" id="' + yId(id,'c2') + '" value="#f0c419" style="width:110px"></div>');
  }
  if(t.kind === 'sketch'){
    h.push('<div class="row"><span class="lbl">strength</span><input type="number" id="' + yId(id,'k') + '" value="12" min="2" max="40" style="width:80px"></div>');
  }
  if(t.kind === 'overlay'){
    h.push('<div class="row"><span class="lbl">opacity</span><input type="number" id="' + yId(id,'op') + '" value="60" min="0" max="100" style="width:80px">');
    h.push('<select id="' + yId(id,'blend') + '"><option value="source-over">normal</option><option value="multiply">multiply</option>' +
      '<option value="screen">screen</option><option value="overlay">overlay</option><option value="soft-light">soft light</option></select></div>');
  }
  if(t.kind === 'split'){
    h.push('<div class="row"><span class="lbl">rows</span><input type="number" id="' + yId(id,'rows') + '" value="2" min="1" max="6" style="width:70px">');
    h.push('<span class="lbl">columns</span><input type="number" id="' + yId(id,'cols') + '" value="2" min="1" max="6" style="width:70px"></div>');
  }
  if(t.kind === 'mosaic'){
    h.push('<div class="row"><span class="lbl">cell size</span><input type="number" id="' + yId(id,'cell') + '" value="18" min="6" max="80" style="width:80px"></div>');
  }
  if(t.kind === 'noise'){
    h.push('<div class="row"><span class="lbl">intensity</span><input type="number" id="' + yId(id,'amt') + '" value="35" min="1" max="120" style="width:80px"></div>');
  }
  if(t.kind === 'compare'){
    h.push('<div class="row"><select id="' + yId(id,'fx') + '"><option value="grayscale">grayscale</option><option value="sepia">sepia</option>' +
      '<option value="blur">blur</option><option value="bright">bright</option></select>');
    h.push('<span class="lbl">slider</span><input type="range" id="' + yId(id,'sl') + '" min="0" max="100" value="50" style="flex:1;max-width:200px"></div>');
  }
  if(t.kind === 'merge' || t.kind === 'sbs'){
    h.push('<div class="row"><select id="' + yId(id,'dir') + '">' +
      (t.kind === 'sbs' ? '<option value="h">baayein-daayein</option>' : '<option value="v">top-bottom</option><option value="h">baayein-daayein</option>') +
      '</select><input type="number" id="' + yId(id,'gap') + '" value="0" placeholder="gap" style="width:80px"></div>');
  }
  if(t.kind === 'glogo'){
    h.push('<div class="row"><input type="text" id="' + yId(id,'txt') + '" value="GAMER" placeholder="naam" style="flex:1">');
    h.push('<input type="number" id="' + yId(id,'fs') + '" value="120" style="width:90px"></div>');
    h.push('<div class="row"><span class="lbl">top</span><input type="text" id="' + yId(id,'c1') + '" value="#ffd400" style="width:100px">');
    h.push('<span class="lbl">bottom</span><input type="text" id="' + yId(id,'c2') + '" value="#ff3d00" style="width:100px">');
    h.push('<span class="lbl">glow</span><input type="text" id="' + yId(id,'c3') + '" value="#00e5ff" style="width:100px"></div>');
  }
  if(t.kind === 'ytthumb'){
    h.push('<div class="row"><input type="text" id="' + yId(id,'txt') + '" placeholder="thumbnail title" style="flex:1">');
    h.push('<span class="lbl">size</span><input type="number" id="' + yId(id,'fs') + '" value="72" style="width:80px"></div>');
  }
  if(t.kind === 'ytbanner'){
    h.push('<div class="row"><input type="text" id="' + yId(id,'txt') + '" placeholder="channel name" style="flex:1">');
    h.push('<span class="lbl">size</span><input type="number" id="' + yId(id,'fs') + '" value="90" style="width:80px"></div>');
  }
  if(t.kind === 'pfp'){
    h.push('<div class="row"><input type="text" id="' + yId(id,'txt') + '" placeholder="bottom text (optional)" style="flex:1">');
    h.push('<input type="text" id="' + yId(id,'c1') + '" value="#1a56db" style="width:100px"></div>');
  }
  if(t.kind === 'sticker'){
    h.push('<div class="row"><span class="lbl">outline</span><input type="number" id="' + yId(id,'w') + '" value="10" min="1" max="40" style="width:80px">');
    h.push('<input type="text" id="' + yId(id,'c') + '" value="#ffffff" style="width:100px"></div>');
  }
  if(t.kind === 'strip'){
    h.push('<div class="row"><input type="text" id="' + yId(id,'txt') + '" placeholder="bottom caption (optional)" style="flex:1">');
    h.push('<input type="text" id="' + yId(id,'bg') + '" value="#ffffff" style="width:100px"></div>');
  }
  if(t.kind === 'contact'){
    h.push('<div class="row"><select id="' + yId(id,'cols') + '"><option value="3">3 column</option><option value="4">4 column</option><option value="5">5 column</option></select>');
    h.push('<input type="text" id="' + yId(id,'bg') + '" value="#ffffff" style="width:100px"></div>');
  }
  if(t.kind === 'frame'){
    h.push('<div class="row"><span class="lbl">border</span><input type="number" id="' + yId(id,'bw') + '" value="24" style="width:80px">');
    h.push('<input type="text" id="' + yId(id,'bc') + '" value="#8b5a2b" style="width:100px">');
    h.push('<span class="lbl">mat</span><input type="number" id="' + yId(id,'mw') + '" value="40" style="width:80px">');
    h.push('<input type="text" id="' + yId(id,'mc') + '" value="#f5f0e6" style="width:100px"></div>');
  }
  if(t.kind === 'caption'){
    h.push('<div class="row"><input type="text" id="' + yId(id,'txt') + '" placeholder="caption" style="flex:1">');
    h.push('<input type="text" id="' + yId(id,'bg') + '" value="#111111" style="width:100px">');
    h.push('<input type="text" id="' + yId(id,'fg') + '" value="#ffffff" style="width:100px">');
    h.push('<input type="number" id="' + yId(id,'fs') + '" value="36" style="width:80px"></div>');
  }
  if(t.kind === 'checker'){
    h.push('<div class="row"><input type="number" id="' + yId(id,'w') + '" value="512" style="width:90px">');
    h.push('<input type="number" id="' + yId(id,'h') + '" value="512" style="width:90px">');
    h.push('<input type="number" id="' + yId(id,'cell') + '" value="32" style="width:80px">');
    h.push('<input type="text" id="' + yId(id,'c1') + '" value="#ffffff" style="width:90px">');
    h.push('<input type="text" id="' + yId(id,'c2') + '" value="#cccccc" style="width:90px"></div>');
  }
  if(t.kind === 'blank'){
    h.push('<div class="row"><input type="number" id="' + yId(id,'w') + '" value="1080" style="width:100px">');
    h.push('<input type="number" id="' + yId(id,'h') + '" value="1080" style="width:100px">');
    h.push('<input type="text" id="' + yId(id,'c') + '" value="transparent" style="width:120px"></div>');
  }
  if(t.kind === 'passport'){
    h.push('<div class="row"><select id="' + yId(id,'size') + '">' +
      '<option value="413x531">35x45 mm @300dpi</option><option value="600x600">2x2 inch @300dpi</option>' +
      '<option value="413x591">35x50 mm @300dpi</option></select>');
    h.push('<select id="' + yId(id,'cols') + '"><option value="4">4 column</option><option value="2">2 column</option></select>');
    h.push('<input type="text" id="' + yId(id,'bg') + '" value="#ffffff" style="width:90px"></div>');
  }
  if(t.kind === 'hist'){
    h.push('<div class="row"><span class="lbl">Histogram load hone par bana hoga</span></div>');
  }
  if(t.kind === 'qr'){
    h.push('<div class="row"><textarea id="' + yId(id,'txt') + '" class="short" placeholder="type text or a link here"></textarea></div>');
    h.push('<div class="row"><span class="lbl">size</span><input type="number" id="' + yId(id,'px') + '" value="512" style="width:90px">');
    h.push('<span class="lbl">ECC</span><select id="' + yId(id,'ecc') + '"><option value="L">L (sabse chhota)</option>' +
      '<option value="M">M</option><option value="Q">Q</option><option value="H">H (sabse mazboot)</option></select></div>');
  }
  if(t.kind === 'palgrad'){
    h.push('<div class="row"><input type="number" id="' + yId(id,'w') + '" value="1080" style="width:90px">');
    h.push('<input type="number" id="' + yId(id,'h') + '" value="1080" style="width:90px">');
    h.push('<span class="lbl">angle</span><input type="number" id="' + yId(id,'ang') + '" value="135" style="width:80px"></div>');
  }

  if(t.kind === 'compare'){
    h.push('<div class="cropwrap" id="' + yId(id,'wrap') + '" style="position:relative">');
    h.push('<canvas id="' + yId(id,'cvA') + '"></canvas>');
    h.push('<canvas id="' + yId(id,'cvB') + '" style="position:absolute;left:0;top:0;clip-path:inset(0 50% 0 0)"></canvas>');
    h.push('</div>');
  } else if(t.kind === 'hist'){
    h.push('<canvas id="' + yId(id,'canvas') + '" style="width:100%;max-width:640px;height:200px;border:1px solid var(--line);border-radius:8px;background:#0b0e12"></canvas>');
  } else if(t.kind === 'sign'){
    /* canvas already added */
  } else if(t.kind === 'checker' || t.kind === 'blank' || t.kind === 'qr' || t.kind === 'palgrad'){
    h.push('<img id="' + yId(id,'prev') + '" class="prev" style="display:none" alt="">');
  } else {
    h.push('<img id="' + yId(id,'prev') + '" class="prev" style="display:none" alt="">');
  }

  h.push('<div class="row"><button class="act pri" onclick="yRun(\'' + id + '\')">' +
    (t.kind === 'sign' ? 'PNG banao' : t.kind === 'qr' ? 'QR banao' : t.kind === 'meta' ? 'View' : 'Create') + '</button>');
  h.push('</div>');
  h.push('<div class="row" id="' + yId(id,'outs') + '"></div>');
  h.push('<div class="status" id="' + yId(id,'st') + '"></div>');
  h.push('</section>');
  return h.join('\n');
}

/* ---------------- loading ---------------- */
function yLoadFile(id, file, slot){
  if(!file){ return; }
  yBusy(id, 'Image load ho rahi hai...');
  var fr = new FileReader();
  fr.onload = function(){
    var img = new Image();
    img.onload = function(){
      var s = ystate(id);
      if(slot === 2){ s.img2 = img; ySet(id, 'Dono images taiyaar.', 'ok'); }
      else {
        s.img = img; s.name = file.name || 'image'; s.size = file.size || 0;
        var p = $(yId(id, 'prev'));
        if(p){ p.src = img.src; p.style.display = 'block'; }
        ySet(id, 'Image taiyaar \u2014 ' + img.naturalWidth + '\u00d7' + img.naturalHeight + ' px.', 'ok');
        if($(yId(id, 'cvA'))){ yCompareInit(id); }
      }
    };
    img.onerror = function(){ ySet(id, 'Image khul nahi paayi.', 'bad'); };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}
function yLoadUrl(id){
  var u = (val(yId(id, 'url')) || '').trim();
  if(!u){ ySet(id, 'URL khaali hai.', 'info'); return; }
  yBusy(id, 'URL se image laa raha hoon...');
  var img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function(){
    var s = ystate(id);
    s.img = img; s.name = (u.split('/').pop() || 'image').split('?')[0]; s.size = 0;
    var p = $(yId(id, 'prev'));
    if(p){ p.src = img.src; p.style.display = 'block'; }
    ySet(id, 'Image taiyaar \u2014 ' + img.naturalWidth + '\u00d7' + img.naturalHeight + ' px.', 'ok');
    if($(yId(id, 'cvA'))){ yCompareInit(id); }
  };
  img.onerror = function(){ ySet(id, 'URL se image nahi khuli (CORS ya galat link).', 'bad'); };
  img.src = u;
}
function yMulti(id, files){
  var list = Array.prototype.slice.call(files || []);
  if(!list.length){ return; }
  var loaded = [], pending = list.length;
  list.forEach(function(f){
    var fr = new FileReader();
    fr.onload = function(){
      var img = new Image();
      img.onload = function(){ loaded.push({ img: img, name: f.name }); if(--pending === 0){ done(); } };
      img.onerror = function(){ if(--pending === 0){ done(); } };
      img.src = fr.result;
    };
    fr.onerror = function(){ if(--pending === 0){ done(); } };
    fr.readAsDataURL(f);
  });
  function done(){
    var s = ystate(id);
    s.list = loaded;
    var box = $(yId(id, 'thumbs'));
    if(box){
      box.innerHTML = '';
      loaded.forEach(function(it){
        var d = document.createElement('div');
        d.className = 'thumb';
        var im = document.createElement('img');
        im.src = it.img.src;
        d.appendChild(im); box.appendChild(d);
      });
    }
    ySet(id, loaded.length + ' images taiyaar.', loaded.length ? 'ok' : 'bad');
  }
}

/* ---------------- run ---------------- */
function yRun(id){
  var t = TOOLS3.filter(function(x){ return x.id === id; })[0];
  if(!t){ return; }
  var s = ystate(id);
  try{
    switch(t.kind){
      case 'rgb':      return yRgb(id, t, s);
      case 'duotone':  return yDuotone(id, t, s);
      case 'sketch':   return ySketch(id, t, s);
      case 'channels': return yChannels(id, t, s);
      case 'overlay':  return yOverlay(id, t, s);
      case 'split':    return ySplit(id, t, s);
      case 'mosaic':   return yMosaic(id, t, s);
      case 'noise':    return yNoise(id, t, s);
      case 'compare':  return yCompareSave(id, t, s);
      case 'merge':    return yMerge(id, t, s, false);
      case 'sbs':      return yMerge(id, t, s, true);
      case 'ytthumb':  return yYtThumb(id, t, s);
      case 'ytbanner': return yYtBanner(id, t, s);
      case 'pfp':      return yPfp(id, t, s);
      case 'strip':    return yStrip(id, t, s);
      case 'contact':  return yContact(id, t, s);
      case 'frame':    return yFrame(id, t, s);
      case 'checker':  return yChecker(id, t);
      case 'blank':    return yBlank(id, t);
      case 'passport': return yPassport(id, t, s);
      case 'meta':     return yMeta(id, s);
      case 'hist':     return yHist(id, s);
      case 'auto':     return yAuto(id, t, s);
      case 'qr':       return yQr(id, t);
      case 'palgrad':  return yPalGrad(id, t, s);
    }
  }catch(e){
    ySet(id, 'Fail: ' + e.message, 'bad');
  }
}

/* ---------------- editing ---------------- */
function yNeedImg(id, s){ if(!s.img){ ySet(id, 'Pehle image chuniye.', 'info'); return false; } return true; }

function yRgb(id, t, s){
  if(!yNeedImg(id, s)){ return; }
  var kr = yNum(id, 'r', 100) / 100, kg = yNum(id, 'g', 100) / 100, kb = yNum(id, 'b', 100) / 100;
  var c = imDraw(s.img, s.img.naturalWidth, s.img.naturalHeight, null);
  imFilterPixels(c, function(r, g, b){
    return [Math.min(255, r * kr), Math.min(255, g * kg), Math.min(255, b * kb)];
  });
  yBusy(id, 'Balance lag raha hai...');
  imBlob(c, 'image/png', 1).then(function(blob){
    yOut(id, [{ blob: blob, name: imBase(s.name) + '-rgb.png' }]);
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

function yDuotone(id, t, s){
  if(!yNeedImg(id, s)){ return; }
  var c1 = yCol(val(yId(id, 'c1')), '#000000'), c2 = yCol(val(yId(id, 'c2')), '#ffffff');
  var a = hexToRgb(c1) || { r: 0, g: 0, b: 0 }, b = hexToRgb(c2) || { r: 255, g: 255, b: 255 };
  var c = imDraw(s.img, s.img.naturalWidth, s.img.naturalHeight, null);
  imFilterPixels(c, function(r, g, bl){
    var v = (0.299 * r + 0.587 * g + 0.114 * bl) / 255;
    return [a.r + (b.r - a.r) * v, a.g + (b.g - a.g) * v, a.b + (b.b - a.b) * v];
  });
  yBusy(id, 'Duotone lag raha hai...');
  imBlob(c, 'image/png', 1).then(function(blob){
    yOut(id, [{ blob: blob, name: imBase(s.name) + '-duotone.png' }]);
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

function ySketch(id, t, s){
  if(!yNeedImg(id, s)){ return; }
  var k = yNum(id, 'k', 12);
  var w = s.img.naturalWidth, h = s.img.naturalHeight;
  var c = imDraw(s.img, w, h, null);
  // grayscale
  imFilterPixels(c, function(r, g, b){
    var v = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    return [v, v, v];
  });
  // invert
  var inv = imCanvas(w, h), ictx = inv.getContext('2d');
  ictx.drawImage(c, 0, 0);
  imFilterPixels(inv, function(r){ return [255 - r, 255 - r, 255 - r]; });
  // blur the inverted copy
  var blur = imCanvas(w, h), bctx = blur.getContext('2d');
  if('filter' in bctx){ bctx.filter = 'blur(' + k + 'px)'; }
  bctx.drawImage(inv, 0, 0);
  bctx.filter = 'none';
  // color dodge: gray / (255 - blurred)
  var grayData = c.getContext('2d').getImageData(0, 0, w, h);
  var blurData = blur.getContext('2d').getImageData(0, 0, w, h);
  var out = c.getContext('2d').createImageData(w, h);
  for(var i = 0; i < grayData.data.length; i += 4){
    var gv = grayData.data[i], bv = blurData.data[i];
    var v = (bv === 255) ? 255 : Math.min(255, gv * 255 / (255 - bv));
    out.data[i] = out.data[i + 1] = out.data[i + 2] = v;
    out.data[i + 3] = 255;
  }
  c.getContext('2d').putImageData(out, 0, 0);
  yBusy(id, 'Sketch ban raha hai...');
  imBlob(c, 'image/png', 1).then(function(blob){
    yOut(id, [{ blob: blob, name: imBase(s.name) + '-sketch.png' }]);
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

function yChannels(id, t, s){
  if(!yNeedImg(id, s)){ return; }
  var w = s.img.naturalWidth, h = s.img.naturalHeight;
  var base = imDraw(s.img, w, h, null);
  var data = base.getContext('2d').getImageData(0, 0, w, h).data;
  var names = ['red', 'green', 'blue'];
  yBusy(id, 'Channels alag kar raha hoon...');
  Promise.all(names.map(function(nm, idx){
    var c = imCanvas(w, h), ctx = c.getContext('2d');
    var d = ctx.createImageData(w, h);
    for(var i = 0; i < data.length; i += 4){
      d.data[i + idx] = data[i + idx];
      d.data[i + 3] = 255;
    }
    ctx.putImageData(d, 0, 0);
    return imBlob(c, 'image/png', 1).then(function(b){ return { blob: b, name: imBase(s.name) + '-' + nm + '.png' }; });
  })).then(function(items){
    yOut(id, items, 'Teen channel files taiyaar.');
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

function yOverlay(id, t, s){
  if(!s.img || !s.img2){ ySet(id, 'Dono images chuniye — base aur upar wali.', 'info'); return; }
  var op = yNum(id, 'op', 60) / 100;
  var blend = val(yId(id, 'blend')) || 'source-over';
  var w = s.img.naturalWidth, h = s.img.naturalHeight;
  var c = imCanvas(w, h), ctx = c.getContext('2d');
  ctx.drawImage(s.img, 0, 0, w, h);
  ctx.globalAlpha = op;
  try{ ctx.globalCompositeOperation = blend; }catch(e){}
  ctx.drawImage(s.img2, 0, 0, w, h);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  yBusy(id, 'Overlay lag raha hai...');
  imBlob(c, 'image/png', 1).then(function(b){
    yOut(id, [{ blob: b, name: imBase(s.name) + '-overlay.png' }]);
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

function ySplit(id, t, s){
  if(!yNeedImg(id, s)){ return; }
  var rows = Math.max(1, Math.min(6, yNum(id, 'rows', 2)));
  var cols = Math.max(1, Math.min(6, yNum(id, 'cols', 2)));
  var w = s.img.naturalWidth, h = s.img.naturalHeight;
  var pw = Math.floor(w / cols), ph = Math.floor(h / rows);
  if(pw < 1 || ph < 1){ ySet(id, 'Image bahut chhoti hai.', 'bad'); return; }
  var jobs = [];
  for(var r = 0; r < rows; r++){
    for(var cI = 0; cI < cols; cI++){
      (function(r, cI){
        var cv = imCanvas(pw, ph);
        cv.getContext('2d').drawImage(s.img, cI * pw, r * ph, pw, ph, 0, 0, pw, ph);
        jobs.push(imBlob(cv, 'image/png', 1).then(function(b){
          return { blob: b, name: imBase(s.name) + '-r' + (r + 1) + 'c' + (cI + 1) + '.png' };
        }));
      })(r, cI);
    }
  }
  yBusy(id, 'Kaat raha hoon...');
  Promise.all(jobs).then(function(items){
    yOut(id, items, items.length + ' hisse taiyaar (har ek ' + pw + '\u00d7' + ph + ' px).');
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

function yMosaic(id, t, s){
  if(!yNeedImg(id, s)){ return; }
  var cell = Math.max(6, Math.min(80, yNum(id, 'cell', 18)));
  var w = s.img.naturalWidth, h = s.img.naturalHeight;
  var cols = Math.max(1, Math.floor(w / cell)), rows = Math.max(1, Math.floor(h / cell));
  var cw = w / cols, ch = h / rows;
  var c = imCanvas(w, h), ctx = c.getContext('2d');
  for(var r = 0; r < rows; r++){
    for(var k = 0; k < cols; k++){
      var sx = k * cw, sy = r * ch;
      var t2 = imCanvas(cw, ch);
      t2.getContext('2d').drawImage(s.img, sx, sy, cw, ch, 0, 0, cw, ch);
      var avg = yAvgColor(t2);
      ctx.fillStyle = 'rgb(' + avg.r + ',' + avg.g + ',' + avg.b + ')';
      ctx.fillRect(sx, sy, cw, ch);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(t2, sx, sy, cw, ch);
      ctx.globalAlpha = 1;
    }
  }
  yBusy(id, 'Mosaic ban rahi hai...');
  imBlob(c, 'image/png', 1).then(function(b){
    yOut(id, [{ blob: b, name: imBase(s.name) + '-mosaic.png' }]);
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}
function yAvgColor(canvas){
  var d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  var r = 0, g = 0, b = 0, n = 0;
  for(var i = 0; i < d.length; i += 4){ r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  n = n || 1;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

function yNoise(id, t, s){
  if(!yNeedImg(id, s)){ return; }
  var amt = Math.max(1, Math.min(120, yNum(id, 'amt', 35)));
  var c = imDraw(s.img, s.img.naturalWidth, s.img.naturalHeight, null);
  imFilterPixels(c, function(r, g, b){
    var n = (Math.random() - 0.5) * amt * 2;
    return [Math.max(0, Math.min(255, r + n)), Math.max(0, Math.min(255, g + n)), Math.max(0, Math.min(255, b + n))];
  });
  yBusy(id, 'Noise daal raha hoon...');
  imBlob(c, 'image/png', 1).then(function(b){
    yOut(id, [{ blob: b, name: imBase(s.name) + '-noise.png' }]);
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

function yCompareInit(id){
  var s = ystate(id);
  if(!s.img){ return; }
  var maxW = Math.min(640, (document.querySelector('main') || document.body).clientWidth - 40);
  var sc = Math.min(1, maxW / s.img.naturalWidth);
  var w = Math.round(s.img.naturalWidth * sc), h = Math.round(s.img.naturalHeight * sc);
  var A = $(yId(id, 'cvA')), B = $(yId(id, 'cvB'));
  if(!A || !B){ return; }
  [A, B].forEach(function(cv){ cv.width = w; cv.height = h; });
  A.getContext('2d').drawImage(s.img, 0, 0, w, h);
  var fx = val(yId(id, 'fx')) || 'grayscale';
  var cB = imDraw(s.img, w, h, null);
  imApplyFilter(fx, cB, { radius: 6, brightness: 25, contrast: 15 });
  B.getContext('2d').drawImage(cB, 0, 0);
  var sl = $(yId(id, 'sl'));
  if(sl){
    sl.oninput = function(){
      B.style.clipPath = 'inset(0 ' + (100 - sl.value) + '% 0 0)';
    };
  }
}
function yCompareSave(id, t, s){
  if(!yNeedImg(id, s)){ return; }
  var A = $(yId(id, 'cvA')), B = $(yId(id, 'cvB'));
  if(!A || !B){ ySet(id, 'Pehle image chuniye.', 'info'); return; }
  var w = A.width, h = A.height;
  var out = imCanvas(w, h), ctx = out.getContext('2d');
  ctx.drawImage(A, 0, 0);
  ctx.drawImage(B, 0, 0);
  var sl = parseInt((($(yId(id, 'sl')) || {}).value) || 50, 10);
  var x = Math.round(w * sl / 100);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 2, 0, 4, h);
  yBusy(id, 'Comparison ban raha hai...');
  imBlob(out, 'image/png', 1).then(function(b){
    yOut(id, [{ blob: b, name: 'compare.png' }]);
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

function yMerge(id, t, s, forceH){
  if(!s.list || s.list.length < 2){ ySet(id, 'Kam se kam 2 images chuniye.', 'info'); return; }
  var dir = forceH ? 'h' : (val(yId(id, 'dir')) || 'v');
  var gap = Math.max(0, yNum(id, 'gap', 0));
  var items = s.list;
  var W = 0, H = 0;
  if(dir === 'h'){
    items.forEach(function(it){ W += it.img.naturalWidth; H = Math.max(H, it.img.naturalHeight); });
    W += gap * (items.length - 1);
  } else {
    items.forEach(function(it){ H += it.img.naturalHeight; W = Math.max(W, it.img.naturalWidth); });
    H += gap * (items.length - 1);
  }
  if(W > 8000 || H > 8000){ ySet(id, 'Bahut bada ho jaayega — images chhoti kijiye.', 'bad'); return; }
  var c = imCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  var x = 0, y = 0;
  items.forEach(function(it){
    ctx.drawImage(it.img, x, y);
    if(dir === 'h'){ x += it.img.naturalWidth + gap; }
    else { y += it.img.naturalHeight + gap; }
  });
  yBusy(id, 'Jod raha hoon...');
  imBlob(c, 'image/png', 1).then(function(b){
    yOut(id, [{ blob: b, name: (forceH ? 'side-by-side' : 'merged') + '.png' }]);
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

/* ---------------- design ---------------- */

function yYtThumb(id, t, s){
  var W = 1280, H = 720;
  var c = imCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, W, H);
  if(s.img){
    var sc = Math.max(W / s.img.naturalWidth, H / s.img.naturalHeight);
    var dw = s.img.naturalWidth * sc, dh = s.img.naturalHeight * sc;
    ctx.drawImage(s.img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
  }
  var txt = val(yId(id, 'txt')) || 'Mera Video Title';
  var fs = Math.max(20, yNum(id, 'fs', 72));
  ctx.font = 'bold ' + fs + 'px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(4, fs / 8);
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#ffffff';
  var words = txt.split(' ');
  var lines = [], line = '';
  words.forEach(function(w2){
    var test = line ? line + ' ' + w2 : w2;
    if(ctx.measureText(test).width > W - 120){ lines.push(line); line = w2; }
    else { line = test; }
  });
  if(line){ lines.push(line); }
  var startY = H / 2 - (lines.length - 1) * fs * 0.7;
  lines.forEach(function(l, i){
    var y = startY + i * fs * 1.3;
    ctx.strokeText(l, W / 2, y, W - 100);
    ctx.fillText(l, W / 2, y, W - 100);
  });
  yBusy(id, 'Thumbnail ban raha hai...');
  imBlob(c, 'image/png', 1).then(function(b){
    yOut(id, [{ blob: b, name: 'youtube-thumbnail-1280x720.png' }]);
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

function yYtBanner(id, t, s){
  var W = 2048, H = 1152;
  var c = imCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#1a56db'; ctx.fillRect(0, 0, W, H);
  if(s.img){
    var sc = Math.max(W / s.img.naturalWidth, H / s.img.naturalHeight);
    var dw = s.img.naturalWidth * sc, dh = s.img.naturalHeight * sc;
    ctx.drawImage(s.img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, W, H);
  }
  // safe area (1546x423 in the middle)
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.setLineDash([18, 14]);
  ctx.lineWidth = 4;
  ctx.strokeRect((W - 1546) / 2, (H - 423) / 2, 1546, 423);
  ctx.setLineDash([]);
  var txt = val(yId(id, 'txt')) || 'Mera Channel';
  var fs = Math.max(20, yNum(id, 'fs', 90));
  ctx.font = 'bold ' + fs + 'px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(4, fs / 8);
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#ffffff';
  ctx.strokeText(txt, W / 2, H / 2, 1500);
  ctx.fillText(txt, W / 2, H / 2, 1500);
  yBusy(id, 'Banner ban raha hai...');
  imBlob(c, 'image/png', 1).then(function(b){
    yOut(id, [{ blob: b, name: 'youtube-banner-2048x1152.png' }],
      'Banner taiyaar — beech wale dashed dabbe ke andar hi text rakhein, mobile par wahi dikhta hai.');
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

function yPfp(id, t, s){
  if(!yNeedImg(id, s)){ return; }
  var S = 1000;
  var c = imCanvas(S, S), ctx = c.getContext('2d');
  ctx.fillStyle = yCol(val(yId(id, 'c1')), '#1a56db');
  ctx.fillRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 10, 0, Math.PI * 2);
  ctx.clip();
  var sc = Math.max(S / s.img.naturalWidth, S / s.img.naturalHeight);
  var dw = s.img.naturalWidth * sc, dh = s.img.naturalHeight * sc;
  ctx.drawImage(s.img, (S - dw) / 2, (S - dh) / 2, dw, dh);
  ctx.restore();
  var txt = val(yId(id, 'txt'));
  if(txt){
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 8; ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff';
    ctx.strokeText(txt, S / 2, S - 30, S - 60);
    ctx.fillText(txt, S / 2, S - 30, S - 60);
  }
  yBusy(id, 'Bana raha hoon...');
  imBlob(c, 'image/png', 1).then(function(b){
    yOut(id, [{ blob: b, name: 'profile-pic-1000x1000.png' }]);
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}


function yStrip(id, t, s){
  if(!s.list || s.list.length < 2){ ySet(id, 'Kam se kam 2 images chuniye.', 'info'); return; }
  var bg = yCol(val(yId(id, 'bg')), '#ffffff');
  var txt = val(yId(id, 'txt')) || '';
  var cellW = 0;
  s.list.forEach(function(it){ cellW = Math.max(cellW, it.img.naturalWidth); });
  cellW = Math.min(cellW, 700);
  var gap = 14, padX = 20;
  var heights = s.list.map(function(it){
    var sc = cellW / it.img.naturalWidth;
    return Math.round(it.img.naturalHeight * sc);
  });
  var H = padX * 2 + heights.reduce(function(a, b){ return a + b; }, 0) + gap * (s.list.length - 1);
  var captionH = txt ? 90 : 0;
  var W = cellW + padX * 2;
  if(H > 12000){ ySet(id, 'Bahut lambi patti — images kam kijiye.', 'bad'); return; }
  var c = imCanvas(W, H + captionH), ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H + captionH);
  var y = padX;
  s.list.forEach(function(it, i){
    ctx.drawImage(it.img, padX, y, cellW, heights[i]);
    y += heights[i] + gap;
  });
  if(txt){
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, W / 2, H + captionH / 2, W - 40);
  }
  yBusy(id, 'Patti ban rahi hai...');
  imBlob(c, 'image/png', 1).then(function(b){
    yOut(id, [{ blob: b, name: 'photo-strip.png' }]);
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

function yContact(id, t, s){
  if(!s.list || s.list.length < 2){ ySet(id, 'Kam se kam 2 images chuniye.', 'info'); return; }
  var cols = Math.max(1, yNum(id, 'cols', 3));
  var bg = yCol(val(yId(id, 'bg')), '#ffffff');
  var cell = 300, gap = 12, pad = 16, labelH = 26;
  var rows = Math.ceil(s.list.length / cols);
  var W = pad * 2 + cols * cell + (cols - 1) * gap;
  var H = pad * 2 + rows * (cell + labelH) + (rows - 1) * gap;
  if(W > 6000 || H > 6000){ ySet(id, 'Bahut bada — images kam kijiye.', 'bad'); return; }
  var c = imCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  s.list.forEach(function(it, i){
    var cx = pad + (i % cols) * (cell + gap);
    var cy = pad + Math.floor(i / cols) * (cell + labelH + gap);
    ctx.fillStyle = '#f2f2f2'; ctx.fillRect(cx, cy, cell, cell);
    var sc = Math.min(cell / it.img.naturalWidth, cell / it.img.naturalHeight);
    var dw = it.img.naturalWidth * sc, dh = it.img.naturalHeight * sc;
    ctx.drawImage(it.img, cx + (cell - dw) / 2, cy + (cell - dh) / 2, dw, dh);
    ctx.fillStyle = '#333333';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((it.name || '').slice(0, 28), cx + cell / 2, cy + cell + labelH / 2, cell - 8);
  });
  yBusy(id, 'Contact sheet ban raha hai...');
  imBlob(c, 'image/png', 1).then(function(b){
    yOut(id, [{ blob: b, name: 'contact-sheet.png' }]);
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

function yFrame(id, t, s){
  if(!yNeedImg(id, s)){ return; }
  var bw = Math.max(0, yNum(id, 'bw', 24));
  var bc = yCol(val(yId(id, 'bc')), '#8b5a2b');
  var mw = Math.max(0, yNum(id, 'mw', 40));
  var mc = yCol(val(yId(id, 'mc')), '#f5f0e6');
  var w = s.img.naturalWidth, h = s.img.naturalHeight;
  var total = bw + mw;
  var c = imCanvas(w + total * 2, h + total * 2), ctx = c.getContext('2d');
  ctx.fillStyle = bc; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = mc; ctx.fillRect(bw, bw, c.width - bw * 2, c.height - bw * 2);
  ctx.drawImage(s.img, total, total);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(total, total, w, h);
  yBusy(id, 'Frame lag raha hai...');
  imBlob(c, 'image/png', 1).then(function(b){
    yOut(id, [{ blob: b, name: imBase(s.name) + '-framed.png' }]);
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}


function yChecker(id, t){
  var w = Math.max(8, Math.min(4000, yNum(id, 'w', 512)));
  var h = Math.max(8, Math.min(4000, yNum(id, 'h', 512)));
  var cell = Math.max(2, yNum(id, 'cell', 32));
  var c1 = yCol(val(yId(id, 'c1')), '#ffffff');
  var c2 = yCol(val(yId(id, 'c2')), '#cccccc');
  var c = imCanvas(w, h), ctx = c.getContext('2d');
  for(var y = 0; y < h; y += cell){
    for(var x = 0; x < w; x += cell){
      var odd = ((Math.floor(x / cell) + Math.floor(y / cell)) % 2) === 1;
      ctx.fillStyle = odd ? c2 : c1;
      ctx.fillRect(x, y, cell, cell);
    }
  }
  yBusy(id, 'Bana raha hoon...');
  imBlob(c, 'image/png', 1).then(function(b){
    yOut(id, [{ blob: b, name: 'checkerboard.png' }]);
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

function yBlank(id, t){
  var w = Math.max(1, Math.min(4000, yNum(id, 'w', 1080)));
  var h = Math.max(1, Math.min(4000, yNum(id, 'h', 1080)));
  var col = String(val(yId(id, 'c')) || 'transparent').trim();
  var c = imCanvas(w, h), ctx = c.getContext('2d');
  if(col && col !== 'transparent'){ ctx.fillStyle = col; ctx.fillRect(0, 0, w, h); }
  yBusy(id, 'Bana raha hoon...');
  imBlob(c, 'image/png', 1).then(function(b){
    yOut(id, [{ blob: b, name: 'blank-' + w + 'x' + h + '.png' }],
      'Taiyaar — ' + w + '\u00d7' + h + ' px' + (col === 'transparent' ? ', poora pardeep.' : ''));
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

function yPassport(id, t, s){
  if(!yNeedImg(id, s)){ return; }
  var size = (val(yId(id, 'size')) || '413x531').split('x');
  var pw = parseInt(size[0], 10), ph = parseInt(size[1], 10);
  var cols = Math.max(1, yNum(id, 'cols', 4));
  var bg = yCol(val(yId(id, 'bg')), '#ffffff');
  var rows = Math.ceil(8 / cols);
  var gap = 12, pad = 20;
  var W = pad * 2 + cols * pw + (cols - 1) * gap;
  var H = pad * 2 + rows * ph + (rows - 1) * gap;
  var c = imCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  for(var i = 0; i < 8; i++){
    var cx = pad + (i % cols) * (pw + gap);
    var cy = pad + Math.floor(i / cols) * (ph + gap);
    var sc = Math.max(pw / s.img.naturalWidth, ph / s.img.naturalHeight);
    var dw = s.img.naturalWidth * sc, dh = s.img.naturalHeight * sc;
    ctx.save();
    ctx.beginPath(); ctx.rect(cx, cy, pw, ph); ctx.clip();
    ctx.drawImage(s.img, cx + (pw - dw) / 2, cy + (ph - dh) / 2, dw, dh);
    ctx.restore();
    ctx.strokeStyle = '#bbbbbb'; ctx.lineWidth = 1;
    ctx.strokeRect(cx, cy, pw, ph);
  }
  yBusy(id, 'Sheet ban rahi hai...');
  imBlob(c, 'image/png', 1).then(function(b){
    yOut(id, [{ blob: b, name: 'passport-sheet-' + pw + 'x' + ph + '.png' }],
      'Sheet taiyaar — ' + cols + ' column, 8 photo.');
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

/* ---------- signature ---------- */
var SIGN = { drawing:false, last:null, bound:{} };

/* ---------------- info ---------------- */
function yMeta(id, s){
  if(!s.img){ ySet(id, 'Pehle image chuniye.', 'info'); return; }
  var lines = [
    'Naam       : ' + (s.name || 'image'),
    'File size  : ' + (s.size ? imSize(s.size) : 'pata nahi'),
    'Dimensions : ' + s.img.naturalWidth + ' \u00d7 ' + s.img.naturalHeight + ' px',
    'Aspect     : ' + imRatio(s.img.naturalWidth, s.img.naturalHeight),
    'Transparency: ' + (imHasAlpha(s.img) ? 'haan' : 'nahi')
  ];
  var exif = yExif(s.img.src);
  if(exif && exif.length){
    lines.push('');
    lines.push('EXIF:');
    exif.forEach(function(e){ lines.push('  ' + e.k + ': ' + e.v); });
  } else {
    lines.push('');
    lines.push('EXIF: is image mein koi EXIF jaankari nahi mili (PNG/WebP mein aksar nahi hoti).');
  }
  ySet(id, lines.join('\n'), 'ok');
}
function yExif(dataUrl){
  try{
    var b64 = String(dataUrl).split(',')[1];
    if(!b64){ return null; }
    var bin = atob(b64);
    if(bin.charCodeAt(0) !== 0xFF || bin.charCodeAt(1) !== 0xD8){ return null; }
    var i = 2, len = bin.length;
    while(i < len){
      if(bin.charCodeAt(i) !== 0xFF){ i++; continue; }
      var marker = bin.charCodeAt(i + 1);
      var segLen = (bin.charCodeAt(i + 2) << 8) + bin.charCodeAt(i + 3);
      if(marker === 0xE1){
        var seg = bin.slice(i + 4, i + 2 + segLen);
        if(seg.slice(0, 4) === 'Exif'){ return yParseTiff(seg.slice(6)); }
      }
      i += 2 + segLen;
    }
    return null;
  }catch(e){ return null; }
}
function yParseTiff(t){
  function u16(o){ return (t.charCodeAt(o) << 8) + t.charCodeAt(o + 1); }
  function u32(o){ return (t.charCodeAt(o) << 24) + (t.charCodeAt(o + 1) << 16) + (t.charCodeAt(o + 2) << 8) + t.charCodeAt(o + 3); }
  var little = t.slice(0, 2) === 'II';
  if(little){
    u16 = function(o){ return (t.charCodeAt(o + 1) << 8) + t.charCodeAt(o); };
    u32 = function(o){ return (t.charCodeAt(o + 3) << 24) + (t.charCodeAt(o + 2) << 16) + (t.charCodeAt(o + 1) << 8) + t.charCodeAt(o); };
  }
  var ifd = u32(4);
  var TAGS = { 0x010F:'Make', 0x0110:'Model', 0x0112:'Orientation', 0x0132:'DateTime',
               0x011A:'XResolution', 0x011B:'YResolution', 0x8769:'ExifIFD',
               0x9003:'DateTimeOriginal', 0x829A:'ExposureTime', 0x8827:'ISO',
               0xA002:'PixelXDimension', 0xA003:'PixelYDimension', 0x920A:'FocalLength' };
  var out = [];
  function readIfd(offset, depth){
    if(!offset || offset >= t.length || depth > 2){ return; }
    var count = u16(offset);
    for(var k = 0; k < count; k++){
      var e = offset + 2 + k * 12;
      if(e + 12 > t.length){ return; }
      var tag = u16(e), type = u16(e + 2), num = u32(e + 4);
      var valOff = e + 8;
      var name = TAGS[tag];
      if(!name){ continue; }
      if(name === 'ExifIFD'){ readIfd(u32(valOff), depth + 1); continue; }
      var value = '';
      if(type === 2){
        var ptr = (num > 4) ? u32(valOff) : valOff;
        var s = '';
        for(var q = 0; q < num; q++){
          var ch = t.charCodeAt(ptr + q);
          if(ch === 0){ break; }
          s += t.charAt(ptr + q);
        }
        value = s.trim();
      } else if(type === 3){
        value = String(u16(valOff));
      } else if(type === 4){
        value = String(u32(valOff));
      } else if(type === 5){
        var ptr2 = u32(valOff);
        var a = u32(ptr2), b = u32(ptr2 + 4);
        value = b ? (Math.round(a / b * 100) / 100) : String(a);
      }
      if(value){ out.push({ k: name, v: value }); }
    }
  }
  readIfd(ifd, 0);
  return out;
}

function yHist(id, s){
  if(!s.img){ ySet(id, 'Pehle image chuniye.', 'info'); return; }
  var cv = $(yId(id, 'canvas'));
  if(!cv){ return; }
  var small = imCanvas(200, Math.max(1, Math.round(200 * s.img.naturalHeight / s.img.naturalWidth)));
  small.getContext('2d').drawImage(s.img, 0, 0, small.width, small.height);
  var d = small.getContext('2d').getImageData(0, 0, small.width, small.height).data;
  var r = new Array(256).fill(0), g = new Array(256).fill(0), b = new Array(256).fill(0);
  for(var i = 0; i < d.length; i += 4){ r[d[i]]++; g[d[i + 1]]++; b[d[i + 2]]++; }
  var W = cv.width = 640, H = cv.height = 220;
  var ctx = cv.getContext('2d');
  ctx.fillStyle = '#0b0e12'; ctx.fillRect(0, 0, W, H);
  var max = Math.max.apply(null, r.concat(g, b)) || 1;
  function plot(arr, color){
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = 1.4;
    for(var x = 0; x < 256; x++){
      var px = x / 255 * W;
      var py = H - (arr[x] / max) * (H - 10);
      if(x === 0){ ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
    }
    ctx.stroke();
  }
  plot(r, 'rgba(255,80,80,0.9)');
  plot(g, 'rgba(80,255,120,0.9)');
  plot(b, 'rgba(90,150,255,0.9)');
  ySet(id, 'Histogram taiyaar — laal, hara, neela channel. Neeche "Create" se PNG bhi le sakte hain.', 'ok');
}

function yAuto(id, t, s){
  if(!yNeedImg(id, s)){ return; }
  var c = imDraw(s.img, s.img.naturalWidth, s.img.naturalHeight, null);
  var ctx = c.getContext('2d');
  var d = ctx.getImageData(0, 0, c.width, c.height);
  var sum = 0, n = 0;
  for(var i = 0; i < d.data.length; i += 16){ sum += (0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]); n++; }
  var avg = sum / (n || 1);
  var factor = avg > 0 ? Math.min(2.2, 128 / avg) : 1;
  for(var j = 0; j < d.data.length; j += 4){
    d.data[j] = Math.min(255, d.data[j] * factor);
    d.data[j + 1] = Math.min(255, d.data[j + 1] * factor);
    d.data[j + 2] = Math.min(255, d.data[j + 2] * factor);
  }
  ctx.putImageData(d, 0, 0);
  yBusy(id, 'Brightness theek kar raha hoon...');
  imBlob(c, 'image/png', 1).then(function(b){
    yOut(id, [{ blob: b, name: imBase(s.name) + '-bright.png' }],
      'Auto brightness lagaya (average ' + Math.round(avg) + ' \u2192 ' + Math.round(avg * factor) + ').');
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

/* ---------------- QR ---------------- */
var QR = (function(){
  var EXP = new Array(512), LOG = new Array(256);
  (function(){
    var x = 1;
    for(var i = 0; i < 255; i++){ EXP[i] = x; LOG[x] = i; x <<= 1; if(x & 0x100){ x ^= 0x11D; } }
    for(var j = 255; j < 512; j++){ EXP[j] = EXP[j - 255]; }
  })();
  function mul(a, b){ if(a === 0 || b === 0){ return 0; } return EXP[LOG[a] + LOG[b]]; }
  function rsGenerator(deg){
    var poly = [1];
    for(var i = 0; i < deg; i++){
      var next = new Array(poly.length + 1).fill(0);
      for(var j = 0; j < poly.length; j++){
        next[j] ^= poly[j];
        next[j + 1] ^= mul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }
  function rsEncode(data, eccLen){
    var gen = rsGenerator(eccLen);
    var res = new Array(eccLen).fill(0);
    for(var d = 0; d < data.length; d++){
      var factor = data[d] ^ res[0];
      res.shift(); res.push(0);
      for(var i = 0; i < eccLen; i++){ res[i] ^= mul(gen[i + 1], factor); }
    }
    return res;
  }
  function bchDigit(n){ var d = 0; while(n !== 0){ d++; n >>>= 1; } return d; }
  function bchTypeInfo(data){
    var d = data << 10;
    while(bchDigit(d) - bchDigit(0x537) >= 0){ d ^= (0x537 << (bchDigit(d) - bchDigit(0x537))); }
    return ((data << 10) | d) ^ 0x5412;
  }
  function bchVersionInfo(v){
    var d = v << 12;
    while(bchDigit(d) - bchDigit(0x1F25) >= 0){ d ^= (0x1F25 << (bchDigit(d) - bchDigit(0x1F25))); }
    return (v << 12) | d;
  }
  var BLOCKS = { 1:[7,[[1,19]]], 2:[10,[[1,34]]], 3:[15,[[1,55]]], 4:[20,[[1,80]]], 5:[26,[[1,108]]],
    6:[18,[[2,68]]], 7:[20,[[2,78]]], 8:[24,[[2,97]]], 9:[30,[[2,116]]], 10:[18,[[2,68],[2,69]]] };
  var BLOCKS_M = { 1:[10,[[1,16]]], 2:[16,[[1,28]]], 3:[26,[[1,44]]], 4:[18,[[2,32]]], 5:[24,[[2,43]]],
    6:[16,[[4,27]]], 7:[18,[[4,31]]], 8:[22,[[2,38],[2,39]]], 9:[22,[[3,36],[2,37]]], 10:[26,[[4,43],[1,44]]] };
  var ALIGN = { 1:[], 2:[6,18], 3:[6,22], 4:[6,26], 5:[6,30], 6:[6,34], 7:[6,22,38], 8:[6,24,42], 9:[6,26,46], 10:[6,28,50] };
  var ECC_BITS = { L:1, M:0, Q:3, H:2 };

  function capacity(ver, ecc){
    var tbl = ecc === 'M' ? BLOCKS_M[ver] : BLOCKS[ver];
    var total = 0;
    tbl[1].forEach(function(g){ total += g[0] * g[1]; });
    return Math.floor((total * 8 - 4 - (ver < 10 ? 8 : 16)) / 8);
  }
  function chooseVersion(len, ecc){
    for(var v = 1; v <= 10; v++){ if(capacity(v, ecc) >= len){ return v; } }
    return null;
  }

  function encode(text, ecc){
    ecc = (ecc === 'M') ? 'M' : 'L';
    var bytes = new TextEncoder().encode(text);
    var ver = chooseVersion(bytes.length, ecc);
    if(!ver){ return { error: 'Text bahut lamba hai \u2014 ' + capacity(10, ecc) + ' bytes tak hi chalta hai.' }; }
    var tbl = ecc === 'M' ? BLOCKS_M[ver] : BLOCKS[ver];
    var eccLen = tbl[0], groups = tbl[1];
    var dataLens = [];
    groups.forEach(function(g){ for(var i = 0; i < g[0]; i++){ dataLens.push(g[1]); } });
    var totalData = dataLens.reduce(function(a, b){ return a + b; }, 0);

    var bits = [];
    function push(v, n){ for(var i = n - 1; i >= 0; i--){ bits.push((v >>> i) & 1); } }
    push(4, 4);
    push(bytes.length, ver < 10 ? 8 : 16);
    for(var b = 0; b < bytes.length; b++){ push(bytes[b], 8); }
    var cap = totalData * 8;
    for(var t = 0; t < 4 && bits.length < cap; t++){ bits.push(0); }
    while(bits.length % 8 !== 0){ bits.push(0); }
    var cw = [];
    for(var i = 0; i < bits.length; i += 8){
      var v = 0;
      for(var j = 0; j < 8; j++){ v = (v << 1) | bits[i + j]; }
      cw.push(v);
    }
    var pads = [0xEC, 0x11], pi = 0;
    while(cw.length < totalData){ cw.push(pads[pi++ % 2]); }

    var blocks = [], idx = 0;
    dataLens.forEach(function(len){ blocks.push(cw.slice(idx, idx + len)); idx += len; });
    var eccs = blocks.map(function(bl){ return rsEncode(bl, eccLen); });
    var maxData = Math.max.apply(null, dataLens);
    var final = [];
    for(var c = 0; c < maxData; c++){ blocks.forEach(function(bl){ if(c < bl.length){ final.push(bl[c]); } }); }
    for(var e = 0; e < eccLen; e++){ eccs.forEach(function(bl){ final.push(bl[e]); }); }

    var size = 17 + 4 * ver;
    var modules = [], reserved = [];
    for(var r0 = 0; r0 < size; r0++){
      modules.push(new Array(size).fill(false));
      reserved.push(new Array(size).fill(false));
    }
    function setF(r, c, v){
      if(r < 0 || c < 0 || r >= size || c >= size){ return; }
      modules[r][c] = v; reserved[r][c] = true;
    }
    function placeFinder(r0, c0){
      for(var r = -1; r <= 7; r++){
        for(var c = -1; c <= 7; c++){
          var rr = r0 + r, cc = c0 + c;
          if(rr < 0 || cc < 0 || rr >= size || cc >= size){ continue; }
          var on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                   (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                   (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          setF(rr, cc, on);
        }
      }
    }
    placeFinder(0, 0); placeFinder(0, size - 7); placeFinder(size - 7, 0);

    var al = ALIGN[ver] || [];
    for(var a1 = 0; a1 < al.length; a1++){
      for(var a2 = 0; a2 < al.length; a2++){
        var ar = al[a1], ac = al[a2];
        if(reserved[ar][ac]){ continue; }
        for(var dr = -2; dr <= 2; dr++){
          for(var dc = -2; dc <= 2; dc++){
            setF(ar + dr, ac + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
          }
        }
      }
    }
    for(var i2 = 0; i2 < size; i2++){
      if(!reserved[6][i2]){ setF(6, i2, i2 % 2 === 0); }
      if(!reserved[i2][6]){ setF(i2, 6, i2 % 2 === 0); }
    }
    for(var i3 = 0; i3 <= 8; i3++){
      if(!reserved[8][i3]){ setF(8, i3, false); }
      if(!reserved[i3][8]){ setF(i3, 8, false); }
    }
    for(var i4 = 0; i4 < 8; i4++){
      if(!reserved[8][size - 1 - i4]){ setF(8, size - 1 - i4, false); }
      if(!reserved[size - 1 - i4][8]){ setF(size - 1 - i4, 8, false); }
    }
    setF(size - 8, 8, true);
    if(ver >= 7){
      var vbits = bchVersionInfo(ver);
      for(var k = 0; k < 18; k++){
        var bit = ((vbits >> k) & 1) === 1;
        setF(Math.floor(k / 3), k % 3 + size - 11, bit);
        setF(k % 3 + size - 11, Math.floor(k / 3), bit);
      }
    }

    var bitIdx = 0, totalBits = final.length * 8;
    function nextBit(){
      if(bitIdx >= totalBits){ return false; }
      var byteIdx = bitIdx >> 3;
      var v = (final[byteIdx] >> (7 - (bitIdx & 7))) & 1;
      bitIdx++;
      return v === 1;
    }
    var upward = true;
    for(var col = size - 1; col > 0; col -= 2){
      if(col === 6){ col--; }
      for(var i5 = 0; i5 < size; i5++){
        var row = upward ? (size - 1 - i5) : i5;
        for(var c2 = 0; c2 < 2; c2++){
          var cc2 = col - c2;
          if(reserved[row][cc2]){ continue; }
          modules[row][cc2] = nextBit();
        }
      }
      upward = !upward;
    }

    function maskFn(k, r, c){
      switch(k){
        case 0: return (r + c) % 2 === 0;
        case 1: return r % 2 === 0;
        case 2: return c % 3 === 0;
        case 3: return (r + c) % 3 === 0;
        case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
        case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
        case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
        case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      }
      return false;
    }
    function build(k){
      var out = modules.map(function(row){ return row.slice(); });
      for(var r = 0; r < size; r++){
        for(var c = 0; c < size; c++){
          if(reserved[r][c]){ continue; }
          if(maskFn(k, r, c)){ out[r][c] = !out[r][c]; }
        }
      }
      var fbits = bchTypeInfo((ECC_BITS[ecc] << 3) | k);
      for(var i = 0; i < 15; i++){
        var mod = ((fbits >> i) & 1) === 1;
        if(i < 6){ out[i][8] = mod; }
        else if(i < 8){ out[i + 1][8] = mod; }
        else { out[size - 15 + i][8] = mod; }
        if(i < 8){ out[8][size - i - 1] = mod; }
        else if(i < 9){ out[8][15 - i - 1 + 1] = mod; }
        else { out[8][15 - i - 1] = mod; }
      }
      out[size - 8][8] = true;
      return out;
    }
    function penalty(mat){
      var score = 0;
      for(var r = 0; r < size; r++){
        var run = 1;
        for(var c = 1; c < size; c++){
          if(mat[r][c] === mat[r][c - 1]){ run++; }
          else { if(run >= 5){ score += run - 2; } run = 1; }
        }
        if(run >= 5){ score += run - 2; }
      }
      for(var c3 = 0; c3 < size; c3++){
        var run2 = 1;
        for(var r2 = 1; r2 < size; r2++){
          if(mat[r2][c3] === mat[r2 - 1][c3]){ run2++; }
          else { if(run2 >= 5){ score += run2 - 2; } run2 = 1; }
        }
        if(run2 >= 5){ score += run2 - 2; }
      }
      for(var r3 = 0; r3 < size - 1; r3++){
        for(var c4 = 0; c4 < size - 1; c4++){
          var v = mat[r3][c4];
          if(v === mat[r3][c4 + 1] && v === mat[r3 + 1][c4] && v === mat[r3 + 1][c4 + 1]){ score += 3; }
        }
      }
      var pat1 = [true,false,true,true,true,false,true,false,false,false,false];
      var pat2 = [false,false,false,false,true,false,true,true,true,false,true];
      function m11(arr, pat){
        for(var i = 0; i < 11; i++){ if(arr[i] !== pat[i]){ return false; } }
        return true;
      }
      for(var r4 = 0; r4 < size; r4++){
        for(var c5 = 0; c5 <= size - 11; c5++){
          var rowArr = mat[r4].slice(c5, c5 + 11);
          if(m11(rowArr, pat1) || m11(rowArr, pat2)){ score += 40; }
        }
      }
      for(var c6 = 0; c6 < size; c6++){
        for(var r5 = 0; r5 <= size - 11; r5++){
          var colArr = [];
          for(var i6 = 0; i6 < 11; i6++){ colArr.push(mat[r5 + i6][c6]); }
          if(m11(colArr, pat1) || m11(colArr, pat2)){ score += 40; }
        }
      }
      var dark = 0;
      for(var r6 = 0; r6 < size; r6++){ for(var c7 = 0; c7 < size; c7++){ if(mat[r6][c7]){ dark++; } } }
      var ratio = dark / (size * size) * 100;
      score += Math.floor(Math.abs(ratio - 50) / 5) * 10;
      return score;
    }
    var best = null, bestScore = Infinity;
    for(var k2 = 0; k2 < 8; k2++){
      var cand = build(k2);
      var sc = penalty(cand);
      if(sc < bestScore){ bestScore = sc; best = cand; }
    }
    return { matrix: best, size: size, version: ver };
  }
  return { encode: encode };
})();

function yQr(id, t){
  var text = val(yId(id, 'txt')) || '';
  if(!text.trim()){ ySet(id, 'Pehle text ya link likhiye.', 'info'); return; }
  var ecc = val(yId(id, 'ecc')) || 'L';
  var px = Math.max(120, Math.min(2000, yNum(id, 'px', 512)));
  var res;
  try{ res = QR.encode(text, ecc); }
  catch(e){ ySet(id, 'QR banane mein dikkat: ' + e.message, 'bad'); return; }
  if(res.error){ ySet(id, res.error, 'bad'); return; }
  var quiet = 4, modules = res.size + quiet * 2;
  var scale = Math.max(1, Math.floor(px / modules));
  var size = modules * scale;
  var c = imCanvas(size, size), ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  for(var r = 0; r < res.size; r++){
    for(var col = 0; col < res.size; col++){
      if(res.matrix[r][col]){
        ctx.fillRect((col + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    }
  }
  var prev = $(yId(id, 'prev'));
  if(prev){ prev.src = c.toDataURL('image/png'); prev.style.display = 'block'; }
  yBusy(id, 'QR bana raha hoon...');
  imBlob(c, 'image/png', 1).then(function(b){
    yOut(id, [{ blob: b, name: 'qrcode.png' }],
      'QR taiyaar \u2014 version ' + res.version + ', ' + size + '\u00d7' + size + ' px. Phone se scan karke dekh lijiye.');
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

/* ---------------- palette gradient ---------------- */
function yPalGrad(id, t, s){
  var w = Math.max(16, Math.min(4000, yNum(id, 'w', 1080)));
  var h = Math.max(16, Math.min(4000, yNum(id, 'h', 1080)));
  var ang = yNum(id, 'ang', 135);
  var stops = [];
  if(s.img){
    var txt = imPaletteText(s.img);
    txt.split('\n').forEach(function(line){
      var m = line.trim().match(/^(#[0-9a-f]{6})/i);
      if(m){ stops.push(m[1]); }
    });
  }
  if(stops.length < 2){ stops = ['#3fb950', '#4493f8']; }
  var c = imCanvas(w, h), ctx = c.getContext('2d');
  var rad = ang * Math.PI / 180;
  var x1 = w / 2 - Math.cos(rad) * w / 2, y1 = h / 2 - Math.sin(rad) * h / 2;
  var x2 = w / 2 + Math.cos(rad) * w / 2, y2 = h / 2 + Math.sin(rad) * h / 2;
  var g = ctx.createLinearGradient(x1, y1, x2, y2);
  stops.forEach(function(col, i){ g.addColorStop(i / (stops.length - 1), col); });
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  yBusy(id, 'Gradient ban raha hai...');
  imBlob(c, 'image/png', 1).then(function(b){
    yOut(id, [{ blob: b, name: 'palette-gradient.png' }],
      'Gradient taiyaar — ' + stops.length + ' rang: ' + stops.join(' '));
  }).catch(function(e){ ySet(id, e.message, 'bad'); });
}

/* ---------------- build ---------------- */
function yBuild(){
  var aside = document.querySelector('aside');
  var main = document.querySelector('main');
  if(!aside || !main || !$('g-img')){ return; }
  var nav = [], panels = [];
  TOOLS3.forEach(function(t){
    nav.push('<button class="nav" title="' + t.name + '" onclick="openTool(\'' + t.id + '\',this)">' + t.name + '</button>');
    panels.push(yPanel(t));
  });
  $('g-img').insertAdjacentHTML('beforeend', nav.join('\n'));
  main.insertAdjacentHTML('beforeend', panels.join('\n'));
  var cnt = document.querySelector('[data-g="img"] .count');
  if(cnt){ cnt.textContent = String(document.querySelectorAll('#g-img .nav').length); }

  TOOLS3.forEach(function(t){
    var inp = $(yId(t.id, 'file'));
    var drop = $(yId(t.id, 'drop'));
    var inp2 = $(yId(t.id, 'file2'));
    var multi = ['merge','strip','contact','sbs'].indexOf(t.kind) >= 0;
    if(inp){
      inp.addEventListener('change', function(){
        if(multi){ yMulti(t.id, inp.files); }
        else { yLoadFile(t.id, inp.files[0]); }
      });
    }
    if(inp2){
      inp2.addEventListener('change', function(){ yLoadFile(t.id, inp2.files[0], 2); });
    }
    if(drop){
      drop.addEventListener('click', function(){ if(inp){ inp.click(); } });
      ['dragenter','dragover'].forEach(function(ev){
        drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.add('over'); });
      });
      ['dragleave','drop'].forEach(function(ev){
        drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.remove('over'); });
      });
      drop.addEventListener('drop', function(e){
        var f = e.dataTransfer && e.dataTransfer.files;
        if(!f || !f.length){ return; }
        if(multi){ yMulti(t.id, f); } else { yLoadFile(t.id, f[0]); }
      });
    }
  });
}
yBuild();

/* ===== toolsearch ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

// @ts-nocheck


/* ===================================================================
   Tool search + ICO generator
   =================================================================== */
(function(){
  /* ---------- search box ---------- */
  var aside = document.querySelector('aside');
  if(aside && !document.getElementById('toolSearch')){
    var wrap = document.createElement('div');
    wrap.className = 'search-wrap';
    wrap.innerHTML = '<div class="search-box">' +
      '<input type="text" id="toolSearch" placeholder="Search" autocomplete="off">' +
      '<button class="search-clear" id="searchClear" title="Search saaf karo" aria-label="Clear">&#10005;</button>' +
      '</div>';
    var note = document.createElement('div');
    note.id = 'searchNote';
    var top = aside.querySelector('.side-top');
    var head = aside.querySelector('.side-head');
    var burger = document.getElementById('burgerBtn');
    var themeBtn = document.getElementById('themeBtn');
    if(head && burger){
      head.insertBefore(wrap, burger);      /* title aur 3-line ke beech */
      if(top){ top.appendChild(note); }
    } else if(top){
      top.appendChild(wrap);
      top.appendChild(note);
    } else if(themeBtn && themeBtn.parentNode === aside){
      aside.insertBefore(wrap, themeBtn.nextSibling);
      aside.insertBefore(note, wrap.nextSibling);
    } else {
      aside.insertBefore(wrap, aside.children[1] || null);
      aside.insertBefore(note, wrap.nextSibling);
    }
    var input = document.getElementById('toolSearch');
    var clearBtn = document.getElementById('searchClear');
    function syncClear(){
      if(clearBtn){ clearBtn.style.display = input.value ? 'block' : 'none'; }
    }
    input.addEventListener('input', function(){ syncClear(); window.runToolSearch(); });
    if(clearBtn){
      clearBtn.addEventListener('click', function(e){
        e.preventDefault();
        input.value = '';
        syncClear();
        window.runToolSearch();
        input.focus();
      });
    }
    syncClear();
    input.addEventListener('keydown', function(e){
      /* Enter par tool khud na khule — sirf results dikhein, user tap kare */
      if(e.key === 'Enter'){ e.preventDefault(); }
      if(e.key === 'Escape'){ input.value = ''; window.runToolSearch(); }
    });
  }

  window.runToolSearch = function(){
    var el = document.getElementById('toolSearch');
    var q = el ? (el.value || '').trim().toLowerCase() : '';
    if(q){
      var asideEl = document.querySelector('aside');
      if(asideEl && asideEl.classList.contains('menu-closed')){
        asideEl.classList.remove('menu-closed');
        var bg = document.getElementById('burgerBtn');
        if(bg){ bg.classList.add('on'); }
      }
    }
    var total = 0;
    document.querySelectorAll('.nav').forEach(function(n){
      var text = (n.textContent || '').toLowerCase();
      var title = (n.getAttribute('title') || '').toLowerCase();
      var hit = !q || text.indexOf(q) >= 0 || title.indexOf(q) >= 0;
      n.style.display = hit ? '' : 'none';
      if(hit && q){ n.classList.add('search-hit'); total++; }
      else { n.classList.remove('search-hit'); }
    });
    document.querySelectorAll('.grp-btn').forEach(function(b){
      var gid = b.getAttribute('data-g');
      var list = document.getElementById('g-' + gid);
      if(!list){ return; }
      var count = 0;
      list.querySelectorAll('.nav').forEach(function(n){ if(n.style.display !== 'none'){ count++; } });
      if(q){
        b.style.display = count ? '' : 'none';
        list.style.display = count ? 'block' : 'none';
        if(count){ list.classList.add('open'); b.classList.add('open'); }
      } else {
        b.style.display = '';
        list.style.display = '';
        list.classList.remove('open');
        b.classList.remove('open');
      }
    });
    if(!q){
      document.querySelectorAll('.grp-list').forEach(function(l){ l.classList.remove('open'); });
      document.querySelectorAll('.grp-btn').forEach(function(b){ b.classList.remove('open'); });
    }
    var mt = document.querySelector('.menu-theme');
    if(mt){ mt.style.display = q ? 'none' : ''; }   /* search ke waqt Light mode chhupa rahe */

    var nt = document.getElementById('searchNote');
    if(nt){
      nt.style.display = 'none';
      nt.textContent = '';
    }
  };

  /* mobile par file khulte hi menu band rahe — sirf 3-line dabane par khule */
  (function(){
    var asideEl = document.querySelector('aside');
    if(asideEl && window.innerWidth <= 760){
      asideEl.classList.add('menu-closed');
      var bg = document.getElementById('burgerBtn');
      if(bg){ bg.classList.remove('on'); }
    }
  })();

  /* ---------- ICO generator ---------- */
  function icoPanel(){
    return '<section id="t-y-ico" class="tool">' +
      '<h2>ICO generator</h2>' +
      '<p class="desc">One image to a favicon.ico file — 16, 32, 48 and 256 px, all in one file. Place it in the website root folder.</p>' +
      '<div class="row"><input type="file" id="y-ico-file" accept="image/*"></div>' +
      '<div class="drop" id="y-ico-drop">Image yahan drag kijiye, ya upar se chuniye</div>' +
      '<img id="y-ico-prev" class="prev" style="display:none" alt="">' +
      '<div class="row"><button class="act pri" onclick="yIcoRun()">Create ICO</button></div>' +
      '<div class="row" id="y-ico-outs"></div>' +
      '<div class="status" id="y-ico-st"></div>' +
      '</section>';
  }
  var g = document.getElementById('g-img');
  var main = document.querySelector('main');
  if(g && main && !document.getElementById('t-y-ico')){
    g.insertAdjacentHTML('beforeend', '<button class="nav" title="ICO generator" onclick="openTool(\'y-ico\',this)">ICO generator</button>');
    main.insertAdjacentHTML('beforeend', icoPanel());
    var cnt = document.querySelector('[data-g="img"] .count');
    if(cnt){ cnt.textContent = String(document.querySelectorAll('#g-img .nav').length); }

    var icoImg = null;
    var inp = document.getElementById('y-ico-file');
    var drop = document.getElementById('y-ico-drop');
    inp.addEventListener('change', function(){ loadIco(inp.files[0]); });
    drop.addEventListener('click', function(){ inp.click(); });
    ['dragenter','dragover'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave','drop'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function(e){
      var f = e.dataTransfer && e.dataTransfer.files;
      if(f && f.length){ loadIco(f[0]); }
    });
    function loadIco(file){
      if(!file){ return; }
      var fr = new FileReader();
      fr.onload = function(){
        var img = new Image();
        img.onload = function(){
          icoImg = img;
          var p = document.getElementById('y-ico-prev');
          p.src = img.src; p.style.display = 'block';
          document.getElementById('y-ico-st').textContent = 'Image taiyaar \u2014 ' + img.naturalWidth + '\u00d7' + img.naturalHeight + ' px.';
          document.getElementById('y-ico-st').className = 'status ok';
        };
        img.onerror = function(){ document.getElementById('y-ico-st').textContent = 'Image khul nahi paayi.'; };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    }
    window.yIcoRun = function(){
      var st = document.getElementById('y-ico-st');
      if(!icoImg){ st.textContent = 'Pehle image chuniye.'; st.className = 'status info'; return; }
      st.innerHTML = '<span class="spin"></span>ICO ban raha hai...'; st.className = 'status info';
      var sizes = [16, 32, 48, 256];
      Promise.all(sizes.map(function(sz){
        var c = imCanvas(sz, sz), ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        var sc = Math.max(sz / icoImg.naturalWidth, sz / icoImg.naturalHeight);
        var dw = icoImg.naturalWidth * sc, dh = icoImg.naturalHeight * sc;
        ctx.drawImage(icoImg, (sz - dw) / 2, (sz - dh) / 2, dw, dh);
        return imBlob(c, 'image/png', 1).then(function(b){ return b.arrayBuffer(); });
      })).then(function(bufs){
        var count = bufs.length;
        var headerSize = 6 + 16 * count;
        var total = headerSize + bufs.reduce(function(a, b){ return a + b.byteLength; }, 0);
        var buf = new ArrayBuffer(total);
        var dv = new DataView(buf);
        dv.setUint16(0, 0, true); dv.setUint16(2, 1, true); dv.setUint16(4, count, true);
        var off = 6, dataOff = headerSize;
        bufs.forEach(function(b, i){
          var sz = sizes[i];
          dv.setUint8(off, sz === 256 ? 0 : sz);
          dv.setUint8(off + 1, sz === 256 ? 0 : sz);
          dv.setUint8(off + 2, 0);
          dv.setUint8(off + 3, 0);
          dv.setUint16(off + 4, 1, true);
          dv.setUint16(off + 6, 32, true);
          dv.setUint32(off + 8, b.byteLength, true);
          dv.setUint32(off + 12, dataOff, true);
          off += 16;
          new Uint8Array(buf, dataOff, b.byteLength).set(new Uint8Array(b));
          dataOff += b.byteLength;
        });
        var blob = new Blob([buf], { type: 'image/x-icon' });
        var outs = document.getElementById('y-ico-outs');
        outs.innerHTML = '';
        var btn = document.createElement('button');
        btn.className = 'act pri';
        btn.textContent = 'Download favicon.ico';
        btn.onclick = function(){ imSave(blob, 'favicon.ico'); };
        outs.appendChild(btn);
        /* saath mein alag-alag PNG icons bhi */
        bufs.forEach(function(ab, i){
          var png = new Blob([ab], { type: 'image/png' });
          var b2 = document.createElement('button');
          b2.className = 'act';
          b2.textContent = 'icon-' + sizes[i] + '.png';
          b2.onclick = function(){ imSave(png, 'icon-' + sizes[i] + 'x' + sizes[i] + '.png'); };
          outs.appendChild(b2);
        });
        st.textContent = 'favicon.ico taiyaar \u2014 4 sizes, ' + Math.round(blob.size / 1024) + ' KB.';
        st.className = 'status ok';
      }).catch(function(e){
        st.textContent = 'ICO nahi bana: ' + e.message;
        st.className = 'status bad';
      });
    };
  }
})();

/* ===== yttools ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

// @ts-nocheck

/* ===================================================================
   YOUTUBE TOOLS — thumbnail previewer + thumbnail maker
   (bina API key, bina server)
   =================================================================== */
(function(){

/* ---------------- video ID parser ---------------- */
function ytParseId(input){
  var u = String(input || '').trim();
  if(!u){ return { error: 'Pehle YouTube ka link paste kijiye.' }; }
  var id = null;
  var patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/i,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/i,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/i,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/i,
    /(?:youtube\.com\/live\/)([A-Za-z0-9_-]{11})/i,
    /(?:m\.youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/i
  ];
  for(var i = 0; i < patterns.length; i++){
    var m = u.match(patterns[i]);
    if(m){ id = m[1]; break; }
  }
  if(!id && /^[A-Za-z0-9_-]{11}$/.test(u)){ id = u; }
  if(!id){ return { error: 'Ye YouTube link samajh nahi aaya. Jaise: https://www.youtube.com/watch?v=XXXXXXXXXXX ya https://youtu.be/XXXXXXXXXXX' }; }
  return { id: id };
}

var YT_SIZES = [
  { key: 'maxresdefault', label: 'Max (1280\u00d7720)' },
  { key: 'sddefault',     label: 'SD (640\u00d7480)' },
  { key: 'hqdefault',     label: 'HQ (480\u00d7360)' },
  { key: 'mqdefault',     label: 'MQ (320\u00d7180)' },
  { key: 'default',       label: 'Chhota (120\u00d790)' }
];

function ytThumbUrl(id, key){
  return 'https://img.youtube.com/vi/' + id + '/' + key + '.jpg';
}

/* ---------------- panel 1 ---------------- */
function ytPreviewerPanel(){
  return '' +
  '<section id="t-yt-prev" class="tool">' +
  '  <h2>YouTube thumbnail previewer</h2>' +
  '  <p class="desc">Paste a video link — all available thumbnails appear, with size and download/copy options. No API key needed.</p>' +
  '  <div class="row">' +
  '    <input type="text" id="ytp-url" placeholder="https://www.youtube.com/watch?v=..." style="flex:1">' +
  '    <button class="act pri" onclick="ytPreviewRun()">View</button>' +
  '    <button class="act" onclick="ytPreviewClear()">Clear</button>' +
  '  </div>' +
  '  <div class="status" id="ytp-st"></div>' +
  '  <div id="ytp-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-top:12px"></div>' +
  '  <div class="status" id="ytp-note" style="margin-top:8px"></div>' +
  '</section>';
}

window.ytPreviewClear = function(){
  var u = document.getElementById('ytp-url'); if(u){ u.value = ''; }
  var g = document.getElementById('ytp-grid'); if(g){ g.innerHTML = ''; }
  var s = document.getElementById('ytp-st'); if(s){ s.textContent = ''; s.className = 'status'; }
  var n = document.getElementById('ytp-note'); if(n){ n.textContent = ''; n.className = 'status'; }
};

window.ytPreviewRun = function(){
  var st = document.getElementById('ytp-st');
  var grid = document.getElementById('ytp-grid');
  var note = document.getElementById('ytp-note');
  var raw = (document.getElementById('ytp-url').value || '').trim();
  var parsed = ytParseId(raw);
  if(parsed.error){
    st.textContent = parsed.error;
    st.className = 'status bad';
    grid.innerHTML = '';
    return;
  }
  var id = parsed.id;
  st.textContent = 'Video ID: ' + id;
  st.className = 'status ok';
  note.textContent = 'Thumbnails load ho rahi hain...';
  note.className = 'status info';
  grid.innerHTML = '';

  var found = 0, pending = YT_SIZES.length;
  YT_SIZES.forEach(function(sz){
    var url = ytThumbUrl(id, sz.key);
    var card = document.createElement('div');
    card.style.cssText = 'border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--panel)';
    var title = document.createElement('div');
    title.style.cssText = 'font-size:11.5px;color:var(--muted);margin-bottom:6px;display:flex;justify-content:space-between';
    title.innerHTML = '<span>' + sz.label + '</span><span class="ytp-dims">\u2014</span>';
    var box = document.createElement('div');
    box.style.cssText = 'background:#0b0e12;border-radius:6px;min-height:90px;display:flex;align-items:center;justify-content:center;overflow:hidden';
    var img = document.createElement('img');
    img.alt = sz.label;
    img.style.cssText = 'max-width:100%;display:block';
    var actions = document.createElement('div');
    actions.className = 'row';
    actions.style.cssText = 'margin-top:8px;gap:6px';
    box.appendChild(img);
    card.appendChild(title);
    card.appendChild(box);
    card.appendChild(actions);
    grid.appendChild(card);

    img.onload = function(){
      pending--;
      var isPlaceholder = (sz.key === 'maxresdefault' && img.naturalWidth <= 120);
      if(isPlaceholder){
        card.style.opacity = '0.45';
        title.querySelector('.ytp-dims').textContent = 'available nahi';
        box.innerHTML = '<span style="color:#8b98a5;font-size:12px;padding:14px">Is video ke liye itni badi thumbnail nahi hai</span>';
      } else {
        found++;
        title.querySelector('.ytp-dims').textContent = img.naturalWidth + '\u00d7' + img.naturalHeight;
        var b1 = document.createElement('button');
        b1.className = 'act';
        b1.textContent = 'Download';
        b1.onclick = function(){ ytDownloadImage(url, id + '-' + sz.key + '.jpg', img); };
        var b2 = document.createElement('button');
        b2.className = 'act';
        b2.textContent = 'Copy URL';
        b2.onclick = function(){
          ytCopy(url);
          note.textContent = 'URL copy ho gaya: ' + url;
          note.className = 'status ok';
        };
        var b3 = document.createElement('button');
        b3.className = 'act';
        b3.textContent = 'Naye tab mein';
        b3.onclick = function(){ window.open(url, '_blank'); };
        actions.appendChild(b1); actions.appendChild(b2); actions.appendChild(b3);
      }
      if(pending === 0){ ytPreviewSummary(found, note); }
    };
    img.onerror = function(){
      pending--;
      card.style.opacity = '0.45';
      title.querySelector('.ytp-dims').textContent = 'available nahi';
      box.innerHTML = '<span style="color:#8b98a5;font-size:12px;padding:14px">Ye thumbnail maujood nahi hai</span>';
      if(pending === 0){ ytPreviewSummary(found, note); }
    };
    img.src = url;
  });
};

function ytPreviewSummary(found, note){
  if(!note){ return; }
  if(found === 0){
    note.textContent = 'Ek bhi thumbnail load nahi hui — video ID galat ho sakta hai ya video private/deleted hai.';
    note.className = 'status bad';
  } else {
    note.textContent = found + ' thumbnail mili. Jo card halke dikh rahe hain, unka size is video ke liye maujood nahi hai.';
    note.className = 'status ok';
  }
}

function ytCopy(text){
  try{
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }catch(e){}
}

function ytDownloadImage(url, name, imgEl){
  /* Pehle canvas se try karo (CORS ki wajah se aksar fail hoga),
     warna image naye tab mein khol do taaki user save kar sake */
  try{
    var c = document.createElement('canvas');
    c.width = imgEl.naturalWidth; c.height = imgEl.naturalHeight;
    c.getContext('2d').drawImage(imgEl, 0, 0);
    c.toBlob(function(b){
      if(b){ imSave(b, name); }
      else { window.open(url, '_blank'); }
    }, 'image/jpeg', 0.95);
  }catch(e){
    window.open(url, '_blank');
  }
}

/* ---------------- panel 2: maker ---------------- */
/* ---------------- build ---------------- */
function ytBuild(){
  var aside = document.querySelector('aside');
  var main = document.querySelector('main');
  if(!aside || !main || document.getElementById('g-yt')){ return; }

  var btn = document.createElement('button');
  btn.className = 'grp-btn';
  btn.setAttribute('data-g', 'yt');
  btn.setAttribute('onclick', "toggleGroup('yt',this)");
  btn.innerHTML = '<span>YouTube</span><span class="count">2</span>';
  aside.appendChild(btn);

  var list = document.createElement('div');
  list.className = 'grp-list';
  list.id = 'g-yt';
  list.innerHTML =
    '<button class="nav" title="YouTube thumbnail previewer" onclick="openTool(\'yt-prev\',this)">Thumbnail previewer</button>';
  aside.appendChild(list);

  main.insertAdjacentHTML('beforeend', ytPreviewerPanel());

}

/* test/debug ke liye bahar bhi available */
window.ytParseId = ytParseId;
window.ytThumbUrl = ytThumbUrl;

ytBuild();

})();

/* ===== mergecleanup ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

// @ts-nocheck

/* duplicate tools hatao — inke features doosre tools mein merge ho chuke hain */
(function(){
  var remove = ['img', 'b64img', 'x-favicon', 'y-ytthumb'];
  remove.forEach(function(id){
    var sec = document.getElementById('t-' + id);
    if(sec && sec.parentNode){ sec.parentNode.removeChild(sec); }
    Array.prototype.slice.call(document.querySelectorAll('.nav')).forEach(function(n){
      var oc = n.getAttribute('onclick') || '';
      if(oc.indexOf("'" + id + "'") >= 0){ n.parentNode.removeChild(n); }
    });
  });
  function dropNav(id){
    Array.prototype.slice.call(document.querySelectorAll('.nav')).forEach(function(n){
      var oc = n.getAttribute('onclick') || '';
      if(oc.indexOf("'" + id + "'") >= 0){ n.parentNode.removeChild(n); }
    });
  }
  /* ek tool ko doosre mein sama do (dono ke features ek jagah) */
  function absorb(targetId, srcId, label, newTitle, newDesc){
    var t = document.getElementById('t-' + targetId);
    var src = document.getElementById('t-' + srcId);
    if(!t || !src){ return; }
    var lbl = document.createElement('div');
    lbl.className = 'row';
    lbl.style.marginTop = '14px';
    lbl.innerHTML = '<span class="lbl" style="font-size:12px;font-weight:700;color:var(--text)">' + label + '</span>';
    t.appendChild(lbl);
    while(src.firstChild){ t.appendChild(src.firstChild); }
    src.parentNode.removeChild(src);
    dropNav(srcId);
    var h2 = t.querySelector('h2');
    if(h2 && newTitle){ h2.textContent = newTitle; }
    var d = t.querySelector('.desc');
    if(d && newDesc){ d.textContent = newDesc; }
  }
  absorb('img-pdf', 'img-multipdf', 'Kai images ek PDF mein (har image alag page)',
         'Image \u2192 PDF', 'Ek ya kai images se PDF banaiye \u2014 A4 ya image ke size ka page, har image alag page par.');
  absorb('img-b64', 'img-b64dec', 'Base64 se image wapas',
         'Image \u2194 Base64', 'Image ka base64/data URL banaiye, ya base64 se image wapas nikaliye.');

  document.querySelectorAll('.grp-btn').forEach(function(b){
    var gid = b.getAttribute('data-g');
    var list = document.getElementById('g-' + gid);
    if(!list){ return; }
    var cnt = list.querySelectorAll('.nav').length;
    var pill = b.querySelector('.count');
    if(pill){ pill.textContent = String(cnt); }
  });
})();

/* ===== codecheck ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

/* ===================================================================
   UNIVERSAL CODE CHECKER — bina AI, bina server, bina API key
   Jahan asli parser available hai wahan asli check, warna basic check.
   =================================================================== */
(function(){

var CC = { files: [], active: 0, issues: [], tab: 'errors', checked: false };

var LANGS = [
  { id:'html',  name:'HTML',        ext:['html','htm'],            level:'partial', check:'html' },
  { id:'css',   name:'CSS',         ext:['css','scss','less'],     level:'partial', check:'css' },
  { id:'js',    name:'JavaScript',  ext:['js','mjs','cjs','jsx'],  level:'partial', check:'js' },
  { id:'ts',    name:'TypeScript',  ext:['ts','tsx'],              level:'partial', check:'ts' },
  { id:'json',  name:'JSON',        ext:['json'],                  level:'full',    check:'json' },
  { id:'xml',   name:'XML',         ext:['xml','plist','rss'],     level:'full',    check:'xml' },
  { id:'svg',   name:'SVG',         ext:['svg'],                   level:'full',    check:'xml' },
  { id:'blogger',name:'Blogger template (XML)', ext:['blogger'],     level:'partial', check:'blogger' },
  { id:'py',    name:'Python',      ext:['py'],                    level:'partial', check:'py' },
  { id:'java',  name:'Java',        ext:['java'],                  level:'partial', check:'generic' },
  { id:'c',     name:'C / C++',     ext:['c','h','cpp','cc','hpp'],level:'partial', check:'generic' },
  { id:'cs',    name:'C#',          ext:['cs'],                    level:'partial', check:'generic' },
  { id:'php',   name:'PHP',         ext:['php'],                   level:'partial', check:'generic' },
  { id:'rb',    name:'Ruby',        ext:['rb'],                    level:'partial', check:'generic' },
  { id:'go',    name:'Go',          ext:['go'],                    level:'partial', check:'generic' },
  { id:'rs',    name:'Rust',        ext:['rs'],                    level:'partial', check:'generic' },
  { id:'kt',    name:'Kotlin',      ext:['kt','kts'],              level:'partial', check:'generic' },
  { id:'swift', name:'Swift',       ext:['swift'],                 level:'partial', check:'generic' },
  { id:'dart',  name:'Dart',        ext:['dart'],                  level:'partial', check:'generic' },
  { id:'sql',   name:'SQL',         ext:['sql'],                   level:'partial', check:'sql' },
  { id:'sh',    name:'Bash / Shell',ext:['sh','bash','zsh'],       level:'partial', check:'generic' },
  { id:'ps1',   name:'PowerShell',  ext:['ps1'],                   level:'partial', check:'generic' },
  { id:'yaml',  name:'YAML',        ext:['yaml','yml'],            level:'partial', check:'yaml' },
  { id:'toml',  name:'TOML',        ext:['toml'],                  level:'partial', check:'generic' },
  { id:'md',    name:'Markdown',    ext:['md','markdown'],         level:'partial', check:'md' },
  { id:'graphql',name:'GraphQL',    ext:['graphql','gql'],         level:'partial', check:'generic' },
  { id:'docker',name:'Dockerfile',  ext:['dockerfile'],            level:'partial', check:'generic' },
  { id:'make',  name:'Makefile',    ext:['makefile','mk'],         level:'partial', check:'generic' },
  { id:'lua',   name:'Lua',         ext:['lua'],                   level:'partial', check:'generic' },
  { id:'pl',    name:'Perl',        ext:['pl','pm'],               level:'partial', check:'generic' },
  { id:'r',     name:'R',           ext:['r'],                     level:'partial', check:'generic' },
  { id:'scala', name:'Scala',       ext:['scala'],                 level:'partial', check:'generic' },
  { id:'sol',   name:'Solidity',    ext:['sol'],                   level:'partial', check:'generic' }
];

function langById(id){ for(var i=0;i<LANGS.length;i++){ if(LANGS[i].id===id){ return LANGS[i]; } } return LANGS[0]; }
function langByExt(name){
  var e = String(name||'').split('.').pop().toLowerCase();
  for(var i=0;i<LANGS.length;i++){ if(LANGS[i].ext.indexOf(e) >= 0){ return LANGS[i]; } }
  return null;
}
function lineCol(code, pos){
  var before = code.slice(0, pos);
  var line = before.split('\n').length;
  var col = pos - before.lastIndexOf('\n');
  return { line: line, col: col };
}
function esc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ---------------- checks ---------------- */
function push(list, sev, file, line, col, msg, fix){
  list.push({ sev: sev, file: file, line: line, col: col, msg: msg, fix: fix || '' });
}

/* brackets + quotes, language ke comment style ke hisaab se */
function checkBrackets(code, file, langId, list){
  var stack = [];
  var pairs = { ')':'(', ']':'[', '}':'{' };
  var i = 0, line = 1, col = 1;
  var inStr = null, inLineComment = false, inBlock = false;
  var hashComments = ['py','yaml','sh','ps1','r','pl','rb','toml','make','docker'];
  var dashComments = ['sql','lua'];
  var htmlComments = (langId === 'html' || langId === 'xml' || langId === 'svg' || langId === 'md');

  while(i < code.length){
    var c = code[i], n = code[i+1];

    if(c === '\n'){ line++; col = 1; inLineComment = false; i++; continue; }

    if(inLineComment){ i++; col++; continue; }

    if(inBlock){
      if(c === '*' && n === '/'){ inBlock = false; i += 2; col += 2; continue; }
      i++; col++; continue;
    }

    if(inStr){
      if(c === '\\'){ i += 2; col += 2; continue; }
      if(c === inStr){ inStr = null; }
      i++; col++; continue;
    }

    if(c === '/' && n === '/' && dashComments.indexOf(langId) < 0){ inLineComment = true; i += 2; col += 2; continue; }
    if(c === '/' && n === '*'){ inBlock = true; i += 2; col += 2; continue; }
    if(c === '#' && hashComments.indexOf(langId) >= 0){ inLineComment = true; i++; col++; continue; }
    if(c === '-' && n === '-' && dashComments.indexOf(langId) >= 0){ inLineComment = true; i += 2; col += 2; continue; }
    if(htmlComments && c === '<' && code.substr(i,4) === '<!--'){
      var endC = code.indexOf('-->', i);
      if(endC < 0){ push(list,'error',file,line,col,'HTML comment band nahi hua — `-->` missing hai.','Comment ke aakhir mein `-->` lagaiye.'); return; }
      var seg = code.slice(i, endC + 3);
      var nl = seg.split('\n').length - 1;
      if(nl){ line += nl; col = seg.length - seg.lastIndexOf('\n'); } else { col += seg.length; }
      i = endC + 3;
      continue;
    }

    if(c === '"' || c === "'" || (c === '`' && langId !== 'md')){
      inStr = c;
      i++; col++;
      continue;
    }

    if(c === '(' || c === '[' || c === '{'){
      stack.push({ ch: c, line: line, col: col });
      i++; col++; continue;
    }
    if(c === ')' || c === ']' || c === '}'){
      if(!stack.length){
        push(list,'error',file,line,col,'Extra `' + c + '` — iska koi opening bracket nahi hai.','Is bracket ko hataiye ya pehle wala bracket jodiye.');
      } else {
        var top = stack.pop();
        if(top.ch !== pairs[c]){
          push(list,'error',file,line,col,'`' + c + '` galat jodi — pehle `' + top.ch + '` khula hai (line ' + top.line + ').','Line ' + top.line + ' wala `' + top.ch + '` band kijiye.');
        }
      }
      i++; col++; continue;
    }
    i++; col++;
  }

  if(inStr){ push(list,'error',file,line,col,'String band nahi hui — ' + inStr + ' missing hai.','Quote band kijiye.'); }
  if(inBlock){ push(list,'error',file,line,col,'Comment band nahi hua — `*/` missing hai.','Comment ke aakhir mein `*/` lagaiye.'); }
  stack.forEach(function(s){
    push(list,'error',file,s.line,s.col,'`' + s.ch + '` khula reh gaya — band nahi hua.','Is bracket ko band kijiye.');
  });
}

/* generic line-level checks (har language) */
function checkLines(code, file, list, langId){
  var lines = code.split('\n');
  var tabs = 0, spaces = 0, longLines = 0, trailing = 0;
  lines.forEach(function(l, i){
    if(/[ \t]+$/.test(l) && l.trim() !== ''){
      trailing++;
      if(trailing <= 8){ push(list,'warning',file,i+1,l.length,'Line ke aakhir mein faltu space hai.','Line ke aakhir ki space hataiye.'); }
    }
    if(/^\t/.test(l)){ tabs++; }
    if(/^ {2,}/.test(l)){ spaces++; }
    if(l.length > 200){
      longLines++;
      if(longLines <= 5){ push(list,'suggestion',file,i+1,201,'Bahut lambi line (' + l.length + ' characters).','Line ko tod dijiye.'); }
    }
    if(/\b(TODO|FIXME|XXX)\b/.test(l) && ['md','txt'].indexOf(langId) < 0){
      push(list,'suggestion',file,i+1,l.search(/\b(TODO|FIXME|XXX)\b/)+1,'Yahan adhoora kaam ka nishaan hai (' + RegExp.$1 + ').','Kaam poora karke comment hataiye.');
    }
  });
  if(tabs && spaces){
    push(list,'suggestion',file,1,1,'File mein tabs aur spaces dono use hue hain (' + tabs + ' lines tab se, ' + spaces + ' lines space se).','Ek hi tarika chuniye — sirf spaces behtar hai.');
  }
  if(code.length && !/\n$/.test(code)){
    push(list,'suggestion',file,lines.length,lines[lines.length-1].length+1,'File ke aakhir mein newline nahi hai.','Aakhir mein ek newline jodiye (git diff saaf rehta hai).');
  }
}

/* JSON — apna parser, exact line/column ke saath */
function jsonValidate(code){
  var i = 0, n = code.length;
  function fail(msg, pos){ var e = new Error(msg); e.pos = (pos === undefined ? i : pos); throw e; }
  function ws(){ while(i < n && /[\s]/.test(code[i])){ i++; } }
  function parseString(){
    var startPos = i;
    i++;
    while(i < n){
      var c = code[i];
      if(c === '\\'){ i += 2; continue; }
      if(c === '"'){ i++; return; }
      if(c === '\n'){ fail('String ke andar newline nahi aa sakta — quote band kijiye.', startPos); }
      i++;
    }
    fail('String band nahi hui — closing `"` missing hai.', startPos);
  }
  function parseNumber(){
    var m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(code.slice(i));
    if(!m || !m[0]){ fail('Number galat likha hai.', i); }
    i += m[0].length;
  }
  function parseObject(){
    i++; ws();
    if(code[i] === '}'){ i++; return; }
    while(true){
      ws();
      if(code[i] !== '"'){ fail('Object mein key double quotes mein honi chahiye.', i); }
      parseString();
      ws();
      if(code[i] !== ':'){ fail('Key ke baad `:` missing hai.', i); }
      i++;
      parseValue();
      ws();
      if(code[i] === ','){ i++; ws(); if(code[i] === '}'){ fail('Aakhri comma ke baad key expected thi — trailing comma allowed nahi.', i); } continue; }
      if(code[i] === '}'){ i++; return; }
      fail('Yahan `,` ya `}` expected tha.', i);
    }
  }
  function parseArray(){
    i++; ws();
    if(code[i] === ']'){ i++; return; }
    while(true){
      parseValue();
      ws();
      if(code[i] === ','){ i++; ws(); if(code[i] === ']'){ fail('Aakhri comma ke baad value expected thi — trailing comma allowed nahi.', i); } continue; }
      if(code[i] === ']'){ i++; return; }
      fail('Yahan `,` ya `]` expected tha.', i);
    }
  }
  function parseValue(){
    ws();
    if(i >= n){ fail('Value expected thi par JSON khatam ho gaya.', i); }
    var c = code[i];
    if(c === '{'){ return parseObject(); }
    if(c === '['){ return parseArray(); }
    if(c === '"'){ return parseString(); }
    if(c === '-' || (c >= '0' && c <= '9')){ return parseNumber(); }
    if(code.substr(i,4) === 'true'){ i += 4; return; }
    if(code.substr(i,5) === 'false'){ i += 5; return; }
    if(code.substr(i,4) === 'null'){ i += 4; return; }
    if(c === "'"){ fail('Single quote use hua hai — JSON mein double quotes chahiye.', i); }
    if(c === '/' ){ fail('JSON mein comment allowed nahi hai.', i); }
    fail('Yahan value expected thi, mila "' + c + '".', i);
  }
  parseValue();
  ws();
  if(i < n){ fail('JSON ke baad extra text hai.', i); }
  return null;
}

function checkJson(code, file, list){
  try{
    jsonValidate(code);
    push(list,'info',file,1,1,'JSON bilkul valid hai — parser ne accept kar liya.','');
  }catch(e){
    if(e.pos === undefined){ push(list,'error',file,1,1,'JSON galat hai: ' + e.message,''); return; }
    var lc = lineCol(code, Math.min(e.pos, code.length));
    var fix = 'Yahan syntax theek kijiye.';
    if(/trailing comma/i.test(e.message)){ fix = 'Aakhri item ke baad ka comma hataiye.'; }
    else if(/double quotes/i.test(e.message)){ fix = 'Single quotes ki jagah double quotes use kijiye.'; }
    else if(/`:`/.test(e.message)){ fix = 'Key ke baad colon `:` lagaiye.'; }
    else if(/comment/i.test(e.message)){ fix = 'Comment hataiye — JSON mein allowed nahi.'; }
    else if(/band nahi/i.test(e.message)){ fix = 'String ke aakhir mein closing quote lagaiye.'; }
    push(list,'error',file,lc.line,lc.col,e.message,fix);
  }
}

/* XML / SVG — asli XML parser */
function checkXml(code, file, list){
  if(typeof DOMParser === 'undefined'){ push(list,'info',file,1,1,'Is browser mein XML parser nahi hai.',''); return; }
  var doc = new DOMParser().parseFromString(code, 'application/xml');
  var err = doc.querySelector('parsererror');
  if(!err){
    push(list,'info',file,1,1,'XML bilkul valid hai — parser ne accept kar liya.','');
    return;
  }
  var text = (err.textContent || '').replace(/\s+/g, ' ').trim();
  var m = text.match(/line\s+(\d+)\s*(?:at\s+)?column\s+(\d+)/i) || text.match(/line\s+(\d+)/i);
  var line = m ? parseInt(m[1],10) : 1;
  var col = m && m[2] ? parseInt(m[2],10) : 1;
  push(list,'error',file,line,col,'XML well-formed nahi hai: ' + text.slice(0, 160),'Tag band kijiye, quotes check kijiye, ya galat character hataiye.');
}

/* HTML — tag stack */
var VOID = {area:1,base:1,br:1,col:1,embed:1,hr:1,img:1,input:1,link:1,meta:1,param:1,source:1,track:1,wbr:1};
function checkHtml(code, file, list, blogger){
  var re = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g;
  var stack = [], m;
  var seenClose = {};
  function isBloggerTag(t){ return blogger && (/^b:/.test(t) || /^data:/.test(t) || /^expr:/.test(t)); }
  function note(key, fn){ if(seenClose[key]){ return; } seenClose[key] = 1; fn(); }

  while((m = re.exec(code))){
    var closing = m[1] === '/';
    var tag = m[2].toLowerCase();
    var rest = m[3] || '';
    var selfClose = /\/\s*$/.test(rest);
    var lc = lineCol(code, m.index);

    if(isBloggerTag(tag)){ continue; }                 /* b:, data:, expr: — Blogger ke apne tags */

    if(!closing && !selfClose && !VOID[tag] && tag !== '!doctype'){
      stack.push({ tag: tag, line: lc.line, col: lc.col });
      continue;
    }

    if(closing){
      if(!stack.length){
        note('extra:' + tag, function(){
          push(list,'error',file,lc.line,lc.col,'`</' + tag + '>` ka koi opening tag nahi mila.','Is closing tag ko hataiye ya upar `<'+tag+'>` jodiye.');
        });
        continue;
      }
      if(stack[stack.length-1].tag === tag){ stack.pop(); continue; }

      var idx = -1;
      for(var i = stack.length - 1; i >= 0; i--){ if(stack[i].tag === tag){ idx = i; break; } }

      if(idx >= 0){
        /* beech ke tags band nahi hue — ek hi baar report karo */
        for(var j = stack.length - 1; j > idx; j--){
          var o = stack[j];
          note('open:' + o.tag + ':' + o.line, function(o){
            return function(){
              push(list,'error',file,o.line,o.col,'`<' + o.tag + '>` band nahi hua — `</' + o.tag + '>` missing hai (line ' + lc.line + ' par `</' + tag + '>` mila).','Line ' + o.line + ' ke paas `</' + o.tag + '>` jodiye.');
            };
          }(o));
        }
        stack.length = idx;   /* sab pop, matching bhi */
      } else {
        note('orphan:' + tag, function(){
          push(list,'error',file,lc.line,lc.col,'`</' + tag + '>` ka opening tag nahi mila.','Ya to opening `<'+tag+'>` jodiye ya ye closing tag hataiye.');
        });
      }
      continue;
    }

    /* attributes */
    var attrRe = /([\w:-]+)\s*=\s*(?:"[^"]*"|'[^']*'|([^\s"'=<>`]+))/g, am;
    while((am = attrRe.exec(rest))){
      if(am[2]){
        note('attr:' + am[1] + ':' + lc.line, function(a1, a2){
          return function(){
            push(list,'warning',file,lc.line,lc.col,'Attribute `' + a1 + '` ke value par quotes nahi hain.','Value ko quotes mein likhiye: ' + a1 + '="' + a2 + '"');
          };
        }(am[1], am[2]));
      }
    }
  }

  var left = stack.slice(0, 6);
  left.forEach(function(o){
    push(list,'error',file,o.line,o.col,'`<' + o.tag + '>` band nahi hua.','`</' + o.tag + '>` jodiye.');
  });
  if(stack.length > 6){
    push(list,'error',file,stack[6].line,stack[6].col,'Aur ' + (stack.length - 6) + ' tags bhi band nahi hue.','Sabhi khule tags ko band kijiye (upar se neeche).');
  }
  if(!blogger && !/<!doctype\s+html/i.test(code) && /<html[\s>]/i.test(code)){
    push(list,'suggestion',file,1,1,'DOCTYPE missing hai.','Sabse upar `<!DOCTYPE html>` likhiye.');
  }
  if(blogger && !/<\?xml/i.test(code)){
    push(list,'suggestion',file,1,1,'Blogger template mein sabse upar `<?xml version="1.0" encoding="UTF-8" ?>` hona chahiye.','XML declaration jodiye.');
  }
}

/* CSS */
function checkCss(code, file, list, off){
  off = off || 0;
  var noSemi = 0, missingVal = 0, missingColon = 0, depth = 0;

  var allLines = code.split('\n');
  allLines.forEach(function(l, i){
    var t = l.trim();
    if(!t){ return; }
    /* agli khaali-na-hone wali line ka pehla character */
    var nextFirst = '';
    for(var q = i + 1; q < allLines.length; q++){
      var tl = allLines[q].trim();
      if(tl){ nextFirst = tl[0]; break; }
    }
    var segs = t.split(/([{}])/);
    var cur = depth;

    for(var k = 0; k < segs.length; k++){
      var seg = segs[k];
      if(seg === '{'){ cur++; continue; }
      if(seg === '}'){ cur = Math.max(0, cur - 1); continue; }

      var part = seg.trim();
      if(!part || cur <= 0){ continue; }
      var next = (segs[k+1] || '').trim();
      if(!next && nextFirst === '}'){ next = '}'; }        /* agli line par hi } hai */
      if(next === '{'){ continue; }                       /* selector */
      if(part.indexOf('/*') === 0 || part.indexOf('//') === 0 || part.indexOf('*') === 0){ continue; }

      var endsWithSemi = /;\s*$/.test(part);
      var decls = part.split(';');

      decls.forEach(function(dd){
        dd = dd.trim();
        if(!dd){ return; }
        if(/^[-\w]+\s*:\s*$/.test(dd)){                   /* property: <khaali> */
          if(missingVal < 6){
            missingVal++;
            push(list,'error',file,i+1+off,t.length,'Property `' + dd.replace(':','').trim() + '` ki value khaali hai.','Value likhiye, jaise `' + dd.replace(':','').trim() + ': red;`');
          }
          return;
        }
        if(dd.indexOf(':') < 0 && /^[-\w]+\s+\S+/.test(dd)){  /* colon hi nahi */
          if(missingColon < 6){
            missingColon++;
            push(list,'warning',file,i+1+off,t.length,'Declaration mein colon `:` missing hai.','`property: value;` format mein likhiye.');
          }
        }
      });

      if(!endsWithSemi && next !== '}' && noSemi < 8){
        noSemi++;
        push(list,'warning',file,i+1+off,t.length,'Declaration ke aakhir mein semicolon nahi hai.','Line ke aakhir mein `;` lagaiye.');
      }
    }
    depth = cur;
  });
}

/* JavaScript / TypeScript */
function checkJs(code, file, list, isTs){
  try{
    new Function(code);                     /* sirf parse — chalaya nahi jaata */
    push(list,'info',file,1,1,'JavaScript syntax theek hai (browser parser ne accept kiya).','');
  }catch(e){
    var msg = e.message || 'Syntax error';
    var ln = 1, cl = 1;
    var mm = String(e.stack || '').match(/<anonymous>:(\d+):(\d+)/);
    if(mm){ ln = Math.max(1, parseInt(mm[1],10) - 2); cl = parseInt(mm[2],10) || 1; }
    push(list,'error',file,ln,cl,'Syntax error: ' + msg,'Bracket, quote aur keyword check kijiye. Ye error browser ke apne parser se aaya hai.');
  }
  if(/\bvar\s+/.test(code)){
    var n = (code.match(/\bvar\s+/g) || []).length;
    push(list,'suggestion',file,1,1,'`var` ' + n + ' baar use hua hai.','Modern JS mein `let` ya `const` behtar hai (block scope milta hai).');
  }
  if(/[^=!<>]==[^=]/.test(code)){
    push(list,'suggestion',file,1,1,'`==` mila — type coercion hota hai.','`===` use kijiye taaki type bhi compare ho.');
  }
  if(/console\.log/.test(code)){
    push(list,'suggestion',file,1,1,'`console.log` code mein chhoda hua hai.','Production se pehle hataiye.');
  }
}

/* Python */
function checkPy(code, file, list){
  var lines = code.split('\n');
  var tabLines = 0, spaceLines = 0;
  lines.forEach(function(l, i){
    if(/^\t+/.test(l)){ tabLines++; }
    if(/^ +\S/.test(l)){ spaceLines++; }
    var t = l.replace(/#.*$/, '').trim();
    if(/^(if|elif|else|for|while|def|class|try|except|finally|with|match|case)\b/.test(t) && !/:$/.test(t)){
      if(/^(else|try|finally)\s*$/.test(t)){
        push(list,'error',file,i+1,t.length,'`' + t + '` ke baad colon `:` chahiye.','Line ke aakhir mein `:` lagaiye.');
      } else if(t.indexOf(':') < 0){
        push(list,'error',file,i+1,t.length,'Block statement ke baad `:` missing hai.','Line ke aakhir mein `:` lagaiye.');
      }
    }
    if(/print\s+[^(\s]/.test(t) && !/print\s*\(/.test(t)){
      push(list,'error',file,i+1,1,'Python 3 mein print ke saath bracket chahiye.','`print(value)` likhiye.');
    }
  });
  if(tabLines && spaceLines){
    push(list,'error',file,1,1,'File mein tabs aur spaces dono indentation ke liye use hue hain — Python isse error deta hai.','Poori file mein sirf spaces (4) use kijiye.');
  }
}

/* YAML */
function checkYaml(code, file, list){
  var lines = code.split('\n');
  var seen = {};
  lines.forEach(function(l, i){
    if(/^\t/.test(l)){
      push(list,'error',file,i+1,1,'YAML mein tab se indentation allowed nahi hai.','Tabs ki jagah spaces use kijiye.');
    }
    var m = l.match(/^(\s*)([A-Za-z0-9_.-]+)\s*:/);
    if(m){
      var key = m[1].length + '|' + m[2];
      if(seen[key]){
        push(list,'warning',file,i+1,1,'Ye key `' + m[2] + '` isi level par pehle bhi hai (line ' + seen[key] + ').','Duplicate key hataiye ya naam badliye.');
      } else { seen[key] = i + 1; }
    }
    if(/:\s*$/.test(l) && !/^\s*#/.test(l) && !/^\s*$/.test(l)){
      var next = lines[i+1];
      if(next !== undefined && next.trim() && next.search(/\S/) <= l.search(/\S/)){
        push(list,'warning',file,i+1,1,'Is key ke baad nested value expected hai par indentation badhi nahi.','Agli line ko aage (indent) kijiye.');
      }
    }
  });
}

/* SQL */
function checkSql(code, file, list){
  var t = code.replace(/--[^\n]*/g, '');
  if(!/;\s*$/.test(t.trim())){
    push(list,'suggestion',file,code.split('\n').length,1,'Aakhir mein semicolon nahi hai.','Statement ke aakhir mein `;` lagaiye.');
  }
  var words = ['SELECT','INSERT','UPDATE','DELETE','CREATE','ALTER','DROP'];
  var first = t.trim().split(/\s+/)[0] || '';
  if(first && words.indexOf(first.toUpperCase()) < 0){
    push(list,'suggestion',file,1,1,'Statement `' + first + '` se shuru hota hai — ye common SQL keyword nahi hai.','SQL keyword se shuru kijiye (SELECT, INSERT, ...).');
  }
  if(/\bSELECT\b[\s\S]*\bFROM\b/i.test(t) === false && /\bSELECT\b/i.test(t)){
    push(list,'warning',file,1,1,'SELECT hai par FROM nahi mila.','Query mein `FROM table` jodiye.');
  }
}

/* Markdown */
function checkMd(code, file, list){
  var fences = (code.match(/^```/gm) || []).length;
  if(fences % 2 !== 0){
    push(list,'error',file,1,1,'Code fence (```) band nahi hua — total ' + fences + ' mile (odd number).','Ek aur ``` lagaiye.');
  }
  code.split('\n').forEach(function(l, i){
    var m = l.match(/\[([^\]]*)\]\(([^)]*)\)/);
    if(m && /\s/.test(m[2]) && !/^https?:/.test(m[2])){
      push(list,'suggestion',file,i+1,m.index+1,'Link ke URL mein space hai — Markdown ise tootne lagta hai.','URL ko `<...>` mein ya space ko `%20` se badliye.');
    }
  });
}

/* HTML ke andar script/style/comment ka content HTML nahi hota —
   usko space se bhar dete hain (line numbers same rehte hain) */
function maskBlocks(code, blogger){
  function blank(str){ return str.replace(/[^\n]/g, ' '); }
  var out = code;
  out = out.replace(/<!--[\s\S]*?-->/g, function(m){ return blank(m); });
  var ATTRS = '(?:"[^"]*"|\'[^\']*\'|[^>])*';
  var tagsToMask = ['script', 'style', 'textarea', 'pre'];
  if(blogger){ tagsToMask.push('b:skin'); }
  tagsToMask.forEach(function(tag){
    var re = new RegExp('(<' + tag + '\\b' + ATTRS + '>)([\\s\\S]*?)(</' + tag + '>)', 'gi');
    out = out.replace(re, function(m, a, b, c){ return a + blank(b) + c; });
  });
  return out;
}

/* HTML ke andar ke <script> blocks ka JS syntax check */
function checkHtmlScripts(code, masked, file, list){
  var re = /<script\b([^>]*)>/gi, m;
  var n = 0;
  while((m = re.exec(masked))){
    var attrs = m[1] || '';
    var openEnd = m.index + m[0].length;
    var cm = /<\/script\s*>/i.exec(masked.slice(openEnd));
    if(!cm){ continue; }
    var body = code.slice(openEnd, openEnd + cm.index);
    if(/\bsrc\s*=/i.test(attrs) || !body.trim()){ continue; }
    n++;
    var start = lineCol(code, openEnd);
    try{
      new Function(body);                 /* sirf parse, chalaya nahi jaata */
    }catch(e){
      push(list,'error',file,start.line,start.col,'Andar ke script mein JS syntax error: ' + (e.message || 'galat'),'Us script block ka JS check kijiye (line ' + start.line + ' se shuru).');
    }
  }
  return n;
}

function checkHtmlStyles(code, masked, file, list, blogger){
  var openRe = blogger ? /<(style|b:skin)\b[^>]*>/gi : /<style\b[^>]*>/gi;
  var m, n = 0;
  while((m = openRe.exec(masked))){
    var tag = (m[1] || 'style');
    var openEnd = m.index + m[0].length;
    var closeRe = new RegExp('</' + tag + '\\s*>', 'i');
    var rest = masked.slice(openEnd);
    var cm = closeRe.exec(rest);
    if(!cm){ continue; }
    var closeStart = openEnd + cm.index;
    var body = code.slice(openEnd, closeStart);
    if(!body.trim()){ continue; }
    var lc = lineCol(code, openEnd);
    body = body.replace(/<!\[CDATA\[/g, '          ').replace(/\]\]>/g, '    ');
    var before = list.length;
    checkCss(body, file, list, lc.line - 1);
    n += (list.length - before);
  }
  return n;
}

function runChecks(code, file, langId){
  var list = [];
  var lang = langById(langId);
  var blogger = (lang.check === 'blogger');
  var masked = (langId === 'html' || langId === 'xml' || langId === 'svg' || blogger) ? maskBlocks(code, blogger) : code;
  checkBrackets(masked, file, langId, list);
  checkLines(code, file, list, langId);
  try{
    if(lang.check === 'json'){ checkJson(code, file, list); }
    else if(lang.check === 'xml'){ checkXml(masked, file, list); }
    else if(lang.check === 'html' || lang.check === 'blogger'){
      checkHtml(masked, file, list, blogger);
      var sn = checkHtmlScripts(code, masked, file, list);
      var cn = checkHtmlStyles(code, masked, file, list, blogger);
      if(sn || cn){ push(list,'info',file,1,1,'Andar ke ' + sn + ' script aur ' + cn + ' CSS issue alag se check kiye gaye.',''); }
    }
    else if(lang.check === 'css'){ checkCss(code, file, list); }
    else if(lang.check === 'js'){ checkJs(code, file, list, false); }
    else if(lang.check === 'ts'){ checkJs(code, file, list, true); }
    else if(lang.check === 'py'){ checkPy(code, file, list); }
    else if(lang.check === 'yaml'){ checkYaml(code, file, list); }
    else if(lang.check === 'sql'){ checkSql(code, file, list); }
    else if(lang.check === 'md'){ checkMd(code, file, list); }
  }catch(e){
    push(list,'error',file,1,1,'Checker mein dikkat: ' + e.message,'');
  }

  /* duplicate errors hatao + cap */
  var seen = {}, out = [];
  list.forEach(function(it){
    var k = it.sev + '|' + it.line + '|' + it.col + '|' + it.msg;
    if(!seen[k]){ seen[k] = 1; out.push(it); }
  });
  var errs = out.filter(function(x){ return x.sev === 'error'; });
  if(errs.length > 40){
    var extra = errs.length - 40;
    var kept = 0;
    out = out.filter(function(x){
      if(x.sev !== 'error'){ return true; }
      kept++;
      return kept <= 40;
    });
    out.push({ sev:'error', file:file, line:0, col:0, msg:'Aur ' + extra + ' errors hain — pehle 40 dikhaye gaye hain. Baaki theek karne par ye bhi dikhenge.', fix:'' });
  }
  return out;
}

/* ---------------- UI ---------------- */
function ccPanel(){
  var opts = LANGS.map(function(l){
    return '<option value="' + l.id + '">' + l.name + (l.level === 'full' ? ' (full)' : ' (basic)') + '</option>';
  }).join('');
  return '' +
  '<section id="t-codecheck" class="tool">' +
  '  <h2>Universal code checker</h2>' +
  '  <p class="desc">Paste code or upload a file — checked with a real parser where possible. Nothing is sent to a server, your code chalaya nahi jaata.</p>' +
  '  <div class="row">' +
  '    <select id="cc-lang" style="min-width:180px">' + opts + '</select>' +
  '    <input type="file" id="cc-file" multiple style="display:none">' +
  '    <button class="act" onclick="document.getElementById(\'cc-file\').click()">Upload file</button>' +
  '    <span class="lbl" id="cc-fileinfo"></span>' +
  '  </div>' +
  '  <div class="cc-editor">' +
  '    <pre class="cc-gutter" id="cc-gutter">1</pre>' +
  '    <textarea id="cc-code" spellcheck="false" placeholder="Paste code here..."></textarea>' +
  '  </div>' +
  '  <div class="row" style="flex-wrap:wrap;gap:6px">' +
  '    <button class="act pri" onclick="ccCheck()">Check code</button>' +
  '    <button class="act" onclick="ccClear()">Clear</button>' +
  '    <button class="act" onclick="ccCopyCode()">Copy code</button>' +
  '    <button class="act" onclick="ccCopyReport()">Copy report</button>' +
  '    <button class="act" onclick="ccDownloadReport()">Download report</button>' +
  '    <button class="act" onclick="ccDownloadCode()">Download code</button>' +
  '    <button class="act" onclick="ccCheck()">Check again</button>' +
  '    <button class="act" onclick="ccSelfTest()">Self-test</button>' +
  '  </div>' +
  '  <div class="status" id="cc-st"></div>' +
  '  <div class="row cc-tabs">' +
  '    <button class="act cc-tab on" data-t="errors" onclick="ccTab(\'errors\')">Errors <b id="cc-n-errors">0</b></button>' +
  '    <button class="act cc-tab" data-t="warnings" onclick="ccTab(\'warnings\')">Warnings <b id="cc-n-warnings">0</b></button>' +
  '    <button class="act cc-tab" data-t="suggestions" onclick="ccTab(\'suggestions\')">Suggestions <b id="cc-n-suggestions">0</b></button>' +
  '    <button class="act cc-tab" data-t="summary" onclick="ccTab(\'summary\')">Summary</button>' +
  '  </div>' +
  '  <div id="cc-results"></div>' +
  '</section>';
}

function ccSetStatus(msg, cls){
  var e = document.getElementById('cc-st');
  if(e){ e.textContent = msg || ''; e.className = 'status ' + (cls || ''); }
}
function ccCodeEl(){ return document.getElementById('cc-code'); }

window.ccSyncGutter = function(){
  var ta = ccCodeEl(), g = document.getElementById('cc-gutter');
  if(!ta || !g){ return; }
  var n = ta.value.split('\n').length;
  var out = [];
  for(var i = 1; i <= n; i++){ out.push(i); }
  g.textContent = out.join('\n');
  g.scrollTop = ta.scrollTop;
};

window.ccCheck = function(){
  var ta = ccCodeEl();
  var code = ta ? ta.value : '';
  if(!code.trim()){ ccSetStatus('Pehle code paste kijiye ya file upload kariye.', 'info'); return; }
  var langId = document.getElementById('cc-lang').value;
  var lang = langById(langId);
  var file = (CC.files[CC.active] && CC.files[CC.active].name) || ('code.' + (lang.ext[0] || 'txt'));
  var issues = runChecks(code, file, langId);
  CC.issues = issues;
  CC.checked = true;
  var errs = issues.filter(function(x){ return x.sev === 'error'; }).length;
  var warns = issues.filter(function(x){ return x.sev === 'warning'; }).length;
  var sug = issues.filter(function(x){ return x.sev === 'suggestion'; }).length;
  document.getElementById('cc-n-errors').textContent = errs;
  document.getElementById('cc-n-warnings').textContent = warns;
  document.getElementById('cc-n-suggestions').textContent = sug;
  ccRender();
  ccSetStatus(errs ? (errs + ' error mile — neeche dekhiye.') : (warns ? ('Koi error nahi, ' + warns + ' warning hai.') : 'Koi error nahi mila.'), errs ? 'bad' : 'ok');
};

window.ccTab = function(t){
  CC.tab = t;
  document.querySelectorAll('.cc-tab').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-t') === t); });
  ccRender();
};

function ccIssueHtml(it){
  var cls = it.sev === 'error' ? 'bad' : (it.sev === 'warning' ? 'warn' : 'info');
  var label = it.sev === 'error' ? 'Error' : (it.sev === 'warning' ? 'Warning' : 'Suggestion');
  return '<div class="cc-issue ' + cls + '">' +
    '<div class="cc-issue-head"><b>' + label + '</b> <span class="lbl">' + esc(it.file) + ' : line ' + it.line + ', col ' + it.col + '</span></div>' +
    '<div>' + esc(it.msg) + '</div>' +
    (it.fix ? '<div class="cc-fix">Suggestion: ' + esc(it.fix) + '</div>' : '') +
    '</div>';
}

function ccRender(){
  var box = document.getElementById('cc-results');
  if(!box){ return; }
  if(!CC.checked){ box.innerHTML = '<div class="lbl">Now check nahi hua — "Check code" dabaiye.</div>'; return; }

  if(CC.tab === 'summary'){
    var langId = document.getElementById('cc-lang').value;
    var lang = langById(langId);
    var e = CC.issues.filter(function(x){ return x.sev === 'error'; }).length;
    var w = CC.issues.filter(function(x){ return x.sev === 'warning'; }).length;
    var s = CC.issues.filter(function(x){ return x.sev === 'suggestion'; }).length;
    var lvl = lang.level === 'full' ? 'FULL — asli parser se jaanch hui' : 'PARTIAL — syntax + structure ki basic jaanch';
    box.innerHTML = '<div class="cc-summary">' +
      '<div><b>Language:</b> ' + lang.name + '</div>' +
      '<div><b>Support level:</b> ' + lvl + '</div>' +
      '<div><b>Errors:</b> ' + e + ' &nbsp; <b>Warnings:</b> ' + w + ' &nbsp; <b>Suggestions:</b> ' + s + '</div>' +
      '<div><b>Lines:</b> ' + (ccCodeEl().value.split('\n').length) + '</div>' +
      '<div><b>Checker version:</b> 2.2</div>' +
      '<div class="lbl" style="margin-top:8px">Note: PARTIAL ka matlab hai ki syntax ki buniyadi jaanch hoti hai, poori compiler-level checking nahi. Koi bhi AI ya online service use nahi hoti.</div>' +
      '</div>';
    return;
  }

  var map = { errors:'error', warnings:'warning', suggestions:'suggestion' };
  var want = map[CC.tab];
  var list = CC.issues.filter(function(x){ return x.sev === want; });
  if(!list.length){
    box.innerHTML = '<div class="lbl">Is tab mein kuch nahi hai.</div>';
    return;
  }
  box.innerHTML = list.map(ccIssueHtml).join('');
}

window.ccSelfTest = function(){
  var cases = [
    { name:'valid JSON',              code:'{"a":1}', lang:'json',   expect:0 },
    { name:'JSON trailing comma',     code:'{"a":1,}', lang:'json',  expect:1 },
    { name:'JSON galat position',     code:'{\n "a": 1,\n "b": ,\n "c": 3\n}', lang:'json', expect:1 },
    { name:'valid HTML',              code:'<!DOCTYPE html><html><body><p>x</p></body></html>', lang:'html', expect:0 },
    { name:'HTML tag mismatch',       code:'<div><p>hi</div>', lang:'html', expect:1, maxErrs:3 },
    { name:'script ke andar HTML',    code:'<html><body><script>var s = "<div>x</div>";<\/script></body></html>', lang:'html', expect:0 },
    { name:'CSS missing value',       code:'.a{color:;background:blue;}', lang:'css', expect:1 },
    { name:'CSS missing semicolon',   code:'.a{color:red\nbackground:blue}', lang:'css', expect:0 },
    { name:'valid CSS',               code:'.a{color:red;background:blue}', lang:'css', expect:0 },
    { name:'valid JS',                code:'function f(a){ return a*2; }', lang:'js', expect:0 },
    { name:'JS syntax error',         code:'function f( { return 1 }', lang:'js', expect:1 },
    { name:'Blogger template valid',  code:'<?xml version="1.0"?>\n<html><b:skin><![CDATA[.a{color:red;}]]></b:skin><body><b:section id="m"/><data:post.title/></body></html>', lang:'blogger', expect:0 },
    { name:'Blogger b:skin mein CSS galti', code:'<?xml version="1.0"?>\n<html><b:skin><![CDATA[.a{color:;}]]></b:skin><body></body></html>', lang:'blogger', expect:1 }
  ];
  var pass = 0, lines = [];
  cases.forEach(function(c){
    var is = runChecks(c.code, 'selftest.' + c.lang, c.lang);
    var errs = is.filter(function(x){ return x.sev === 'error'; }).length;
    var ok = (c.expect === 0) ? (errs === 0) : (errs > 0);
    if(ok && c.maxErrs && errs > c.maxErrs){ ok = false; }
    if(ok){ pass++; }
    lines.push((ok ? 'PASS' : 'FAIL') + '  ' + c.name + '  (errors: ' + errs + ')');
  });
  var msg = 'Self-test: ' + pass + '/' + cases.length + ' pass\n\n' + lines.join('\n') + '\n\nChecker v2.2 — cascading errors limited, JSON exact position, Blogger mode';
  var box = document.getElementById('cc-results');
  if(box){
    box.innerHTML = '<div class="cc-summary" style="white-space:pre-wrap">' + msg.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</div>';
  }
  ccSetStatus(pass === cases.length ? 'Self-test pass — checker sahi kaam kar raha hai (' + pass + '/' + cases.length + ').' : 'Self-test fail — ' + (cases.length - pass) + ' case fail hue.', pass === cases.length ? 'ok' : 'bad');
};

window.ccClear = function(){
  var ta = ccCodeEl();
  if(ta){ ta.value = ''; }
  CC.files = []; CC.active = 0; CC.issues = []; CC.checked = false;
  document.getElementById('cc-fileinfo').textContent = '';
  document.getElementById('cc-n-errors').textContent = '0';
  document.getElementById('cc-n-warnings').textContent = '0';
  document.getElementById('cc-n-suggestions').textContent = '0';
  ccSyncGutter(); ccRender();
  ccSetStatus('Saaf ho gaya.', 'info');
};

window.ccCopyCode = function(){
  var ta = ccCodeEl();
  if(!ta || !ta.value){ ccSetStatus('Code khaali hai.', 'info'); return; }
  ccCopy(ta.value);
  ccSetStatus('Code copy ho gaya.', 'ok');
};

function ccReportText(){
  var lang = langById(document.getElementById('cc-lang').value);
  var lines = [];
  lines.push('CODE CHECK REPORT');
  lines.push('Language : ' + lang.name + ' (' + (lang.level === 'full' ? 'full support' : 'partial support') + ')');
  lines.push('Date     : ' + new Date().toLocaleString('en-IN'));
  lines.push('Total    : ' + CC.issues.length + ' issues');
  lines.push('');
  CC.issues.forEach(function(it, i){
    lines.push((i+1) + '. [' + it.sev.toUpperCase() + '] ' + it.file + ' line ' + it.line + ', col ' + it.col);
    lines.push('   ' + it.msg);
    if(it.fix){ lines.push('   Fix: ' + it.fix); }
    lines.push('');
  });
  return lines.join('\n');
}

window.ccCopyReport = function(){
  if(!CC.checked){ ccSetStatus('Pehle check kijiye.', 'info'); return; }
  ccCopy(ccReportText());
  ccSetStatus('Report copy ho gayi.', 'ok');
};

window.ccDownloadReport = function(){
  if(!CC.checked){ ccSetStatus('Pehle check kijiye.', 'info'); return; }
  imSave(new Blob([ccReportText()], { type:'text/plain;charset=utf-8' }), 'code-check-report.txt');
  ccSetStatus('Report download ho gayi.', 'ok');
};

window.ccDownloadCode = function(){
  var ta = ccCodeEl();
  if(!ta || !ta.value){ ccSetStatus('Code khaali hai.', 'info'); return; }
  var lang = langById(document.getElementById('cc-lang').value);
  imSave(new Blob([ta.value], { type:'text/plain;charset=utf-8' }), 'code.' + (lang.ext[0] || 'txt'));
  ccSetStatus('Code file download ho gayi.', 'ok');
};

function ccCopy(text){
  try{
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }catch(e){}
}

/* file loading */
function ccLoadFile(file){
  if(!file){ return; }
  if(file.size > 2 * 1024 * 1024){ ccSetStatus('File bahut badi hai (2 MB se more) — chhoti file chuniye.', 'bad'); return; }
  var lang = langByExt(file.name);
  var fr = new FileReader();
  fr.onload = function(){
    var ta = ccCodeEl();
    ta.value = fr.result;
    if(lang){ document.getElementById('cc-lang').value = lang.id; }
    CC.files = [{ name: file.name }];
    CC.active = 0;
    document.getElementById('cc-fileinfo').textContent = file.name + ' (' + Math.round(file.size/1024) + ' KB)';
    ccSyncGutter(); CC.checked = false; ccRender();
    ccSetStatus('File load ho gayi' + (lang ? ' — language: ' + lang.name : ' — language khud chuniye') + '.', 'ok');
  };
  fr.onerror = function(){ ccSetStatus('File padh nahi paaya.', 'bad'); };
  fr.readAsText(file);
}

/* build */
function ccBuild(){
  var main = document.querySelector('main');
  var more = document.getElementById('g-more');
  if(!main || !more || document.getElementById('t-codecheck')){ return; }
  more.insertAdjacentHTML('beforeend',
    '<button class="nav" title="Universal code checker" onclick="openTool(\'codecheck\',this)">Code checker</button>');
  main.insertAdjacentHTML('beforeend', ccPanel());
  var cnt = document.querySelector('[data-g="more"] .count');
  if(cnt){ cnt.textContent = String(document.querySelectorAll('#g-more .nav').length); }

  var ta = ccCodeEl();
  ta.addEventListener('input', ccSyncGutter);
  ta.addEventListener('scroll', function(){
    var g = document.getElementById('cc-gutter');
    if(g){ g.scrollTop = ta.scrollTop; }
  });
  ta.addEventListener('keydown', function(e){
    if(e.key === 'Tab'){
      e.preventDefault();
      var s = ta.selectionStart, en = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
      ta.selectionStart = ta.selectionEnd = s + 2;
      ccSyncGutter();
    }
  });

  var fi = document.getElementById('cc-file');
  fi.addEventListener('change', function(){ ccLoadFile(fi.files[0]); });

  /* drag & drop */
  var ed = document.querySelector('.cc-editor');
  if(ed){
    ['dragenter','dragover'].forEach(function(ev){
      ed.addEventListener(ev, function(e){ e.preventDefault(); ed.classList.add('over'); });
    });
    ['dragleave','drop'].forEach(function(ev){
      ed.addEventListener(ev, function(e){ e.preventDefault(); ed.classList.remove('over'); });
    });
    ed.addEventListener('drop', function(e){
      var f = e.dataTransfer && e.dataTransfer.files;
      if(f && f.length){ ccLoadFile(f[0]); }
    });
  }
  ccSyncGutter();
  ccRender();
}

ccBuild();

/* test/debug */
window.CC = CC;
window.ccRunChecks = runChecks;
window.ccLangByExt = langByExt;

})();

/* ===== menudrawer ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

(function(){
  var aside = document.querySelector('aside');
  if(!aside || document.getElementById('menuDrawer')){ return; }
  var drawer = document.createElement('div');
  drawer.id = 'menuDrawer';
  /* saare group buttons aur lists drawer ke andar daalo */
  var nodes = Array.prototype.slice.call(aside.children).filter(function(el){
    return el.classList && (el.classList.contains('grp-btn') || el.classList.contains('grp-list'));
  });
  nodes.forEach(function(el){ drawer.appendChild(el); });
  /* theme button bhi drawer ke andar, sabse upar */
  var mt = aside.querySelector('.menu-theme');
  if(mt){ drawer.insertBefore(mt, drawer.firstChild); }
  aside.appendChild(drawer);

  /* drawer ke bahar click karne par band */
  document.addEventListener('click', function(e){
    if(window.innerWidth > 760){ return; }
    if(aside.classList.contains('menu-closed')){ return; }
    var d = document.getElementById('menuDrawer');
    if(!d || !d.contains(e.target)){
      if(e.target.closest && e.target.closest('.side-head')){ return; }   /* 3-line khud handle karega */
      aside.classList.add('menu-closed');
      var b = document.getElementById('burgerBtn');
      if(b){ b.classList.remove('on'); }
      document.querySelectorAll('.grp-list.open').forEach(function(l){ l.classList.remove('open'); });
      document.querySelectorAll('.grp-btn.open').forEach(function(x){ x.classList.remove('open'); });
    }
  }, true);
})();

/* ===== collagemaker ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

/* ===================================================================
   PHOTO COLLAGE MAKER — 1 se 9 photos, grid, gap, radius, export
   =================================================================== */
(function(){

var C = {
  imgs: [],          /* {img, name} */
  W: 1080, H: 1080,
  gap: 12,
  radius: 8,
  bg: '#0f172a',
  cols: 0            /* 0 = auto */
};

function $(id){ return document.getElementById(id); }
function esc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
function st(msg, cls){
  var e = $('cg-st');
  if(e){ e.textContent = msg || ''; e.className = 'status ' + (cls || ''); }
}

function gridFor(n){
  if(C.cols) { var cols = C.cols; return { cols: cols, rows: Math.ceil(n / cols) }; }
  if(n <= 1){ return { cols:1, rows:1 }; }
  if(n === 2){ return { cols:2, rows:1 }; }
  if(n === 3){ return { cols:2, rows:2 }; }   /* 2 upar, 1 neeche full */
  if(n === 4){ return { cols:2, rows:2 }; }
  if(n <= 6){ return { cols:3, rows:2 }; }
  return { cols:3, rows:3 };
}

function draw(){
  var cv = $('cg-canvas');
  if(!cv){ return; }
  cv.width = C.W; cv.height = C.H;
  var ctx = cv.getContext('2d');
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, C.W, C.H);

  var n = C.imgs.length;
  if(!n){
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Photos upload kijiye', C.W / 2, C.H / 2);
    return;
  }

  var g = gridFor(n);
  var gap = C.gap;
  var cw = (C.W - gap * (g.cols + 1)) / g.cols;
  var ch = (C.H - gap * (g.rows + 1)) / g.rows;
  var idx = 0;

  for(var r = 0; r < g.rows; r++){
    for(var c = 0; c < g.cols; c++){
      if(idx >= n){ break; }
      var x = gap + c * (cw + gap);
      var y = gap + r * (ch + gap);
      var w = cw, h = ch;

      /* 3 photos: pehli do upar, teesri neeche poori chaudai */
      if(n === 3 && r === 1){
        w = C.W - gap * 2;
      }

      var item = C.imgs[idx];
      var im = item.img;
      var sc = Math.max(w / im.naturalWidth, h / im.naturalHeight);
      var dw = im.naturalWidth * sc, dh = im.naturalHeight * sc;
      var dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;

      ctx.save();
      ctx.beginPath();
      if(ctx.roundRect){
        ctx.roundRect(x, y, w, h, C.radius);
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.clip();
      ctx.drawImage(im, dx, dy, dw, dh);
      ctx.restore();
      idx++;
    }
  }
  var info = $('cg-info');
  if(info){ info.textContent = C.imgs.length + ' photo • ' + C.W + '×' + C.H; }
}

function addFiles(files){
  var list = Array.prototype.slice.call(files || []);
  if(!list.length){ return; }
  if(C.imgs.length + list.length > 9){
    st('Zyada se more 9 photos. Kuch chhoti kari gayi.', 'bad');
    list = list.slice(0, 9 - C.imgs.length);
  }
  var pending = list.length;
  list.forEach(function(f){
    if(!/^image\//.test(f.type || '')){ pending--; return; }
    var fr = new FileReader();
    fr.onload = function(){
      var im = new Image();
      im.onload = function(){
        C.imgs.push({ img: im, name: f.name });
        pending--;
        if(pending <= 0){ renderThumbs(); draw(); st(C.imgs.length + ' photo lag gayi.', 'ok'); }
      };
      im.onerror = function(){ pending--; st('Ek image khul nahi paayi.', 'bad'); };
      im.src = fr.result;
    };
    fr.onerror = function(){ pending--; };
    fr.readAsDataURL(f);
  });
}

function renderThumbs(){
  var box = $('cg-thumbs');
  if(!box){ return; }
  box.innerHTML = C.imgs.map(function(it, i){
    return '<div class="cg-thumb"><img src="' + it.img.src + '" alt="">' +
      '<button class="cg-del" onclick="cgRemove(' + i + ')">×</button></div>';
  }).join('');
}

window.cgRemove = function(i){
  C.imgs.splice(i, 1);
  renderThumbs(); draw();
};

window.cgSet = function(k, v){
  if(k === 'gap'){ C.gap = parseInt(v, 10) || 0; }
  else if(k === 'radius'){ C.radius = parseInt(v, 10) || 0; }
  else if(k === 'bg'){ C.bg = v; }
  else if(k === 'cols'){ C.cols = parseInt(v, 10) || 0; }
  else if(k === 'size'){
    var p = String(v).split('x');
    C.W = parseInt(p[0], 10); C.H = parseInt(p[1], 10);
  }
  draw();
};

window.cgClear = function(){
  C.imgs = [];
  renderThumbs(); draw();
  st('Saaf ho gaya.', 'info');
};

window.cgExport = function(kind){
  var cv = $('cg-canvas');
  if(!cv || !C.imgs.length){ st('Pehle photos upload kijiye.', 'bad'); return; }
  var mime = kind === 'jpg' ? 'image/jpeg' : 'image/png';
  st('Export ho raha hai...', 'info');
  var done = false;
  function finish(b){
    if(done){ return; }
    done = true;
    if(!b){ st('Export fail hua.', 'bad'); return; }
    imSave(b, 'collage-' + C.W + 'x' + C.H + '.' + (kind === 'jpg' ? 'jpg' : 'png'));
    st('Collage export ho gaya — ' + Math.round(b.size / 1024) + ' KB.', 'ok');
  }
  try{
    cv.toBlob(function(b){ finish(b); }, mime, 0.92);
    setTimeout(function(){
      if(!done){
        try{
          var dataUrl = cv.toDataURL(mime, 0.92);
          var bin = atob(dataUrl.split(',')[1]);
          var arr = new Uint8Array(bin.length);
          for(var i = 0; i < bin.length; i++){ arr[i] = bin.charCodeAt(i); }
          finish(new Blob([arr], { type: mime }));
        }catch(e){ finish(null); }
      }
    }, 1800);
  }catch(e){ finish(null); }
};

function build(){
  var main = document.querySelector('main');
  if(!main || $('t-collage')){ return; }
  main.insertAdjacentHTML('beforeend',
    '<section id="t-collage" class="tool">' +
      '<h2>Photo collage</h2>' +
      '<p class="desc">Choose 2 to 9 photos — the grid builds itself. Change gap, corners, background and size, then download PNG/JPG. Photos arevice se hi padhi jaati hain.</p>' +
      '<div class="row" style="flex-wrap:wrap;gap:6px">' +
        '<input type="file" id="cg-file" accept="image/*" multiple style="display:none">' +
        '<button class="act pri" onclick="document.getElementById(\'cg-file\').click()">Choose photos</button>' +
        '<button class="act" onclick="cgClear()">Clear</button>' +
        '<button class="act" onclick="cgExport(\'png\')">PNG</button>' +
        '<button class="act" onclick="cgExport(\'jpg\')">JPG</button>' +
        '<span class="lbl" id="cg-info"></span>' +
      '</div>' +
      '<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px">' +
        '<select onchange="cgSet(\'size\',this.value)">' +
          '<option value="1080x1080">1080×1080 (post)</option>' +
          '<option value="1080x1350">1080×1350 (portrait)</option>' +
          '<option value="1920x1080">1920×1080 (wide)</option>' +
          '<option value="1280x720">1280×720 (thumbnail)</option>' +
        '</select>' +
        '<select onchange="cgSet(\'cols\',this.value)">' +
          '<option value="0">auto grid</option><option value="2">2 columns</option>' +
          '<option value="3">3 columns</option><option value="4">4 columns</option>' +
        '</select>' +
        '<span class="lbl">gap</span><input type="range" min="0" max="40" value="12" oninput="cgSet(\'gap\',this.value)" style="width:90px">' +
        '<span class="lbl">corner</span><input type="range" min="0" max="40" value="8" oninput="cgSet(\'radius\',this.value)" style="width:90px">' +
        '<span class="lbl">bg</span><input type="color" value="#0f172a" onchange="cgSet(\'bg\',this.value)">' +
      '</div>' +
      '<div class="cc-editor" style="margin-top:10px;max-height:none">' +
        '<canvas id="cg-canvas" width="1080" height="1080" style="width:100%;max-width:520px;height:auto;display:block;margin:auto;background:#0b0e12;border-radius:8px"></canvas>' +
      '</div>' +
      '<div class="row" id="cg-thumbs" style="flex-wrap:wrap;gap:6px;margin-top:8px"></div>' +
      '<div class="status" id="cg-st"></div>' +
    '</section>');

  var fi = $('cg-file');
  if(fi){ fi.addEventListener('change', function(){ addFiles(fi.files); fi.value = ''; }); }

  var drop = $('cg-canvas');
  if(drop){
    ['dragenter','dragover'].forEach(function(ev){
      drop.addEventListener(ev, function(e){ e.preventDefault(); });
    });
    drop.addEventListener('drop', function(e){
      e.preventDefault();
      if(e.dataTransfer && e.dataTransfer.files){ addFiles(e.dataTransfer.files); }
    });
  }
  draw();
}

build();

})();

/* ===== uploadbuttons ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

/* har file input ko ek jaisa "Upload" button banao (native Choose File hatao) */
(function(){
  function labelFor(inp){
    var a = (inp.getAttribute('accept') || '').toLowerCase();
    if(a.indexOf('json') >= 0){ return 'Upload Project'; }
    if(a.indexOf('image') >= 0){ return inp.multiple ? 'Upload Images' : 'Upload Image'; }
    if(a.indexOf('html') >= 0){ return 'Upload HTML'; }
    if(a.indexOf('xml') >= 0){ return 'Upload File'; }
    return inp.multiple ? 'Upload Files' : 'Upload File';
  }
  function upgrade(inp){
    if(!inp || inp.tagName !== 'INPUT' || inp.type !== 'file'){ return; }
    if(inp.dataset.upBtn){ return; }
    /* jo pehle se hidden hain aur unka apna button hai, unhe chhodo */
    if(inp.style.display === 'none' || inp.hidden){ inp.dataset.upBtn = 'skip'; return; }
    inp.dataset.upBtn = '1';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'up-btn';
    /* agar isi row mein label hai to button par bhi likho (duplicate labels na ho) */
    var ctx = '';
    var row = inp.closest ? inp.closest('.row') : null;
    if(row){
      var lbl = row.querySelector('.lbl');
      if(lbl){ ctx = lbl.textContent.trim(); }
    }
    btn.textContent = labelFor(inp) + (ctx ? ' — ' + ctx : '');
    btn.setAttribute('data-label', labelFor(inp));
    btn.addEventListener('click', function(e){
      e.preventDefault();
      try{ inp.click(); }catch(err){}
    });
    inp.style.display = 'none';
    if(inp.parentNode){ inp.parentNode.insertBefore(btn, inp.nextSibling); }
    /* agar input badal jaaye to button ka text bhi update */
    inp.addEventListener('change', function(){
      if(inp.files && inp.files.length > 1){
        btn.textContent = (btn.getAttribute('data-label') || labelFor(inp)) + ' (' + inp.files.length + ')' + (ctx ? ' — ' + ctx : '');
      }
    });
  }
  function scan(root){
    if(!root || !root.querySelectorAll){ return; }
    root.querySelectorAll('input[type=file]').forEach(upgrade);
  }
  scan(document);
  try{
    new MutationObserver(function(list){
      list.forEach(function(m){
        if(!m.addedNodes){ return; }
        m.addedNodes.forEach(function(n){
          if(n.nodeType !== 1){ return; }
          if(n.tagName === 'INPUT' && n.type === 'file'){ upgrade(n); }
          else { scan(n); }
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }catch(e){}
  window.upgradeFileInputs = scan;
})();

/* ===== textuploads ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

/* jin text tools mein file upload ka fayda hai, wahan upload button lagao */
(function(){
  var MAP = [
    ['t-json',     'jsonIn',   '.json,application/json', 'Upload JSON'],
    ['t-json',     'jsonOut',  null, null],
    ['t-replace',  'repIn',    '.txt,.md', 'Upload text'],
    ['t-regex',    'rxIn',     '.txt,.md', 'Upload text'],
    ['t-jwt',      'jwtIn',    '.txt', 'Upload token'],
    ['t-md',       'mdIn',     '.md,.markdown,.txt', 'Upload .md'],
    ['t-notes',    'notesIn',  '.txt,.md', 'Upload note'],
    ['t-xml',      'xmlIn',    '.xml,.txt', 'Upload XML'],
    ['t-aes',      'aesIn',    '.txt', 'Upload text'],
    ['t-yamlboth', 'yamlIn',   '.yaml,.yml,.json,.txt', 'Upload YAML (JSON se)'],
    ['t-yamlboth', 'y2In',     '.yaml,.yml,.json,.txt', 'Upload YAML (YAML se)'],
    ['t-diffboth', 'cmpA',     '.txt,.md,.json,.csv', 'Upload file A'],
    ['t-diffboth', 'cmpB',     '.txt,.md,.json,.csv', 'Upload file B'],
    ['t-csvboth',  'csvIn',    '.csv,.txt', 'Upload CSV (JSON ke liye)'],
    ['t-csvboth',  'ctIn',     '.csv,.txt', 'Upload CSV (table ke liye)'],
    ['t-textboth', 'stIn',     '.txt,.md', 'Upload text (stats)'],
    ['t-textboth', 'readIn',   '.txt,.md', 'Upload text (readability)'],
    ['t-listboth', 'linesIn',  '.txt', 'Upload list'],
    ['t-listboth', 'setA',     '.txt', 'Upload A'],
    ['t-listboth', 'setB',     '.txt', 'Upload B'],
    ['t-caseboth', 'caseIn',   '.txt', 'Upload text (case)'],
    ['t-caseboth', 'slugIn',   '.txt', 'Upload text (slug)'],
    ['t-htmlboth', 'htmlIn',   '.html,.htm,.txt', 'Upload HTML (entities)'],
    ['t-htmlboth', 'htIn',     '.html,.htm,.txt', 'Upload HTML (text ke liye)'],
    ['t-jsoncode', 'tsIn',     '.json', 'Upload JSON (TypeScript)'],
    ['t-jsoncode', 'sqlIn',    '.json', 'Upload JSON (SQL)'],
    ['t-y-qr',     'y-qr-txt', '.txt', 'Upload text']
  ];

  function addUpload(toolId, taId, accept, label){
    var ta = document.getElementById(taId);
    if(!ta || !accept){ return false; }
    if(ta.dataset.uploadAdded){ return false; }
    ta.dataset.uploadAdded = '1';

    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.style.display = 'none';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'up-btn';
    btn.textContent = label;
    btn.style.marginBottom = '8px';

    inp.addEventListener('change', function(){
      var f = inp.files && inp.files[0];
      if(!f){ return; }
      if(f.size > 5 * 1024 * 1024){
        alert('File 5 MB se badi hai — chhoti file chuniye.');
        return;
      }
      var fr = new FileReader();
      fr.onload = function(){
        ta.value = fr.result;
        try{
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.dispatchEvent(new Event('change', { bubbles: true }));
        }catch(e){}
        btn.textContent = label + ' ✓ ' + f.name.slice(0, 18);
      };
      fr.onerror = function(){ alert('File padhi nahi ja saki.'); };
      fr.readAsText(f);
    });

    btn.addEventListener('click', function(e){ e.preventDefault(); inp.click(); });

    /* textarea ke theek pehle daalo */
    ta.parentNode.insertBefore(btn, ta);
    ta.parentNode.insertBefore(inp, ta);
    return true;
  }

  var n = 0;
  MAP.forEach(function(m){ if(addUpload(m[0], m[1], m[2], m[3])){ n++; } });
  window.__textUploads = n;
})();

/* ===== designnav ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

(function(){
  var g = document.getElementById('g-design');
  if(!g || g.querySelector('[data-collage]')){ return; }
  g.insertAdjacentHTML('beforeend',
    '<button class="nav" data-collage="1" onclick="openTool(\'collage\',this)">Photo collage</button>');
  var c = document.querySelector('[data-g="design"] .count');
  if(c){ c.textContent = String(document.querySelectorAll('#g-design .nav').length); }
})();

/* ===== extratools ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

/* ===================================================================
   EXTRA FREE TOOLS — sab offline, koi API nahi
   =================================================================== */
(function(){

function $(id){ return document.getElementById(id); }
function esc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function save(blob, name){ if(window.imSave){ imSave(blob, name); } else {
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
} }

/* ---------------- 1. CSV → Chart ---------------- */
function csvChart(){
  var raw = ($('cc2-in') || {}).value || '';
  var type = ($('cc2-type') || {}).value || 'bar';
  var cv = $('cc2-canvas');
  if(!cv){ return; }
  var W = 900, H = 520;
  cv.width = W; cv.height = H;
  var ctx = cv.getContext('2d');
  ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, H);

  var rows = raw.split('\n').map(function(l){ return l.trim(); }).filter(Boolean).map(function(l){
    var parts = l.split(',');
    return { label: (parts[0] || '').trim(), value: parseFloat((parts[1] || '').replace(/[^\d.-]/g, '')) || 0 };
  });
  if(!rows.length){
    ctx.fillStyle = '#8b98a5'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('CSV daaliye — har line: label,value', W/2, H/2);
    return;
  }
  var max = Math.max.apply(null, rows.map(function(r){ return r.value; })) || 1;
  var colors = ['#4c8dff','#3fb950','#f59e0b','#ef4444','#a78bfa','#22d3ee','#f472b6','#84cc16'];

  if(type === 'pie'){
    var total = rows.reduce(function(a, r){ return a + r.value; }, 0) || 1;
    var cx = W/2, cy = H/2, rad = Math.min(W, H)/2 - 60, start = -Math.PI/2;
    rows.forEach(function(r, i){
      var ang = (r.value/total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, rad, start, start + ang); ctx.closePath();
      ctx.fillStyle = colors[i % colors.length]; ctx.fill();
      start += ang;
    });
  } else {
    var pad = 60, chartW = W - pad*2, chartH = H - pad*2;
    var bw = chartW / rows.length * 0.7;
    var step = chartW / rows.length;
    ctx.strokeStyle = '#242c36'; ctx.lineWidth = 1;
    for(var g = 0; g <= 4; g++){
      var y = pad + chartH - (chartH * g/4);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W-pad, y); ctx.stroke();
      ctx.fillStyle = '#8b98a5'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(Math.round(max * g/4), pad - 8, y + 4);
    }
    if(type === 'line'){
      ctx.beginPath();
      rows.forEach(function(r, i){
        var x = pad + step*i + step/2;
        var y = pad + chartH - (r.value/max)*chartH;
        if(i === 0){ ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
      });
      ctx.strokeStyle = '#4c8dff'; ctx.lineWidth = 3; ctx.stroke();
    }
    rows.forEach(function(r, i){
      var x = pad + step*i + (step - bw)/2;
      var h = (r.value/max)*chartH;
      if(type === 'bar'){
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(x, pad + chartH - h, bw, h);
      } else if(type === 'line'){
        var cx2 = pad + step*i + step/2;
        var cy2 = pad + chartH - (r.value/max)*chartH;
        ctx.beginPath(); ctx.arc(cx2, cy2, 5, 0, 7); ctx.fillStyle = '#4c8dff'; ctx.fill();
      }
      ctx.fillStyle = '#c9d5e1'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(r.label.slice(0, 10), pad + step*i + step/2, H - pad + 20);
    });
  }
  var st = $('cc2-st'); if(st){ st.textContent = rows.length + ' rows ka chart ban gaya.'; st.className = 'status ok'; }
}
window.cc2Run = csvChart;
window.cc2Save = function(){
  var cv = $('cc2-canvas');
  if(!cv){ return; }
  cv.toBlob(function(b){ save(b, 'chart.png'); });
};

/* ---------------- 2. JSON → Table ---------------- */
window.jtRun = function(){
  var raw = ($('jt-in') || {}).value || '';
  var out = $('jt-out');
  if(!out){ return; }
  try{
    var data = JSON.parse(raw);
    if(!Array.isArray(data)){ data = [data]; }
    if(!data.length){ out.innerHTML = '<div class="lbl">JSON khaali hai.</div>'; return; }
    var keys = [];
    data.forEach(function(o){ if(o && typeof o === 'object'){ Object.keys(o).forEach(function(k){ if(keys.indexOf(k) < 0){ keys.push(k); } }); } });
    var html = '<div style="overflow:auto"><table style="border-collapse:collapse;font-size:12px;width:100%">' +
      '<tr>' + keys.map(function(k){ return '<th style="border:1px solid var(--line);padding:6px 8px;text-align:left;background:var(--panel2)">' + esc(k) + '</th>'; }).join('') + '</tr>';
    data.slice(0, 200).forEach(function(o){
      html += '<tr>' + keys.map(function(k){
        var v = o && o[k];
        if(v === undefined || v === null){ v = ''; }
        if(typeof v === 'object'){ v = JSON.stringify(v); }
        return '<td style="border:1px solid var(--line);padding:5px 8px">' + esc(String(v).slice(0, 80)) + '</td>';
      }).join('') + '</tr>';
    });
    html += '</table></div>';
    if(data.length > 200){ html += '<div class="lbl" style="margin-top:6px">Pehli 200 rows dikhayi gayi hain (total ' + data.length + ').</div>'; }
    out.innerHTML = html;
    var st = $('jt-st'); if(st){ st.textContent = data.length + ' rows, ' + keys.length + ' columns.'; st.className = 'status ok'; }
  }catch(e){
    out.innerHTML = '';
    var st2 = $('jt-st'); if(st2){ st2.textContent = 'JSON galat hai: ' + e.message; st2.className = 'status bad'; }
  }
};

/* ---------------- 3. Barcode (Code 39) ---------------- */
var C39 = {
  '0':'101001101101','1':'110100101011','2':'101100101011','3':'110110010101','4':'101001101011',
  '5':'110100110101','6':'101100110101','7':'101001011011','8':'110100101101','9':'101100101101',
  'A':'110101001011','B':'101101001011','C':'110110100101','D':'101011001011','E':'110101100101',
  'F':'101101100101','G':'101010011011','H':'110101001101','I':'101101001101','J':'101011001101',
  'K':'110101010011','L':'101101010011','M':'110110101001','N':'101011010011','O':'110101101001',
  'P':'101101101001','Q':'101010110011','R':'110101011001','S':'101101011001','T':'101011011001',
  'U':'110010101011','V':'100110101011','W':'110011010101','X':'100101101011','Y':'110010110101',
  'Z':'100110110101','-':'100101011011','.':'110010101101',' ':'100110101101','$':'100100100101',
  '/':'100100101001','+':'100101001001','%':'101001001001','*':'100101101101'
};
window.bcRun = function(){
  var text = String(($('bc-in') || {}).value || '').toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, '');
  var cv = $('bc-canvas');
  if(!cv){ return; }
  if(!text){ var s0 = $('bc-st'); if(s0){ s0.textContent = 'Kuch likhiye (A-Z, 0-9, - . space).'; s0.className = 'status bad'; } return; }
  var full = '*' + text + '*';
  var bits = '';
  for(var i = 0; i < full.length; i++){
    var p = C39[full[i]];
    if(!p){ continue; }
    bits += p + '0';
  }
  var barW = 3, h = 140, pad = 30;
  cv.width = Math.max(120, bits.length * barW + pad * 2);
  cv.height = h + 70;
  var ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#000000';
  for(var b = 0; b < bits.length; b++){
    if(bits[b] === '1'){ ctx.fillRect(pad + b * barW, 20, barW, h); }
  }
  ctx.fillStyle = '#000'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
  ctx.fillText(text, cv.width / 2, h + 52);
  var st = $('bc-st'); if(st){ st.textContent = 'Code 39 barcode ban gaya — ' + text.length + ' characters.'; st.className = 'status ok'; }
};
window.bcSave = function(){
  var cv = $('bc-canvas');
  if(!cv){ return; }
  cv.toBlob(function(b){ save(b, 'barcode.png'); });
};

/* ---------------- 4. Image → ASCII ---------------- */
window.asciiRun = function(file){
  var out = $('asc-out');
  if(!out || !file){ return; }
  if(!/^image\//.test(file.type || '')){ out.textContent = 'Ye image file nahi hai.'; return; }
  var fr = new FileReader();
  fr.onload = function(){
    var im = new Image();
    im.onload = function(){
      var cols = parseInt(($('asc-cols') || {}).value, 10) || 90;
      var ratio = im.naturalHeight / im.naturalWidth;
      var rows = Math.max(4, Math.round(cols * ratio * 0.5));
      var c = document.createElement('canvas');
      c.width = cols; c.height = rows;
      var ctx = c.getContext('2d');
      ctx.drawImage(im, 0, 0, cols, rows);
      var data = ctx.getImageData(0, 0, cols, rows).data;
      var chars = '@%#*+=-:. ';
      var lines = [];
      for(var y = 0; y < rows; y++){
        var line = '';
        for(var x = 0; x < cols; x++){
          var i = (y * cols + x) * 4;
          var lum = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114) / 255;
          line += chars[Math.min(chars.length - 1, Math.floor(lum * (chars.length - 1)))];
        }
        lines.push(line);
      }
      out.textContent = lines.join('\n');
      var st = $('asc-st'); if(st){ st.textContent = cols + '×' + rows + ' characters ka ASCII ban gaya.'; st.className = 'status ok'; }
    };
    im.onerror = function(){ out.textContent = 'Image khul nahi paayi.'; };
    im.src = fr.result;
  };
  fr.readAsDataURL(file);
};
window.asciiCopy = function(){
  var out = $('asc-out');
  if(!out || !out.textContent){ return; }
  var ta = document.createElement('textarea');
  ta.value = out.textContent;
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); }catch(e){}
  document.body.removeChild(ta);
  var st = $('asc-st'); if(st){ st.textContent = 'ASCII copy ho gaya.'; st.className = 'status ok'; }
};

/* ---------------- 5. Palette from image ---------------- */
window.palRun = function(file){
  var box = $('pal-out');
  if(!box || !file){ return; }
  var fr = new FileReader();
  fr.onload = function(){
    var im = new Image();
    im.onload = function(){
      var c = document.createElement('canvas');
      c.width = 120; c.height = 120;
      var ctx = c.getContext('2d');
      ctx.drawImage(im, 0, 0, 120, 120);
      var d = ctx.getImageData(0, 0, 120, 120).data;
      var counts = {};
      for(var i = 0; i < d.length; i += 4){
        var r = d[i] >> 4, g = d[i+1] >> 4, b = d[i+2] >> 4;
        var key = r + ',' + g + ',' + b;
        counts[key] = (counts[key] || 0) + 1;
      }
      var arr = Object.keys(counts).map(function(k){ return { k: k, n: counts[k] }; });
      arr.sort(function(a, b){ return b.n - a.n; });
      var top = arr.slice(0, 8).map(function(o){
        var p = o.k.split(',').map(function(v){ return parseInt(v, 10) * 17; });
        var hex = '#' + p.map(function(v){ return ('0' + v.toString(16)).slice(-2); }).join('');
        return { hex: hex, pct: Math.round(o.n * 100 / (120*120)) };
      });
      box.innerHTML = top.map(function(t){
        return '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
          '<span style="width:34px;height:34px;border-radius:7px;background:' + t.hex + ';border:1px solid var(--line)"></span>' +
          '<code style="font-size:12px">' + t.hex + '</code>' +
          '<span class="lbl" style="width:auto">' + t.pct + '%</span>' +
          '<button class="act" style="padding:2px 8px;font-size:11px" onclick="navigator.clipboard&&navigator.clipboard.writeText(\'' + t.hex + '\')">copy</button></div>';
      }).join('');
      var st = $('pal-st'); if(st){ st.textContent = 'Top ' + top.length + ' rang mile.'; st.className = 'status ok'; }
    };
    im.onerror = function(){ box.textContent = 'Image khul nahi paayi.'; };
    im.src = fr.result;
  };
  fr.readAsDataURL(file);
};

/* ---------------- 6. Stopwatch ---------------- */
var SW = { start: 0, elapsed: 0, timer: null, laps: [] };
window.swToggle = function(){
  var btn = $('sw-btn');
  if(SW.timer){
    clearInterval(SW.timer); SW.timer = null;
    SW.elapsed += Date.now() - SW.start;
    if(btn){ btn.textContent = 'Start'; }
  } else {
    SW.start = Date.now();
    SW.timer = setInterval(swTick, 50);
    if(btn){ btn.textContent = 'Stop'; }
  }
};
function swTick(){
  var ms = SW.elapsed + (Date.now() - SW.start);
  var el = $('sw-time');
  if(el){ el.textContent = fmt(ms); }
}
function fmt(ms){
  var m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), c = Math.floor((ms % 1000) / 10);
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + (c < 10 ? '0' : '') + c;
}
window.swLap = function(){
  var ms = SW.elapsed + (SW.timer ? Date.now() - SW.start : 0);
  SW.laps.unshift(fmt(ms));
  var box = $('sw-laps');
  if(box){ box.textContent = SW.laps.slice(0, 20).map(function(t, i){ return (i+1) + '. ' + t; }).join('\n'); }
};
window.swReset = function(){
  if(SW.timer){ clearInterval(SW.timer); SW.timer = null; }
  SW.elapsed = 0; SW.laps = [];
  var el = $('sw-time'); if(el){ el.textContent = '00:00.00'; }
  var box = $('sw-laps'); if(box){ box.textContent = ''; }
  var btn = $('sw-btn'); if(btn){ btn.textContent = 'Start'; }
};

/* ---------------- 7. BMI + calorie ---------------- */
window.bmiRun = function(){
  var h = parseFloat(($('bmi-h') || {}).value) || 0;
  var w = parseFloat(($('bmi-w') || {}).value) || 0;
  var age = parseFloat(($('bmi-age') || {}).value) || 25;
  var sex = ($('bmi-sex') || {}).value || 'm';
  var act = parseFloat(($('bmi-act') || {}).value) || 1.375;
  var out = $('bmi-out');
  if(!out){ return; }
  if(!h || !w){ out.textContent = 'Height (cm) aur weight (kg) likhiye.'; return; }
  var m = h / 100;
  var bmi = w / (m * m);
  var cat = bmi < 18.5 ? 'Kam wazan (underweight)' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Zyada wazan (overweight)' : 'Motapa (obese)';
  var bmr = sex === 'm' ? (10*w + 6.25*h - 5*age + 5) : (10*w + 6.25*h - 5*age - 161);
  var tdee = bmr * act;
  out.innerHTML = '<div><b>BMI:</b> ' + bmi.toFixed(1) + ' — ' + cat + '</div>' +
    '<div><b>BMR (aaram ki halat mein):</b> ' + Math.round(bmr) + ' kcal/din</div>' +
    '<div><b>Roz ki zaroorat (activity ke saath):</b> ' + Math.round(tdee) + ' kcal/din</div>' +
    '<div class="lbl" style="margin-top:6px">Ye sirf andaza hai, medical advice nahi. Sehat ke liye doctor se baat kijiye.</div>';
};

/* ---------------- 8. Typing test ---------------- */
var TT_TEXT = 'The quick brown fox jumps over the lazy dog. Practice typing every day to improve your speed and accuracy.';
var TT_START = 0;
window.ttNew = function(){
  var el = $('tt-text');
  if(el){ el.textContent = TT_TEXT; }
  var inp = $('tt-in'); if(inp){ inp.value = ''; inp.disabled = false; inp.focus(); }
  TT_START = 0;
  var st = $('tt-st'); if(st){ st.textContent = 'Type karna shuru kijiye...'; st.className = 'status'; }
};
window.ttInput = function(){
  if(!TT_START){ TT_START = Date.now(); }
  var inp = $('tt-in');
  var typed = inp.value;
  var target = TT_TEXT.slice(0, typed.length);
  var correct = 0;
  for(var i = 0; i < typed.length; i++){ if(typed[i] === TT_TEXT[i]){ correct++; } }
  var mins = (Date.now() - TT_START) / 60000;
  var wpm = mins > 0 ? Math.round((typed.length / 5) / mins) : 0;
  var acc = typed.length ? Math.round(correct * 100 / typed.length) : 100;
  var st = $('tt-st');
  if(st){ st.textContent = 'WPM: ' + wpm + '  |  Accuracy: ' + acc + '%  |  ' + typed.length + ' characters'; st.className = 'status ok'; }
};

/* ---------------- panels + nav ---------------- */
function panel(id, title, desc, body){
  return '<section id="t-' + id + '" class="tool"><h2>' + title + '</h2><p class="desc">' + desc + '</p>' + body + '</section>';
}

function build(){
  var main = document.querySelector('main');
  if(!main || document.getElementById('t-cc2')){ return; }
  var html = '';

  /* CSV → chart */
  html += panel('cc2', 'CSV → chart',
    'Enter CSV (each line: label,value) — create a bar, line or pie chart and download it as PNG.',
    '<textarea id="cc2-in" style="height:120px" placeholder="Jan,120&#10;Feb,180&#10;Mar,150"></textarea>' +
    '<div class="row"><select id="cc2-type" onchange="cc2Run()"><option value="bar">bar</option><option value="line">line</option><option value="pie">pie</option></select>' +
    '<button class="act pri" onclick="cc2Run()">Create chart</button>' +
    '<button class="act" onclick="cc2Save()">PNG download</button></div>' +
    '<canvas id="cc2-canvas" style="width:100%;max-width:900px;height:auto;border:1px solid var(--line);border-radius:8px"></canvas>' +
    '<div class="status" id="cc2-st"></div>');

  /* JSON → table */
  html += panel('jt', 'JSON → table',
    'Paste a JSON array — it appears as a plain table that you can copy into a sheet.',
    '<textarea id="jt-in" style="height:140px" placeholder=\'[{"name":"A","age":20}]\'></textarea>' +
    '<div class="row"><button class="act pri" onclick="jtRun()">Create table</button></div>' +
    '<div id="jt-out"></div><div class="status" id="jt-st"></div>');

  /* Barcode */
  html += panel('bc', 'Barcode (Code 39)',
    'Create a Code 39 barcode from text or numbers — download as PNG. All standard scanners read it.',
    '<div class="row"><input type="text" id="bc-in" placeholder="HELLO-123" style="flex:1" oninput="bcRun()">' +
    '<button class="act pri" onclick="bcRun()">Create</button>' +
    '<button class="act" onclick="bcSave()">PNG download</button></div>' +
    '<canvas id="bc-canvas" style="max-width:100%;border:1px solid var(--line);border-radius:8px;background:#fff"></canvas>' +
    '<div class="status" id="bc-st"></div>');

  /* Image → ASCII */
  html += panel('asc', 'Image → ASCII art',
    'Turn a photo into character art — copy or download it.',
    '<div class="row"><input type="file" id="asc-file" accept="image/*"><span class="lbl">chars</span>' +
    '<input type="number" id="asc-cols" value="90" min="30" max="200" style="width:80px">' +
    '<button class="act" onclick="asciiCopy()">Copy</button></div>' +
    '<pre id="asc-out" style="background:#0b0e12;color:#c9d5e1;font:10px/1.1 monospace;overflow:auto;padding:10px;border-radius:8px;border:1px solid var(--line);max-height:420px"></pre>' +
    '<div class="status" id="asc-st"></div>');

  /* Palette from image */
  html += panel('pal', 'Palette from image',
    'Extract the most common colours from a photo — copy the hex codes.',
    '<div class="row"><input type="file" id="pal-file" accept="image/*"></div>' +
    '<div id="pal-out"></div><div class="status" id="pal-st"></div>');

  /* Stopwatch */
  html += panel('sw', 'Stopwatch',
    'Start, stop, lap and reset — down to milliseconds.',
    '<div id="sw-time" style="font:600 40px/1.2 ui-monospace,monospace;margin:10px 0">00:00.00</div>' +
    '<div class="row"><button class="act pri" id="sw-btn" onclick="swToggle()">Start</button>' +
    '<button class="act" onclick="swLap()">Lap</button>' +
    '<button class="act" onclick="swReset()">Reset</button></div>' +
    '<pre id="sw-laps" style="background:#0b0e12;padding:10px;border-radius:8px;border:1px solid var(--line);min-height:60px;font:12px/1.6 ui-monospace,monospace"></pre>');

  /* BMI */
  html += panel('bmi', 'BMI and calories',
    'BMI, BMR and daily calorie needs from height, weight and age.',
    '<div class="row"><span class="lbl">height (cm)</span><input type="number" id="bmi-h" value="170" style="width:90px">' +
    '<span class="lbl">weight (kg)</span><input type="number" id="bmi-w" value="65" style="width:90px"></div>' +
    '<div class="row"><span class="lbl">age</span><input type="number" id="bmi-age" value="25" style="width:70px">' +
    '<select id="bmi-sex"><option value="m">male</option><option value="f">female</option></select>' +
    '<select id="bmi-act"><option value="1.2">aaram</option><option value="1.375" selected>halki activity</option>' +
    '<option value="1.55">medium</option><option value="1.725">more</option></select>' +
    '<button class="act pri" onclick="bmiRun()">Extract</button></div>' +
    '<div id="bmi-out" style="font-size:13px;line-height:1.9"></div>');

  /* Typing test */
  html += panel('tt', 'Typing speed test',
    'Type the given sentence — see your WPM and accuracy.',
    '<div id="tt-text" style="background:#0b0e12;border:1px solid var(--line);border-radius:8px;padding:12px;font-size:14px;line-height:1.6">The quick brown fox jumps over the lazy dog. Practice typing every day to improve your speed and accuracy.</div>' +
    '<textarea id="tt-in" style="height:80px;margin-top:8px" oninput="ttInput()" placeholder="Type here..."></textarea>' +
    '<div class="row"><button class="act" onclick="ttNew()">New text</button></div>' +
    '<div class="status" id="tt-st"></div>');

  main.insertAdjacentHTML('beforeend', html);

  /* nav entries */
  var groups = { cc2:'g-json', jt:'g-json', bc:'g-encode', asc:'g-img', pal:'g-img', sw:'g-util', bmi:'g-calc', tt:'g-util' };
  var labels = { cc2:'CSV → chart', jt:'JSON → table', bc:'Barcode (Code 39)', asc:'Image → ASCII', pal:'Palette from image', sw:'Stopwatch', bmi:'BMI and calories', tt:'Typing test' };
  Object.keys(groups).forEach(function(id){
    var g = document.getElementById(groups[id]);
    if(g){ g.insertAdjacentHTML('beforeend', '<button class="nav" onclick="openTool(\'' + id + '\',this)">' + labels[id] + '</button>'); }
  });
  Object.keys(groups).forEach(function(id){
    var grp = groups[id].replace('g-','');
    var cnt = document.querySelector('[data-g="' + grp + '"] .count');
    if(cnt){ cnt.textContent = String(document.querySelectorAll('#' + groups[id] + ' .nav').length); }
  });

  /* file handlers */
  var af = $('asc-file');
  if(af){ af.addEventListener('change', function(){ asciiRun(af.files[0]); }); }
  var pf = $('pal-file');
  if(pf){ pf.addEventListener('change', function(){ palRun(pf.files[0]); }); }
}

build();

})();

/* ===== settings ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

/* ===================================================================
   SETTINGS — theme, size, compact mode, storage backup, app info
   =================================================================== */
(function(){

function $(id){ return document.getElementById(id); }
function st(msg, cls){ var e = $('st-st'); if(e){ e.textContent = msg || ''; e.className = 'status ' + (cls || ''); } }
function bytes(n){ return n < 1024 ? n + ' B' : (n < 1048576 ? (n/1024).toFixed(1) + ' KB' : (n/1048576).toFixed(2) + ' MB'); }

var APP_KEYS = ['dt-theme', 'dt-size', 'dt-compact', 'notesIn', 'proThumb', 'proPalettes', 'dsFavs', 'dsRecent'];

/* ---------- theme ---------- */
function applyTheme(mode){
  var light = mode === 'light';
  document.body.classList.toggle('light', light);
  try{ localStorage.setItem('dt-theme', light ? 'light' : 'dark'); }catch(e){}
  var b = $('st-theme-btn');
  if(b){ b.textContent = light ? 'Dark mode on kijiye' : 'Light mode on kijiye'; }
  var lbl = $('st-theme-now');
  if(lbl){ lbl.textContent = light ? 'Light' : 'Dark'; }
}
window.stTheme = function(mode){
  applyTheme(mode);
  if(!_stInit){ st('Theme: ' + mode, 'ok'); }
};

/* ---------- text size ---------- */
window.stSize = function(mode){
  var main = document.querySelector('main');
  var z = mode === 'large' ? 1.12 : (mode === 'small' ? 0.92 : 1);
  if(main){ main.style.zoom = z; }
  try{ localStorage.setItem('dt-size', mode); }catch(e){}
  if(!_stInit){ st('Text size: ' + mode, 'ok'); }
};

/* ---------- compact mode ---------- */
var _stInit = true;
window.stCompact = function(on){
  document.body.classList.toggle('ui-compact', !!on);
  try{ localStorage.setItem('dt-compact', on ? '1' : '0'); }catch(e){}
  if(!_stInit){ st(on ? 'Compact mode on — kam jagah, more tools.' : 'Compact mode off.', 'ok'); }
};

/* ---------- storage ---------- */
function storageRows(){
  var rows = [], total = 0;
  APP_KEYS.forEach(function(k){
    var v = null;
    try{ v = localStorage.getItem(k); }catch(e){}
    if(v !== null){
      rows.push({ key: k, size: v.length });
      total += v.length;
    }
  });
  /* koi doosri key bhi ho to dikhao */
  try{
    for(var i = 0; i < localStorage.length; i++){
      var k2 = localStorage.key(i);
      if(APP_KEYS.indexOf(k2) < 0){
        var v2 = localStorage.getItem(k2) || '';
        rows.push({ key: k2, size: v2.length });
        total += v2.length;
      }
    }
  }catch(e){}
  return { rows: rows, total: total };
}
window.stRefresh = function(){
  var box = $('st-storage');
  if(!box){ return; }
  var data = storageRows();
  if(!data.rows.length){
    box.innerHTML = '<div class="lbl">Now koi data save nahi hua.</div>';
    return;
  }
  box.innerHTML = data.rows.map(function(r){
    return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px solid var(--line)">' +
      '<code>' + r.key + '</code><span class="lbl" style="width:auto">' + bytes(r.size) + '</span></div>';
  }).join('') + '<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;font-weight:600">' +
    '<span>Total</span><span>' + bytes(data.total) + '</span></div>';
};

window.stBackup = function(){
  var out = {};
  APP_KEYS.forEach(function(k){
    try{ var v = localStorage.getItem(k); if(v !== null){ out[k] = v; } }catch(e){}
  });
  var blob = new Blob([JSON.stringify({ app: 'dev-toolkit', savedAt: new Date().toISOString(), data: out }, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dev-toolkit-backup.json';
  a.click();
  st('Backup download ho gaya.', 'ok');
};

window.stRestore = function(file){
  if(!file){ return; }
  var fr = new FileReader();
  fr.onload = function(){
    try{
      var obj = JSON.parse(fr.result);
      var data = obj && obj.data ? obj.data : obj;
      if(!data || typeof data !== 'object'){ throw new Error('galat file'); }
      var n = 0;
      Object.keys(data).forEach(function(k){
        if(typeof data[k] === 'string'){ localStorage.setItem(k, data[k]); n++; }
      });
      stRefresh();
      st(n + ' settings wapas aa gayin — page reload kijiye.', 'ok');
    }catch(e){
      st('Backup file padhi nahi ja saki: ' + e.message, 'bad');
    }
  };
  fr.readAsText(file);
};

window.stClear = function(){
  if(!confirm('Sab saved data (notes, settings, backup) mit jayega. Pakka?')){ return; }
  var n = 0;
  APP_KEYS.forEach(function(k){
    try{ if(localStorage.getItem(k) !== null){ localStorage.removeItem(k); n++; } }catch(e){}
  });
  stRefresh();
  st(n + ' items saaf ho gaye.', 'ok');
};

/* ---------- panel ---------- */
function build(){
  var main = document.querySelector('main');
  var grp = document.getElementById('g-util');
  if(!main || !grp || document.getElementById('t-settings')){ return; }

  grp.insertAdjacentHTML('beforeend',
    '<button class="nav" onclick="openTool(\'settings\',this)">Settings</button>');
  var cnt = document.querySelector('[data-g="util"] .count');
  if(cnt){ cnt.textContent = String(document.querySelectorAll('#g-util .nav').length); }

  main.insertAdjacentHTML('beforeend',
    '<section id="t-settings" class="tool">' +
      '<h2>Settings</h2>' +
      '<p class="desc">Theme, text size, compact mode and backup of saved data. Everything stays in your browser — no server.</p>' +

      '<h3 style="font-size:13px;margin:14px 0 6px">Theme</h3>' +
      '<div class="row"><span class="lbl">Now:</span><b id="st-theme-now" style="font-size:12.5px">Dark</b>' +
      '<button class="act" onclick="stTheme(\'dark\')">Dark</button>' +
      '<button class="act" onclick="stTheme(\'light\')">Light</button></div>' +

      '<h3 style="font-size:13px;margin:14px 0 6px">Text size</h3>' +
      '<div class="row"><button class="act" onclick="stSize(\'small\')">Chhota</button>' +
      '<button class="act" onclick="stSize(\'normal\')">Normal</button>' +
      '<button class="act" onclick="stSize(\'large\')">Bada</button></div>' +

      '<h3 style="font-size:13px;margin:14px 0 6px">Layout</h3>' +
      '<div class="row"><label class="chk"><input type="checkbox" id="st-compact" onchange="stCompact(this.checked)"> Compact mode (kam jagah)</label></div>' +

      '<h3 style="font-size:13px;margin:14px 0 6px">Saved data</h3>' +
      '<div id="st-storage" style="margin-bottom:8px"></div>' +
      '<div class="row">' +
        '<button class="act" onclick="stRefresh()">Refresh</button>' +
        '<button class="act" onclick="stBackup()">Backup download</button>' +
        '<input type="file" id="st-file" accept=".json,application/json" style="display:none">' +
        '<button class="act" onclick="document.getElementById(\'st-file\').click()">Backup restore</button>' +
        '<button class="act" onclick="stClear()">Delete all data</button>' +
      '</div>' +

      '<h3 style="font-size:13px;margin:14px 0 6px">App info</h3>' +
      '<div id="st-info" style="font-size:12.5px;line-height:1.9"></div>' +
      '<div class="status" id="st-st"></div>' +
    '</section>');

  var f = $('st-file');
  if(f){ f.addEventListener('change', function(){ stRestore(f.files[0]); f.value = ''; }); }

  /* current state load karo */
  var theme = 'dark', size = 'normal', compact = false;
  try{
    theme = localStorage.getItem('dt-theme') === 'light' ? 'light' : 'dark';
    size = localStorage.getItem('dt-size') || 'normal';
    compact = localStorage.getItem('dt-compact') === '1';
  }catch(e){}
  _stInit = true;
  applyTheme(theme);
  stSize(size);
  if($('st-compact')){ $('st-compact').checked = compact; }
  stCompact(compact);
  stRefresh();
  _stInit = false;

  var info = $('st-info');
  if(info){
    info.innerHTML = '<div><b>Tools:</b> ' + document.querySelectorAll('.tool').length + '</div>' +
      '<div><b>Groups:</b> ' + document.querySelectorAll('.grp-btn').length + '</div>' +
      '<div><b>Internet:</b> zaroori nahi — sab kuch offline chalta hai</div>' +
      '<div><b>Data:</b> sirf aapke browser mein (localStorage)</div>';
  }
}

build();

})();

/* ===== tenmore ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

/* ===================================================================
   10 EXTRA FREE TOOLS — sab offline
   =================================================================== */
(function(){

function $(id){ return document.getElementById(id); }
function esc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function st(id, msg, cls){ var e = $(id); if(e){ e.textContent = msg || ''; e.className = 'status ' + (cls || ''); } }
function save(blob, name){
  if(window.imSave){ imSave(blob, name); return; }
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
}

/* ---------- 1. Contrast checker ---------- */
function lum(hex){
  var h = hex.replace('#','');
  if(h.length === 3){ h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; }
  var r = parseInt(h.slice(0,2),16)/255, g = parseInt(h.slice(2,4),16)/255, b = parseInt(h.slice(4,6),16)/255;
  function f(c){ return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
  return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b);
}
window.ctRun = function(){
  var fg = ($('ct-fg') || {}).value || '#ffffff';
  var bg = ($('ct-bg') || {}).value || '#000000';
  var l1 = lum(fg), l2 = lum(bg);
  var ratio = (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
  var out = $('ct-out');
  if(!out){ return; }
  function badge(ok, label){ return '<span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;margin-right:4px;background:' + (ok ? '#1a7f37' : '#7f1d1d') + ';color:#fff">' + label + (ok ? ' ✓' : ' ✗') + '</span>'; }
  out.innerHTML = '<div style="background:' + bg + ';color:' + fg + ';padding:16px;border-radius:8px;font-size:16px;margin-bottom:10px">Aa — yahan aapka text dikhega</div>' +
    '<div style="font-size:20px;font-weight:700;margin-bottom:6px">' + ratio.toFixed(2) + ':1</div>' +
    '<div style="margin-bottom:8px">' + badge(ratio >= 4.5, 'Normal text AA') + badge(ratio >= 7, 'Normal AAA') +
    badge(ratio >= 3, 'Bada text AA') + badge(ratio >= 4.5, 'Bada AAA') + '</div>' +
    '<div class="lbl">4.5:1 se upar ho to normal text theek padha jaata hai; 7:1 best hai.</div>';
};

/* ---------- 2. Age calculator ---------- */
window.ageRun = function(){
  var v = ($('age-date') || {}).value;
  var out = $('age-out');
  if(!out || !v){ return; }
  var b = new Date(v), now = new Date();
  if(isNaN(b.getTime()) || b > now){ out.textContent = 'Sahi date chuniye (aaj se pehle).'; return; }
  var y = now.getFullYear() - b.getFullYear();
  var m = now.getMonth() - b.getMonth();
  var d = now.getDate() - b.getDate();
  if(d < 0){ m--; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if(m < 0){ y--; m += 12; }
  var days = Math.floor((now - b) / 86400000);
  var next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
  if(next < now){ next.setFullYear(now.getFullYear() + 1); }
  var left = Math.ceil((next - now) / 86400000);
  out.innerHTML = '<div style="font-size:22px;font-weight:700">' + y + ' saal, ' + m + ' mahine, ' + d + ' din</div>' +
    '<div>Total din: <b>' + days.toLocaleString('en-IN') + '</b></div>' +
    '<div>Agla birthday: <b>' + left + ' din baad</b></div>';
};

/* ---------- 3. Scientific calculator ---------- */
window.scCalc = function(){
  var expr = ($('sc-in') || {}).value || '';
  var out = $('sc-out');
  if(!out){ return; }
  if(!expr.trim()){ out.textContent = ''; return; }
  var clean = expr.replace(/\^/g, '**')
    .replace(/\bsin\(/g,'Math.sin(').replace(/\bcos\(/g,'Math.cos(').replace(/\btan\(/g,'Math.tan(')
    .replace(/\bsqrt\(/g,'Math.sqrt(').replace(/\blog\(/g,'Math.log10(').replace(/\bln\(/g,'Math.log(')
    .replace(/\babs\(/g,'Math.abs(').replace(/\bpi\b/gi,'Math.PI').replace(/\be\b/g,'Math.E');
  if(/[^0-9+\-*/().% Matha-z]/.test(clean) || /[a-z]{2,}/i.test(clean.replace(/Math\.[a-zA-Z]+/g,''))){
    out.textContent = 'Sirf numbers aur + - * / ( ) ^ sin cos tan sqrt log use kijiye.';
    return;
  }
  try{
    var val = Function('"use strict";return (' + clean + ')')();
    if(typeof val !== 'number' || !isFinite(val)){ throw new Error('galat'); }
    out.innerHTML = '<b style="font-size:20px">' + val + '</b>';
  }catch(e){
    out.textContent = 'Expression galat hai.';
  }
};

/* ---------- 4. Morse code ---------- */
var MORSE = { a:'.-', b:'-...', c:'-.-.', d:'-..', e:'.', f:'..-.', g:'--.', h:'....', i:'..', j:'.---',
  k:'-.-', l:'.-..', m:'--', n:'-.', o:'---', p:'.--.', q:'--.-', r:'.-.', s:'...', t:'-', u:'..-',
  v:'...-', w:'.--', x:'-..-', y:'-.--', z:'--..', '0':'-----', '1':'.----', '2':'..---', '3':'...--',
  '4':'....-', '5':'.....', '6':'-....', '7':'--...', '8':'---..', '9':'----.' };
var MORSE_REV = {};
Object.keys(MORSE).forEach(function(k){ MORSE_REV[MORSE[k]] = k; });

window.morseRun = function(mode){
  var inp = ($('mo-in') || {}).value || '';
  var out = $('mo-out');
  if(!out){ return; }
  if(mode === 'encode'){
    out.value = inp.toLowerCase().split('').map(function(ch){
      if(ch === ' '){ return '/'; }
      return MORSE[ch] || '';
    }).filter(Boolean).join(' ');
  } else {
    out.value = inp.trim().split(/\s+/).map(function(code){
      if(code === '/' || code === '|'){ return ' '; }
      return MORSE_REV[code] || '?';
    }).join('');
  }
};
window.morseBeep = function(){
  var code = ($('mo-out') || {}).value || '';
  if(!code){ return; }
  try{
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC){ st('mo-st', 'Is browser mein audio nahi chalta.', 'bad'); return; }
    var ac = new AC();
    var t = ac.currentTime;
    code.split('').forEach(function(ch){
      if(ch === '.' || ch === '-'){
        var dur = ch === '.' ? 0.1 : 0.3;
        var osc = ac.createOscillator(), g = ac.createGain();
        osc.frequency.value = 650;
        g.gain.value = 0.15;
        osc.connect(g); g.connect(ac.destination);
        osc.start(t); osc.stop(t + dur);
        t += dur + 0.08;
      } else if(ch === ' '){ t += 0.25; }
      else if(ch === '/'){ t += 0.5; }
    });
    st('mo-st', 'Beep baj rahi hai...', 'ok');
  }catch(e){ st('mo-st', 'Audio nahi chal paya.', 'bad'); }
};

/* ---------- 5. Timer ---------- */
var TM = { end: 0, timer: null };
window.tmStart = function(){
  var m = parseInt(($('tm-min') || {}).value, 10) || 0;
  var s = parseInt(($('tm-sec') || {}).value, 10) || 0;
  var total = m * 60 + s;
  if(total <= 0){ st('tm-st', 'Time set kijiye.', 'bad'); return; }
  if(TM.timer){ clearInterval(TM.timer); }
  TM.end = Date.now() + total * 1000;
  st('tm-st', 'Timer chal raha hai...', 'ok');
  TM.timer = setInterval(function(){
    var left = Math.max(0, Math.round((TM.end - Date.now()) / 1000));
    var el = $('tm-time');
    if(el){
      var mm = Math.floor(left / 60), ss = left % 60;
      el.textContent = (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
    }
    if(left <= 0){
      clearInterval(TM.timer); TM.timer = null;
      st('tm-st', 'Time poora! ⏰', 'ok');
      try{
        var AC = window.AudioContext || window.webkitAudioContext;
        var ac = new AC();
        for(var i = 0; i < 3; i++){
          var osc = ac.createOscillator(), g = ac.createGain();
          osc.frequency.value = 880; g.gain.value = 0.2;
          osc.connect(g); g.connect(ac.destination);
          osc.start(ac.currentTime + i * 0.45);
          osc.stop(ac.currentTime + i * 0.45 + 0.3);
        }
      }catch(e){}
    }
  }, 250);
};
window.tmStop = function(){
  if(TM.timer){ clearInterval(TM.timer); TM.timer = null; }
  var el = $('tm-time'); if(el){ el.textContent = '00:00'; }
  st('tm-st', 'Timer band.', 'info');
};

/* ---------- 6. Watermark ---------- */
window.wmRun = function(file){
  var out = $('wm-canvas');
  if(!out || !file){ return; }
  if(!/^image\//.test(file.type || '')){ st('wm-st', 'Ye image nahi hai.', 'bad'); return; }
  var fr = new FileReader();
  fr.onload = function(){
    var im = new Image();
    im.onload = function(){
      var text = ($('wm-text') || {}).value || 'WATERMARK';
      var pos = ($('wm-pos') || {}).value || 'br';
      var op = parseFloat(($('wm-op') || {}).value || '0.5');
      var size = Math.max(14, Math.round(im.naturalWidth * 0.045));
      out.width = im.naturalWidth;
      out.height = im.naturalHeight;
      var ctx = out.getContext('2d');
      ctx.drawImage(im, 0, 0);
      ctx.globalAlpha = op;
      ctx.font = 'bold ' + size + 'px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = Math.max(2, size / 10);
      var pad = size * 0.8;
      var w = ctx.measureText(text).width;
      var x = pos.indexOf('l') >= 0 ? pad : im.naturalWidth - w - pad;
      var y = pos.indexOf('t') >= 0 ? pad + size : im.naturalHeight - pad;
      if(pos === 'center'){ x = (im.naturalWidth - w) / 2; y = im.naturalHeight / 2; }
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
      ctx.globalAlpha = 1;
      st('wm-st', 'Watermark lag gaya — ' + im.naturalWidth + '×' + im.naturalHeight, 'ok');
    };
    im.onerror = function(){ st('wm-st', 'Image khul nahi paayi.', 'bad'); };
    im.src = fr.result;
  };
  fr.readAsDataURL(file);
};
window.wmSave = function(){
  var cv = $('wm-canvas');
  if(!cv || !cv.width){ return; }
  cv.toBlob(function(b){ save(b, 'watermarked.png'); });
};

/* ---------- 7. Text to handwriting ---------- */
window.hwRun = function(){
  var text = ($('hw-text') || {}).value || '';
  var cv = $('hw-canvas');
  if(!cv){ return; }
  var W = 900, lineH = 46, pad = 60;
  var lines = [];
  text.split('\n').forEach(function(par){
    var words = par.split(' '), line = '';
    for(var i = 0; i < words.length; i++){
      var test = line ? line + ' ' + words[i] : words[i];
      if(test.length > 58 && line){ lines.push(line); line = words[i]; }
      else { line = test; }
    }
    lines.push(line);
  });
  var H = pad * 2 + Math.max(3, lines.length) * lineH;
  cv.width = W; cv.height = H;
  var ctx = cv.getContext('2d');
  ctx.fillStyle = '#fffdf7'; ctx.fillRect(0, 0, W, H);
  /* ruled lines */
  ctx.strokeStyle = '#cfe0f5'; ctx.lineWidth = 1;
  for(var y = pad; y < H - pad; y += lineH){
    ctx.beginPath(); ctx.moveTo(pad, y + lineH - 8); ctx.lineTo(W - pad, y + lineH - 8); ctx.stroke();
  }
  ctx.strokeStyle = '#f3c4c4';
  ctx.beginPath(); ctx.moveTo(pad - 14, 0); ctx.lineTo(pad - 14, H); ctx.stroke();

  ctx.fillStyle = '#1f3b8a';
  ctx.font = '30px "Segoe Script","Bradley Hand",cursive';
  lines.forEach(function(line, i){
    ctx.fillText(line, pad, pad + i * lineH + 26);
  });
  st('hw-st', 'Handwriting page ban gaya — ' + W + '×' + H, 'ok');
};
window.hwSave = function(){
  var cv = $('hw-canvas');
  if(!cv || !cv.width){ return; }
  cv.toBlob(function(b){ save(b, 'handwriting.png'); });
};

/* ---------- 8. Fuel cost ---------- */
window.fuelRun = function(){
  var dist = parseFloat(($('fu-dist') || {}).value) || 0;
  var mil = parseFloat(($('fu-mil') || {}).value) || 0;
  var price = parseFloat(($('fu-price') || {}).value) || 0;
  var out = $('fu-out');
  if(!out){ return; }
  if(!dist || !mil || !price){ out.textContent = 'Distance, mileage aur price teeno bhariye.'; return; }
  var litres = dist / mil;
  var cost = litres * price;
  out.innerHTML = '<div><b>Tel lagega:</b> ' + litres.toFixed(2) + ' litre</div>' +
    '<div><b>Total kharcha:</b> ₹' + Math.round(cost).toLocaleString('en-IN') + '</div>' +
    '<div><b>Per km:</b> ₹' + (cost / dist).toFixed(2) + '</div>';
};

/* ---------- 9. Tip splitter ---------- */
window.tipRun = function(){
  var bill = parseFloat(($('tip-bill') || {}).value) || 0;
  var pct = parseFloat(($('tip-pct') || {}).value) || 0;
  var ppl = parseInt(($('tip-ppl') || {}).value, 10) || 1;
  var out = $('tip-out');
  if(!out){ return; }
  if(!bill){ out.textContent = 'Bill ki rakam likhiye.'; return; }
  var tip = bill * pct / 100;
  var total = bill + tip;
  out.innerHTML = '<div><b>Tip:</b> ₹' + tip.toFixed(2) + '</div>' +
    '<div><b>Total:</b> ₹' + total.toFixed(2) + '</div>' +
    '<div><b>Har banda de:</b> ₹' + (total / ppl).toFixed(2) + ' (' + ppl + ' log)</div>';
};

/* ---------- 10. Word frequency ---------- */
window.wfRun = function(){
  var text = ($('wf-in') || {}).value || '';
  var out = $('wf-out');
  if(!out){ return; }
  var stop = 'the a an and or but if then than that this these those is are was were be been being of to in on at for with by from as it its i you he she they we my your our their not no so do does did have has had will would can could should'.split(' ');
  var words = text.toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s]/g, ' ').split(/\s+/).filter(function(w){
    return w && w.length > 2 && stop.indexOf(w) < 0;
  });
  var counts = {};
  words.forEach(function(w){ counts[w] = (counts[w] || 0) + 1; });
  var arr = Object.keys(counts).map(function(k){ return { w: k, n: counts[k] }; });
  arr.sort(function(a, b){ return b.n - a.n; });
  if(!arr.length){ out.innerHTML = '<div class="lbl">Koi shabd nahi mila.</div>'; return; }
  var max = arr[0].n;
  out.innerHTML = arr.slice(0, 30).map(function(o){
    var pct = Math.round(o.n / max * 100);
    return '<div style="display:flex;align-items:center;gap:8px;margin:3px 0">' +
      '<span style="width:120px;font-size:12px;overflow:hidden;text-overflow:ellipsis">' + esc(o.w) + '</span>' +
      '<span style="flex:1;height:8px;background:var(--panel3);border-radius:4px;overflow:hidden"><span style="display:block;height:100%;width:' + pct + '%;background:var(--accent2)"></span></span>' +
      '<span class="lbl" style="width:34px;text-align:right">' + o.n + '</span></div>';
  }).join('');
  st('wf-st', words.length + ' shabd, ' + arr.length + ' alag-alag.', 'ok');
};

/* ---------- panels ---------- */
function panel(id, title, desc, body){
  return '<section id="t-' + id + '" class="tool"><h2>' + title + '</h2><p class="desc">' + desc + '</p>' + body + '</section>';
}

function build(){
  var main = document.querySelector('main');
  if(!main || document.getElementById('t-ct')){ return; }
  var html = '';

  html += panel('ct', 'Colour contrast checker',
    'Choose two colours — it tells you whether the text is readable, as per WCAG.',
    '<div class="row"><span class="lbl">text</span><input type="color" id="ct-fg" value="#ffffff" oninput="ctRun()">' +
    '<span class="lbl">background</span><input type="color" id="ct-bg" value="#0d1117" oninput="ctRun()"></div>' +
    '<div id="ct-out"></div>');

  html += panel('age', 'Age calculator',
    'Enter your date of birth — years, months, days and your next birthday.',
    '<div class="row"><input type="date" id="age-date" onchange="ageRun()">' +
    '<button class="act pri" onclick="ageRun()">Extract</button></div>' +
    '<div id="age-out" style="font-size:13px;line-height:1.9"></div>');

  html += panel('sc', 'Scientific calculator',
    'sin, cos, tan, sqrt, log, ^ — all supported. Type an expression.',
    '<input type="text" id="sc-in" placeholder="2^10 + sqrt(144)" style="width:100%;font-size:16px;height:44px" oninput="scCalc()">' +
    '<div class="row" style="margin-top:8px">' +
    '<button class="act" onclick="document.getElementById(\'sc-in\').value += \'+\'; scCalc()">+</button>' +
    '<button class="act" onclick="document.getElementById(\'sc-in\').value += \'-\'; scCalc()">−</button>' +
    '<button class="act" onclick="document.getElementById(\'sc-in\').value += \'*\'; scCalc()">×</button>' +
    '<button class="act" onclick="document.getElementById(\'sc-in\').value += \'/\'; scCalc()">÷</button>' +
    '<button class="act" onclick="document.getElementById(\'sc-in\').value += \'^\'; scCalc()">^</button>' +
    '<button class="act" onclick="document.getElementById(\'sc-in\').value = \'\'; scCalc()">C</button></div>' +
    '<div id="sc-out" style="font-size:16px;min-height:28px"></div>');

  html += panel('mo', 'Morse code',
    'Text to Morse and Morse to text. You can also play the beep.',
    '<textarea id="mo-in" style="height:80px" placeholder="SOS or ... --- ..."></textarea>' +
    '<div class="row"><button class="act pri" onclick="morseRun(\'encode\')">Text → Morse</button>' +
    '<button class="act pri" onclick="morseRun(\'decode\')">Morse → Text</button>' +
    '<button class="act" onclick="morseBeep()">Beep suno</button></div>' +
    '<textarea id="mo-out" style="height:80px" readonly></textarea>' +
    '<div class="status" id="mo-st"></div>');

  html += panel('tm', 'Timer',
    'Countdown timer — a beep sounds when the time is up.',
    '<div id="tm-time" style="font:600 40px/1.2 ui-monospace,monospace;margin:10px 0">00:00</div>' +
    '<div class="row"><span class="lbl">min</span><input type="number" id="tm-min" value="5" min="0" max="180" style="width:80px">' +
    '<span class="lbl">sec</span><input type="number" id="tm-sec" value="0" min="0" max="59" style="width:80px">' +
    '<button class="act pri" onclick="tmStart()">Start</button>' +
    '<button class="act" onclick="tmStop()">Stop</button></div>' +
    '<div class="status" id="tm-st"></div>');

  html += panel('wm', 'Watermark',
    'Put your name or text on a photo — choose position and opacity.',
    '<div class="row"><input type="file" id="wm-file" accept="image/*">' +
    '<input type="text" id="wm-text" value="MY NAME" style="width:130px">' +
    '<select id="wm-pos"><option value="br">bottom-right</option><option value="bl">bottom-left</option>' +
    '<option value="tr">top-right</option><option value="tl">top-left</option><option value="center">middle</option></select>' +
    '<span class="lbl">opacity</span><input type="range" id="wm-op" min="10" max="100" value="55" style="width:90px"></div>' +
    '<div class="row"><button class="act" onclick="wmSave()">PNG download</button></div>' +
    '<canvas id="wm-canvas" style="max-width:100%;border:1px solid var(--line);border-radius:8px"></canvas>' +
    '<div class="status" id="wm-st"></div>');

  html += panel('hw', 'Text → handwriting',
    'Create a PNG of your text written on a ruled handwriting page.',
    '<textarea id="hw-text" style="height:100px" placeholder="Type your text here...">Yeh ek handwriting wala page hai. Yahan aap kuch bhi likh sakte hain.</textarea>' +
    '<div class="row"><button class="act pri" onclick="hwRun()">Create page</button>' +
    '<button class="act" onclick="hwSave()">PNG download</button></div>' +
    '<canvas id="hw-canvas" style="max-width:100%;border:1px solid var(--line);border-radius:8px"></canvas>' +
    '<div class="status" id="hw-st"></div>');

  html += panel('fuel', 'Fuel cost',
    'Fuel needed and total cost — from distance and mileage.',
    '<div class="row"><span class="lbl">distance (km)</span><input type="number" id="fu-dist" value="100" style="width:90px">' +
    '<span class="lbl">mileage (km/l)</span><input type="number" id="fu-mil" value="45" style="width:90px">' +
    '<span class="lbl">₹/litre</span><input type="number" id="fu-price" value="105" style="width:90px">' +
    '<button class="act pri" onclick="fuelRun()">Extract</button></div>' +
    '<div id="fu-out" style="font-size:13px;line-height:1.9"></div>');

  html += panel('tip', 'Tip splitter',
    'Bill, tip % and number of people — the share for each person.',
    '<div class="row"><span class="lbl">bill ₹</span><input type="number" id="tip-bill" value="1000" style="width:100px">' +
    '<span class="lbl">tip %</span><input type="number" id="tip-pct" value="10" style="width:70px">' +
    '<span class="lbl">log</span><input type="number" id="tip-ppl" value="4" style="width:70px">' +
    '<button class="act pri" onclick="tipRun()">Extract</button></div>' +
    '<div id="tip-out" style="font-size:13px;line-height:1.9"></div>');

  html += panel('wf', 'Word frequency',
    'Which word appears how many times — most frequent on top.',
    '<textarea id="wf-in" style="height:110px" placeholder="Paste text here..."></textarea>' +
    '<div class="row"><button class="act pri" onclick="wfRun()">Count</button></div>' +
    '<div id="wf-out"></div><div class="status" id="wf-st"></div>');

  main.insertAdjacentHTML('beforeend', html);

  var groups = { ct:'g-design', age:'g-calc', sc:'g-calc', mo:'g-text', tm:'g-util', wm:'g-img', hw:'g-text', fuel:'g-calc', tip:'g-calc', wf:'g-text' };
  var labels = { ct:'Contrast checker', age:'Age calculator', sc:'Scientific calculator', mo:'Morse code', tm:'Timer', wm:'Watermark', hw:'Text → handwriting', fuel:'Fuel cost', tip:'Tip splitter', wf:'Word frequency' };
  Object.keys(groups).forEach(function(id){
    var g = document.getElementById(groups[id]);
    if(g){ g.insertAdjacentHTML('beforeend', '<button class="nav" onclick="openTool(\'' + id + '\',this)">' + labels[id] + '</button>'); }
  });
  Object.keys(groups).forEach(function(id){
    var grp = groups[id].replace('g-','');
    var cnt = document.querySelector('[data-g="' + grp + '"] .count');
    if(cnt){ cnt.textContent = String(document.querySelectorAll('#' + groups[id] + ' .nav').length); }
  });

  var wf = $('wm-file');
  if(wf){ wf.addEventListener('change', function(){ wmRun(wf.files[0]); }); }
}

build();

})();

/* ===== clearall ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

/* jin tools mein text/code paste hota hai, sabme Clear button */
(function(){
  var added = 0, skipped = 0;
  document.querySelectorAll('.tool').forEach(function(tool){
    var areas = Array.prototype.slice.call(tool.querySelectorAll('textarea')).filter(function(ta){
      return !ta.readOnly && !ta.disabled && !ta.dataset.noClear;
    });
    if(!areas.length){ return; }
    /* pehle se Clear button hai? */
    var hasClear = Array.prototype.some.call(tool.querySelectorAll('button'), function(b){
      return /^clear$/i.test((b.textContent || '').trim());
    });
    if(hasClear){ skipped++; return; }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'act clear-btn';
    btn.textContent = 'Clear';
    btn.style.marginBottom = '8px';
    btn.addEventListener('click', function(e){
      e.preventDefault();
      areas.forEach(function(ta){
        ta.value = '';
        try{
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.dispatchEvent(new Event('change', { bubbles: true }));
        }catch(err){}
      });
      btn.textContent = 'Clear ✓';
      setTimeout(function(){ btn.textContent = 'Clear'; }, 900);
    });

    var first = areas[0];
    if(first.parentNode){ first.parentNode.insertBefore(btn, first); }
    added++;
  });
  window.__clearButtons = added;
})();

/* ===== codeviewer ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

/* ===================================================================
   CODE VIEWER — syntax highlighting, line numbers, koi library nahi
   =================================================================== */
(function(){

function $(id){ return document.getElementById(id); }
function esc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ---------- language families ---------- */
var KW = {
  js: 'const let var function return if else for while do switch case break continue class new this super extends import from export default async await try catch finally throw typeof instanceof in of delete void yield static get set null undefined true false',
  py: 'def class return if elif else for while in not and or is None True False import from as with try except finally raise lambda yield global nonlocal pass break continue del assert async await print self',
  java: 'public private protected class interface extends implements static final void int long double float boolean char String if else for while do switch case break continue return new try catch finally throw throws import package this super null true false abstract synchronized',
  c: 'int char float double void long short unsigned signed struct union enum typedef static const if else for while do switch case break continue return sizeof goto extern volatile inline register NULL true false class public private protected namespace template typename using new delete this virtual override',
  go: 'package import func var const type struct interface map chan go defer select case switch for if else return break continue range nil true false string int int64 float64 bool byte rune error make new len cap append',
  rust: 'fn let mut const static struct enum trait impl use mod pub crate self Self match if else for while loop return break continue where as dyn ref move async await unsafe true false Some None Ok Err',
  php: 'function class public private protected static return if else elseif for foreach while do switch case break continue new echo print try catch finally throw use namespace extends implements array null true false isset unset empty',
  ruby: 'def end class module if elsif else unless while until for in do return yield begin rescue ensure raise nil true false self require attr_accessor puts',
  sql: 'select from where insert into values update set delete create table drop alter add column join left right inner outer on group by order having limit offset union all distinct as and or not null is like in between count sum avg min max case when then else end primary key foreign references index view',
  sh: 'if then else elif fi for while do done case esac function echo exit return local export readonly cd ls cp mv rm mkdir touch cat grep sed awk chmod chown sudo apt npm node python pip git'
};

function kwRe(list){
  return new RegExp('\\b(?:' + list.trim().split(/\s+/).join('|') + ')\\b', 'y');
}

var RULES = {
  js: [
    { re: /\/\*[\s\S]*?\*\/|\/\/[^\n]*/y, cls: 'com' },
    { re: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/y, cls: 'str' },
    { re: kwRe(KW.js), cls: 'kw' },
    { re: /\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y, cls: 'num' },
    { re: /\b[A-Za-z_$][\w$]*(?=\s*\()/y, cls: 'fn' },
    { re: /[{}()\[\];,.]/y, cls: 'pun' }
  ],
  py: [
    { re: /#[^\n]*/y, cls: 'com' },
    { re: /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y, cls: 'str' },
    { re: /@[\w.]+/y, cls: 'fn' },
    { re: kwRe(KW.py), cls: 'kw' },
    { re: /\b\d+(?:\.\d+)?\b/y, cls: 'num' },
    { re: /\b[A-Za-z_]\w*(?=\s*\()/y, cls: 'fn' },
    { re: /[{}()\[\]:;,.]/y, cls: 'pun' }
  ],
  java: [
    { re: /\/\*[\s\S]*?\*\/|\/\/[^\n]*/y, cls: 'com' },
    { re: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y, cls: 'str' },
    { re: kwRe(KW.java), cls: 'kw' },
    { re: /\b\d+(?:\.\d+)?[fLdD]?\b/y, cls: 'num' },
    { re: /\b[A-Za-z_]\w*(?=\s*\()/y, cls: 'fn' },
    { re: /[{}()\[\];,.]/y, cls: 'pun' }
  ],
  c: [
    { re: /\/\*[\s\S]*?\*\/|\/\/[^\n]*/y, cls: 'com' },
    { re: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y, cls: 'str' },
    { re: /#\s*\w+/y, cls: 'fn' },
    { re: kwRe(KW.c), cls: 'kw' },
    { re: /\b\d+(?:\.\d+)?[fFuUlL]*\b/y, cls: 'num' },
    { re: /\b[A-Za-z_]\w*(?=\s*\()/y, cls: 'fn' },
    { re: /[{}()\[\];,.]/y, cls: 'pun' }
  ],
  go: [
    { re: /\/\*[\s\S]*?\*\/|\/\/[^\n]*/y, cls: 'com' },
    { re: /"(?:[^"\\]|\\.)*"|`[^`]*`/y, cls: 'str' },
    { re: kwRe(KW.go), cls: 'kw' },
    { re: /\b\d+(?:\.\d+)?\b/y, cls: 'num' },
    { re: /\b[A-Za-z_]\w*(?=\s*\()/y, cls: 'fn' },
    { re: /[{}()\[\];,.:]/y, cls: 'pun' }
  ],
  rust: [
    { re: /\/\*[\s\S]*?\*\/|\/\/[^\n]*/y, cls: 'com' },
    { re: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y, cls: 'str' },
    { re: kwRe(KW.rust), cls: 'kw' },
    { re: /\b\d+(?:\.\d+)?\b/y, cls: 'num' },
    { re: /\b[A-Za-z_]\w*(?=\s*[(!])/y, cls: 'fn' },
    { re: /[{}()\[\];,.:#]/y, cls: 'pun' }
  ],
  php: [
    { re: /\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*/y, cls: 'com' },
    { re: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y, cls: 'str' },
    { re: kwRe(KW.php), cls: 'kw' },
    { re: /\$[A-Za-z_]\w*/y, cls: 'fn' },
    { re: /\b\d+(?:\.\d+)?\b/y, cls: 'num' },
    { re: /[{}()\[\];,.]/y, cls: 'pun' }
  ],
  ruby: [
    { re: /#[^\n]*/y, cls: 'com' },
    { re: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y, cls: 'str' },
    { re: kwRe(KW.ruby), cls: 'kw' },
    { re: /\b\d+(?:\.\d+)?\b/y, cls: 'num' },
    { re: /:[A-Za-z_]\w*/y, cls: 'fn' },
    { re: /[{}()\[\];,.]/y, cls: 'pun' }
  ],
  sql: [
    { re: /--[^\n]*|\/\*[\s\S]*?\*\//y, cls: 'com' },
    { re: /'(?:[^']|'')*'/y, cls: 'str' },
    { re: new RegExp('\\b(?:' + KW.sql.toUpperCase().split(' ').join('|') + ')\\b', 'iy'), cls: 'kw' },
    { re: /\b\d+(?:\.\d+)?\b/y, cls: 'num' },
    { re: /[();,.*]/y, cls: 'pun' }
  ],
  sh: [
    { re: /#[^\n]*/y, cls: 'com' },
    { re: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y, cls: 'str' },
    { re: kwRe(KW.sh), cls: 'kw' },
    { re: /\$\w+|\$\{[^}]*\}/y, cls: 'fn' },
    { re: /\b\d+\b/y, cls: 'num' },
    { re: /[|&;<>(){}[\]]/y, cls: 'pun' }
  ],
  json: [
    { re: /"(?:[^"\\]|\\.)*"(?=\s*:)/y, cls: 'key' },
    { re: /"(?:[^"\\]|\\.)*"/y, cls: 'str' },
    { re: /\b(?:true|false|null)\b/y, cls: 'kw' },
    { re: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y, cls: 'num' },
    { re: /[{}[\]:,]/y, cls: 'pun' }
  ],
  html: [
    { re: new RegExp('<!--[\\s\\S]*?-->', 'y'), cls: 'com' },
    { re: new RegExp('<!DOCTYPE[^>]*>', 'iy'), cls: 'kw' },
    { re: new RegExp('<\\/?[a-zA-Z][\\w:-]*', 'y'), cls: 'tag' },
    { re: /[a-zA-Z-:]+(?=\s*=)/y, cls: 'attr' },
    { re: /"(?:[^"]*)"|'(?:[^']*)'/y, cls: 'str' },
    { re: /[<>\/=]/y, cls: 'pun' }
  ],
  css: [
    { re: /\/\*[\s\S]*?\*\//y, cls: 'com' },
    { re: /@[\w-]+/y, cls: 'kw' },
    { re: /"(?:[^"]*)"|'(?:[^']*)'/y, cls: 'str' },
    { re: /[.#][\w-]+/y, cls: 'tag' },
    { re: /[-\w]+(?=\s*:)/y, cls: 'attr' },
    { re: /#[0-9a-fA-F]{3,8}\b/y, cls: 'num' },
    { re: /\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg)?\b/y, cls: 'num' },
    { re: /[{}();:,]/y, cls: 'pun' }
  ],
  yaml: [
    { re: /#[^\n]*/y, cls: 'com' },
    { re: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y, cls: 'str' },
    { re: /[-\w.]+(?=\s*:)/y, cls: 'key' },
    { re: /\b(?:true|false|null|yes|no)\b/y, cls: 'kw' },
    { re: /\b\d+(?:\.\d+)?\b/y, cls: 'num' },
    { re: /[:\-{}[\],]/y, cls: 'pun' }
  ],
  md: [
    { re: /^#{1,6} [^\n]*/my, cls: 'kw' },
    { re: /```[\s\S]*?```|`[^`\n]+`/y, cls: 'str' },
    { re: /\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*/y, cls: 'fn' },
    { re: /\[[^\]\n]*\]\([^)\n]*\)/y, cls: 'attr' },
    { re: /^[-*+] |^\d+\. /my, cls: 'num' },
    { re: /^> [^\n]*/my, cls: 'com' }
  ],
  plain: []
};

var ALIAS = {
  javascript:'js', js:'js', jsx:'js', mjs:'js', ts:'js', typescript:'js', tsx:'js',
  python:'py', py:'py',
  java:'java', kotlin:'java', kt:'java', csharp:'java', cs:'java', swift:'java', dart:'java', scala:'java',
  c:'c', cpp:'c', 'c++':'c', h:'c', hpp:'c', objc:'c',
  go:'go', golang:'go',
  rust:'rust', rs:'rust',
  php:'php',
  ruby:'ruby', rb:'ruby',
  sql:'sql', mysql:'sql', postgres:'sql',
  bash:'sh', sh:'sh', shell:'sh', zsh:'sh', powershell:'sh', ps1:'sh',
  json:'json',
  html:'html', xml:'html', svg:'html', vue:'html',
  css:'css', scss:'css', less:'css',
  yaml:'yaml', yml:'yaml',
  markdown:'md', md:'md',
  text:'plain', txt:'plain', plain:'plain'
};

var EXT = { js:'js', py:'py', java:'java', c:'c', go:'go', rust:'rs', php:'php', ruby:'rb', sql:'sql', sh:'sh', json:'json', html:'html', css:'css', yaml:'yaml', md:'md', plain:'txt' };

function family(lang){
  var f = ALIAS[(lang || '').toLowerCase()] || 'plain';
  return RULES[f] ? f : 'plain';
}

function highlight(code, lang){
  var fam = family(lang);
  var rules = RULES[fam];
  if(!rules || !rules.length){ return esc(code); }
  var out = '', i = 0, n = code.length;
  while(i < n){
    var matched = false;
    for(var r = 0; r < rules.length; r++){
      var re = rules[r].re;
      re.lastIndex = i;
      var m = re.exec(code);
      if(m && m.index === i && m[0].length){
        out += '<span class="tk-' + rules[r].cls + '">' + esc(m[0]) + '</span>';
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if(!matched){
      var ch = code[i];
      out += (ch === '<' ? '&lt;' : (ch === '&' ? '&amp;' : ch));
      i++;
    }
  }
  return out;
}

function detect(code){
  var c = code.trim();
  if(!c){ return 'plain'; }
  if(/^[\[{]/.test(c)){
    try{ JSON.parse(c); return 'json'; }catch(e){ return 'json'; }  /* galat JSON bhi JSON hi hai */
  }
  if(/^<!DOCTYPE|^<html/i.test(c)){ return 'html'; }
  if(/^<\?xml/i.test(c)){ return 'html'; }
  if(/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE)\b/i.test(c)){ return 'sql'; }
  if(/^\s*(def |import |from .* import|class .*:)/m.test(c) && /:\s*$/m.test(c)){ return 'py'; }
  if(/^\s*(#include|int main|printf\()/m.test(c)){ return 'c'; }
  if(/\bfunc\s+\w+\s*\(/m.test(c)){ return 'go'; }
  if(/\bfn\s+\w+\s*\(/m.test(c)){ return 'rust'; }
  if(/<\?php/.test(c)){ return 'php'; }
  if(/^\s*[.#][\w-]+\s*\{/m.test(c) || /:\s*[^;]+;/m.test(c) && /\{/.test(c)){ return 'css'; }
  if(/^\s*#{1,6}\s/m.test(c)){ return 'md'; }
  if(/^\s*[\w.-]+:\s+\S/m.test(c) && !/[;{}]/.test(c)){ return 'yaml'; }
  if(/^\s*<[a-zA-Z]/.test(c)){ return 'html'; }
  if(/\b(function|const|let|var|=>)\b/.test(c)){ return 'js'; }
  if(/^\s*(#!\/|echo |export )/m.test(c)){ return 'sh'; }
  return 'plain';
}

/* ---------- render ---------- */
var CV = { lang: 'auto', wrap: false, size: 12.5 };

function render(){
  var src = ($('cv-in') || {}).value || '';
  var code = $('cv-code'), stats = $('cv-stats');
  var lang = CV.lang === 'auto' ? detect(src) : CV.lang;
  if(code){
    code.innerHTML = highlight(src, lang);
    code.style.fontSize = CV.size + 'px';
  }
  if(stats){
    stats.textContent = lines2(src) + ' lines · ' + src.length + ' chars · ' + lang.toUpperCase();
  }
  var badge = $('cv-lang-now');
  if(badge){ badge.textContent = lang.toUpperCase(); }
}
function lines2(s){ return s ? s.split('\n').length : 0; }

var t = null;
window.cvInput = function(){
  clearTimeout(t);
  t = setTimeout(render, 160);
};
window.addEventListener('resize', function(){ if(document.getElementById('cv-code')){ render(); } });
window.cvLang = function(v){ CV.lang = v; render(); };
window.cvSize = function(d){
  CV.size = Math.max(9, Math.min(20, CV.size + d));
  var ta = $('cv-in');
  if(ta){ ta.style.fontSize = CV.size + 'px'; }
  render();
};
/* ---------- live preview ---------- */
window.cvPreview = function(){
  var src = ($('cv-in') || {}).value || '';
  var frame = $('cv-frame');
  var iframe = $('cv-preview');
  var stage = frame ? frame.querySelector('.cv-stage') : null;
  if(!frame || !iframe){ return; }
  if(!src.trim()){ st2('Pehle code paste ya upload kijiye.'); return; }

  var lang = CV.lang === 'auto' ? detect(src) : CV.lang;
  var html = '';

  if(lang === 'html'){
    html = src;
  } else if(lang === 'css'){
    html = '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + src + '</style></head>' +
      '<body style="font-family:sans-serif;padding:16px"><h1>Heading</h1><p>Paragraph text — CSS preview.</p>' +
      '<button>Button</button> <a href="#">Link</a></body></html>';
  } else if(lang === 'md'){
    var md = src.replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/^###### (.*)$/gm,'<h6>$1</h6>').replace(/^##### (.*)$/gm,'<h5>$1</h5>')
      .replace(/^#### (.*)$/gm,'<h4>$1</h4>').replace(/^### (.*)$/gm,'<h3>$1</h3>')
      .replace(/^## (.*)$/gm,'<h2>$1</h2>').replace(/^# (.*)$/gm,'<h1>$1</h1>')
      .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/\*([^*]+)\*/g,'<i>$1</i>')
      .replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\n\n/g,'</p><p>');
    html = '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>body{font-family:sans-serif;padding:16px;line-height:1.6}code{background:#eee;padding:1px 4px;border-radius:3px}</style></head><body><p>' + md + '</p></body></html>';
  } else {
    st2('Is language (' + lang.toUpperCase() + ') ka live preview nahi banta — sirf HTML, CSS aur Markdown ka banta hai.');
    return;
  }

  iframe.srcdoc = html;
  frame.style.display = 'block';
  if(stage){
    stage.className = 'cv-stage ' + (($('cv-device') || {}).value || 'phone');
  }
  var t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  var titleEl = $('cv-title');
  if(titleEl){ titleEl.textContent = t ? t[1].trim().slice(0, 40) : 'Preview'; }
  st2('Preview taiyar — sandbox mein chalta hai (aapke data ko chhoo nahi sakta).', true);
};

function st2(msg, ok){
  var e = $('cv-st');
  if(e){ e.textContent = msg; e.className = 'status ' + (ok ? 'ok' : 'info'); }
}

window.cvFull = function(){
  var frame = $('cv-frame');
  var iframe = $('cv-preview');
  if(!frame || frame.style.display === 'none'){ cvPreview(); }
  if(!iframe || !iframe.srcdoc){ return; }
  var old = document.getElementById('cv-fullwrap');
  if(old){ old.remove(); }
  var wrap = document.createElement('div');
  wrap.id = 'cv-fullwrap';
  wrap.className = 'cv-full';
  wrap.innerHTML = '<div class="cv-bar"><span>' + (($('cv-title') || {}).textContent || 'Preview') + '</span>' +
    '<button class="act" style="margin-left:auto;padding:3px 10px;min-height:26px;font-size:12px" onclick="document.getElementById(\'cv-fullwrap\').remove()">Stop</button></div>';
  var f2 = document.createElement('iframe');
  f2.sandbox = 'allow-scripts allow-forms allow-modals';
  f2.srcdoc = iframe.srcdoc;
  wrap.appendChild(f2);
  document.body.appendChild(wrap);
};

window.cvClear = function(){
  var inp = $('cv-in');
  if(inp){ inp.value = ''; }
  render();
};
window.cvCopy = function(){
  var src = ($('cv-in') || {}).value || '';
  if(!src){ return; }
  var ta = document.createElement('textarea');
  ta.value = src; document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); }catch(e){}
  document.body.removeChild(ta);
  var st = $('cv-st'); if(st){ st.textContent = 'Code copy ho gaya.'; st.className = 'status ok'; }
};
window.cvDownload = function(){
  var src = ($('cv-in') || {}).value || '';
  if(!src){ return; }
  var lang = CV.lang === 'auto' ? detect(src) : CV.lang;
  var blob = new Blob([src], { type: 'text/plain;charset=utf-8' });
  var name = 'code.' + (EXT[family(lang)] || 'txt');
  if(window.imSave){ imSave(blob, name); }
  else { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }
};
window.cvToChecker = function(){
  var src = ($('cv-in') || {}).value || '';
  var lang = CV.lang === 'auto' ? detect(src) : CV.lang;
  openTool('codecheck', null);
  var map = { js:'js', py:'py', json:'json', html:'html', css:'css', sql:'sql', yaml:'yaml', md:'md', java:'java', c:'c', go:'go', rust:'rs', php:'php', ruby:'rb', sh:'sh', plain:'html' };
  var sel = $('cc-lang');
  if(sel){ sel.value = map[lang] || 'html'; }
  var ta = $('cc-code');
  if(ta){ ta.value = src; if(window.ccSyncGutter){ ccSyncGutter(); } if(window.ccCheck){ ccCheck(); } }
};
window.cvFile = function(file){
  if(!file){ return; }
  if(file.size > 1024 * 1024){ var st = $('cv-st'); if(st){ st.textContent = 'File 1 MB se badi hai.'; st.className = 'status bad'; } return; }
  var fr = new FileReader();
  fr.onload = function(){
    var inp = $('cv-in');
    if(inp){ inp.value = fr.result; }
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if(ALIAS[ext]){ CV.lang = ALIAS[ext]; var sel = $('cv-lang'); if(sel){ sel.value = ALIAS[ext]; } }
    render();
    if(/html?$/i.test(ext) || /^html$/.test(CV.lang)){ cvPreview(); }
    var st = $('cv-st'); if(st){ st.textContent = file.name + ' khul gayi.'; st.className = 'status ok'; }
  };
  fr.readAsText(file);
};

/* ---------- panel ---------- */
function build(){
  var main = document.querySelector('main');
  var grp = document.getElementById('g-web');
  if(!main || !grp || document.getElementById('t-cv')){ return; }

  grp.insertAdjacentHTML('beforeend',
    '<button class="nav" onclick="openTool(\'cv\',this)">Code viewer</button>');
  var cnt = document.querySelector('[data-g="web"] .count');
  if(cnt){ cnt.textContent = String(document.querySelectorAll('#g-web .nav').length); }

  var langs = ['auto','js','py','java','c','go','rust','php','ruby','sql','sh','json','html','css','yaml','md','plain'];
  var opts = langs.map(function(l){ return '<option value="' + l + '">' + (l === 'auto' ? 'auto-detect' : l) + '</option>'; }).join('');

  main.insertAdjacentHTML('beforeend',
    '<section id="t-cv" class="tool">' +
      '<h2>Code viewer</h2>' +
      '<p class="desc">Paste code or upload a file — shown with colours and line numbers. JS, Python, Java, C/C++, Go, Rust, PHP, Ruby, SQL, Shell, JSON, HTML, CSS, YAML, Markdown. Sab browser mein, kuch upload nahi hota.</p>' +
      '<div class="row">' +
        '<select id="cv-lang" onchange="cvLang(this.value)">' + opts + '</select>' +
        '<input type="file" id="cv-file" style="display:none">' +
        '<button class="act" onclick="document.getElementById(\'cv-file\').click()">Upload File</button>' +
        '<button class="act" onclick="cvSize(-1)">A−</button>' +
        '<button class="act" onclick="cvSize(1)">A+</button>' +
        '<button class="act" onclick="cvCopy()">Copy</button>' +
        '<button class="act" onclick="cvDownload()">Download</button>' +
        '<button class="act" onclick="cvToChecker()">Open in Checker</button>' +
      '</div>' +
      '<textarea id="cv-in" spellcheck="false" style="height:200px;font-size:13px;line-height:1.55" placeholder="Paste code here or open a file with Upload File..." oninput="cvInput()"></textarea>' +
      '<div class="row"><button class="act" onclick="cvClear()">Clear</button><span class="lbl" id="cv-stats" style="width:auto"></span>' +
        '<span class="lbl" style="width:auto">Language: <b id="cv-lang-now">PLAIN</b></span></div>' +
      '<div class="row" style="margin-bottom:6px">' +
        '<button class="act pri" onclick="cvPreview()">View preview</button>' +
        '<select id="cv-device" onchange="cvPreview()"><option value="phone">phone</option><option value="tablet">tablet</option><option value="desktop">desktop</option></select>' +
        '<button class="act" onclick="cvFull()">Full Screen</button>' +
        '<span class="lbl" style="width:auto">HTML/CSS ka live preview</span>' +
      '</div>' +
      '<div id="cv-frame" class="cv-frame" style="display:none">' +
        '<div class="cv-bar"><span id="cv-title">My Screen</span>' +
          '<span style="margin-left:auto;display:flex;gap:6px">' +
            '<button class="act" style="padding:2px 8px;min-height:24px;font-size:11px" onclick="cvPreview()">↻</button>' +
          '</span></div>' +
        '<div class="cv-stage"><iframe id="cv-preview" sandbox="allow-scripts allow-forms allow-modals" title="preview"></iframe></div>' +
      '</div>' +
      '<div class="status" id="cv-st"></div>' +
    '</section>');

  var f = $('cv-file');
  if(f){ f.addEventListener('change', function(){ cvFile(f.files[0]); f.value = ''; }); }
  render();
}

/* ---------- css ---------- */
var style = document.createElement('style');
style.textContent =
  '.cv-wrap{display:flex;border:1px solid var(--line);border-radius:10px;background:#0b0e12;max-height:560px;overflow:auto;margin-bottom:8px;min-width:0;max-width:100%;-webkit-overflow-scrolling:touch}' +
  '.cv-gutter{margin:0;padding:10px 8px;color:#5d6b78;font:12.5px/1.55 ui-monospace,Menlo,monospace;text-align:right;background:#090c10;border-right:1px solid var(--line);user-select:none;min-width:44px;flex:0 0 auto;white-space:pre}' +
  '.cv-code{margin:0;padding:10px 12px;font:12.5px/1.55 ui-monospace,Menlo,monospace;color:#e6edf3;white-space:pre;tab-size:2;flex:1 1 auto;min-width:0;overflow-x:auto}' +
  '.tk-com{color:#6b7d8f;font-style:italic}' +
  '.tk-str{color:#a5d6a7}' +
  '.tk-kw{color:#82aaff}' +
  '.tk-num{color:#f78c6c}' +
  '.tk-fn{color:#ffcb6b}' +
  '.tk-pun{color:#89ddff}' +
  '.tk-tag{color:#f07178}' +
  '.tk-attr{color:#c792ea}' +
  '.tk-key{color:#7fdbca}' +
  'body.light .cv-wrap{background:#fff}' +
  'body.light .cv-gutter{background:#f2f5f8;color:#8b98a5}' +
  'body.light .cv-code{color:#1f2328}' +
  'body.light .tk-com{color:#6a737d} body.light .tk-str{color:#22863a} body.light .tk-kw{color:#005cc5}' +
  'body.light .tk-num{color:#b31d28} body.light .tk-fn{color:#6f42c1} body.light .tk-tag{color:#d73a49}' +
  'body.light .tk-attr{color:#6f42c1} body.light .tk-key{color:#005cc5}';
document.head.appendChild(style);

build();

})();

/* ===== hundredtools ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

/* ===================================================================
   100 TOOLS — spec driven, sab offline, koi library nahi
   =================================================================== */
(function(){

function $(id){ return document.getElementById(id); }
function esc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function num(v, d){ var n = parseFloat(v); return isNaN(n) ? (d || 0) : n; }
function inr(n){ return '₹' + Math.round(n).toLocaleString('en-IN'); }

/* ---------------- text helpers ---------------- */
function lines(s){ return String(s).split('\n'); }
function toTitle(s){ return s.replace(/\w\S*/g, function(w){ return w[0].toUpperCase() + w.slice(1).toLowerCase(); }); }
function toSentence(s){ return s.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, function(c){ return c.toUpperCase(); }); }
function toSnake(s){ return s.trim().replace(/([a-z])([A-Z])/g,'$1_$2').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'').toLowerCase(); }
function toKebab(s){ return toSnake(s).replace(/_/g,'-'); }
function toCamel(s){ return toSnake(s).replace(/_([a-z])/g, function(m, c){ return c.toUpperCase(); }); }
function toConstant(s){ return toSnake(s).toUpperCase(); }
function rot13(s){ return s.replace(/[a-zA-Z]/g, function(c){
  var b = c <= 'Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b + 13) % 26 + b);
}); }

/* ---------------- colour helpers ---------------- */
function hex2rgb(h){
  h = String(h).replace('#','');
  if(h.length === 3){ h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; }
  var n = parseInt(h, 16);
  return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
}
function rgb2hex(r,g,b){
  function h(v){ v = Math.max(0, Math.min(255, Math.round(v))); return ('0'+v.toString(16)).slice(-2); }
  return '#' + h(r) + h(g) + h(b);
}
function rgb2hsl(r,g,b){
  r/=255; g/=255; b/=255;
  var mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx-mn, h = 0, s = 0, l = (mx+mn)/2;
  if(d){
    s = l > 0.5 ? d/(2-mx-mn) : d/(mx+mn);
    if(mx === r){ h = ((g-b)/d + (g<b?6:0)); }
    else if(mx === g){ h = (b-r)/d + 2; }
    else { h = (r-g)/d + 4; }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s*100), l: Math.round(l*100) };
}
function hsl2rgb(h,s,l){
  h/=360; s/=100; l/=100;
  if(!s){ var v = l*255; return { r:v, g:v, b:v }; }
  function hue(p,q,t){ if(t<0) t+=1; if(t>1) t-=1;
    if(t<1/6) return p+(q-p)*6*t; if(t<1/2) return q; if(t<2/3) return p+(q-p)*(2/3-t)*6; return p; }
  var q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
  return { r: hue(p,q,h+1/3)*255, g: hue(p,q,h)*255, b: hue(p,q,h-1/3)*255 };
}

/* ---------------- validators ---------------- */
function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v.trim()); }
function validPhoneIN(v){ return /^(\+91[\-\s]?)?[6-9]\d{9}$/.test(v.replace(/\s/g,'')); }
function validIFSC(v){ return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.trim().toUpperCase()); }
function validPAN(v){ return /^[A-Z]{5}\d{4}[A-Z]$/.test(v.trim().toUpperCase()); }
function validGSTIN(v){
  var s = v.trim().toUpperCase();
  if(!/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9][Z][A-Z0-9]$/.test(s)){ return false; }
  var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', sum = 0;
  for(var i = 0; i < 14; i++){
    var p = chars.indexOf(s[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(p/36) + (p%36);
  }
  return chars[(36 - (sum % 36)) % 36] === s[14];
}
var V_TABLE = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],
  [4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],
  [8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
var D_TABLE = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],
  [4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],
  [8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
function verhoeffValid(numStr){
  var c = 0, d = String(numStr).split('').reverse().map(Number);
  for(var i = 0; i < d.length; i++){ c = D_TABLE[c][V_TABLE[i % 8][d[i]]]; }
  return c === 0;
}
function luhnValid(n){
  var s = String(n).replace(/\D/g,''), sum = 0, alt = false;
  for(var i = s.length - 1; i >= 0; i--){
    var d = parseInt(s[i], 10);
    if(alt){ d *= 2; if(d > 9){ d -= 9; } }
    sum += d; alt = !alt;
  }
  return s.length >= 12 && sum % 10 === 0;
}

/* ---------------- tool specs ---------------- */
var T = [];

/* ---- TEXT (30) ---- */
T.push({ id:'t-rev', n:'Reverse text', g:'text', k:'text', fn:function(s){ return s.split('').reverse().join(''); } });
T.push({ id:'t-sortaz', n:'Sort lines A–Z', g:'text', k:'text', fn:function(s){ return lines(s).sort().join('\n'); } });
T.push({ id:'t-sortza', n:'Sort lines Z–A', g:'text', k:'text', fn:function(s){ return lines(s).sort().reverse().join('\n'); } });
T.push({ id:'t-sortlen', n:'Sort by length', g:'text', k:'text', fn:function(s){ return lines(s).sort(function(a,b){ return a.length-b.length; }).join('\n'); } });
T.push({ id:'t-dedupe', n:'Duplicate lines hatao', g:'text', k:'text', fn:function(s){ var seen={}; return lines(s).filter(function(l){ if(seen[l]){ return false; } seen[l]=1; return true; }).join('\n'); } });
T.push({ id:'t-shuffle', n:'Shuffle lines', g:'text', k:'text', fn:function(s){ var a=lines(s); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a.join('\n'); } });
T.push({ id:'t-trim', n:'Har line trim karo', g:'text', k:'text', fn:function(s){ return lines(s).map(function(l){ return l.trim(); }).join('\n'); } });
T.push({ id:'t-noempty', n:'Khaali lines hatao', g:'text', k:'text', fn:function(s){ return lines(s).filter(function(l){ return l.trim(); }).join('\n'); } });
T.push({ id:'t-num', n:'Lines par number lagao', g:'text', k:'text', fn:function(s){ return lines(s).map(function(l,i){ return (i+1)+'. '+l; }).join('\n'); } });
T.push({ id:'t-unnum', n:'Line numbers hatao', g:'text', k:'text', fn:function(s){ return lines(s).map(function(l){ return l.replace(/^\s*\d+[.)]\s*/,''); }).join('\n'); } });
T.push({ id:'t-prefix', n:'Har line se pehle jodo', g:'text', k:'pair', b:'prefix', fn:function(s,p){ return lines(s).map(function(l){ return (p||'')+l; }).join('\n'); } });
T.push({ id:'t-suffix', n:'Har line ke baad jodo', g:'text', k:'pair', b:'suffix', fn:function(s,p){ return lines(s).map(function(l){ return l+(p||''); }).join('\n'); } });
T.push({ id:'t-quote', n:'Har line ko quotes mein', g:'text', k:'text', fn:function(s){ return lines(s).map(function(l){ return '"'+l.replace(/"/g,'\\"')+'",'; }).join('\n'); } });
T.push({ id:'t-unquote', n:'Quotes hatao', g:'text', k:'text', fn:function(s){ return lines(s).map(function(l){ return l.replace(/^[\s"']+|[\s"',]+$/g,''); }).join('\n'); } });
T.push({ id:'t-striphtml', n:'HTML tags hatao', g:'text', k:'text', fn:function(s){ return s.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'); } });
T.push({ id:'t-stripmd', n:'Markdown hatao', g:'text', k:'text', fn:function(s){ return s.replace(/```[\s\S]*?```/g,'').replace(/`([^`]*)`/g,'$1').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/[*_#>~-]{1,6}\s?/g,'').trim(); } });
T.push({ id:'t-collapse', n:'Extra spaces hatao', g:'text', k:'text', fn:function(s){ return s.replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n'); } });
T.push({ id:'t-tabs2sp', n:'Tabs → spaces', g:'text', k:'text', fn:function(s){ return s.replace(/\t/g,'    '); } });
T.push({ id:'t-sp2tabs', n:'Spaces → tabs', g:'text', k:'text', fn:function(s){ return s.replace(/^ +/gm, function(m){ return '\t'.repeat(Math.floor(m.length/4)); }); } });
T.push({ id:'t-title', n:'Title Case', g:'text', k:'text', fn:toTitle });
T.push({ id:'t-sentence', n:'Sentence case', g:'text', k:'text', fn:toSentence });
T.push({ id:'t-snake', n:'snake_case', g:'text', k:'text', fn:toSnake });
T.push({ id:'t-kebab', n:'kebab-case', g:'text', k:'text', fn:toKebab });
T.push({ id:'t-camel', n:'camelCase', g:'text', k:'text', fn:toCamel });
T.push({ id:'t-const', n:'CONSTANT_CASE', g:'text', k:'text', fn:toConstant });
T.push({ id:'t-rot13', n:'ROT13', g:'text', k:'text', fn:rot13 });
T.push({ id:'t-revwords', n:'Shabd ulta karo', g:'text', k:'text', fn:function(s){ return lines(s).map(function(l){ return l.split(/\s+/).reverse().join(' '); }).join('\n'); } });
T.push({ id:'t-emails', n:'Email nikaalo', g:'text', k:'text', fn:function(s){ var m = s.match(/[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}/g) || []; return m.join('\n'); } });
T.push({ id:'t-urls', n:'URL nikaalo', g:'text', k:'text', fn:function(s){ var m = s.match(/https?:\/\/[^\s<>"']+/g) || []; return m.join('\n'); } });
T.push({ id:'t-numbers', n:'Numbers nikaalo', g:'text', k:'text', fn:function(s){ var m = s.match(/-?\d+(?:\.\d+)?/g) || []; return m.join('\n'); } });
T.push({ id:'t-nopunct', n:'Punctuation hatao', g:'text', k:'text', fn:function(s){ return s.replace(/[^\w\s\u0900-\u097F]/g,''); } });
T.push({ id:'t-single', n:'Sab ek line mein', g:'text', k:'text', fn:function(s){ return s.replace(/\s+/g,' ').trim(); } });
T.push({ id:'t-wrap', n:'Text wrap (60 cols)', g:'text', k:'text', fn:function(s){ return s.replace(/(.{60})(\s|$)/g,'$1\n'); } });
T.push({ id:'t-uniquewords', n:'Duplicate shabd hatao', g:'text', k:'text', fn:function(s){ var seen={}; return s.split(/\s+/).filter(function(w){ var k=w.toLowerCase(); if(seen[k]){ return false; } seen[k]=1; return true; }).join(' '); } });

/* ---- CONVERTERS (22) ---- */
T.push({ id:'c-jsonxml', n:'JSON → XML', g:'json', k:'text', fn:function(s){
  try{
    var o = JSON.parse(s), out = ['<?xml version="1.0" encoding="UTF-8"?>','<root>'];
    function walk(v, name){
      if(Array.isArray(v)){ v.forEach(function(x){ walk(x, name); }); return; }
      if(v && typeof v === 'object'){
        out.push('  <' + name + '>');
        Object.keys(v).forEach(function(k){ walk(v[k], k); });
        out.push('  </' + name + '>');
        return;
      }
      out.push('  <' + name + '>' + esc(v == null ? '' : v) + '</' + name + '>');
    }
    Object.keys(o).forEach(function(k){ walk(o[k], k); });
    out.push('</root>');
    return out.join('\n');
  }catch(e){ return 'JSON galat hai: ' + e.message; }
} });
T.push({ id:'c-tomljson', n:'TOML → JSON', g:'json', k:'text', fn:function(s){
  var out = {}, cur = out;
  lines(s).forEach(function(l){
    l = l.trim();
    if(!l || l[0] === '#'){ return; }
    var sec = l.match(/^\[([^\]]+)\]$/);
    if(sec){ var path = sec[1].split('.'); cur = out; path.forEach(function(p){ cur[p] = cur[p] || {}; cur = cur[p]; }); return; }
    var kv = l.match(/^([\w.-]+)\s*=\s*(.+)$/);
    if(kv){
      var v = kv[2].trim();
      if(/^".*"$/.test(v) || /^'.*'$/.test(v)){ v = v.slice(1,-1); }
      else if(/^\[.*\]$/.test(v)){ v = v.slice(1,-1).split(',').map(function(x){ return x.trim().replace(/^"|"$/g,''); }).filter(Boolean); }
      else if(v === 'true' || v === 'false'){ v = v === 'true'; }
      else if(!isNaN(parseFloat(v))){ v = parseFloat(v); }
      cur[kv[1]] = v;
    }
  });
  return JSON.stringify(out, null, 2);
} });
T.push({ id:'c-inijson', n:'INI → JSON', g:'json', k:'text', fn:function(s){
  var out = {}, cur = out, curName = '';
  lines(s).forEach(function(l){
    l = l.trim();
    if(!l || l[0] === ';' || l[0] === '#'){ return; }
    var sec = l.match(/^\[([^\]]+)\]$/);
    if(sec){ curName = sec[1]; cur = out[curName] = {}; return; }
    var kv = l.match(/^([^=]+)=(.*)$/);
    if(kv){ if(!curName){ curName = 'main'; cur = out.main = out.main || {}; } cur[kv[1].trim()] = kv[2].trim(); }
  });
  return JSON.stringify(out, null, 2);
} });
T.push({ id:'c-jsonini', n:'JSON → INI', g:'json', k:'text', fn:function(s){
  try{
    var o = JSON.parse(s), out = [];
    Object.keys(o).forEach(function(k){
      if(o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])){
        out.push('[' + k + ']');
        Object.keys(o[k]).forEach(function(k2){ out.push(k2 + '=' + o[k][k2]); });
        out.push('');
      }
    });
    Object.keys(o).forEach(function(k){
      if(!o[k] || typeof o[k] !== 'object'){ out.push(k + '=' + o[k]); }
    });
    return out.join('\n');
  }catch(e){ return 'JSON galat hai: ' + e.message; }
} });
T.push({ id:'c-csvsql', n:'CSV → SQL INSERT', g:'json', k:'text', fn:function(s){
  var rows = lines(s).filter(Boolean).map(function(l){ return l.split(',').map(function(c){ return c.trim(); }); });
  if(rows.length < 2){ return 'Pehli line header, phir data chahiye.'; }
  var cols = rows[0], table = 'my_table', out = [];
  rows.slice(1).forEach(function(r){
    var vals = r.map(function(v){ return /^-?\d+(\.\d+)?$/.test(v) ? v : "'" + v.replace(/'/g,"''") + "'"; });
    out.push('INSERT INTO ' + table + ' (' + cols.join(', ') + ') VALUES (' + vals.join(', ') + ');');
  });
  return out.join('\n');
} });
T.push({ id:'c-sqlcsv', n:'SQL → CSV', g:'json', k:'text', fn:function(s){
  var out = [];
  var re = /INSERT\s+INTO\s+\w+\s*\(([^)]*)\)\s*VALUES\s*\(([^)]*)\)/gi, m;
  var colsDone = false;
  while((m = re.exec(s))){
    if(!colsDone){ out.push(m[1].split(',').map(function(c){ return c.trim(); }).join(',')); colsDone = true; }
    out.push(m[2].split(',').map(function(v){ return v.trim().replace(/^'|'$/g,''); }).join(','));
  }
  return out.length ? out.join('\n') : 'INSERT statements nahi mile.';
} });
T.push({ id:'c-tablecsv', n:'HTML table → CSV', g:'json', k:'text', fn:function(s){
  var rows = s.match(/<tr[\s\S]*?<\/tr>/gi) || [], out = [];
  rows.forEach(function(r){
    var cells = r.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
    out.push(cells.map(function(c){ return c.replace(/<[^>]+>/g,'').trim().replace(/,/g,' '); }).join(','));
  });
  return out.join('\n') || 'Table nahi mila.';
} });
T.push({ id:'c-htmlmd', n:'HTML → Markdown', g:'text', k:'text', fn:function(s){
  return s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi,'# $1\n').replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi,'## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi,'### $1\n').replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi,'**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi,'**$1**').replace(/<em[^>]*>([\s\S]*?)<\/em>/gi,'*$1*')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,'[$2]($1)')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi,'- $1\n').replace(/<br\s*\/?>/gi,'\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi,'$1\n\n').replace(/<[^>]+>/g,'').replace(/\n{3,}/g,'\n\n').trim();
} });
T.push({ id:'c-mdtext', n:'Markdown → plain text', g:'text', k:'text', fn:function(s){
  return s.replace(/```[\s\S]*?```/g,'').replace(/^#{1,6}\s*/gm,'').replace(/\*\*([^*]*)\*\*/g,'$1')
    .replace(/\*([^*]*)\*/g,'$1').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1')
    .replace(/^>\s?/gm,'').replace(/^[-*+]\s/gm,'').replace(/`([^`]*)`/g,'$1').replace(/\n{3,}/g,'\n\n').trim();
} });
T.push({ id:'c-jsonqs', n:'JSON → query string', g:'json', k:'text', fn:function(s){
  try{
    var o = JSON.parse(s), parts = [];
    Object.keys(o).forEach(function(k){ parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(o[k])); });
    return parts.join('&');
  }catch(e){ return 'JSON galat hai.'; }
} });
T.push({ id:'c-qsjson', n:'Query string → JSON', g:'json', k:'text', fn:function(s){
  var out = {};
  s.replace(/^\?/,'').split('&').forEach(function(p){
    if(!p){ return; }
    var i = p.indexOf('=');
    var k = decodeURIComponent(i < 0 ? p : p.slice(0,i));
    var v = i < 0 ? '' : decodeURIComponent(p.slice(i+1));
    out[k] = v;
  });
  return JSON.stringify(out, null, 2);
} });
T.push({ id:'c-jsonenv', n:'JSON → .env', g:'json', k:'text', fn:function(s){
  try{
    var o = JSON.parse(s), out = [];
    Object.keys(o).forEach(function(k){
      var v = o[k];
      if(typeof v === 'object'){ return; }
      out.push(k.toUpperCase().replace(/[^A-Z0-9_]/g,'_') + '=' + v);
    });
    return out.join('\n');
  }catch(e){ return 'JSON galat hai.'; }
} });
T.push({ id:'c-envjson', n:'.env → JSON', g:'json', k:'text', fn:function(s){
  var out = {};
  lines(s).forEach(function(l){
    l = l.trim();
    if(!l || l[0] === '#'){ return; }
    var i = l.indexOf('=');
    if(i < 0){ return; }
    var k = l.slice(0,i).trim(), v = l.slice(i+1).trim().replace(/^["']|["']$/g,'');
    out[k] = v;
  });
  return JSON.stringify(out, null, 2);
} });
T.push({ id:'c-textjsonstr', n:'Text → JSON string', g:'json', k:'text', fn:function(s){ return JSON.stringify(s); } });
T.push({ id:'c-jsonstrtext', n:'JSON string → text', g:'json', k:'text', fn:function(s){
  try{ var v = JSON.parse(s); return typeof v === 'string' ? v : JSON.stringify(v, null, 2); }
  catch(e){ return 'JSON string galat hai.'; }
} });
T.push({ id:'c-binary', n:'Text → binary', g:'encode', k:'text', fn:function(s){
  return s.split('').map(function(c){ return c.charCodeAt(0).toString(2).padStart(8,'0'); }).join(' ');
} });
T.push({ id:'c-binarytext', n:'Binary → text', g:'encode', k:'text', fn:function(s){
  return s.trim().split(/\s+/).map(function(b){ return String.fromCharCode(parseInt(b, 2) || 0); }).join('');
} });
T.push({ id:'c-octal', n:'Text → octal/hex', g:'encode', k:'text', fn:function(s){
  return s.split('').map(function(c){ return c + '  oct=' + c.charCodeAt(0).toString(8) + '  hex=' + c.charCodeAt(0).toString(16); }).join('\n');
} });
T.push({ id:'c-hexrgb', n:'HEX → RGB', g:'design', k:'text', fn:function(s){
  var m = s.match(/#?[0-9a-fA-F]{3,8}/); if(!m){ return 'HEX code likhiye, jaise #4c8dff'; }
  var c = hex2rgb(m[0]); return 'rgb(' + c.r + ', ' + c.g + ', ' + c.b + ')\n#' + rgb2hex(c.r,c.g,c.b);
} });
T.push({ id:'c-rgbhex', n:'RGB → HEX', g:'design', k:'text', fn:function(s){
  var m = s.match(/(\d{1,3})\D+(\d{1,3})\D+(\d{1,3})/);
  if(!m){ return 'RGB likhiye, jaise 76, 141, 255'; }
  var h = rgb2hex(+m[1], +m[2], +m[3]);
  var hsl = rgb2hsl(+m[1], +m[2], +m[3]);
  return h + '\nhsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)';
} });
T.push({ id:'c-hslhex', n:'HSL → HEX', g:'design', k:'text', fn:function(s){
  var m = s.match(/(\d{1,3})\D+(\d{1,3})\D+(\d{1,3})/);
  if(!m){ return 'HSL likhiye, jaise 220, 100, 65'; }
  var c = hsl2rgb(+m[1], +m[2], +m[3]);
  return rgb2hex(c.r, c.g, c.b);
} });
T.push({ id:'c-cmyk', n:'RGB ↔ CMYK', g:'design', k:'text', fn:function(s){
  var m = s.match(/(\d{1,3})\D+(\d{1,3})\D+(\d{1,3})/);
  if(!m){ return 'RGB likhiye, jaise 76, 141, 255'; }
  var r = +m[1]/255, g = +m[2]/255, b = +m[3]/255;
  var k = 1 - Math.max(r,g,b);
  if(k === 1){ return 'C 0%  M 0%  Y 0%  K 100%'; }
  var c = (1-r-k)/(1-k), mm = (1-g-k)/(1-k), y = (1-b-k)/(1-k);
  return 'C ' + Math.round(c*100) + '%  M ' + Math.round(mm*100) + '%  Y ' + Math.round(y*100) + '%  K ' + Math.round(k*100) + '%';
} });

/* ---- VALIDATORS (12) ---- */
function validTool(id, name, g, label, fn, ph){
  T.push({ id:id, n:name, g:g, k:'form', fields:[{ k:'v', label:label, value:'', ph:ph || '' }], calc:function(v){
    var ok = fn(v.v || '');
    return ok ? '<div class="status ok" style="font-size:14px">✓ Sahi hai</div>' : '<div class="status bad" style="font-size:14px">✗ Galat hai</div>';
  } });
}
validTool('v-email', 'Email validator', 'util', 'email', validEmail, 'naam@example.com');
validTool('v-phone', 'Mobile validator (India)', 'util', 'mobile', validPhoneIN, '9876543210');
validTool('v-ifsc', 'IFSC validator', 'util', 'IFSC', validIFSC, 'SBIN0001234');
validTool('v-pan', 'PAN validator', 'util', 'PAN', validPAN, 'ABCDE1234F');
validTool('v-gstin', 'GSTIN validator', 'util', 'GSTIN', validGSTIN, '27AAPFU0939F1ZV');
validTool('v-aadhaar', 'Aadhaar checksum', 'util', 'Aadhaar (12 digit)', function(v){ return /^\d{12}$/.test(v.replace(/\s/g,'')) && verhoeffValid(v.replace(/\s/g,'')); }, '1234 5678 9012');
validTool('v-luhn', 'Card number (Luhn)', 'util', 'card number', luhnValid, '4111 1111 1111 1111');
validTool('v-upi', 'UPI ID validator', 'util', 'UPI ID', function(v){ return /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(v.trim()); }, 'naam@okhdfcbank');
validTool('v-url', 'URL validator', 'util', 'URL', function(v){ try{ var u = new URL(v); return !!u.protocol && !!u.host; }catch(e){ return false; } }, 'https://example.com');
validTool('v-ipv4', 'IPv4 validator', 'util', 'IP', function(v){
  var p = v.trim().split('.');
  return p.length === 4 && p.every(function(x){ return /^\d{1,3}$/.test(x) && +x <= 255; });
}, '192.168.1.1');
validTool('v-domain', 'Domain validator', 'util', 'domain', function(v){ return /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/.test(v.trim()); }, 'example.com');
validTool('v-pincode', 'PIN code validator', 'util', 'PIN', function(v){ return /^[1-9]\d{5}$/.test(v.trim()); }, '110001');

/* ---- GENERATORS (10) ---- */
T.push({ id:'g-str', n:'Random string', g:'util', k:'form',
  fields:[{ k:'len', label:'length', value:'16', type:'number' }],
  calc:function(v){
    var len = Math.max(1, Math.min(200, parseInt(v.len,10) || 16));
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    var out = '';
    for(var i = 0; i < len; i++){ out += chars[Math.floor(Math.random()*chars.length)]; }
    return '<code style="font-size:15px">' + out + '</code>';
  } });
T.push({ id:'g-nums', n:'Random numbers', g:'util', k:'form',
  fields:[{ k:'min', label:'min', value:'1', type:'number' },{ k:'max', label:'max', value:'100', type:'number' },{ k:'count', label:'kitne', value:'10', type:'number' }],
  calc:function(v){
    var mn = parseInt(v.min,10) || 0, mx = parseInt(v.max,10) || 100, c = Math.min(500, parseInt(v.count,10) || 10);
    var out = [];
    for(var i = 0; i < c; i++){ out.push(Math.floor(Math.random()*(mx-mn+1))+mn); }
    return '<code>' + out.join(', ') + '</code>';
  } });
var FIRST = ['Aarav','Vivaan','Aditya','Ananya','Diya','Ishaan','Kabir','Meera','Riya','Rohan','Saanvi','Vihaan'];
var LAST = ['Sharma','Verma','Patel','Reddy','Nair','Iyer','Singh','Gupta','Das','Joshi','Mehta','Khan'];
var CITY = ['Mumbai','Delhi','Bengaluru','Chennai','Kolkata','Pune','Jaipur','Lucknow','Hyderabad','Indore'];
T.push({ id:'g-name', n:'Random Indian naam', g:'util', k:'text', fn:function(s){
  var n = Math.max(1, Math.min(50, parseInt(s,10) || 5)), out = [];
  for(var i = 0; i < n; i++){ out.push(FIRST[Math.floor(Math.random()*FIRST.length)] + ' ' + LAST[Math.floor(Math.random()*LAST.length)]); }
  return out.join('\n');
} });
T.push({ id:'g-address', n:'Random address', g:'util', k:'text', fn:function(s){
  var n = Math.max(1, Math.min(50, parseInt(s,10) || 5)), out = [];
  for(var i = 0; i < n; i++){
    out.push((Math.floor(Math.random()*200)+1) + ', ' + ['MG Road','Nehru Nagar','Gandhi Path','Park Street'][Math.floor(Math.random()*4)] + ', ' +
      CITY[Math.floor(Math.random()*CITY.length)] + ' - ' + (100000 + Math.floor(Math.random()*899999)));
  }
  return out.join('\n');
} });
T.push({ id:'g-email', n:'Random email', g:'util', k:'text', fn:function(s){
  var n = Math.max(1, Math.min(50, parseInt(s,10) || 5)), out = [];
  var dom = ['gmail.com','yahoo.in','outlook.com','example.com'];
  for(var i = 0; i < n; i++){
    out.push((FIRST[Math.floor(Math.random()*FIRST.length)] + Math.floor(Math.random()*999)).toLowerCase() + '@' + dom[Math.floor(Math.random()*dom.length)]);
  }
  return out.join('\n');
} });
T.push({ id:'g-phone', n:'Random mobile number', g:'util', k:'text', fn:function(s){
  var n = Math.max(1, Math.min(50, parseInt(s,10) || 5)), out = [];
  for(var i = 0; i < n; i++){ out.push('+91 ' + (6 + Math.floor(Math.random()*4)) + Math.floor(Math.random()*1000000000).toString().padStart(9,'0')); }
  return out.join('\n');
} });
T.push({ id:'g-passphrase', n:'Passphrase generator', g:'util', k:'text', fn:function(s){
  var words = ['tiger','river','mango','cloud','stone','light','bread','train','green','happy','ocean','music','paper','silver','garden','rocket','pencil','winter','summer','orange'];
  var n = Math.max(2, Math.min(8, parseInt(s,10) || 4)), out = [];
  for(var i = 0; i < n; i++){ out.push(words[Math.floor(Math.random()*words.length)]); }
  return out.join('-') + '-' + Math.floor(Math.random()*99);
} });
T.push({ id:'g-dice', n:'Dice roller', g:'util', k:'text', fn:function(s){
  var n = Math.max(1, Math.min(20, parseInt(s,10) || 2)), out = [];
  for(var i = 0; i < n; i++){ out.push('🎲 ' + (Math.floor(Math.random()*6)+1)); }
  return out.join('\n');
} });
T.push({ id:'g-coin', n:'Coin flip', g:'util', k:'text', fn:function(s){
  var n = Math.max(1, Math.min(50, parseInt(s,10) || 10)), heads = 0, out = [];
  for(var i = 0; i < n; i++){ var h = Math.random() < 0.5; if(h){ heads++; } out.push(h ? 'Heads' : 'Tails'); }
  return out.join('\n') + '\n\nHeads: ' + heads + ' | Tails: ' + (n-heads);
} });
T.push({ id:'g-lottery', n:'Lottery numbers', g:'util', k:'form',
  fields:[{ k:'max', label:'max number', value:'49', type:'number' },{ k:'pick', label:'kitne', value:'6', type:'number' }],
  calc:function(v){
    var mx = Math.max(5, Math.min(100, parseInt(v.max,10) || 49));
    var pick = Math.max(1, Math.min(mx, parseInt(v.pick,10) || 6));
    var pool = [];
    for(var i = 1; i <= mx; i++){ pool.push(i); }
    var out = [];
    for(var j = 0; j < pick; j++){ out.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]); }
    out.sort(function(a,b){ return a-b; });
    return '<code style="font-size:16px">' + out.join(' · ') + '</code>';
  } });

/* ---- CALCULATORS (20) ---- */
function calcTool(id, name, g, fields, fn){
  T.push({ id:id, n:name, g:g, k:'form', fields:fields, calc:fn });
}
calcTool('k-si', 'Simple interest', 'calc',
  [{ k:'p', label:'principal ₹', value:'10000', type:'number' },{ k:'r', label:'rate %', value:'8', type:'number' },{ k:'t', label:'years', value:'3', type:'number' }],
  function(v){
    var si = num(v.p) * num(v.r) * num(v.t) / 100;
    return '<div><b>Interest:</b> ' + inr(si) + '</div><div><b>Total:</b> ' + inr(num(v.p) + si) + '</div>';
  });
calcTool('k-salary', 'Salary breakup (India)', 'calc',
  [{ k:'ctc', label:'CTC (yearly ₹)', value:'600000', type:'number' }],
  function(v){
    var ctc = num(v.ctc), basic = ctc * 0.5, hra = basic * 0.4, pf = basic * 0.12;
    return '<div><b>Basic (50%):</b> ' + inr(basic/12) + '/month</div>' +
      '<div><b>HRA (40% of basic):</b> ' + inr(hra/12) + '/month</div>' +
      '<div><b>PF (12% of basic):</b> ' + inr(pf/12) + '/month</div>' +
      '<div><b>Baaki (special allowance):</b> ' + inr((ctc - basic - hra - pf*2)/12) + '/month</div>' +
      '<div class="lbl" style="margin-top:6px">Sirf andaza — company ke structure ke hisaab se badalta hai.</div>';
  });
calcTool('k-gratuity', 'Gratuity', 'calc',
  [{ k:'basic', label:'last basic+DA (monthly ₹)', value:'30000', type:'number' },{ k:'years', label:'years', value:'10', type:'number' }],
  function(v){
    var g = num(v.basic) * 15 / 26 * num(v.years);
    return '<div><b>Gratuity:</b> ' + inr(g) + '</div><div class="lbl">Formula: basic × 15/26 × saal</div>';
  });
calcTool('k-water', 'Water intake', 'calc',
  [{ k:'w', label:'weight (kg)', value:'65', type:'number' },{ k:'act', label:'exercise (min)', value:'30', type:'number' }],
  function(v){
    var base = num(v.w) * 35, extra = num(v.act) / 30 * 350;
    return '<div><b>Roz paani:</b> ' + Math.round((base+extra)/1000 * 10)/10 + ' litre</div>' +
      '<div class="lbl">Garmi mein thoda more. Ye andaza hai, medical advice nahi.</div>';
  });
calcTool('k-sleep', 'Sleep cycle', 'calc',
  [{ k:'h', label:'uthna hai (hour 0-23)', value:'6', type:'number' },{ k:'m', label:'minute', value:'30', type:'number' }],
  function(v){
    var wake = num(v.h)*60 + num(v.m), out = [];
    for(var c = 6; c >= 4; c--){
      var t = wake - (c*90 + 15);
      t = (t + 1440) % 1440;
      out.push('<div>so jaiye <b>' + String(Math.floor(t/60)).padStart(2,'0') + ':' + String(t%60).padStart(2,'0') + '</b> (' + c + ' cycles)</div>');
    }
    return out.join('');
  });
calcTool('k-pregnancy', 'Pregnancy due date', 'calc',
  [{ k:'d', label:'last period (YYYY-MM-DD)', value:'', type:'text' }],
  function(v){
    var d = new Date(v.d);
    if(isNaN(d.getTime())){ return 'Sahi date daaliye.'; }
    var due = new Date(d.getTime() + 280*86400000);
    return '<div><b>Due date:</b> ' + due.toLocaleDateString('en-IN') + '</div><div class="lbl">LMP + 280 din. Doctor se confirm kijiye.</div>';
  });
calcTool('k-pace', 'Running pace', 'calc',
  [{ k:'km', label:'distance (km)', value:'5', type:'number' },{ k:'min', label:'time (minutes)', value:'30', type:'number' }],
  function(v){
    var km = num(v.km), min = num(v.min);
    if(!km || !min){ return 'Distance aur time bhariye.'; }
    var pace = min/km, sec = Math.round((pace - Math.floor(pace))*60);
    return '<div><b>Pace:</b> ' + Math.floor(pace) + ':' + String(sec).padStart(2,'0') + ' min/km</div>' +
      '<div><b>Speed:</b> ' + (km/(min/60)).toFixed(2) + ' km/h</div>';
  });
calcTool('k-gpa', 'GPA / CGPA', 'calc',
  [{ k:'marks', label:'marks (comma se, 0-100)', value:'85,90,78,92', type:'text' }],
  function(v){
    var m = String(v.marks).split(',').map(function(x){ return num(x); }).filter(function(x){ return x > 0; });
    if(!m.length){ return 'Marks likhiye.'; }
    var avg = m.reduce(function(a,b){ return a+b; },0)/m.length;
    return '<div><b>Average:</b> ' + avg.toFixed(1) + '%</div>' +
      '<div><b>GPA (10):</b> ' + (avg/9.5).toFixed(2) + '</div>' +
      '<div><b>Grade:</b> ' + (avg >= 90 ? 'A+' : avg >= 80 ? 'A' : avg >= 70 ? 'B' : avg >= 60 ? 'C' : avg >= 50 ? 'D' : 'F') + '</div>';
  });
calcTool('k-marks', 'Marks percentage', 'calc',
  [{ k:'got', label:'milay', value:'450', type:'number' },{ k:'total', label:'total', value:'600', type:'number' }],
  function(v){
    var p = num(v.total) ? num(v.got)/num(v.total)*100 : 0;
    return '<div><b>' + p.toFixed(2) + '%</b></div><div>' + (p >= 33 ? 'Pass' : 'Fail') + '</div>';
  });
calcTool('k-dateadd', 'Date + days', 'calc',
  [{ k:'d', label:'date (YYYY-MM-DD)', value:'', type:'text' },{ k:'n', label:'din (+ ya -)', value:'30', type:'number' }],
  function(v){
    var d = new Date(v.d);
    if(isNaN(d.getTime())){ return 'Sahi date daaliye.'; }
    var r = new Date(d.getTime() + num(v.n)*86400000);
    return '<div><b>' + r.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) + '</b></div>';
  });
calcTool('k-workdays', 'Working days', 'calc',
  [{ k:'a', label:'se (YYYY-MM-DD)', value:'', type:'text' },{ k:'b', label:'tak (YYYY-MM-DD)', value:'', type:'text' }],
  function(v){
    var a = new Date(v.a), b = new Date(v.b);
    if(isNaN(a) || isNaN(b)){ return 'Dono date daaliye.'; }
    var days = 0, cur = new Date(a);
    while(cur <= b){ var w = cur.getDay(); if(w !== 0 && w !== 6){ days++; } cur.setDate(cur.getDate()+1); }
    return '<div><b>Working days:</b> ' + days + '</div><div class="lbl">Saturday-Sunday chhod kar (chhuttiyan alag).</div>';
  });
calcTool('k-electricity', 'Electricity bill (slab)', 'calc',
  [{ k:'u', label:'units (kWh)', value:'250', type:'number' },{ k:'r', label:'rate ₹/unit', value:'7', type:'number' }],
  function(v){
    var u = num(v.u), r = num(v.r), bill;
    if(u <= 100){ bill = u * r * 0.8; }
    else if(u <= 300){ bill = 100*r*0.8 + (u-100)*r; }
    else { bill = 100*r*0.8 + 200*r + (u-300)*r*1.2; }
    return '<div><b>Andaza bill:</b> ' + inr(bill) + '</div><div class="lbl">Slab sirf example hai — aapke board ke rates alag hote hain.</div>';
  });
calcTool('k-fuelkmpl', 'Mileage (km/l)', 'calc',
  [{ k:'km', label:'distance (km)', value:'450', type:'number' },{ k:'l', label:'petrol (litre)', value:'10', type:'number' }],
  function(v){
    var k = num(v.km), l = num(v.l);
    return '<div><b>Mileage:</b> ' + (l ? (k/l).toFixed(2) : 0) + ' km/l</div>';
  });
calcTool('k-savings', 'Savings goal', 'calc',
  [{ k:'goal', label:'target ₹', value:'100000', type:'number' },{ k:'mon', label:'mahine', value:'12', type:'number' }],
  function(v){
    var per = num(v.mon) ? num(v.goal)/num(v.mon) : 0;
    return '<div><b>Har mahine bachana:</b> ' + inr(per) + '</div><div><b>Har hafte:</b> ' + inr(per*12/52) + '</div>';
  });
calcTool('k-rent', 'Rent yield', 'calc',
  [{ k:'price', label:'property price ₹', value:'5000000', type:'number' },{ k:'rent', label:'monthly rent ₹', value:'15000', type:'number' }],
  function(v){
    var y = num(v.rent)*12, p = num(v.price);
    return '<div><b>Saal ka kiraya:</b> ' + inr(y) + '</div><div><b>Yield:</b> ' + (p ? (y/p*100).toFixed(2) : 0) + '%</div>';
  });
calcTool('k-bmr2', 'Calories burned (walk)', 'calc',
  [{ k:'min', label:'minutes', value:'30', type:'number' },{ k:'w', label:'weight (kg)', value:'65', type:'number' }],
  function(v){
    return '<div><b>Andaza:</b> ' + Math.round(num(v.min) * num(v.w) * 0.05) + ' kcal</div><div class="lbl">Walking ~5 km/h par.</div>';
  });
calcTool('k-discount2', 'Discount + tax', 'calc',
  [{ k:'p', label:'price ₹', value:'2000', type:'number' },{ k:'d', label:'discount %', value:'20', type:'number' },{ k:'g', label:'GST %', value:'18', type:'number' }],
  function(v){
    var after = num(v.p) * (1 - num(v.d)/100);
    var gst = after * num(v.g)/100;
    return '<div><b>Discount ke baad:</b> ' + inr(after) + '</div><div><b>GST:</b> ' + inr(gst) + '</div><div><b>Final:</b> ' + inr(after+gst) + '</div>';
  });


/* ---- 5 aur (total 100) ---- */
T.push({ id:'t-sortnum', n:'Lines ko number se sort karo', g:'text', k:'text', fn:function(s){ return lines(s).sort(function(a,b){ return (parseFloat(a)||0)-(parseFloat(b)||0); }).join('\n'); } });
T.push({ id:'t-revlines', n:'Line order ulta karo', g:'text', k:'text', fn:function(s){ return lines(s).reverse().join('\n'); } });
T.push({ id:'c-csvmd', n:'CSV → Markdown table', g:'json', k:'text', fn:function(s){
  var rows = lines(s).filter(Boolean).map(function(l){ return l.split(',').map(function(c){ return c.trim(); }); });
  if(!rows.length){ return 'CSV daaliye.'; }
  var head = '| ' + rows[0].join(' | ') + ' |';
  var sep = '| ' + rows[0].map(function(){ return '---'; }).join(' | ') + ' |';
  var body = rows.slice(1).map(function(r){ return '| ' + r.join(' | ') + ' |'; }).join('\n');
  return head + '\n' + sep + (body ? '\n' + body : '');
} });
validTool('v-imei', 'IMEI validator', 'util', 'IMEI (15 digit)', function(v){ return /^\d{15}$/.test(v.replace(/\s/g,'')) && luhnValid(v.replace(/\s/g,'')); }, '356938035643809');
T.push({ id:'g-color', n:'Random colour palette', g:'design', k:'text', fn:function(s){
  var n = Math.max(2, Math.min(10, parseInt(s,10) || 5)), out = [];
  for(var i = 0; i < n; i++){
    var c = hsl2rgb(Math.floor(Math.random()*360), 60 + Math.random()*35, 40 + Math.random()*25);
    out.push(rgb2hex(c.r, c.g, c.b));
  }
  return out.join('\n');
} });

/* ---------------- renderers ---------------- */
function textPanel(t){
  return '<section id="t-' + t.id + '" class="tool"><h2>' + t.n + '</h2>' +
    '<p class="desc">Enter text — updates instantly. All in your browser.</p>' +
    '<textarea id="' + t.id + '-in" style="height:130px" oninput="genRun(\'' + t.id + '\')" placeholder="Type or paste here..."></textarea>' +
    (t.k === 'pair' ? '<div class="row"><input type="text" id="' + t.id + '-p" placeholder="' + t.b + '" style="flex:1" oninput="genRun(\'' + t.id + '\')"></div>' : '') +
    '<div class="row"><button class="act" onclick="genRun(\'' + t.id + '\')">Chalao</button>' +
    '<button class="act" onclick="genCopy(\'' + t.id + '\')">Copy</button>' +
    '<button class="act clear-btn" onclick="genClear(\'' + t.id + '\')">Clear</button></div>' +
    '<textarea id="' + t.id + '-out" style="height:130px" readonly></textarea>' +
    '<div class="status" id="' + t.id + '-st"></div></section>';
}
function formPanel(t){
  var fields = t.fields.map(function(f){
    return '<div class="row"><span class="lbl" style="width:auto">' + f.label + '</span>' +
      '<input type="' + (f.type || 'text') + '" id="' + t.id + '-' + f.k + '" value="' + (f.value || '') + '" style="width:120px" oninput="genCalc(\'' + t.id + '\')"></div>';
  }).join('');
  return '<section id="t-' + t.id + '" class="tool"><h2>' + t.n + '</h2>' +
    '<p class="desc">Values bhariye — result turant dikhega.</p>' + fields +
    '<div class="row"><button class="act" onclick="genCalc(\'' + t.id + '\')">Extract</button></div>' +
    '<div id="' + t.id + '-out" style="font-size:13px;line-height:1.9"></div></section>';
}

function build(){
  var main = document.querySelector('main');
  if(!main || document.getElementById('t-' + T[0].id)){ return; }
  var html = '';
  T.forEach(function(t){ html += (t.k === 'form' ? formPanel(t) : textPanel(t)); });
  main.insertAdjacentHTML('beforeend', html);

  /* nav */
  var byGroup = {};
  T.forEach(function(t){ (byGroup[t.g] = byGroup[t.g] || []).push(t); });
  Object.keys(byGroup).forEach(function(g){
    var el = document.getElementById('g-' + g);
    if(!el){ return; }
    byGroup[g].forEach(function(t){
      el.insertAdjacentHTML('beforeend', '<button class="nav" onclick="openTool(\'' + t.id + '\',this)">' + t.n + '</button>');
    });
    var cnt = document.querySelector('[data-g="' + g + '"] .count');
    if(cnt){ cnt.textContent = String(el.querySelectorAll('.nav').length); }
  });
}

/* ---------------- runtime ---------------- */
var MAP = {};
T.forEach(function(t){ MAP[t.id] = t; });

window.genRun = function(id){
  var t = MAP[id];
  if(!t || t.k === 'form'){ return; }
  var inp = document.getElementById(id + '-in');
  var out = document.getElementById(id + '-out');
  if(!inp || !out){ return; }
  try{
    var extra = document.getElementById(id + '-p');
    out.value = t.k === 'pair' ? t.fn(inp.value, extra ? extra.value : '') : t.fn(inp.value);
  }catch(e){
    out.value = 'Dikkat: ' + e.message;
  }
};
window.genCalc = function(id){
  var t = MAP[id];
  if(!t || t.k !== 'form'){ return; }
  var v = {};
  t.fields.forEach(function(f){
    var el = document.getElementById(id + '-' + f.k);
    v[f.k] = el ? el.value : '';
  });
  var out = document.getElementById(id + '-out');
  if(out){ try{ out.innerHTML = t.calc(v); }catch(e){ out.innerHTML = 'Dikkat: ' + e.message; } }
};
window.genCopy = function(id){
  var out = document.getElementById(id + '-out');
  if(!out){ return; }
  var text = out.value || out.textContent;
  var ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); }catch(e){}
  document.body.removeChild(ta);
  var st = document.getElementById(id + '-st');
  if(st){ st.textContent = 'Copy ho gaya.'; st.className = 'status ok'; }
};
window.genClear = function(id){
  var inp = document.getElementById(id + '-in');
  var out = document.getElementById(id + '-out');
  if(inp){ inp.value = ''; }
  if(out){ out.value = ''; }
};

build();

})();

/* ===== countfix ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

(function(){
  document.querySelectorAll('.grp-list').forEach(function(list){
    var id = list.id.replace('g-', '');
    var btn = document.querySelector('[data-g="' + id + '"] .count');
    if(btn){ btn.textContent = String(list.querySelectorAll('.nav').length); }
  });
})();

/* ===== htmlinspector ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

/* ===================================================================
   HTML INSPECTOR — paste karo, andar kya hai sab dikhega
   Asli DOMParser se padhta hai (regex guess nahi)
   =================================================================== */
(function(){

function $(id){ return document.getElementById(id); }
function esc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

var TAGS = ['div','span','p','a','img','script','style','link','meta','section','article','header','footer','nav','ul','ol','li','table','tr','td','th','form','input','button','textarea','select','iframe','video','audio','canvas','svg','h1','h2','h3','h4','h5','h6','br','hr','strong','em','label','picture','source'];

function row(label, value){
  return '<div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px solid var(--line);font-size:12.5px">' +
    '<span class="lbl" style="width:auto">' + label + '</span><b style="text-align:right">' + value + '</b></div>';
}
function block(title, inner){
  return '<div style="margin:12px 0"><div style="font-size:12px;font-weight:700;margin-bottom:4px;color:var(--accent2)">' + title + '</div>' + inner + '</div>';
}
function chips(arr, limit){
  if(!arr.length){ return '<span class="lbl">koi nahi</span>'; }
  var shown = arr.slice(0, limit || 40);
  return shown.map(function(x){
    return '<code style="display:inline-block;background:var(--panel2);border:1px solid var(--line);border-radius:5px;padding:1px 6px;margin:2px;font-size:11px">' + esc(x) + '</code>';
  }).join('') + (arr.length > (limit || 40) ? ' <span class="lbl">+' + (arr.length - (limit || 40)) + ' aur</span>' : '');
}

window.hiRun = function(){
  var code = ($('hi-in') || {}).value || '';
  var out = $('hi-out');
  if(!out){ return; }
  if(!code.trim()){ out.innerHTML = '<div class="lbl">HTML paste kijiye.</div>'; return; }

  var doc;
  try{
    doc = new DOMParser().parseFromString(code, 'text/html');
  }catch(e){
    out.innerHTML = '<div class="status bad">Parse nahi ho paya: ' + esc(e.message) + '</div>';
    return;
  }
  var err = doc.querySelector('parsererror');

  /* counts */
  var counts = {};
  TAGS.forEach(function(t){ counts[t] = doc.querySelectorAll(t).length; });
  var allEls = doc.querySelectorAll('*').length;

  /* meta */
  var title = doc.querySelector('title') ? doc.querySelector('title').textContent.trim() : '';
  var descEl = doc.querySelector('meta[name="description"]');
  var desc = descEl ? descEl.getAttribute('content') : '';
  var viewport = doc.querySelector('meta[name="viewport"]');
  var htmlEl = doc.documentElement;
  var lang = htmlEl ? (htmlEl.getAttribute('lang') || '') : '';
  var doctype = /^\s*<!doctype/i.test(code);

  /* ids + classes */
  var ids = [], classes = {}, seenCls = [];
  doc.querySelectorAll('[id]').forEach(function(e){ ids.push(e.id); });
  doc.querySelectorAll('[class]').forEach(function(e){
    String(e.className).split(/\s+/).forEach(function(c){ if(c && !classes[c]){ classes[c] = 1; seenCls.push(c); } });
  });

  /* links */
  var links = [], ext = 0, int2 = 0;
  doc.querySelectorAll('a[href]').forEach(function(a){
    var h = a.getAttribute('href');
    links.push(h);
    if(/^https?:\/\//i.test(h)){ ext++; } else { int2++; }
  });

  /* images */
  var imgs = [], noAlt = 0;
  doc.querySelectorAll('img').forEach(function(i){
    imgs.push(i.getAttribute('src') || '(src nahi)');
    if(!i.hasAttribute('alt') || !i.getAttribute('alt').trim()){ noAlt++; }
  });

  /* scripts + styles */
  var scripts = doc.querySelectorAll('script');
  var extScripts = 0, inlineScripts = 0;
  scripts.forEach(function(s){ if(s.getAttribute('src')){ extScripts++; } else { inlineScripts++; } });
  var styles = doc.querySelectorAll('style').length;
  var inlineStyles = doc.querySelectorAll('[style]').length;
  var cssLinks = doc.querySelectorAll('link[rel="stylesheet"]').length;

  /* headings */
  var heads = [];
  doc.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function(h){
    heads.push(h.tagName.toLowerCase() + ': ' + (h.textContent || '').trim().slice(0, 40));
  });

  /* forms */
  var forms = doc.querySelectorAll('form').length;
  var inputs = doc.querySelectorAll('input,select,textarea').length;

  var html = '';

  html += block('Basics',
    row('Doctype', doctype ? '✓ hai' : '✗ nahi') +
    row('lang', lang ? esc(lang) : '—') +
    row('Title', title ? esc(title) : '<span class="lbl">nahi</span>') +
    row('Meta description', desc ? esc(desc.slice(0, 60)) : '<span class="lbl">nahi</span>') +
    row('Viewport (mobile)', viewport ? '✓ ' + esc(viewport.getAttribute('content').slice(0, 40)) : '✗ nahi') +
    row('Total elements', allEls) +
    row('File size', (code.length / 1024).toFixed(1) + ' KB'));

  html += block('Tag counts', Object.keys(counts).filter(function(t){ return counts[t] > 0; })
    .sort(function(a, b){ return counts[b] - counts[a]; })
    .map(function(t){ return row('&lt;' + t + '&gt;', counts[t]); }).join(''));

  html += block('Scripts &amp; styles',
    row('Script tags', scripts.length) +
    row('External scripts', extScripts) +
    row('Inline scripts', inlineScripts) +
    row('&lt;style&gt; blocks', styles) +
    row('CSS files (link)', cssLinks) +
    row('Elements with style=""', inlineStyles));

  html += block('Links (' + links.length + ')',
    row('Internal', int2) + row('External', ext) +
    '<div style="margin-top:5px">' + chips(links, 25) + '</div>');

  html += block('Images (' + imgs.length + ')',
    row('alt missing', noAlt > 0 ? '<span style="color:var(--err)">' + noAlt + '</span>' : '0') +
    '<div style="margin-top:5px">' + chips(imgs, 15) + '</div>');

  html += block('IDs (' + ids.length + ')', chips(ids, 30));
  html += block('Classes (' + seenCls.length + ')', chips(seenCls, 40));
  html += block('Headings (' + heads.length + ')',
    heads.length ? heads.map(function(h){ return '<div style="font-size:12px">' + esc(h) + '</div>'; }).join('') : '<span class="lbl">koi nahi</span>');
  html += block('Forms', row('&lt;form&gt;', forms) + row('input / select / textarea', inputs));

  if(err){
    html = '<div class="cc-issue bad" style="margin-bottom:8px">Parser ne dikkat batayi — HTML mein kuch galat ho sakta hai.</div>' + html;
  }
  out.innerHTML = html;

  var st = $('hi-st');
  if(st){ st.textContent = 'Inspect ho gaya — ' + allEls + ' elements, ' + ids.length + ' ids, ' + seenCls.length + ' classes.'; st.className = 'status ok'; }
};

window.hiClear = function(){
  var inp = $('hi-in'); if(inp){ inp.value = ''; }
  var out = $('hi-out'); if(out){ out.innerHTML = '<div class="lbl">HTML paste kijiye — phir "Inspect" dabaiye.</div>'; }
  var st = $('hi-st'); if(st){ st.textContent = ''; }
};

window.hiFile = function(file){
  if(!file){ return; }
  if(file.size > 2 * 1024 * 1024){ var st = $('hi-st'); if(st){ st.textContent = 'File 2 MB se badi hai.'; st.className = 'status bad'; } return; }
  var fr = new FileReader();
  fr.onload = function(){
    var inp = $('hi-in');
    if(inp){ inp.value = fr.result; }
    hiRun();
  };
  fr.readAsText(file);
};

/* ---------------- panel ---------------- */
function build(){
  var main = document.querySelector('main');
  var grp = document.getElementById('g-web');
  if(!main || !grp || document.getElementById('t-hi')){ return; }

  grp.insertAdjacentHTML('beforeend',
    '<button class="nav" onclick="openTool(\'hi\',this)">HTML inspector</button>');
  var cnt = document.querySelector('[data-g="web"] .count');
  if(cnt){ cnt.textContent = String(document.querySelectorAll('#g-web .nav').length); }

  main.insertAdjacentHTML('beforeend',
    '<section id="t-hi" class="tool">' +
      '<h2>HTML inspector</h2>' +
      '<p class="desc">Paste HTML or file upload kijiye — andar kya hai sab dikhega: title, meta, tags ki ginti, ids, classes, links, images, scripts, headings, forms. Asli HTML parser se padha jaata hai, koi andaza nahi.</p>' +
      '<div class="row">' +
        '<input type="file" id="hi-file" accept=".html,.htm,.txt,text/html" style="display:none">' +
        '<button class="act" onclick="document.getElementById(\'hi-file\').click()">Upload File</button>' +
        '<button class="act pri" onclick="hiRun()">Inspect</button>' +
        '<button class="act clear-btn" onclick="hiClear()">Clear</button>' +
      '</div>' +
      '<textarea id="hi-in" style="height:150px" placeholder="&lt;!DOCTYPE html&gt;&#10;&lt;html&gt;... paste here"></textarea>' +
      '<div id="hi-out"><div class="lbl">HTML paste kijiye — phir "Inspect" dabaiye.</div></div>' +
      '<div class="status" id="hi-st"></div>' +
    '</section>');

  var f = $('hi-file');
  if(f){ f.addEventListener('change', function(){ hiFile(f.files[0]); f.value = ''; }); }
}

build();

})();

/* ===== more100 ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

/* ===================================================================
   100 NAYE TOOLS — unit, cipher, number, date, CSS, colour, dev
   =================================================================== */
(function(){

function $(id){ return document.getElementById(id); }
function esc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function num(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; }

var T = [];

/* ================= A. UNIT CONVERTERS (18) ================= */
function conv(id, name, g, units, note){
  T.push({ id:id, n:name, g:g, k:'conv', units:units, note:note || '' });
}
conv('u-len', 'Length converter', 'util', { 'millimetre (mm)':0.001, 'centimetre (cm)':0.01, 'metre (m)':1, 'kilometre (km)':1000, 'inch (in)':0.0254, 'foot (ft)':0.3048, 'yard (yd)':0.9144, 'mile (mi)':1609.344 });
conv('u-wt', 'Weight converter', 'util', { 'milligram (mg)':0.000001, 'gram (g)':0.001, 'kilogram (kg)':1, 'tonne':1000, 'pound (lb)':0.45359237, 'ounce (oz)':0.0283495231, 'quintal':100 });
conv('u-temp', 'Temperature converter', 'util', { 'Celsius':1, 'Fahrenheit':1, 'Kelvin':1 }, 'special');
conv('u-area', 'Area converter', 'util', { 'sq metre (m²)':1, 'sq kilometre (km²)':1000000, 'sq foot (ft²)':0.09290304, 'sq yard (yd²)':0.83612736, 'hectare':10000, 'acre':4046.8564224, 'bigha (approx)':2529.3 });
conv('u-vol', 'Volume converter', 'util', { 'millilitre (ml)':0.001, 'litre (l)':1, 'cubic metre (m³)':1000, 'teaspoon (US)':0.00492892, 'tablespoon (US)':0.0147868, 'cup (US)':0.236588, 'pint (US)':0.473176, 'gallon (US)':3.78541 });
conv('u-speed', 'Speed converter', 'util', { 'metre/second (m/s)':1, 'km/hour (km/h)':0.277778, 'mile/hour (mph)':0.44704, 'knot':0.514444, 'foot/second (ft/s)':0.3048 });
conv('u-time', 'Time converter', 'util', { 'second':1, 'minute':60, 'hour':3600, 'day':86400, 'week':604800, 'month (30d)':2592000, 'year (365d)':31536000, 'millisecond':0.001 });
conv('u-data', 'Data size converter', 'util', { 'bit':0.125, 'byte':1, 'kilobyte (KB)':1024, 'megabyte (MB)':1048576, 'gigabyte (GB)':1073741824, 'terabyte (TB)':1099511627776 });
conv('u-press', 'Pressure converter', 'util', { 'pascal (Pa)':1, 'kilopascal (kPa)':1000, 'bar':100000, 'psi':6894.757, 'atm':101325, 'mmHg':133.322 });
conv('u-energy', 'Energy converter', 'util', { 'joule (J)':1, 'kilojoule (kJ)':1000, 'calorie (cal)':4.184, 'kilocalorie (kcal)':4184, 'watt-hour (Wh)':3600, 'kilowatt-hour (kWh)':3600000 });
conv('u-power', 'Power converter', 'util', { 'watt (W)':1, 'kilowatt (kW)':1000, 'horsepower (HP)':745.699872, 'BTU/hour':0.29307107, 'megawatt (MW)':1000000 });
conv('u-angle', 'Angle converter', 'util', { 'degree (°)':1, 'radian':57.2957795, 'gradian':0.9, 'turn':360, 'arcminute':0.0166667 });
conv('u-freq', 'Frequency converter', 'util', { 'hertz (Hz)':1, 'kilohertz (kHz)':1000, 'megahertz (MHz)':1000000, 'gigahertz (GHz)':1000000000 });
conv('u-fuel', 'Fuel economy converter', 'util', { 'km per litre':1, 'mile per gallon (US)':0.425144, 'mile per gallon (UK)':0.354006, 'litre per 100 km':100 });
conv('u-force', 'Force converter', 'util', { 'newton (N)':1, 'kilonewton (kN)':1000, 'kilogram-force (kgf)':9.80665, 'pound-force (lbf)':4.448222 });
conv('u-torque', 'Torque converter', 'util', { 'newton-metre (Nm)':1, 'kilogram-metre (kgm)':9.80665, 'pound-foot (lb-ft)':1.355818 });
conv('u-cook', 'Cooking measure', 'util', { 'millilitre (ml)':1, 'teaspoon':4.92892, 'tablespoon':14.7868, 'cup':236.588, 'gram (water)':1, 'ounce':28.3495 });
conv('u-land', 'Land area (India)', 'util', { 'square foot':1, 'square metre':10.7639, 'guntha':1089, 'bigha (approx)':27000, 'acre':43560, 'hectare':107639, 'square yard':9 });

/* ================= B. CIPHERS & ENCODERS (12) ================= */
function caesar(s, sh){ return s.replace(/[a-zA-Z]/g, function(c){
  var b = c <= 'Z' ? 65 : 97;
  return String.fromCharCode((c.charCodeAt(0) - b + sh + 26) % 26 + b);
}); }
T.push({ id:'c-caesar', n:'Caesar cipher', g:'encode', k:'form',
  fields:[{ k:'t', label:'text', value:'', type:'text' },{ k:'s', label:'shift', value:'3', type:'number' }],
  calc:function(v){
    var s = parseInt(v.s, 10) || 0;
    return '<div><b>Encrypt:</b> <code>' + esc(caesar(v.t || '', s)) + '</code></div>' +
      '<div><b>Decrypt:</b> <code>' + esc(caesar(v.t || '', -s)) + '</code></div>';
  } });
T.push({ id:'c-atbash', n:'Atbash cipher', g:'encode', k:'text', fn:function(s){
  return s.replace(/[a-zA-Z]/g, function(c){
    var b = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(b + (25 - (c.charCodeAt(0) - b)));
  });
} });
T.push({ id:'c-rot47', n:'ROT47', g:'encode', k:'text', fn:function(s){
  return s.replace(/[!-~]/g, function(c){ return String.fromCharCode(33 + ((c.charCodeAt(0) - 33 + 47) % 94)); });
} });
T.push({ id:'c-vigenere', n:'Vigenère cipher', g:'encode', k:'form',
  fields:[{ k:'t', label:'text', value:'', type:'text' },{ k:'k', label:'key', value:'key', type:'text' },{ k:'m', label:'mode (e/d)', value:'e', type:'text' }],
  calc:function(v){
    var t = v.t || '', k = (v.k || 'a').toLowerCase().replace(/[^a-z]/g,'') || 'a';
    var dec = (v.m || 'e').toLowerCase().indexOf('d') === 0;
    var ki = 0, out = '';
    for(var i = 0; i < t.length; i++){
      var c = t[i];
      if(/[a-zA-Z]/.test(c)){
        var b = c <= 'Z' ? 65 : 97;
        var sh = k.charCodeAt(ki % k.length) - 97;
        if(dec){ sh = -sh; }
        out += String.fromCharCode((c.charCodeAt(0) - b + sh + 26) % 26 + b);
        ki++;
      } else { out += c; }
    }
    return '<code style="word-break:break-all">' + esc(out) + '</code>';
  } });
T.push({ id:'c-rail', n:'Rail fence cipher', g:'encode', k:'pair', b:'rails (2-6)', fn:function(s, r){
  var rails = Math.max(2, Math.min(6, parseInt(r, 10) || 3));
  var rows = [], i, j, dir = 1, row = 0;
  for(i = 0; i < rails; i++){ rows.push(''); }
  for(i = 0; i < s.length; i++){
    rows[row] += s[i];
    if(row === 0){ dir = 1; } else if(row === rails - 1){ dir = -1; }
    row += dir;
  }
  return rows.join('');
} });
T.push({ id:'c-bacon', n:'Bacon cipher', g:'encode', k:'text', fn:function(s){
  var map = {};
  'ABCDEFGHIKLMNOPQRSTUVWXYZ'.split('').forEach(function(c, i){ map[c] = i.toString(2).padStart(5, '0').replace(/0/g,'A').replace(/1/g,'B'); });
  return s.toUpperCase().split('').map(function(c){ return map[c] || (/[A-Z]/.test(c) ? 'ABBBB' : ' '); }).join(' ').trim();
} });
T.push({ id:'c-a1z26', n:'A1Z26 (letters ↔ numbers)', g:'encode', k:'form',
  fields:[{ k:'t', label:'text ya numbers', value:'', type:'text' },{ k:'m', label:'mode (e/d)', value:'e', type:'text' }],
  calc:function(v){
    var t = (v.t || '').trim(), dec = (v.m || 'e').toLowerCase().indexOf('d') === 0;
    if(!dec){ return '<code>' + t.toUpperCase().split('').map(function(c){
      var n = c.charCodeAt(0) - 64;
      return (n >= 1 && n <= 26) ? n : '-';
    }).join('-') + '</code>'; }
    return '<code>' + t.split(/[^0-9]+/).filter(Boolean).map(function(x){ return String.fromCharCode(64 + (parseInt(x, 10) || 0)); }).join('') + '</code>';
  } });
T.push({ id:'c-base32', n:'Base32 encode/decode', g:'encode', k:'form',
  fields:[{ k:'t', label:'text', value:'', type:'text' },{ k:'m', label:'mode (e/d)', value:'e', type:'text' }],
  calc:function(v){
    var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    var t = v.t || '', dec = (v.m || 'e').toLowerCase().indexOf('d') === 0;
    try{
      if(!dec){
        var bytes = new TextEncoder().encode(t), bits = '', out = '';
        for(var i = 0; i < bytes.length; i++){ bits += bytes[i].toString(2).padStart(8, '0'); }
        while(bits.length % 5){ bits += '0'; }
        for(var j = 0; j < bits.length; j += 5){ out += A[parseInt(bits.substr(j, 5), 2)]; }
        while(out.length % 8){ out += '='; }
        return '<code style="word-break:break-all">' + esc(out) + '</code>';
      }
      var s2 = t.toUpperCase().replace(/=+$/, ''), bits2 = '';
      for(var k = 0; k < s2.length; k++){ bits2 += A.indexOf(s2[k]).toString(2).padStart(5, '0'); }
      var bytes2 = [];
      for(var m = 0; m + 8 <= bits2.length; m += 8){ bytes2.push(parseInt(bits2.substr(m, 8), 2)); }
      return '<code style="word-break:break-all">' + esc(new TextDecoder().decode(new Uint8Array(bytes2))) + '</code>';
    }catch(e){ return 'Galat input.'; }
  } });
T.push({ id:'c-base58', n:'Base58 encode/decode', g:'encode', k:'form',
  fields:[{ k:'t', label:'text', value:'', type:'text' },{ k:'m', label:'mode (e/d)', value:'e', type:'text' }],
  calc:function(v){
    var A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    var t = v.t || '', dec = (v.m || 'e').toLowerCase().indexOf('d') === 0;
    try{
      if(!dec){
        var bytes = new TextEncoder().encode(t), num2 = 0n;
        for(var i = 0; i < bytes.length; i++){ num2 = num2 * 256n + BigInt(bytes[i]); }
        var out = '';
        while(num2 > 0n){ out = A[Number(num2 % 58n)] + out; num2 = num2 / 58n; }
        for(var z = 0; z < bytes.length && bytes[z] === 0; z++){ out = '1' + out; }
        return '<code style="word-break:break-all">' + esc(out || '1') + '</code>';
      }
      var n2 = 0n;
      for(var k = 0; k < t.length; k++){ var idx = A.indexOf(t[k]); if(idx < 0){ return 'Galat Base58.'; } n2 = n2 * 58n + BigInt(idx); }
      var bs = [];
      while(n2 > 0n){ bs.unshift(Number(n2 % 256n)); n2 = n2 / 256n; }
      return '<code style="word-break:break-all">' + esc(new TextDecoder().decode(new Uint8Array(bs))) + '</code>';
    }catch(e){ return 'Galat input.'; }
  } });
T.push({ id:'c-base64url', n:'Base64 URL-safe', g:'encode', k:'form',
  fields:[{ k:'t', label:'text', value:'', type:'text' },{ k:'m', label:'mode (e/d)', value:'e', type:'text' }],
  calc:function(v){
    var t = v.t || '', dec = (v.m || 'e').toLowerCase().indexOf('d') === 0;
    try{
      if(!dec){
        var b = btoa(unescape(encodeURIComponent(t)));
        return '<code style="word-break:break-all">' + esc(b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')) + '</code>';
      }
      var s2 = t.replace(/-/g,'+').replace(/_/g,'/');
      while(s2.length % 4){ s2 += '='; }
      return '<code style="word-break:break-all">' + esc(decodeURIComponent(escape(atob(s2)))) + '</code>';
    }catch(e){ return 'Galat input.'; }
  } });
T.push({ id:'c-hexdec', n:'Hex ↔ decimal ↔ binary', g:'encode', k:'text', fn:function(s){
  var t = s.trim(), n = NaN;
  if(/^0x/i.test(t)){ n = parseInt(t, 16); }
  else if(/^[01]+$/.test(t)){ n = parseInt(t, 2); }
  else if(/^\d+$/.test(t)){ n = parseInt(t, 10); }
  if(isNaN(n)){ return 'Ek number likhiye (decimal, 0x hex, ya binary).'; }
  return 'decimal: ' + n + '\nhex: 0x' + n.toString(16).toUpperCase() + '\nbinary: ' + n.toString(2) + '\noctal: ' + n.toString(8);
} });
T.push({ id:'c-rot13b', n:'Reverse alphabet', g:'encode', k:'text', fn:function(s){
  return s.split('').reverse().join('');
} });

/* ================= C. NUMBER TOOLS (14) ================= */
function isPrime(n){
  if(n < 2){ return false; }
  if(n % 2 === 0){ return n === 2; }
  for(var i = 3; i * i <= n; i += 2){ if(n % i === 0){ return false; } }
  return true;
}
T.push({ id:'n-prime', n:'Prime checker', g:'calc', k:'text', fn:function(s){
  var n = parseInt(s, 10);
  if(isNaN(n) || n < 0){ return 'Number likhiye.'; }
  return n + (isPrime(n) ? ' — prime hai ✓' : ' — prime nahi hai ✗');
} });
T.push({ id:'n-primelist', n:'Prime numbers list', g:'calc', k:'text', fn:function(s){
  var n = Math.min(10000, parseInt(s, 10) || 100), out = [];
  for(var i = 2; i <= n; i++){ if(isPrime(i)){ out.push(i); } }
  return out.join(', ') + '\n\nTotal: ' + out.length;
} });
T.push({ id:'n-gcd', n:'GCD aur LCM', g:'calc', k:'pair', b:'doosra number', fn:function(a, b){
  var x = Math.abs(parseInt(a, 10) || 0), y = Math.abs(parseInt(b, 10) || 0);
  if(!x || !y){ return 'Do number likhiye.'; }
  var p = x, q = y;
  while(q){ var t = q; q = p % q; p = t; }
  return 'GCD: ' + p + '\nLCM: ' + (x / p * y);
} });
T.push({ id:'n-fact', n:'Factorial', g:'calc', k:'text', fn:function(s){
  var n = parseInt(s, 10);
  if(isNaN(n) || n < 0 || n > 170){ return '0 se 170 ke beech number likhiye.'; }
  var r = 1n;
  for(var i = 2n; i <= BigInt(n); i++){ r *= i; }
  return n + '! = ' + r.toString();
} });
T.push({ id:'n-fib', n:'Fibonacci series', g:'calc', k:'text', fn:function(s){
  var n = Math.min(100, parseInt(s, 10) || 10), a = 0n, b = 1n, out = [];
  for(var i = 0; i < n; i++){ out.push(a.toString()); var t = a + b; a = b; b = t; }
  return out.join(', ');
} });
T.push({ id:'n-root', n:'Square root / cube root', g:'calc', k:'text', fn:function(s){
  var n = parseFloat(s);
  if(isNaN(n)){ return 'Number likhiye.'; }
  return 'square root: ' + Math.sqrt(n).toFixed(6) + '\ncube root: ' + Math.cbrt(n).toFixed(6) + '\nsquare: ' + (n*n) + '\ncube: ' + (n*n*n);
} });
T.push({ id:'n-pctchange', n:'Percentage change', g:'calc', k:'pair', b:'naya value', fn:function(a, b){
  var o = parseFloat(a), n = parseFloat(b);
  if(!o){ return 'Purana value 0 nahi ho sakta.'; }
  var d = (n - o) / Math.abs(o) * 100;
  return (d >= 0 ? 'Badha: +' : 'Ghata: ') + d.toFixed(2) + '%';
} });
T.push({ id:'n-ratio', n:'Ratio simplifier', g:'calc', k:'text', fn:function(s){
  var m = s.match(/(\d+)\s*[:/]\s*(\d+)/);
  if(!m){ return 'Aise likhiye: 16:24'; }
  var a = parseInt(m[1], 10), b = parseInt(m[2], 10), p = a, q = b;
  while(q){ var t = q; q = p % q; p = t; }
  return m[1] + ':' + m[2] + ' = ' + (a/p) + ':' + (b/p) + '\n(decimal: ' + (a/b).toFixed(3) + ')';
} });
T.push({ id:'n-round', n:'Rounding', g:'calc', k:'form',
  fields:[{ k:'n', label:'number', value:'1234.5678', type:'text' },{ k:'d', label:'round to', value:'100', type:'number' }],
  calc:function(v){
    var n = num(v.n), d = Math.max(1, num(v.d) || 1);
    return '<div><b>Nearest ' + d + ':</b> ' + (Math.round(n/d)*d) + '</div>' +
      '<div><b>Up:</b> ' + (Math.ceil(n/d)*d) + ' &nbsp; <b>Down:</b> ' + (Math.floor(n/d)*d) + '</div>' +
      '<div><b>2 decimal:</b> ' + n.toFixed(2) + '</div>';
  } });
var ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
var TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function two(n){ return n < 20 ? ONES[n] : TENS[Math.floor(n/10)] + (n % 10 ? ' ' + ONES[n % 10] : ''); }
function toWords(n){
  if(n === 0){ return 'zero'; }
  var out = [];
  var cr = Math.floor(n / 10000000); n %= 10000000;
  var lk = Math.floor(n / 100000); n %= 100000;
  var th = Math.floor(n / 1000); n %= 1000;
  var hu = Math.floor(n / 100); n %= 100;
  if(cr){ out.push(toWords(cr) + ' crore'); }
  if(lk){ out.push(two(lk) + ' lakh'); }
  if(th){ out.push(two(th) + ' thousand'); }
  if(hu){ out.push(ONES[hu] + ' hundred'); }
  if(n){ out.push(two(n)); }
  return out.join(' ');
}
T.push({ id:'n-words', n:'Number to words (Indian)', g:'calc', k:'text', fn:function(s){
  var n = parseInt(String(s).replace(/[^\d]/g, ''), 10);
  if(isNaN(n)){ return 'Number likhiye.'; }
  return toWords(n);
} });
T.push({ id:'n-divis', n:'Divisibility checker', g:'calc', k:'pair', b:'divisor', fn:function(a, b){
  var n = parseInt(a, 10), d = parseInt(b, 10);
  if(!d){ return 'Divisor 0 nahi ho sakta.'; }
  return n + (n % d === 0 ? ' , ' + d + ' se poora divide hota hai ✓' : ' , ' + d + ' se divide nahi hota ✗') + '\nBhaagphal: ' + (n/d).toFixed(3);
} });
T.push({ id:'n-factors', n:'Factors aur even/odd', g:'calc', k:'text', fn:function(s){
  var n = parseInt(s, 10);
  if(isNaN(n) || n < 1){ return 'Positive number likhiye.'; }
  var f = [];
  for(var i = 1; i * i <= n; i++){ if(n % i === 0){ f.push(i); if(i !== n/i){ f.push(n/i); } } }
  f.sort(function(a,b){ return a-b; });
  return n + ' ' + (n % 2 ? 'odd' : 'even') + '\nfactors: ' + f.join(', ') + '\ntotal: ' + f.length;
} });
T.push({ id:'n-stats', n:'Average / median / mode', g:'calc', k:'text', fn:function(s){
  var a = s.split(/[,\s]+/).map(parseFloat).filter(function(x){ return !isNaN(x); });
  if(!a.length){ return 'Numbers likhiye (comma se).'; }
  var sum = a.reduce(function(x,y){ return x+y; }, 0), avg = sum/a.length;
  var sorted = a.slice().sort(function(x,y){ return x-y; });
  var mid = Math.floor(sorted.length/2);
  var med = sorted.length % 2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
  var counts = {}, best = sorted[0], bestN = 0;
  a.forEach(function(x){ counts[x] = (counts[x]||0)+1; if(counts[x] > bestN){ bestN = counts[x]; best = x; } });
  return 'count: ' + a.length + '\nsum: ' + sum + '\naverage: ' + avg.toFixed(3) + '\nmedian: ' + med + '\nmode: ' + best + ' (' + bestN + ' baar)';
} });

/* ================= D. DATE & TIME (12) ================= */
function dparse(s){ var d = new Date(s); return isNaN(d.getTime()) ? null : d; }
T.push({ id:'d-dow', n:'Day of week', g:'calc', k:'text', fn:function(s){
  var d = dparse(s.trim()); if(!d){ return 'Date likhiye: 2026-01-15'; }
  return d.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
} });
T.push({ id:'d-week', n:'Week number', g:'calc', k:'text', fn:function(s){
  var d = dparse(s.trim()); if(!d){ return 'Date likhiye.'; }
  var start = new Date(d.getFullYear(), 0, 1);
  var wk = Math.ceil((((d - start) / 86400000) + start.getDay() + 1) / 7);
  return 'ISO week: ' + wk + ' (saal ' + d.getFullYear() + ')';
} });
T.push({ id:'d-doy', n:'Day of year', g:'calc', k:'text', fn:function(s){
  var d = dparse(s.trim()); if(!d){ return 'Date likhiye.'; }
  var start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000) + ' / ' + (d.getFullYear() % 4 === 0 ? 366 : 365);
} });
T.push({ id:'d-leap', n:'Leap year checker', g:'calc', k:'text', fn:function(s){
  var y = parseInt(s, 10);
  if(isNaN(y)){ return 'Saal likhiye.'; }
  var leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return y + (leap ? ' leap year hai ✓' : ' leap year nahi hai ✗');
} });
T.push({ id:'d-between', n:'Days between dates', g:'calc', k:'form',
  fields:[{ k:'a', label:'se (YYYY-MM-DD)', value:'', type:'text' },{ k:'b', label:'tak', value:'', type:'text' }],
  calc:function(v){
    var a = dparse(v.a), b = dparse(v.b);
    if(!a || !b){ return 'Dono date daaliye.'; }
    var days = Math.round(Math.abs(b - a) / 86400000);
    return '<div><b>' + days + ' din</b></div><div>' + (days/7).toFixed(1) + ' hafte · ' + (days/30.44).toFixed(1) + ' mahine</div>';
  } });
T.push({ id:'d-addmonths', n:'Date + months', g:'calc', k:'form',
  fields:[{ k:'d', label:'date', value:'', type:'text' },{ k:'m', label:'months (+/-)', value:'6', type:'number' }],
  calc:function(v){
    var d = dparse(v.d); if(!d){ return 'Date daaliye.'; }
    d.setMonth(d.getMonth() + num(v.m));
    return '<b>' + d.toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }) + '</b>';
  } });
T.push({ id:'d-agemonths', n:'Age in months/weeks', g:'calc', k:'text', fn:function(s){
  var d = dparse(s.trim()); if(!d){ return 'Janm tithi likhiye.'; }
  var days = Math.floor((Date.now() - d) / 86400000);
  return 'din: ' + days + '\nhafte: ' + (days/7).toFixed(1) + '\nmahine: ' + (days/30.44).toFixed(1) + '\nsaal: ' + (days/365.25).toFixed(1);
} });
T.push({ id:'d-tz', n:'Time zone compare', g:'calc', k:'form',
  fields:[{ k:'h', label:'IST hour (0-23)', value:'12', type:'number' },{ k:'o', label:'doosra offset (+/- hours)', value:'0', type:'number' }],
  calc:function(v){
    var h = num(v.h), o = num(v.o);
    var t = ((h + o) % 24 + 24) % 24;
    var out = [];
    [['UTC', -5.5], ['New York', -9.5], ['London', -5.5], ['Dubai', -1.5], ['Singapore', 2.5], ['Tokyo', 3.5], ['Sydney', 4.5]].forEach(function(z){
      var hh = ((h + z[1]) % 24 + 24) % 24;
      out.push('<div style="display:flex;justify-content:space-between"><span>' + z[0] + '</span><b>' + String(Math.floor(hh)).padStart(2,'0') + ':' + (hh % 1 ? '30' : '00') + '</b></div>');
    });
    return out.join('') + '<div class="lbl" style="margin-top:6px">DST ignore kiya gaya hai.</div>';
  } });
T.push({ id:'d-fmt', n:'Date format converter', g:'calc', k:'text', fn:function(s){
  var d = dparse(s.trim()); if(!d){ return 'Date likhiye.'; }
  var dd = String(d.getDate()).padStart(2,'0'), mm = String(d.getMonth()+1).padStart(2,'0'), yy = d.getFullYear();
  return 'DD/MM/YYYY: ' + dd + '/' + mm + '/' + yy + '\nYYYY-MM-DD: ' + yy + '-' + mm + '-' + dd + '\nMMM DD, YYYY: ' + d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) + '\nISO: ' + d.toISOString();
} });
T.push({ id:'d-countdown', n:'Countdown to date', g:'calc', k:'text', fn:function(s){
  var d = dparse(s.trim()); if(!d){ return 'Date likhiye.'; }
  var diff = d - Date.now();
  if(diff < 0){ return 'Ye date nikal chuki hai (' + Math.floor(-diff/86400000) + ' din pehle).'; }
  return Math.floor(diff/86400000) + ' din ' + Math.floor(diff%86400000/3600000) + ' ghante baaki';
} });
T.push({ id:'d-hours', n:'Working hours', g:'calc', k:'form',
  fields:[{ k:'s', label:'start (HH:MM)', value:'09:30', type:'text' },{ k:'e', label:'end', value:'18:30', type:'text' },{ k:'b', label:'break (min)', value:'45', type:'number' }],
  calc:function(v){
    function m(t){ var p = String(t).split(':'); return (parseInt(p[0],10)||0)*60 + (parseInt(p[1],10)||0); }
    var mins = m(v.e) - m(v.s) - num(v.b);
    if(mins < 0){ mins += 1440; }
    return '<div><b>' + Math.floor(mins/60) + ' ghante ' + (mins%60) + ' minute</b></div>' +
      '<div class="lbl">break ' + num(v.b) + ' min nikaal kar</div>';
  } });
T.push({ id:'d-duration', n:'Time add/subtract', g:'calc', k:'form',
  fields:[{ k:'a', label:'time (HH:MM)', value:'10:45', type:'text' },{ k:'b', label:'minutes (+/-)', value:'90', type:'number' }],
  calc:function(v){
    var p = String(v.a).split(':');
    var t = (parseInt(p[0],10)||0)*60 + (parseInt(p[1],10)||0) + num(v.b);
    t = ((t % 1440) + 1440) % 1440;
    return '<b>' + String(Math.floor(t/60)).padStart(2,'0') + ':' + String(t%60).padStart(2,'0') + '</b>';
  } });

/* ================= E. TEXT EXTRAS (14) ================= */
T.push({ id:'x-palin', n:'Palindrome checker', g:'text', k:'text', fn:function(s){
  var c = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if(!c){ return 'Text likhiye.'; }
  return c === c.split('').reverse().join('') ? '✓ Palindrome hai' : '✗ Palindrome nahi hai';
} });
T.push({ id:'x-anagram', n:'Anagram checker', g:'text', k:'pair', b:'doosra shabd', fn:function(a, b){
  var f = function(x){ return x.toLowerCase().replace(/[^a-z0-9]/g,'').split('').sort().join(''); };
  return f(a) === f(b) ? '✓ Anagram hain' : '✗ Anagram nahi hain';
} });
T.push({ id:'x-perline', n:'Words per line', g:'text', k:'text', fn:function(s){
  return s.split('\n').map(function(l, i){ return (i+1) + ': ' + (l.trim() ? l.trim().split(/\s+/).length : 0) + ' words'; }).join('\n');
} });
T.push({ id:'x-reading', n:'Reading time', g:'text', fn:function(s){
  var w = s.trim() ? s.trim().split(/\s+/).length : 0;
  return 'shabd: ' + w + '\npadhne ka time: ' + Math.max(1, Math.round(w/200)) + ' minute (200 wpm)\nbolne ka time: ' + Math.max(1, Math.round(w/130)) + ' minute';
}, k:'text' });
T.push({ id:'x-charfreq', n:'Character frequency', g:'text', k:'text', fn:function(s){
  var c = {};
  s.toLowerCase().replace(/[^a-z0-9]/g,'').split('').forEach(function(ch){ c[ch] = (c[ch]||0)+1; });
  return Object.keys(c).sort(function(a,b){ return c[b]-c[a]; }).map(function(k){ return k + ': ' + c[k]; }).join('\n');
} });
T.push({ id:'x-vowels', n:'Vowel / consonant count', g:'text', k:'text', fn:function(s){
  var v = (s.match(/[aeiouAEIOU]/g) || []).length;
  var c = (s.match(/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/g) || []).length;
  var d = (s.match(/\d/g) || []).length;
  return 'vowels: ' + v + '\nconsonants: ' + c + '\ndigits: ' + d + '\nspaces: ' + (s.match(/\s/g) || []).length;
} });
T.push({ id:'x-longest', n:'Longest word', g:'text', k:'text', fn:function(s){
  var w = s.split(/\s+/).filter(Boolean).sort(function(a,b){ return b.length - a.length; });
  if(!w.length){ return 'Text likhiye.'; }
  return 'sabse lamba: ' + w[0] + ' (' + w[0].length + ')\nagla: ' + (w[1] || '-');
} });
T.push({ id:'x-acronym', n:'Acronym generator', g:'text', k:'text', fn:function(s){
  return s.split(/\s+/).filter(Boolean).map(function(w){ return w[0].toUpperCase(); }).join('');
} });
T.push({ id:'x-initials', n:'Initials', g:'text', k:'text', fn:function(s){
  return s.trim().split(/\s+/).map(function(w){ return w[0].toUpperCase() + '.'; }).join(' ');
} });
T.push({ id:'x-namesplit', n:'Name splitter', g:'text', k:'text', fn:function(s){
  var p = s.trim().split(/\s+/);
  if(p.length < 2){ return 'Poora naam likhiye (pehla + aakhri).'; }
  return 'first: ' + p[0] + '\nlast: ' + p[p.length-1] + '\nmiddle: ' + (p.slice(1, -1).join(' ') || '-');
} });
T.push({ id:'x-hashtag', n:'Hashtag generator', g:'text', k:'text', fn:function(s){
  var stop = 'a an the and or of in on at to for with is are was were'.split(' ');
  var tags = s.toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(function(w){ return w.length > 2 && stop.indexOf(w) < 0; });
  var uniq = [];
  tags.forEach(function(t){ if(uniq.indexOf(t) < 0){ uniq.push(t); } });
  return uniq.slice(0, 20).map(function(t){ return '#' + t; }).join(' ') + '\n\n' + uniq.slice(0, 5).map(function(t){ return '#' + t + 'tips'; }).join(' ');
} });
T.push({ id:'x-altcase', n:'aLtErNaTiNg case', g:'text', k:'text', fn:function(s){
  var up = false;
  return s.split('').map(function(c){ if(/[a-zA-Z]/.test(c)){ up = !up; return up ? c.toUpperCase() : c.toLowerCase(); } return c; }).join('');
} });
T.push({ id:'x-wrapb', n:'Text ko quotes/brackets mein', g:'text', k:'form',
  fields:[{ k:'t', label:'text', value:'', type:'text' },{ k:'s', label:'style (quote/round/curly/square)', value:'quote', type:'text' }],
  calc:function(v){
    var map = { quote:['"','"'], round:['(',')'], curly:['{','}'], square:['[',']'] };
    var m = map[(v.s || 'quote').trim()] || map.quote;
    return '<code>' + esc(m[0] + (v.t || '') + m[1]) + '</code>';
  } });
T.push({ id:'x-dupwords', n:'Duplicate words count', g:'text', k:'text', fn:function(s){
  var w = s.toLowerCase().split(/\s+/).filter(Boolean), c = {};
  w.forEach(function(x){ c[x] = (c[x]||0)+1; });
  var dup = Object.keys(c).filter(function(k){ return c[k] > 1; });
  return dup.length ? dup.map(function(k){ return k + ' — ' + c[k] + ' baar'; }).join('\n') : 'Koi duplicate shabd nahi.';
} });

/* ================= F. CSS GENERATORS (10) ================= */
function cssTool(id, name, fields, fn){
  T.push({ id:id, n:name, g:'design', k:'form', fields:fields, calc:fn });
}
cssTool('s-shadow', 'Box shadow CSS', [
  { k:'x', label:'x', value:'4', type:'number' },{ k:'y', label:'y', value:'6', type:'number' },
  { k:'b', label:'blur', value:'16', type:'number' },{ k:'c', label:'colour', value:'#00000080', type:'text' }],
  function(v){
    var css = 'box-shadow: ' + num(v.x) + 'px ' + num(v.y) + 'px ' + num(v.b) + 'px ' + v.c + ';';
    return '<div style="background:#1b222c;border-radius:10px;padding:20px;text-align:center;margin-bottom:8px;' + css + '">preview</div>' +
      '<code style="font-size:12px">' + esc(css) + '</code>';
  });
cssTool('s-textshadow', 'Text shadow CSS', [
  { k:'x', label:'x', value:'2', type:'number' },{ k:'y', label:'y', value:'3', type:'number' },
  { k:'b', label:'blur', value:'6', type:'number' },{ k:'c', label:'colour', value:'#ff3d00', type:'text' }],
  function(v){
    var css = 'text-shadow: ' + num(v.x) + 'px ' + num(v.y) + 'px ' + num(v.b) + 'px ' + v.c + ';';
    return '<div style="font-size:28px;font-weight:800;padding:14px;text-align:center;' + css + '">Sample</div>' +
      '<code style="font-size:12px">' + esc(css) + '</code>';
  });
cssTool('s-radius', 'Border radius CSS', [
  { k:'r', label:'radius px', value:'18', type:'number' }],
  function(v){
    var css = 'border-radius: ' + num(v.r) + 'px;';
    return '<div style="height:80px;background:var(--accent2);' + css + ';margin-bottom:8px"></div><code>' + esc(css) + '</code>';
  });
cssTool('s-grad', 'Linear gradient CSS', [
  { k:'a', label:'colour 1', value:'#4c8dff', type:'text' },{ k:'b', label:'colour 2', value:'#a855f7', type:'text' },
  { k:'d', label:'angle deg', value:'135', type:'number' }],
  function(v){
    var css = 'background: linear-gradient(' + num(v.d) + 'deg, ' + v.a + ', ' + v.b + ');';
    return '<div style="height:80px;border-radius:10px;' + css + ';margin-bottom:8px"></div><code>' + esc(css) + '</code>';
  });
cssTool('s-radial', 'Radial gradient CSS', [
  { k:'a', label:'inner colour', value:'#4c8dff', type:'text' },{ k:'b', label:'outer colour', value:'#0d1117', type:'text' }],
  function(v){
    var css = 'background: radial-gradient(circle, ' + v.a + ', ' + v.b + ');';
    return '<div style="height:80px;border-radius:10px;' + css + ';margin-bottom:8px"></div><code>' + esc(css) + '</code>';
  });
cssTool('s-flex', 'Flexbox snippet', [
  { k:'d', label:'direction (row/column)', value:'row', type:'text' },
  { k:'j', label:'justify (center/space-between/...)', value:'center', type:'text' },
  { k:'a', label:'align (center/flex-start/...)', value:'center', type:'text' },
  { k:'g', label:'gap px', value:'12', type:'number' }],
  function(v){
    var css = 'display:flex;flex-direction:' + (v.d||'row') + ';justify-content:' + (v.j||'center') + ';align-items:' + (v.a||'center') + ';gap:' + num(v.g) + 'px;';
    return '<div style="' + css + ';background:#1b222c;padding:14px;border-radius:8px;margin-bottom:8px"><span>1</span><span>2</span><span>3</span></div>' +
      '<code style="font-size:12px">' + esc(css) + '</code>';
  });
cssTool('s-grid', 'CSS grid snippet', [
  { k:'c', label:'columns', value:'3', type:'number' },{ k:'g', label:'gap px', value:'10', type:'number' }],
  function(v){
    var cols = Math.max(1, Math.min(6, num(v.c)));
    var css = 'display:grid;grid-template-columns:repeat(' + cols + ', 1fr);gap:' + num(v.g) + 'px;';
    var boxes = '';
    for(var i = 0; i < cols * 2; i++){ boxes += '<div style="background:var(--accent2);height:30px;border-radius:6px"></div>'; }
    return '<div style="' + css + ';margin-bottom:8px">' + boxes + '</div><code style="font-size:12px">' + esc(css) + '</code>';
  });
cssTool('s-anim', 'CSS keyframes', [
  { k:'n', label:'name', value:'spin', type:'text' },{ k:'d', label:'duration (s)', value:'1', type:'number' },
  { k:'t', label:'transform (rotate/pulse/slide)', value:'rotate', type:'text' }],
  function(v){
    var name = (v.n || 'spin').replace(/[^a-zA-Z0-9_-]/g, '');
    var dur = num(v.d) || 1;
    var tf = (v.t || 'rotate').toLowerCase();
    var from = tf === 'pulse' ? 'scale(1)' : (tf === 'slide' ? 'translateX(0)' : 'rotate(0deg)');
    var to = tf === 'pulse' ? 'scale(1.25)' : (tf === 'slide' ? 'translateX(30px)' : 'rotate(360deg)');
    var css = '@keyframes ' + name + ' { from { transform: ' + from + '; } to { transform: ' + to + '; } }\n' +
      '.box { animation: ' + name + ' ' + dur + 's linear infinite; }';
    return '<div class="box" style="width:44px;height:44px;background:var(--accent2);border-radius:8px;margin:10px auto;animation:' + name + ' ' + dur + 's linear infinite"></div>' +
      '<style>@keyframes ' + name + '{from{transform:' + from + '}to{transform:' + to + '}}</style>' +
      '<code style="font-size:12px;white-space:pre-wrap">' + esc(css) + '</code>';
  });
cssTool('s-filter', 'CSS image filter', [
  { k:'b', label:'blur px', value:'0', type:'number' },{ k:'br', label:'brightness %', value:'100', type:'number' },
  { k:'c', label:'contrast %', value:'100', type:'number' },{ k:'s', label:'saturate %', value:'100', type:'number' }],
  function(v){
    var css = 'filter: blur(' + num(v.b) + 'px) brightness(' + num(v.br) + '%) contrast(' + num(v.c) + '%) saturate(' + num(v.s) + '%);';
    return '<div style="height:70px;border-radius:8px;background:linear-gradient(90deg,#4c8dff,#a855f7,#22c55e);' + css + ';margin-bottom:8px"></div>' +
      '<code style="font-size:12px">' + esc(css) + '</code>';
  });
cssTool('s-transform', 'CSS transform', [
  { k:'r', label:'rotate deg', value:'0', type:'number' },{ k:'s', label:'scale', value:'1', type:'number' },
  { k:'x', label:'translateX px', value:'0', type:'number' }],
  function(v){
    var css = 'transform: rotate(' + num(v.r) + 'deg) scale(' + num(v.s) + ') translateX(' + num(v.x) + 'px);';
    return '<div style="width:60px;height:60px;background:var(--accent2);border-radius:8px;margin:14px auto;' + css + '"></div>' +
      '<code style="font-size:12px">' + esc(css) + '</code>';
  });

/* ================= G. COLOUR TOOLS (8) ================= */
function hex2rgb(h){ h = String(h).replace('#',''); if(h.length === 3){ h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; } var n = parseInt(h,16); return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 }; }
function rgb2hex(r,g,b){ function f(v){ v = Math.max(0,Math.min(255,Math.round(v))); return ('0'+v.toString(16)).slice(-2); } return '#'+f(r)+f(g)+f(b); }
function swatch(hex, label){
  return '<div style="display:inline-block;text-align:center;margin:3px"><div style="width:54px;height:54px;border-radius:8px;background:' + hex + ';border:1px solid var(--line)"></div><code style="font-size:10px">' + (label || hex) + '</code></div>';
}
T.push({ id:'k-shades', n:'Shades aur tints', g:'design', k:'text', fn:function(s){
  var c = hex2rgb((s.match(/#?[0-9a-fA-F]{3,6}/) || ['#4c8dff'])[0]);
  var out = [];
  for(var i = 5; i >= 1; i--){ out.push(swatch(rgb2hex(c.r*(1-i*0.15), c.g*(1-i*0.15), c.b*(1-i*0.15)))); }
  out.push(swatch(rgb2hex(c.r, c.g, c.b), 'base'));
  for(var j = 1; j <= 5; j++){ out.push(swatch(rgb2hex(c.r+(255-c.r)*j*0.15, c.g+(255-c.g)*j*0.15, c.b+(255-c.b)*j*0.15))); }
  return out.join('');
} });
T.push({ id:'k-complement', n:'Complementary colours', g:'design', k:'text', fn:function(s){
  var c = hex2rgb((s.match(/#?[0-9a-fA-F]{3,6}/) || ['#4c8dff'])[0]);
  return swatch(rgb2hex(c.r,c.g,c.b)) + swatch(rgb2hex(255-c.r,255-c.g,255-c.b)) +
    swatch(rgb2hex(c.r*0.5,c.g*0.5,c.b*0.5)) + swatch(rgb2hex(c.r+(255-c.r)*0.5, c.g+(255-c.g)*0.5, c.b+(255-c.b)*0.5));
} });
T.push({ id:'k-mix', n:'Colour mixer', g:'design', k:'form',
  fields:[{ k:'a', label:'colour 1', value:'#4c8dff', type:'text' },{ k:'b', label:'colour 2', value:'#f59e0b', type:'text' },{ k:'p', label:'mix %', value:'50', type:'number' }],
  calc:function(v){
    var a = hex2rgb(v.a), b = hex2rgb(v.b), p = Math.max(0, Math.min(100, num(v.p))) / 100;
    var hex = rgb2hex(a.r+(b.r-a.r)*p, a.g+(b.g-a.g)*p, a.b+(b.b-a.b)*p);
    return swatch(hex) + '<div style="margin-top:6px"><code>' + hex + '</code></div>';
  } });
T.push({ id:'k-random', n:'Random colour', g:'design', k:'text', fn:function(s){
  var n = Math.max(1, Math.min(12, parseInt(s, 10) || 5)), out = [];
  for(var i = 0; i < n; i++){ out.push(swatch(rgb2hex(Math.random()*255, Math.random()*255, Math.random()*255))); }
  return out.join('');
} });
T.push({ id:'k-analog', n:'Analogous colours', g:'design', k:'text', fn:function(s){
  var c = hex2rgb((s.match(/#?[0-9a-fA-F]{3,6}/) || ['#4c8dff'])[0]);
  var out = [swatch(rgb2hex(c.r,c.g,c.b), 'base')];
  for(var i = 1; i <= 3; i++){
    out.push(swatch(rgb2hex(c.r + i*22, c.g - i*8, c.b - i*18)));
    out.push(swatch(rgb2hex(c.r - i*18, c.g + i*12, c.b + i*22)));
  }
  return out.join('');
} });
T.push({ id:'k-triadic', n:'Triadic colours', g:'design', k:'text', fn:function(s){
  var c = hex2rgb((s.match(/#?[0-9a-fA-F]{3,6}/) || ['#4c8dff'])[0]);
  return swatch(rgb2hex(c.r,c.g,c.b), 'base') +
    swatch(rgb2hex(c.b, c.r, c.g)) + swatch(rgb2hex(c.g, c.b, c.r));
} });
T.push({ id:'k-gradientstops', n:'Gradient stops', g:'design', k:'form',
  fields:[{ k:'a', label:'colour 1', value:'#4c8dff', type:'text' },{ k:'b', label:'colour 2', value:'#22c55e', type:'text' },{ k:'n', label:'stops', value:'5', type:'number' }],
  calc:function(v){
    var a = hex2rgb(v.a), b = hex2rgb(v.b), n = Math.max(2, Math.min(10, num(v.n)));
    var stops = [], out = [];
    for(var i = 0; i < n; i++){
      var p = i/(n-1);
      var hex = rgb2hex(a.r+(b.r-a.r)*p, a.g+(b.g-a.g)*p, a.b+(b.b-a.b)*p);
      stops.push(hex + ' ' + Math.round(p*100) + '%');
      out.push(swatch(hex));
    }
    var css = 'linear-gradient(90deg, ' + stops.join(', ') + ')';
    return '<div style="height:40px;border-radius:8px;background:' + css + ';margin-bottom:6px"></div><div>' + out.join('') + '</div><code style="font-size:11px;word-break:break-all">' + esc(css) + '</code>';
  } });
T.push({ id:'k-name', n:'Colour name finder', g:'design', k:'text', fn:function(s){
  var named = { black:'#000000', white:'#ffffff', red:'#ff0000', lime:'#00ff00', blue:'#0000ff', yellow:'#ffff00', cyan:'#00ffff', magenta:'#ff00ff', silver:'#c0c0c0', gray:'#808080', maroon:'#800000', olive:'#808000', green:'#008000', purple:'#800080', teal:'#008080', navy:'#000080', orange:'#ffa500', pink:'#ffc0cb', gold:'#ffd700', brown:'#a52a2a', violet:'#ee82ee', indigo:'#4b0082', tomato:'#ff6347', salmon:'#fa8072', khaki:'#f0e68c', coral:'#ff7f50', crimson:'#dc143c', turquoise:'#40e0d0', beige:'#f5f5dc', lavender:'#e6e6fa' };
  var c = hex2rgb((s.match(/#?[0-9a-fA-F]{3,6}/) || ['#4c8dff'])[0]);
  var best = '', bd = 1e9;
  Object.keys(named).forEach(function(k){
    var t = hex2rgb(named[k]);
    var d = Math.pow(t.r-c.r,2) + Math.pow(t.g-c.g,2) + Math.pow(t.b-c.b,2);
    if(d < bd){ bd = d; best = k; }
  });
  return 'sabse kareeb: ' + best + ' (' + named[best] + ')' + swatch(named[best]);
} });

/* ================= H. DEV HELPERS (12) ================= */
T.push({ id:'v-gitignore', n:'.gitignore generator', g:'web', k:'form',
  fields:[{ k:'t', label:'type (node/python/android/flutter/php)', value:'node', type:'text' }],
  calc:function(v){
    var map = {
      node: ['node_modules/', 'dist/', '.env', '.DS_Store', 'npm-debug.log*', 'coverage/'],
      python: ['__pycache__/', '*.pyc', '.venv/', '.env', '*.egg-info/', '.pytest_cache/'],
      android: ['*.iml', '.gradle/', 'local.properties', 'build/', '.idea/', 'captures/'],
      flutter: ['.dart_tool/', 'build/', '.packages', '.flutter-plugins', 'ios/Pods/'],
      php: ['vendor/', '.env', 'storage/logs/', '*.log', '.phpunit.result.cache']
    };
    var key = (v.t || 'node').trim().toLowerCase();
    return '<pre style="background:#0b0e12;padding:10px;border-radius:8px;font-size:12px;overflow:auto">' + esc((map[key] || map.node).join('\n')) + '</pre>';
  } });
T.push({ id:'v-robots', n:'robots.txt generator', g:'web', k:'form',
  fields:[{ k:'s', label:'sitemap URL', value:'https://example.com/sitemap.xml', type:'text' },{ k:'a', label:'allow all? (yes/no)', value:'yes', type:'text' }],
  calc:function(v){
    var txt = 'User-agent: *\n' + ((v.a || 'yes').toLowerCase().indexOf('n') === 0 ? 'Disallow: /private/\nDisallow: /admin/' : 'Allow: /') + '\n\nSitemap: ' + (v.s || '') + '\n';
    return '<pre style="background:#0b0e12;padding:10px;border-radius:8px;font-size:12px">' + esc(txt) + '</pre>';
  } });
T.push({ id:'v-metatags', n:'Meta tags generator', g:'web', k:'form',
  fields:[{ k:'t', label:'title', value:'My Page', type:'text' },{ k:'d', label:'description', value:'', type:'text' },{ k:'u', label:'URL', value:'https://example.com', type:'text' }],
  calc:function(v){
    var out = '<title>' + esc(v.t || '') + '</title>\n' +
      '<meta name="description" content="' + esc(v.d || '') + '">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<link rel="canonical" href="' + esc(v.u || '') + '">';
    return '<pre style="background:#0b0e12;padding:10px;border-radius:8px;font-size:12px;overflow:auto">' + esc(out) + '</pre>';
  } });
T.push({ id:'v-ogtags', n:'Open Graph tags', g:'web', k:'form',
  fields:[{ k:'t', label:'title', value:'My Page', type:'text' },{ k:'d', label:'description', value:'', type:'text' },{ k:'i', label:'image URL', value:'https://example.com/cover.jpg', type:'text' },{ k:'u', label:'URL', value:'https://example.com', type:'text' }],
  calc:function(v){
    var out = '<meta property="og:type" content="website">\n' +
      '<meta property="og:title" content="' + esc(v.t || '') + '">\n' +
      '<meta property="og:description" content="' + esc(v.d || '') + '">\n' +
      '<meta property="og:image" content="' + esc(v.i || '') + '">\n' +
      '<meta property="og:url" content="' + esc(v.u || '') + '">\n' +
      '<meta name="twitter:card" content="summary_large_image">';
    return '<pre style="background:#0b0e12;padding:10px;border-radius:8px;font-size:12px;overflow:auto">' + esc(out) + '</pre>';
  } });
T.push({ id:'v-tsinterface', n:'JSON → TypeScript', g:'web', k:'text', fn:function(s){
  try{
    var o = JSON.parse(s);
    function type(v, name){
      if(Array.isArray(v)){ return type(v[0] || {}, name) + '[]'; }
      if(v && typeof v === 'object'){
        var lines = Object.keys(v).map(function(k){ return '  ' + k + ': ' + type(v[k], k) + ';'; });
        return '{\n' + lines.join('\n') + '\n}';
      }
      if(typeof v === 'number'){ return 'number'; }
      if(typeof v === 'boolean'){ return 'boolean'; }
      return 'string';
    }
    return 'export interface Root ' + type(o, 'Root');
  }catch(e){ return 'JSON galat hai: ' + e.message; }
} });
T.push({ id:'v-gostruct', n:'JSON → Go struct', g:'web', k:'text', fn:function(s){
  try{
    var o = JSON.parse(s);
    function go(v, name){
      if(Array.isArray(v)){ return '[]' + go(v[0] || {}, name); }
      if(v && typeof v === 'object'){
        return 'struct {\n' + Object.keys(v).map(function(k){
          return '\t' + k.charAt(0).toUpperCase() + k.slice(1) + ' ' + go(v[k], k) + ' `json:"' + k + '"`';
        }).join('\n') + '\n}';
      }
      if(typeof v === 'number'){ return 'float64'; }
      if(typeof v === 'boolean'){ return 'bool'; }
      return 'string';
    }
    return 'type Root ' + go(o, 'Root');
  }catch(e){ return 'JSON galat hai: ' + e.message; }
} });
T.push({ id:'v-pyclass', n:'JSON → Python dataclass', g:'web', k:'text', fn:function(s){
  try{
    var o = JSON.parse(s);
    function py(v){
      if(Array.isArray(v)){ return 'List[' + py(v[0] || '') + ']'; }
      if(v && typeof v === 'object'){ return 'dict'; }
      if(typeof v === 'number'){ return 'float'; }
      if(typeof v === 'boolean'){ return 'bool'; }
      return 'str';
    }
    var lines = Object.keys(o).map(function(k){ return '    ' + k + ': ' + py(o[k]); });
    return 'from dataclasses import dataclass\nfrom typing import List, Dict\n\n@dataclass\nclass Root:\n' + lines.join('\n');
  }catch(e){ return 'JSON galat hai: ' + e.message; }
} });
T.push({ id:'v-jsonsql', n:'JSON → CREATE TABLE', g:'web', k:'text', fn:function(s){
  try{
    var o = JSON.parse(s);
    var row = Array.isArray(o) ? o[0] : o;
    var cols = Object.keys(row).map(function(k){
      var v = row[k];
      var t = typeof v === 'number' ? 'REAL' : (typeof v === 'boolean' ? 'INTEGER' : 'TEXT');
      return '  ' + k + ' ' + t;
    });
    return 'CREATE TABLE my_table (\n  id INTEGER PRIMARY KEY,\n' + cols.join(',\n') + '\n);';
  }catch(e){ return 'JSON galat hai: ' + e.message; }
} });
T.push({ id:'v-curlfetch', n:'cURL → fetch()', g:'web', k:'text', fn:function(s){
  var url = (s.match(/https?:\/\/[^\s'"]+/) || [''])[0];
  if(!url){ return 'cURL command paste kijiye.'; }
  var method = (s.match(/-X\s+(\w+)/i) || [null, 'GET'])[1].toUpperCase();
  var headers = [], re = /-H\s+['"]([^'"]+)['"]/g, m;
  while((m = re.exec(s))){ headers.push(m[1]); }
  var body = (s.match(/-d\s+['"]([\s\S]*?)['"]/i) || [null, null])[1];
  var out = 'fetch("' + url + '", {\n  method: "' + method + '"' +
    (headers.length ? ',\n  headers: {\n' + headers.map(function(h){
      var i = h.indexOf(':');
      return '    "' + h.slice(0,i).trim() + '": "' + h.slice(i+1).trim() + '"';
    }).join(',\n') + '\n  }' : '') +
    (body ? ',\n  body: ' + JSON.stringify(body) : '') +
    '\n}).then(r => r.json()).then(console.log);';
  return '<pre style="background:#0b0e12;padding:10px;border-radius:8px;font-size:12px;overflow:auto">' + esc(out) + '</pre>';
} });
T.push({ id:'v-htmlboiler', n:'HTML boilerplate', g:'web', k:'form',
  fields:[{ k:'t', label:'title', value:'My Page', type:'text' },{ k:'l', label:'lang', value:'en', type:'text' }],
  calc:function(v){
    var out = '<!DOCTYPE html>\n<html lang="' + esc(v.l || 'en') + '">\n<head>\n' +
      '  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '  <title>' + esc(v.t || '') + '</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n\n  <h1>' + esc(v.t || '') + '</h1>\n\n  <script src="app.js"><\/script>\n</body>\n</html>';
    return '<pre style="background:#0b0e12;padding:10px;border-radius:8px;font-size:12px;overflow:auto">' + esc(out) + '</pre>';
  } });
T.push({ id:'v-htaccess', n:'.htaccess redirect', g:'web', k:'form',
  fields:[{ k:'f', label:'from (path)', value:'/old-page', type:'text' },{ k:'t', label:'to (URL)', value:'https://example.com/new-page', type:'text' }],
  calc:function(v){
    var out = 'Redirect 301 ' + (v.f || '/') + ' ' + (v.t || '/') + '\n\n' +
      '# https force\nRewriteEngine On\nRewriteCond %{HTTPS} off\nRewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]';
    return '<pre style="background:#0b0e12;padding:10px;border-radius:8px;font-size:12px;overflow:auto">' + esc(out) + '</pre>';
  } });
T.push({ id:'v-secret', n:'Random secret key', g:'util', k:'form',
  fields:[{ k:'n', label:'length', value:'32', type:'number' }],
  calc:function(v){
    var len = Math.max(8, Math.min(128, num(v.n) || 32));
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    var arr = new Uint8Array(len), out = '';
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(arr) : arr.forEach(function(x, i){ arr[i] = Math.floor(Math.random()*256); });
    for(var i = 0; i < len; i++){ out += chars[arr[i] % chars.length]; }
    return '<code style="font-size:14px;word-break:break-all">' + out + '</code>';
  } });

T.push({ id:'x-comma', n:'Lines → comma list', g:'text', k:'text', fn:function(s){
  return s.split('\n').map(function(l){ return l.trim(); }).filter(Boolean).map(function(l){
    return /[",]/.test(l) ? '"' + l.replace(/"/g, '""') + '"' : l;
  }).join(', ');
} });

/* ================= RENDER ================= */
function panel(t){ return '<section id="t-' + t.id + '" class="tool"></section>'; }

function textPanel(t){
  return '<section id="t-' + t.id + '" class="tool"><h2>' + t.n + '</h2>' +
    '<p class="desc">Enter text — instant result. All in your browser.</p>' +
    '<textarea id="' + t.id + '-in" style="height:110px" oninput="ntRun(\'' + t.id + '\')" placeholder="Type here..."></textarea>' +
    (t.k === 'pair' ? '<div class="row"><input type="text" id="' + t.id + '-p" placeholder="' + (t.b || '') + '" style="flex:1" oninput="ntRun(\'' + t.id + '\')"></div>' : '') +
    '<div class="row"><button class="act" onclick="ntRun(\'' + t.id + '\')">Chalao</button>' +
    '<button class="act" onclick="ntCopy(\'' + t.id + '\')">Copy</button>' +
    '<button class="act clear-btn" onclick="ntClear(\'' + t.id + '\')">Clear</button></div>' +
    '<div id="' + t.id + '-out" style="font-size:13px;line-height:1.7;word-break:break-word"></div></section>';
}
function formPanel(t){
  var fields = t.fields.map(function(f){
    return '<div class="row"><span class="lbl" style="width:auto">' + f.label + '</span>' +
      '<input type="' + (f.type || 'text') + '" id="' + t.id + '-' + f.k + '" value="' + (f.value || '') + '" style="width:140px" oninput="ntCalc(\'' + t.id + '\')"></div>';
  }).join('');
  return '<section id="t-' + t.id + '" class="tool"><h2>' + t.n + '</h2>' +
    '<p class="desc">Values bhariye — result turant.</p>' + fields +
    '<div class="row"><button class="act" onclick="ntCalc(\'' + t.id + '\')">Extract</button></div>' +
    '<div id="' + t.id + '-out" style="font-size:13px;line-height:1.8;word-break:break-word"></div></section>';
}
function convPanel(t){
  var opts = Object.keys(t.units).map(function(u){ return '<option value="' + u + '">' + u + '</option>'; }).join('');
  return '<section id="t-' + t.id + '" class="tool"><h2>' + t.n + '</h2>' +
    '<p class="desc">Choose a value and units — instant conversion.</p>' +
    '<div class="row"><input type="number" id="' + t.id + '-v" value="1" style="width:120px" oninput="ntConv(\'' + t.id + '\')">' +
    '<select id="' + t.id + '-f" onchange="ntConv(\'' + t.id + '\')">' + opts + '</select>' +
    '<span class="lbl">→</span>' +
    '<select id="' + t.id + '-t" onchange="ntConv(\'' + t.id + '\')">' + opts + '</select></div>' +
    '<div id="' + t.id + '-out" style="font-size:15px;line-height:1.8"></div></section>';
}

function build(){
  var main = document.querySelector('main');
  if(!main || document.getElementById('t-' + T[0].id)){ return; }
  var html = '';
  T.forEach(function(t){
    html += (t.k === 'form' ? formPanel(t) : (t.k === 'conv' ? convPanel(t) : textPanel(t)));
  });
  main.insertAdjacentHTML('beforeend', html);

  var byGroup = {};
  T.forEach(function(t){ (byGroup[t.g] = byGroup[t.g] || []).push(t); });
  Object.keys(byGroup).forEach(function(g){
    var el = document.getElementById('g-' + g);
    if(!el){ return; }
    byGroup[g].forEach(function(t){
      el.insertAdjacentHTML('beforeend', '<button class="nav" onclick="openTool(\'' + t.id + '\',this)">' + t.n + '</button>');
    });
    var cnt = document.querySelector('[data-g="' + g + '"] .count');
    if(cnt){ cnt.textContent = String(el.querySelectorAll('.nav').length); }
  });
}

var MAP = {};
T.forEach(function(t){ MAP[t.id] = t; });

window.ntRun = function(id){
  var t = MAP[id];
  if(!t || t.k === 'form' || t.k === 'conv'){ return; }
  var inp = document.getElementById(id + '-in'), out = document.getElementById(id + '-out');
  if(!inp || !out){ return; }
  try{
    var extra = document.getElementById(id + '-p');
    var val = (t.k === 'pair') ? t.fn(inp.value, extra ? extra.value : '') : t.fn(inp.value);
    out.innerHTML = (String(val).indexOf('<') === 0) ? val : '<pre style="white-space:pre-wrap;margin:0;font-size:13px">' + String(val).replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</pre>';
  }catch(e){ out.textContent = 'Dikkat: ' + e.message; }
};
window.ntCalc = function(id){
  var t = MAP[id];
  if(!t || t.k !== 'form'){ return; }
  var v = {};
  t.fields.forEach(function(f){ var el = document.getElementById(id + '-' + f.k); v[f.k] = el ? el.value : ''; });
  var out = document.getElementById(id + '-out');
  if(out){ try{ out.innerHTML = t.calc(v); }catch(e){ out.innerHTML = 'Dikkat: ' + e.message; } }
};
window.ntConv = function(id){
  var t = MAP[id];
  if(!t || t.k !== 'conv'){ return; }
  var valEl = document.getElementById(id + '-v'), fEl = document.getElementById(id + '-f'), tEl = document.getElementById(id + '-t'), out = document.getElementById(id + '-out');
  if(!valEl || !fEl || !tEl || !out){ return; }
  var v = parseFloat(valEl.value) || 0, from = fEl.value, to = tEl.value;
  var res;
  if(t.note === 'special'){
    var c;
    if(from === 'Celsius'){ c = v; } else if(from === 'Fahrenheit'){ c = (v - 32) * 5/9; } else { c = v - 273.15; }
    if(to === 'Celsius'){ res = c; } else if(to === 'Fahrenheit'){ res = c * 9/5 + 32; } else { res = c + 273.15; }
  } else if(t.id === 'u-fuel'){
    /* fuel: base = km/l */
    var kml;
    if(from === 'km per litre'){ kml = v; }
    else if(from === 'litre per 100 km'){ kml = v ? 100/v : 0; }
    else { kml = v * t.units[from]; }
    if(to === 'km per litre'){ res = kml; }
    else if(to === 'litre per 100 km'){ res = kml ? 100/kml : 0; }
    else { res = kml / t.units[to]; }
  } else {
    res = v * t.units[from] / t.units[to];
  }
  out.innerHTML = '<b style="font-size:20px">' + (Math.abs(res) < 0.001 && res !== 0 ? res.toExponential(4) : (Math.round(res * 1e6) / 1e6)) + '</b> <span class="lbl">' + esc(to) + '</span>' +
    '<div class="lbl" style="margin-top:4px">' + v + ' ' + esc(from) + ' = ' + res + ' ' + esc(to) + '</div>';
};
window.ntCopy = function(id){
  var out = document.getElementById(id + '-out');
  if(!out){ return; }
  var ta = document.createElement('textarea');
  ta.value = out.textContent; document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); }catch(e){}
  document.body.removeChild(ta);
};
window.ntClear = function(id){
  var inp = document.getElementById(id + '-in'), out = document.getElementById(id + '-out');
  if(inp){ inp.value = ''; }
  if(out){ out.innerHTML = ''; }
};

build();

})();

/* ===== minecraft ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

/* ===================================================================
   MINECRAFT PAINTING CREATOR — Bedrock .mcpack + Java .zip
   Asli pack structure, apna ZIP writer, koi server nahi
   =================================================================== */
(function(){

function $(id){ return document.getElementById(id); }
function esc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function st(msg, cls){ var e = $('mc-st'); if(e){ e.textContent = msg || ''; e.className = 'status ' + (cls || ''); } }

/* ---------------- ZIP writer ---------------- */
var CRC = (function(){
  var t = new Uint32Array(256);
  for(var n = 0; n < 256; n++){ var c = n; for(var k = 0; k < 8; k++){ c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); } t[n] = c >>> 0; }
  return t;
})();
function crc32(b){ var c = 0xFFFFFFFF; for(var i = 0; i < b.length; i++){ c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); } return (c ^ 0xFFFFFFFF) >>> 0; }
function u16(v){ return [v & 255, (v >> 8) & 255]; }
function u32(v){ return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; }
function makeZip(files){
  var chunks = [], central = [], off = 0;
  var d = new Date();
  var dt = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
  var dd = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  files.forEach(function(f){
    var nm = new TextEncoder().encode(f.name), data = f.data, c = crc32(data);
    var loc = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(dt), u16(dd), u32(c), u32(data.length), u32(data.length), u16(nm.length), u16(0));
    chunks.push(new Uint8Array(loc), nm, data);
    central.push({ nm: nm, c: c, s: data.length, o: off });
    off += loc.length + nm.length + data.length;
  });
  var cs = off, csize = 0;
  central.forEach(function(c){
    var rec = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(dt), u16(dd), u32(c.c), u32(c.s), u32(c.s), u16(c.nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.o));
    chunks.push(new Uint8Array(rec), c.nm);
    csize += rec.length + c.nm.length;
  });
  chunks.push(new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(csize), u32(cs), u16(0))));
  var total = chunks.reduce(function(a, c){ return a + c.length; }, 0);
  var out = new Uint8Array(total), p = 0;
  chunks.forEach(function(c){ out.set(c, p); p += c.length; });
  return new Blob([out], { type: 'application/zip' });
}
function uuid(){
  if(window.crypto && crypto.randomUUID){ return crypto.randomUUID(); }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
    var r = Math.random() * 16 | 0;
    return (c === 'x' ? r : ((r & 3) | 8)).toString(16);
  });
}

/* ---------------- state ---------------- */
var M = {
  edition: 'bedrock',
  name: 'My Paintings',
  desc: 'Custom paintings pack',
  javaFmt: '34',
  icon: null,          /* {img} */
  items: [],           /* {id, name, w, h, img, url} */
  seq: 1
};
var SIZES = [[1,1],[1,2],[2,1],[2,2],[3,3],[3,4],[4,2],[4,3],[4,4]];

/* ---- vanilla paintings: classic ones live inside textures/painting/kz.png ----
   x,y = position in 16x16 "block cells" of the vanilla atlas. */
var CLASSIC = [
  { n:'kebab',          w:1, h:1, x:0,  y:0  },
  { n:'aztec',          w:1, h:1, x:1,  y:0  },
  { n:'alban',          w:1, h:1, x:2,  y:0  },
  { n:'aztec2',         w:1, h:1, x:3,  y:0  },
  { n:'bomb',           w:1, h:1, x:4,  y:0  },
  { n:'plant',          w:1, h:1, x:5,  y:0  },
  { n:'wasteland',      w:1, h:1, x:6,  y:0  },
  { n:'pool',           w:2, h:1, x:0,  y:2  },
  { n:'courbet',        w:2, h:1, x:2,  y:2  },
  { n:'sea',            w:2, h:1, x:4,  y:2  },
  { n:'sunset',         w:2, h:1, x:6,  y:2  },
  { n:'creebet',        w:2, h:1, x:8,  y:2  },
  { n:'wanderer',       w:1, h:2, x:0,  y:4  },
  { n:'graham',         w:1, h:2, x:1,  y:4  },
  { n:'fighters',       w:4, h:2, x:0,  y:6  },
  { n:'match',          w:2, h:2, x:0,  y:8  },
  { n:'bust',           w:2, h:2, x:2,  y:8  },
  { n:'stage',          w:2, h:2, x:4,  y:8  },
  { n:'void',           w:2, h:2, x:6,  y:8  },
  { n:'skull_and_roses',w:2, h:2, x:8,  y:8  },
  { n:'wither',         w:2, h:2, x:10, y:8  },
  { n:'skeleton',       w:4, h:3, x:12, y:4  },
  { n:'donkey_kong',    w:4, h:3, x:12, y:7  },
  { n:'pointer',        w:4, h:4, x:0,  y:12 },
  { n:'pigscene',       w:4, h:4, x:4,  y:12 },
  { n:'burning_skull',  w:4, h:4, x:8,  y:12 }
];

/* ---- 1.21+ paintings: apni alag file (textures/painting/<name>.png) ---- */
var MODERN = [
  { n:'meditative',   w:1, h:1 },
  { n:'prairie_ride', w:1, h:2 },
  { n:'baroque',      w:2, h:2 },
  { n:'humble',       w:2, h:2 },
  { n:'bouquet',      w:3, h:3 },
  { n:'cavebird',     w:3, h:3 },
  { n:'cotan',        w:3, h:3 },
  { n:'endboss',      w:3, h:3 },
  { n:'fern',         w:3, h:3 },
  { n:'owlemons',     w:3, h:3 },
  { n:'sunflowers',   w:3, h:3 },
  { n:'tides',        w:3, h:3 },
  { n:'backyard',     w:3, h:4 },
  { n:'pond',         w:3, h:4 },
  { n:'changing',     w:4, h:2 },
  { n:'finding',      w:4, h:2 },
  { n:'lowmist',      w:4, h:2 },
  { n:'passage',      w:4, h:2 },
  { n:'orb',          w:4, h:4 },
  { n:'unpacked',     w:4, h:4 }
];

/* vanilla kz.png (256x256) — pack ka base, taaki jo size aapne nahi chuna
   wo painting vanilla hi rahe (purple "missing texture" na dikhe). */
var VANILLA_KZ = 'data:image/png;base64,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';

function slotsFor(w, h){
  var out = CLASSIC.filter(function(c){ return c.w === w && c.h === h; })
    .map(function(c){ return { n:c.n, x:c.x, y:c.y }; });
  MODERN.filter(function(m){ return m.w === w && m.h === h; })
    .forEach(function(m){ out.push({ n:m.n, x:null, y:null }); });
  return out;
}

/* har size ke liye max images = us size ke kitne vanilla slots hain */
function sizeKey(w, h){ return w + 'x' + h; }
function sizeLimit(w, h){ return slotsFor(w, h).length; }
function sizeCount(w, h){
  return M.items.filter(function(x){ return x.w === w && x.h === h; }).length;
}
function sizeLeft(w, h){ var lim = sizeLimit(w, h); return lim ? Math.max(0, lim - sizeCount(w, h)) : 0; }

function loadImage(src){
  return new Promise(function(res, rej){
    var im = new Image();
    im.onload = function(){ res(im); };
    im.onerror = function(){ rej(new Error('image load fail')); };
    im.src = src;
  });
}

function pngBytes(canvas){
  /* toDataURL se seedha bytes — koi async callback nahi, isliye kabhi atakta nahi */
  var d = canvas.toDataURL('image/png');
  var bin = atob(d.split(',')[1] || '');
  var arr = new Uint8Array(bin.length);
  for(var i = 0; i < bin.length; i++){ arr[i] = bin.charCodeAt(i); }
  return Promise.resolve(arr);
}

/* image → canvas of exact px, cover crop (stretch/distort kabhi nahi) */
function imgW(img){ return img ? (img.naturalWidth || img.width || 0) : 0; }
function imgH(img){ return img ? (img.naturalHeight || img.height || 0) : 0; }
function fitCanvas(img, w, h){
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w || 1));
  c.height = Math.max(1, Math.round(h || 1));
  var ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  if('imageSmoothingQuality' in ctx){ ctx.imageSmoothingQuality = 'high'; }
  var iw = imgW(img), ih = imgH(img);
  if(!iw || !ih){ return c; }                 /* khaali image par crash nahi */
  var s = Math.max(c.width / iw, c.height / ih);
  var dw = iw * s, dh = ih * s;
  ctx.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
  return c;
}

/* chhoti copy — browser storage mein rakhne ke liye (band karne par bhi bacha rahe) */
function storeCopy(img, maxPx){
  maxPx = maxPx || 384;
  var iw = imgW(img), ih = imgH(img);
  if(!iw || !ih){ return ''; }
  var sc = Math.min(1, maxPx / Math.max(iw, ih));
  var c = fitCanvas(img, Math.max(1, Math.round(iw * sc)), Math.max(1, Math.round(ih * sc)));
  var d = '';
  try{ d = c.toDataURL('image/webp', 0.9); }catch(e){ d = ''; }
  if(!/^data:image\/webp/i.test(d)){
    try{ d = c.toDataURL('image/png'); }catch(e2){ d = ''; }
  }
  return d;
}

/* ---------------- save / restore ---------------- */
var STORE_KEY = 'dt-mc-paintings-v1';
function saveState(){
  try{
    var items = M.items.map(function(x){
      return { id: x.id, name: x.name, w: x.w, h: x.h, iw: x.iw || 0, ih: x.ih || 0, src: x.src || '' };
    });
    var nm = $('mc-name');
    window.localStorage.setItem(STORE_KEY, JSON.stringify({
      seq: M.seq, items: items, pack: nm ? nm.value : '', edition: M.edition
    }));
    return true;
  }catch(e){ return false; }
}
function loadState(){
  var raw = null;
  try{ raw = window.localStorage.getItem(STORE_KEY); }catch(e){ return; }
  if(!raw){ return; }
  var d = null;
  try{ d = JSON.parse(raw); }catch(e){ return; }
  if(!d || !d.items || !d.items.length){ return; }
  M.seq = d.seq || (d.items.length + 1);
  if(d.edition === 'java' || d.edition === 'bedrock'){ M.edition = d.edition; }
  M.items = d.items.map(function(x){
    return { id: x.id, name: x.name, w: Math.max(1, x.w | 0), h: Math.max(1, x.h | 0),
             iw: x.iw || 0, ih: x.ih || 0, img: null, url: '', src: x.src || '' };
  });
  var nm = $('mc-name');
  if(nm && d.pack){ nm.value = d.pack; }
  renderList();
  M.items.forEach(function(it){
    if(!it.src){ return; }
    var im = new Image();
    im.onload = function(){
      it.img = im;
      it.iw = imgW(im); it.ih = imgH(im);
      it.url = fitCanvas(im, Math.max(64, it.w * 32), Math.max(64, it.h * 32)).toDataURL('image/png');
      renderList();
    };
    im.onerror = function(){ it.src = ''; };
    im.src = it.src;
  });
}

/* ---------------- rendering ---------------- */
function renderSizes(){
  var box = $('mc-sizes');
  if(!box){ return; }
  box.innerHTML = SIZES.map(function(s){
    var lim = sizeLimit(s[0], s[1]), used = sizeCount(s[0], s[1]);
    var full = lim && used >= lim;
    return '<button class="act mc-size' + (full ? ' mc-full' : '') + '" data-w="' + s[0] + '" data-h="' + s[1] + '"' +
      ' title="' + used + '/' + lim + ' images' + (full ? ' — limit poori' : '') + '"' +
      ' onclick="mcAdd(' + s[0] + ',' + s[1] + ')">' + s[0] + '×' + s[1] + '</button>';
  }).join('') +
  /* size grid ke saath hi pack icon button */
  '<button class="act mc-size mc-iconbtn" type="button" title="Pack icon (256×256)"' +
    ' onclick="document.getElementById(\'mc-iconfile\').click()">' +
    '<img id="mc-iconprev" alt="" style="display:' + (M.iconUrl ? 'block' : 'none') + '"' +
      (M.iconUrl ? ' src="' + M.iconUrl + '"' : '') + '>' +
    '<span>Pack icon</span></button>';
  renderLimits();
}

/* limit wali line — har size ka used/max */
function renderLimits(){
  var el = $('mc-limits');
  if(!el){ return; }
  el.innerHTML = 'Image limit: ' + SIZES.map(function(s){
    var used = sizeCount(s[0], s[1]), lim = sizeLimit(s[0], s[1]);
    var full = lim && used >= lim;
    return '<span style="white-space:nowrap' + (full ? ';color:#3ddc6b' : '') + '">' + s[0] + '×' + s[1] + ' ' + used + '/' + lim + '</span>';
  }).join(' &nbsp;·&nbsp; ');
}

function renderList(){
  var box = $('mc-list');
  if(!box){ return; }
  if(!M.items.length){
    box.innerHTML = '<div class="lbl">No paintings yet — pick a size above to add one</div>';
    renderLimits(); renderSizes();
    return;
  }
  box.innerHTML = M.items.map(function(it){
    var tip = (it.iw && it.ih ? it.iw + '×' + it.ih + ' px · ' : '') + it.w + '×' + it.h + ' blocks';
    var thumb = it.url
      ? '<img src="' + it.url + '" alt="" title="' + tip + '">'
      : '<span class="mc-noph">+</span>';
    return '<div class="mc-card">' +
      '<div class="mc-thumb">' + thumb + '</div>' +
      '<div class="mc-size-lbl">' + it.w + '×' + it.h + '</div>' +
      '<div class="mc-acts">' +
        '<button class="act" onclick="mcDup(\'' + it.id + '\')" title="duplicate">⧉</button>' +
        '<button class="act" onclick="mcDel(\'' + it.id + '\')" title="delete">✕</button>' +
      '</div>' +
    '</div>';
  }).join('');
  renderLimits();
  renderSizes();
}

window.mcEdition = function(e){
  M.edition = e;
  document.querySelectorAll('.mc-ed').forEach(function(b){ b.classList.toggle('pri', b.dataset.ed === e); });
  var jf = $('mc-java-ver');
  if(jf){ jf.style.display = e === 'java' ? '' : 'none'; }
  saveState();
  st('Edition: ' + (e === 'bedrock' ? 'Bedrock' : 'Java') + ' — export format badal gaya.', 'ok');
};

window.mcAdd = function(w, h){
  w = Math.max(1, Math.min(16, parseInt(w, 10) || 1));
  h = Math.max(1, Math.min(16, parseInt(h, 10) || 1));
  var lim = sizeLimit(w, h), left = sizeLeft(w, h);
  if(lim && left <= 0){
    st(w + '×' + h + ' ki limit poori hai — ' + lim + ' images se zyada nahi. Pehle koi painting delete kijiye.', 'bad');
    return;
  }
  var it = { id: 'p' + (M.seq++), name: 'painting' + M.seq, w: w, h: h,
             img: null, url: '', src: '', iw: 0, ih: 0 };
  M.items.push(it);
  renderList();
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.multiple = true;                       /* ek saath kai images chun sakte hain */
  inp.accept = 'image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp,image/*';
  inp.onchange = function(){
    var files = inp.files ? [].slice.call(inp.files) : [];
    if(!files.length){ return; }
    /* limit ke andar hi images lenge */
    var canTake = sizeLeft(w, h) + 1;          /* is card ko count karke */
    if(lim && files.length > canTake){
      var cut = files.length;
      files = files.slice(0, canTake);
      setTimeout(function(){
        st(w + '×' + h + ' ki limit ' + lim + ' images hai — aapne ' + cut + ' chuni thi, sirf ' + canTake + ' li gayi.', 'bad');
      }, 1400);
    }
    /* pehli image isi card mein, baaki ke liye usi size ke naye cards */
    mcSetImage(it.id, files[0]);
    for(var k = 1; k < files.length; k++){
      var extra = { id: 'p' + (M.seq++), name: 'painting' + M.seq, w: w, h: h,
                    img: null, url: '', src: '', iw: 0, ih: 0 };
      M.items.push(extra);
      mcSetImage(extra.id, files[k]);
    }
    if(files.length > 1){ renderList(); }
  };
  inp.oncancel = function(){                 /* user ne cancel kiya — khaali card na rahe */
    M.items = M.items.filter(function(x){ return x.id !== it.id; });
    renderList();
    saveState();
  };
  inp.click();
};

window.mcCustom = function(){
  var w = parseInt(($('mc-cw') || {}).value, 10) || 2;
  var h = parseInt(($('mc-ch') || {}).value, 10) || 2;
  if(w < 1 || h < 1 || w > 16 || h > 16){ st('Width aur height 1 se 16 ke beech rakhiye.', 'bad'); return; }
  mcAdd(w, h);
};

window.mcSetImage = function(id, file){
  var it = M.items.filter(function(x){ return x.id === id; })[0];
  if(!it){ return; }
  if(!file){ return; }
  /* MIME khaali bhi aa sakta hai (Android/iOS picker) — extension se bhi pehchano */
  var typeOk = /^image\//.test(file.type || '');
  var nameOk = /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name || '');
  if(!typeOk && !nameOk){ st('Ye image file nahi hai — PNG, JPG ya WEBP chuniye.', 'bad'); return; }
  if(file.size > 12 * 1024 * 1024){ st('Image 12 MB se badi hai.', 'bad'); return; }
  st('Image padhi ja rahi hai...', 'info');
  var fr = new FileReader();
  fr.onerror = function(){ st('File padhi nahi ja saki — dobara try kijiye.', 'bad'); };
  fr.onload = function(){
    var img = new Image();
    img.decoding = 'sync';
    img.onload = function(){
      try{
        var iw = imgW(img), ih = imgH(img);
        if(!iw || !ih){ st('Image khaali nikli — dusri file try kijiye.', 'bad'); return; }
        it.img = img;
        it.iw = iw; it.ih = ih;
        /* gallery thumb — 1x1 bhi saaf dikhe (32px per block) */
        it.url = fitCanvas(img, Math.max(64, it.w * 32), Math.max(64, it.h * 32)).toDataURL('image/png');
        it.src = storeCopy(img, 384);
        renderList();
        var saved = saveState();
        st(file.name + ' lag gayi — ' + iw + '×' + ih + ' px, painting ' + it.w + '×' + it.h +
           ' block' + (saved ? '' : ' (browser storage full — save nahi hui)'), 'ok');
      }catch(err){
        st('Image process nahi hui: ' + err.message, 'bad');
      }
    };
    img.onerror = function(){ st('Image khul nahi paayi — PNG / JPG / WEBP file chuniye.', 'bad'); };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
};

window.mcRename = function(id, v){
  M.items.forEach(function(x){ if(x.id === id){ x.name = v; } });
  saveState();
};
window.mcDel = function(id){
  M.items = M.items.filter(function(x){ return x.id !== id; });
  renderList();
  saveState();
  st('Painting hata di.', 'info');
};
window.mcDup = function(id){
  var it = M.items.filter(function(x){ return x.id === id; })[0];
  if(!it){ return; }
  if(sizeLimit(it.w, it.h) && sizeLeft(it.w, it.h) <= 0){
    st(it.w + '×' + it.h + ' ki limit ' + sizeLimit(it.w, it.h) + ' images hai — duplicate nahi ban sakta.', 'bad');
    return;
  }
  M.items.push({ id: 'p' + (M.seq++), name: it.name + '_copy', w: it.w, h: it.h,
                 img: it.img, url: it.url, src: it.src, iw: it.iw || 0, ih: it.ih || 0 });
  renderList();
  saveState();
};

window.mcIcon = function(file){
  if(!file){ return; }
  var fr = new FileReader();
  fr.onload = function(){
    var img = new Image();
    img.onload = function(){
      M.icon = img;
      var c = fitCanvas(img, 256, 256);
      M.iconUrl = c.toDataURL('image/png');
      var prev = $('mc-iconprev');
      if(prev){ prev.src = M.iconUrl; prev.style.display = 'block'; }
      st('Pack icon lag gaya (256×256).', 'ok');
    };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
};

function defaultIcon(){
  var c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  var x = c.getContext('2d');
  x.fillStyle = '#7c5a3a'; x.fillRect(0, 0, 256, 256);
  x.fillStyle = '#5d4028';
  for(var i = 0; i < 8; i++){ x.fillRect(0, i * 32, 256, 2); }
  x.fillStyle = '#c9a06a'; x.fillRect(24, 24, 208, 208);
  x.fillStyle = '#8b6540'; x.fillRect(36, 36, 184, 184);
  x.fillStyle = '#f0d9b5'; x.font = 'bold 64px sans-serif'; x.textAlign = 'center';
  x.fillText('🎨', 128, 150);
  return c;
}

/* ---------------- export ---------------- */
window.mcExport = async function(ed){
  M.edition = (ed === 'java') ? 'java' : 'bedrock';
  var name = (($('mc-name') || {}).value || 'My Paintings').trim();
  var desc = name + ' — custom paintings';
  if(!M.items.length){ st('Kam se kam ek painting chahiye.', 'bad'); return; }
  var missing = M.items.filter(function(x){ return !x.img; });
  if(missing.length){ st(missing.length + ' painting mein image nahi hai — pehle image lagaiye.', 'bad'); return; }

  st('Pack ban raha hai...', 'info');
  try{
    var files = [];
    var iconCanvas = M.icon ? fitCanvas(M.icon, 256, 256) : defaultIcon();
    var iconBytes = await pngBytes(iconCanvas);

    if(M.edition === 'bedrock'){
      var manifest = {
        format_version: 2,
        header: {
          name: name, description: desc,
          uuid: uuid(), version: [1, 0, 0], min_engine_version: [1, 20, 0]
        },
        modules: [{ description: desc, type: 'resources', uuid: uuid(), version: [1, 0, 0] }]
      };
      files.push({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
      files.push({ name: 'pack_icon.png', data: iconBytes });

      /* Bedrock paintings ek hi atlas (textures/painting/kz.png) se aate hain.
         Base = vanilla atlas (256x256, 16x bada karke), uske upar sirf wahi
         slots draw hote hain jinke liye aapne image di hai — baaki vanilla. */
      var ATLAS = 1024, PPB = ATLAS / 16;      /* 64 px per block */
      var ac = document.createElement('canvas');
      ac.width = ATLAS; ac.height = ATLAS;
      var actx = ac.getContext('2d');
      try{
        var baseImg = await loadImage(VANILLA_KZ);
        actx.imageSmoothingEnabled = false;     /* vanilla pixel art crisp rahe */
        actx.drawImage(baseImg, 0, 0, ATLAS, ATLAS);
        actx.imageSmoothingEnabled = true;
      }catch(e){
        actx.fillStyle = '#d67fff';
        actx.fillRect(0, 0, ATLAS, ATLAS);
      }
      if('imageSmoothingQuality' in actx){ actx.imageSmoothingQuality = 'high'; }

      /* kaunsi image kis slot mein jayegi */
      var planned = [], slotWarn = '';
      SIZES.forEach(function(sz){
        var w = sz[0], h = sz[1];
        var items = M.items.filter(function(p){ return p.w === w && p.h === h; });
        if(!items.length){ return; }
        var slots = slotsFor(w, h);
        if(items.length > slots.length){
          slotWarn += ' ' + w + '×' + h + ': ' + items.length + ' images hain par ' + slots.length + ' slots — extra images use nahi hui.';
        }
        items.forEach(function(it, idx){
          if(slots[idx]){ planned.push({ it: it, slot: slots[idx], w: w, h: h }); }
        });
      });

      planned.forEach(function(pl){
        if(pl.slot.x === null || pl.slot.x === undefined){ return; }   /* modern -> alag file */
        var src = fitCanvas(pl.it.img, pl.w * PPB, pl.h * PPB);
        actx.drawImage(src, pl.slot.x * PPB, pl.slot.y * PPB);
      });

      files.push({ name: 'textures/painting/kz.png', data: await pngBytes(ac) });

      /* 1.21+ paintings ki apni file hoti hai — jo slots atlas mein nahi hain */
      for(var mi = 0; mi < planned.length; mi++){
        var pm = planned[mi];
        if(pm.slot.x !== null && pm.slot.x !== undefined){ continue; }
        var mcv = fitCanvas(pm.it.img, pm.w * 64, pm.h * 64);
        files.push({ name: 'textures/painting/' + pm.slot.n + '.png', data: await pngBytes(mcv) });
      }
      files.push({ name: 'README.txt', data: new TextEncoder().encode(
        'MINECRAFT BEDROCK RESOURCE PACK\n==============================\n\n' +
        'Pack: ' + name + '\n\n' +
        'INSTALL:\n1. .mcpack file ko phone mein rakhiye.\n2. File par tap kijiye -> "Open with Minecraft".\n' +
        '3. Minecraft -> Settings -> Global Resources (ya world settings) -> pack activate kijiye.\n' +
        '4. Koi bhi painting lagaiye — aapki image dikhegi.\n\n' +
        'SACH BAAAT:\n' +
        '- Bedrock paintings ek hi atlas file se aate hain: textures/painting/kz.png.\n' +
        '  Base vanilla atlas hai, uske upar sirf aapki chuni hui paintings draw hoti hain.\n' +
        '- Jo size aapne nahi chuna, wo painting vanilla hi rehti hai.\n' +
        '- Bedrock mein BILKUL NAYI size/variant ki painting resource pack se nahi banti —\n' +
        '  uske liye behavior pack + custom entity chahiye.\n' +
        '- Bedrock .mcpack asal mein ek ZIP hai jisme manifest.json + assets hote hain — wahi\n' +
        '  structure is pack mein hai.\n') });
    } else {
      var fmt = parseInt(($('mc-java-ver') || {}).value, 10) || 34;
      var mcmeta = { pack: {
        pack_format: fmt,
        description: desc,
        /* paintings 1.15 se badle nahi hain — isliye range de dete hain */
        supported_formats: { min_inclusive: 5, max_inclusive: Math.max(fmt, 5) }
      } };
      files.push({ name: 'pack.mcmeta', data: new TextEncoder().encode(JSON.stringify(mcmeta, null, 2)) });
      files.push({ name: 'pack.png', data: iconBytes });

      /* har chuni hui painting apne vanilla naam ki file ban jaati hai */
      var plannedJ = [];
      SIZES.forEach(function(sz){
        var w = sz[0], h = sz[1];
        var items = M.items.filter(function(p){ return p.w === w && p.h === h; });
        if(!items.length){ return; }
        var slots = slotsFor(w, h);
        items.forEach(function(it, idx){
          if(slots[idx]){ plannedJ.push({ it: it, slot: slots[idx], w: w, h: h }); }
        });
      });
      for(var j = 0; j < plannedJ.length; j++){
        var pj = plannedJ[j];
        var cv2 = fitCanvas(pj.it.img, pj.w * 16, pj.h * 16);
        files.push({ name: 'assets/minecraft/textures/painting/' + pj.slot.n + '.png', data: await pngBytes(cv2) });
      }
      /* 1.19.3+ atlas */
      files.push({ name: 'assets/minecraft/atlases/paintings.json', data: new TextEncoder().encode(JSON.stringify({
        sources: [{ type: 'directory', source: 'minecraft', prefix: 'painting' }]
      }, null, 2)) });
      files.push({ name: 'README.txt', data: new TextEncoder().encode(
        'MINECRAFT JAVA RESOURCE PACK\n============================\n\nPack: ' + name + '\n\n' +
        'INSTALL:\n1. ZIP ko mat kholiye — seedha resourcepacks folder mein daaliye.\n' +
        '2. Minecraft Java -> Options -> Resource Packs -> "Open Pack Folder".\n' +
        '3. ZIP copy kijiye -> Back -> pack list mein aayega -> activate.\n\n' +
        'SACH BAAAT:\n' +
        '- Sirf un sizes ki paintings replace hoti hain jo aapne chuni hain; baaki vanilla rehti hain.\n' +
        '- pack_format ' + fmt + ' hai — ye aapke chune hue version ke liye hai. Galat version par\n' +
        '  Minecraft pack ko "incompatible" dikha sakta hai (phir bhi load ho sakta hai).\n' +
        '- Java 1.21+ mein BILKUL NAYI painting variant add karni ho to datapack chahiye:\n' +
        '  data/<ns>/painting_variant/<name>.json (asset_id, width, height) + texture.\n' +
        '  Ye tool sirf resource pack deta hai — replace karne ke liye, naye variant ke liye nahi.\n') });
    }

    var blob = makeZip(files);
    var fname = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + (M.edition === 'bedrock' ? '.mcpack' : '.zip');
    if(window.imSave){ imSave(blob, fname); }
    else { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; a.click(); }
    st('✓ ' + fname + ' ban gaya — ' + files.length + ' files, ' + Math.round(blob.size / 1024) + ' KB.' + (slotWarn ? ' Note:' + slotWarn : ''), 'ok');
  }catch(e){
    st('Export fail: ' + e.message, 'bad');
  }
};

window.mcExportOne = function(){
  if(!M.items.length){ st('Pehli painting add kijiye.', 'bad'); return; }
  var it = M.items[0];
  if(!it.img){ st('Pehli painting mein image nahi hai.', 'bad'); return; }
  var c = fitCanvas(it.img, it.w * 16, it.h * 16);
  var d = c.toDataURL('image/png');
  var bin = atob(d.split(',')[1] || '');
  var arr = new Uint8Array(bin.length);
  for(var i = 0; i < bin.length; i++){ arr[i] = bin.charCodeAt(i); }
  var b = new Blob([arr], { type: 'image/png' });
  var nm = (it.name || 'painting').replace(/[^a-z0-9_-]/gi, '_') + '-' + it.w + 'x' + it.h + '.png';
  if(window.imSave){ imSave(b, nm); }
  else { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nm; a.click(); }
  st('Painting PNG download ho gayi.', 'ok');
};

/* ---------------- panel ---------------- */
function build(){
  var main = document.querySelector('main');
  var grp = document.getElementById('g-design');
  if(!main || !grp || document.getElementById('t-mc')){ return; }

  /* nav pehle se Minecraft group mein hai — yahan sirf count sync */
  var cnt = document.querySelector('[data-g="design"] .count');
  if(cnt){ cnt.textContent = String(document.querySelectorAll('#g-design .nav').length); }
  var cnt2 = document.querySelector('[data-g="mc"] .count');
  if(cnt2){ cnt2.textContent = String(document.querySelectorAll('#g-mc .nav').length); }

  main.insertAdjacentHTML('beforeend',
    '<section id="t-mc" class="tool">' +
      '<h2>MC Paintings Creator</h2>' +
      '<div class="row"><span class="lbl" style="width:auto">Pack name</span><input type="text" id="mc-name" value="MC Painting" style="flex:1;min-width:140px">' +
      '</div>' +


      '<div class="row"><span class="lbl" style="width:auto">Painting size:</span><span id="mc-sizes" style="display:flex;gap:4px;flex-wrap:wrap;flex:1 1 100%;min-width:0"></span></div>' +
      '<div class="lbl" id="mc-limits" style="font-size:11.5px;line-height:1.7;margin:-4px 0 6px"></div>' +

      '<input type="file" id="mc-iconfile" accept="image/*" style="display:none">' +

      '<div id="mc-list" style="margin:10px 0"></div>' +

      '<div class="row">' +
        '<button class="act pri" id="mc-export-bedrock" onclick="mcExport(\'bedrock\')">Download Bedrock</button>' +
        '<button class="act pri" id="mc-export-java" onclick="mcExport(\'java\')">Download Java</button>' +
      '</div>' +
      '<div class="status" id="mc-st"></div>' +

      '<h3 style="font-size:13px;margin:16px 0 6px">Install kaise karein</h3>' +
      '<div style="font-size:12.5px;line-height:1.8;color:var(--muted)">' +
        '<b>Bedrock:</b> Mcpack Par Tap Kijiye → Open With Minecraft → Settings → Global Resources → Activate<br>' +
        '<b>Java:</b> ZIP Ko Resourcepacks Folder Mein Daaliye → Options → Resource Packs → Activate' +
      '</div>' +
    '</section>');

  renderSizes();
  renderList();
  var f = $('mc-iconfile');
  if(f){ f.addEventListener('change', function(){ mcIcon(f.files[0]); f.value = ''; }); }
  /* pack name yaad rahe */
  var nmEl = $('mc-name');
  if(nmEl){ nmEl.addEventListener('input', function(){ saveState(); }); }
  /* pehle se save ki hui paintings wapas laao */
  loadState();
}

var css = document.createElement('style');
css.textContent =
  '.mc-card{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:10px;padding:8px;margin-bottom:6px;background:var(--panel)}' +
  '.mc-thumb{width:54px;height:54px;border-radius:8px;overflow:hidden;background:#0b0e12;flex:0 0 auto}' +
  '.mc-thumb img{width:100%;height:100%;object-fit:cover;display:block}' +
  '.mc-acts{display:flex;gap:4px;flex:0 0 auto}' +
  '.mc-size{min-height:28px;padding:3px 8px;font-size:11.5px;flex:0 0 auto}' +
  '#mc-sizes{width:100%}' +
  '.mc-iconbtn{display:inline-flex;align-items:center;justify-content:center;gap:3px;font-weight:650;white-space:normal;text-align:center;line-height:1.05;padding:0 3px!important;font-size:9px!important;width:56px!important;min-width:56px!important;max-width:56px!important;height:40px!important;overflow:hidden}' +
  '.mc-iconbtn img{width:12px;height:12px;object-fit:cover;display:block;border:1px solid var(--line);flex:0 0 auto}' +
  'body.light .mc-card{background:#fff}';
document.head.appendChild(css);

build();

})();

/* ===== titlecase ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

/* sab tool aur button ke naam Title Case mein — jaise "Minecraft Painting Creator" */
(function(){
  var KEEP = { json:1, html:1, css:1, js:1, pdf:1, api:1, url:1, ip:1, rgb:1, hex:1, hsl:1, cmyk:1,
    yaml:1, xml:1, sql:1, svg:1, png:1, jpg:1, jpeg:1, webp:1, gif:1, ico:1, zip:1, md:1, uuid:1,
    jwt:1, totp:1, utc:1, ist:1, ai:1, id:1, pin:1, ifsc:1, pan:1, gstin:1, gst:1, emi:1, sip:1,
    ascii:1, base32:1, base58:1, base64:1, rot13:1, a1z26:1, qr:1, exif:1, dpi:1, ctc:1, gpa:1,
    cgpa:1, bmr:1, bmi:1, csv:1, toml:1, ini:1, env:1, curl:1, http:1, https:1, og:1, ts:1,
    npm:1, uid:1, upi:1, imei:1, otp:1, sms:1, pdfs:1 };

  var BRAND = { youtube:'YouTube', github:'GitHub', whatsapp:'WhatsApp', instagram:'Instagram',
    facebook:'Facebook', tiktok:'TikTok', twitch:'Twitch', discord:'Discord', linkedin:'LinkedIn',
    wordpress:'WordPress', javascript:'JavaScript', typescript:'TypeScript', opencv:'OpenCV',
    macos:'macOS', ios:'iOS', android:'Android', minecraft:'Minecraft', canva:'Canva' };

  function fix(str){
    var out = String(str).replace(/[A-Za-z][A-Za-z0-9'’]*/g, function(w){
      if(/^[A-Z0-9]{2,}$/.test(w)){ return w; }              /* JSON, PDF, RGB — waise hi */
      var low = w.toLowerCase();
      if(BRAND[low]){ return BRAND[low]; }                   /* youtube -> YouTube */
      if(KEEP[low]){ return low.toUpperCase(); }             /* json -> JSON */
      return w;                                              /* baaki jaisa hai waisa */
    });
    /* sirf shuru ka letter bada */
    return out.replace(/^(\s*)([a-z])/, function(m, sp, ch){ return sp + ch.toUpperCase(); });
  }

  function apply(){
    var n = 0;
    function doEl(el){
      if(!el){ return; }
      var t = el.textContent;
      if(!t || !/[a-z]/.test(t)){ return; }
      var f = fix(t);
      if(f !== t){ el.textContent = f; n++; }
    }
    document.querySelectorAll('.nav').forEach(doEl);
    document.querySelectorAll('.grp-btn span:first-child').forEach(doEl);
    document.querySelectorAll('button').forEach(doEl);
    document.querySelectorAll('.tool h2').forEach(doEl);
    document.querySelectorAll('.tool h3').forEach(doEl);
    /* labels — par jo element ka apna id hai (live value) use chhod do */
    document.querySelectorAll('.lbl:not([id])').forEach(doEl);
    document.querySelectorAll('label.field, .field:not([id])').forEach(doEl);
    document.querySelectorAll('summary').forEach(doEl);
    return n;
  }

  apply();
  setTimeout(apply, 300);
  setTimeout(apply, 1200);

  /* tool khulne ke baad bhi apply karo (tool ka HTML baad mein banta hai) */
  (function hook(){
    if(typeof window.openTool !== 'function'){ return; }
    var orig = window.openTool;
    window.openTool = function(){
      var r = orig.apply(this, arguments);
      setTimeout(apply, 60);
      setTimeout(apply, 450);
      return r;
    };
  })();

  window.__tcFixed = apply;
})();

/* ===== webgl3d ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

/* ===================================================================
   WEBGL 3D PREVIEW — asli GPU 3D, koi library nahi
   Perspective camera + directional light + nearest-neighbour texture
   =================================================================== */
(function(){

/* ---------- matrix helpers ---------- */
function m4(){ return new Float32Array(16); }
function identity(o){
  o[0]=1;o[1]=0;o[2]=0;o[3]=0; o[4]=0;o[5]=1;o[6]=0;o[7]=0;
  o[8]=0;o[9]=0;o[10]=1;o[11]=0; o[12]=0;o[13]=0;o[14]=0;o[15]=1; return o;
}
function perspective(o, fovy, aspect, near, far){
  var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  o[0]=f/aspect;o[1]=0;o[2]=0;o[3]=0;
  o[4]=0;o[5]=f;o[6]=0;o[7]=0;
  o[8]=0;o[9]=0;o[10]=(far+near)*nf;o[11]=-1;
  o[12]=0;o[13]=0;o[14]=2*far*near*nf;o[15]=0; return o;
}
function mul(o, a, b){
  for(var i=0;i<4;i++){
    for(var j=0;j<4;j++){
      o[i*4+j] = a[0*4+j]*b[i*4+0] + a[1*4+j]*b[i*4+1] + a[2*4+j]*b[i*4+2] + a[3*4+j]*b[i*4+3];
    }
  }
  return o;
}
function rotY(o, r){
  var c = Math.cos(r), s = Math.sin(r);
  identity(o); o[0]=c; o[2]=-s; o[8]=s; o[10]=c; return o;
}
function rotX(o, r){
  var c = Math.cos(r), s = Math.sin(r);
  identity(o); o[5]=c; o[6]=s; o[9]=-s; o[10]=c; return o;
}
function translate(o, x, y, z){ identity(o); o[12]=x; o[13]=y; o[14]=z; return o; }

/* ---------- shaders ---------- */
var VS = [
  'attribute vec3 aPos;',
  'attribute vec2 aUV;',
  'attribute vec3 aNorm;',
  'uniform mat4 uMVP;',
  'varying vec2 vUV;',
  'varying vec3 vNorm;',
  'void main(){',
  '  vUV = aUV;',
  '  vNorm = aNorm;',
  '  gl_Position = uMVP * vec4(aPos, 1.0);',
  '}'
].join('\n');

var FS = [
  'precision mediump float;',
  'uniform sampler2D uTex;',
  'uniform float uTint;',
  'varying vec2 vUV;',
  'varying vec3 vNorm;',
  'void main(){',
  '  vec4 c = texture2D(uTex, vUV);',
  '  if(c.a < 0.06) discard;',
  '  vec3 L = normalize(vec3(0.45, 0.95, 0.62));',
  '  float d = max(dot(normalize(vNorm), L), 0.0);',
  '  float sh = 0.58 + 0.42 * d;',
  '  gl_FragColor = vec4(c.rgb * sh * uTint, c.a);',
  '}'
].join('\n');

function compile(gl, type, src){
  var sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){
    throw new Error(gl.getShaderInfoLog(sh) || 'shader error');
  }
  return sh;
}

/* ---------- box geometry ---------- */
/* boxes: w,h,d, x,y ; uv: 6 faces ke rects [u,v,w,h] */
function buildPart(b){
  var hw = b.w/2, hd = b.d/2;
  var x = b.x, y = b.y - 20;   /* model center */
  var corners = [
    [x-hw, y,      -hd], [x+hw, y,      -hd], [x+hw, y,      hd], [x-hw, y,      hd],
    [x-hw, y+b.h,  -hd], [x+hw, y+b.h,  -hd], [x+hw, y+b.h,  hd], [x-hw, y+b.h,  hd]
  ];
  var faces = [
    { key:'front',  idx:[3,2,6,7], n:[0,0,1] },
    { key:'back',   idx:[1,0,4,5], n:[0,0,-1] },
    { key:'right',  idx:[1,2,6,5], n:[1,0,0] },
    { key:'left',   idx:[0,3,7,4], n:[-1,0,0] },
    { key:'top',    idx:[4,5,6,7], n:[0,1,0] },
    { key:'bottom', idx:[0,1,2,3], n:[0,-1,0] }
  ];
  var verts = [], hits = [];
  faces.forEach(function(f){
    var r = b.uv[f.key];
    /* BOXES mein sirf [u,v] hai — width/height face se nikalti hai */
    var uw = (f.key === 'top' || f.key === 'bottom') ? b.w : ((f.key === 'front' || f.key === 'back') ? b.w : b.d);
    var uh = (f.key === 'top' || f.key === 'bottom') ? b.d : b.h;
    var u0 = r[0]/64, v0 = r[1]/64, u1 = (r[0]+uw)/64, v1 = (r[1]+uh)/64;
    var a = corners[f.idx[0]], bb = corners[f.idx[1]], c = corners[f.idx[2]], d = corners[f.idx[3]];
    var quad = [a, bb, c, d];
    var uvs = [[u0,v1],[u1,v1],[u1,v0],[u0,v0]];
    var order = [0,1,2, 0,2,3];
    order.forEach(function(i){
      verts.push(quad[i][0], quad[i][1], quad[i][2], uvs[i][0], uvs[i][1], f.n[0], f.n[1], f.n[2]);
    });
    hits.push({ key: f.key, quad: quad, cu: [[u0,v1],[u1,v1],[u1,v0],[u0,v0]] });
  });
  return { data: new Float32Array(verts), count: verts.length/8, hits: hits };
}

/* ---------- renderer ---------- */
var GL = {
  gl: null,
  prog: null,
  tex: null,
  parts: null,
  canvas: null,
  failed: false
};

function initGL(cv){
  if(GL.gl){ return true; }
  var gl = null;
  try{
    gl = cv.getContext('webgl', { alpha:true, antialias:true, premultipliedAlpha:false })
      || cv.getContext('experimental-webgl', { alpha:true, antialias:true });
  }catch(e){ gl = null; }
  if(!gl){ GL.failed = true; return false; }
  try{
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)){ throw new Error('link fail'); }
    GL.prog = p;
    GL.aPos = gl.getAttribLocation(p, 'aPos');
    GL.aUV = gl.getAttribLocation(p, 'aUV');
    GL.aNorm = gl.getAttribLocation(p, 'aNorm');
    GL.uMVP = gl.getUniformLocation(p, 'uMVP');
    GL.uTex = gl.getUniformLocation(p, 'uTex');
    GL.uTint = gl.getUniformLocation(p, 'uTint');
    GL.gl = gl;
    GL.canvas = cv;
    return true;
  }catch(e){
    GL.failed = true;
    GL.err = e.message || String(e);
    return false;
  }
}

function uploadTexture(skinCanvas){
  var gl = GL.gl;
  if(!gl){ return; }
  if(!GL.tex){
    GL.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, GL.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  gl.bindTexture(gl.TEXTURE_2D, GL.tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, skinCanvas);
}

/* API — skin tool isse use karta hai */
window.MCGL = {
  available: function(){ return !GL.failed; },

  render: function(cv, boxes, skinCanvas, yawDeg, pitchDeg, zoom, hidden){
    if(!initGL(cv)){ return false; }
    var gl = GL.gl;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cssW = cv.clientWidth || 260;
    var cssH = cv.clientHeight || 300;
    var W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
    if(cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }

    gl.viewport(0, 0, W, H);
    gl.clearColor(0.09, 0.13, 0.18, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    uploadTexture(skinCanvas);
    gl.useProgram(GL.prog);

    var proj = m4(), view = m4(), model = m4(), tmp = m4(), mvp = m4();
    perspective(proj, 42 * Math.PI/180, W/H, 0.1, 400);

    var ry = rotY(m4(), yawDeg * Math.PI/180);
    var rx = rotX(m4(), pitchDeg * Math.PI/180);
    mul(model, rx, ry);

    var dist = 50 / (zoom || 1);
    translate(view, 0, 0, -dist);
    mul(tmp, view, model);
    mul(mvp, proj, tmp);

    gl.uniformMatrix4fv(GL.uMVP, false, mvp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, GL.tex);
    gl.uniform1i(GL.uTex, 0);
    gl.uniform1f(GL.uTint, 1.0);

    /* per part draw (hidden skip) */
    var hits = [];
    boxes.forEach(function(b){
      if(hidden && hidden[b.name]){ return; }
      var part = buildPart(b);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, part.data, gl.STREAM_DRAW);
      var stride = 8 * 4;
      gl.enableVertexAttribArray(GL.aPos);
      gl.vertexAttribPointer(GL.aPos, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(GL.aUV);
      gl.vertexAttribPointer(GL.aUV, 2, gl.FLOAT, false, stride, 3*4);
      gl.enableVertexAttribArray(GL.aNorm);
      gl.vertexAttribPointer(GL.aNorm, 3, gl.FLOAT, false, stride, 5*4);
      gl.drawArrays(gl.TRIANGLES, 0, part.count);
      gl.deleteBuffer(buf);

      /* tap ke liye screen polygons */
      part.hits.forEach(function(h){
        var pts = h.quad.map(function(v){
          var x = mvp[0]*v[0] + mvp[4]*v[1] + mvp[8]*v[2] + mvp[12];
          var y = mvp[1]*v[0] + mvp[5]*v[1] + mvp[9]*v[2] + mvp[13];
          var w = mvp[3]*v[0] + mvp[7]*v[1] + mvp[11]*v[2] + mvp[15];
          if(Math.abs(w) < 1e-6){ w = 1e-6; }
          return [ (x/w * 0.5 + 0.5) * W, (1 - (y/w * 0.5 + 0.5)) * H ];
        });
        hits.push({ part: b.name, key: h.key, poly: pts, cu: h.cu });
      });
    });
    return hits;
  },
  debug: function(){ return { err: GL.err || null, failed: GL.failed }; }
};

})();

/* ===== skintool ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

/* ===================================================================
   MINECRAFT SKIN CREATOR — 64x64 pixel editor + 3D preview + PNG
   Koi library nahi: 3D preview apna chhota renderer hai (orthographic)
   =================================================================== */
(function(){

function $(id){ return document.getElementById(id); }
function st(msg, cls){ var e = $('sk-st'); if(e){ e.textContent = msg || ''; e.className = 'status ' + (cls || ''); } }

var PART_UV = {
  head:     [[8,8,8,8],[24,8,8,8],[0,8,8,8],[16,8,8,8],[8,0,8,8],[16,0,8,8]],
  body:     [[20,20,8,12],[32,20,8,12],[16,20,4,12],[28,20,4,12],[20,16,8,4],[28,16,8,4]],
  rightArm: [[44,20,4,12],[52,20,4,12],[40,20,4,12],[48,20,4,12],[44,16,4,4],[48,16,4,4]],
  leftArm:  [[36,52,4,12],[44,52,4,12],[32,52,4,12],[40,52,4,12],[36,48,4,4],[40,48,4,4]],
  rightLeg: [[4,20,4,12],[12,20,4,12],[0,20,4,12],[8,20,4,12],[4,16,4,4],[8,16,4,4]],
  leftLeg:  [[20,52,4,12],[28,52,4,12],[16,52,4,12],[24,52,4,12],[20,48,4,4],[24,48,4,4]]
};

var S = {
  size: 64,
  zoom: 8,
  tool: 'pencil',
  part: 'all',
  partOnly: false,
  brush: 1,
  autoRotate: false,
  zoom3d: 1,
  hidden: {},
  color: '#4c8dff',
  model: 'classic',
  yaw: -22,
  pitch: 8,
  grid: true,
  undo: [],
  redo: [],
  skin: null,       /* canvas 64x64 */
  ctx: null,
  layerView: 'both', /* both | body | overlay */
  overlay: { on: true, opacity: 100, parts: { head:true, body:true, rarm:true, larm:true, rleg:true, lleg:true } },
  noGL: true        /* canvas renderer — WebGL preview galat crop karta tha */
};

/* ---------------- skin canvas ---------------- */
function newSkin(fill){
  var c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  var x = c.getContext('2d');
  x.clearRect(0, 0, 64, 64);
  return c;
}

function pushUndo(){
  try{
    S.undo.push(S.ctx.getImageData(0, 0, 64, 64));
    if(S.undo.length > 25){ S.undo.shift(); }
    S.redo.length = 0;
  }catch(e){}
}

/* ---------------- editor drawing ---------------- */
function drawEditor(){
  var cv = $('sk-canvas');
  if(!cv || !S.skin){ return; }
  var z = S.zoom, W = 64 * z;
  cv.width = W; cv.height = W;
  /* screen par hamesha fit — internal resolution crisp rehti hai */
  cv.style.width = '100%';
  cv.style.maxWidth = W + 'px';
  cv.style.height = 'auto';
  cv.style.aspectRatio = '1 / 1';
  var x = cv.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, W, W);
  /* checkerboard for transparency */
  var s = Math.max(4, z);
  for(var i = 0; i < 64; i++){
    for(var j = 0; j < 64; j++){
      x.fillStyle = ((i + j) % 2) ? '#20262e' : '#171c22';
      x.fillRect(i * z, j * z, z, z);
    }
  }
  x.drawImage(S.skin, 0, 0, 64, 64, 0, 0, W, W);
  /* koi grid ya box overlay nahi — sirf skin texture */
}

function insidePart(px, py){
  /* chhupaya gaya part paint nahi hota */
  var rev = { head:'head', body:'body', rightArm:'rarm', leftArm:'larm', rightLeg:'rleg', leftLeg:'lleg' };
  var keys = Object.keys(PART_UV);
  for(var q = 0; q < keys.length; q++){
    var k = keys[q];
    if(S.hidden[rev[k]]){
      var rr = PART_UV[k];
      for(var w = 0; w < rr.length; w++){
        var b0 = rr[w];
        if(px >= b0[0] && px < b0[0] + b0[2] && py >= b0[1] && py < b0[1] + b0[3]){ return false; }
      }
    }
  }
  if(!S.partOnly || S.part === 'all'){ return true; }
  var rects = PART_UV[S.part] || [];
  for(var i = 0; i < rects.length; i++){
    var r = rects[i];
    if(px >= r[0] && px < r[0] + r[2] && py >= r[1] && py < r[1] + r[3]){ return true; }
  }
  return false;
}

function paintAt(ev){
  var cv = $('sk-canvas');
  if(!cv || !S.skin){ return; }
  var r = cv.getBoundingClientRect();
  var cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
  var cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
  var px = Math.floor(cx / (r.width / 64));
  var py = Math.floor(cy / (r.height / 64));
  if(px < 0 || py < 0 || px > 63 || py > 63){ return; }
  var x = S.ctx;
  if(S.tool === 'picker'){
    var d = x.getImageData(px, py, 1, 1).data;
    if(d[3] > 0){
      S.color = '#' + [d[0], d[1], d[2]].map(function(v){ return ('0' + v.toString(16)).slice(-2); }).join('');
      var ci = $('sk-color'); if(ci){ ci.value = S.color; }
      st('Rang liya: ' + S.color, 'ok');
    }
    return;
  }
  if(S.tool === 'fill'){
    if(!insidePart(px, py)){ st('Sirf chuna hua body part paint hoga.', 'info'); return; }
    floodFill(px, py, S.color);
    renderAll();
    return;
  }
  var size = Math.max(1, Math.min(8, S.brush || 1));
  var st0 = Math.floor((size - 1) / 2), en0 = Math.ceil((size - 1) / 2);
  var painted = false;
  for(var yy = py - st0; yy <= py + en0; yy++){
    for(var xx = px - st0; xx <= px + en0; xx++){
      if(xx < 0 || xx > 63 || yy < 0 || yy > 63){ continue; }
      if(!insidePart(xx, yy)){ continue; }
      painted = true;
      if(S.tool === 'eraser'){ x.clearRect(xx, yy, 1, 1); }
      else { x.fillStyle = S.color; x.fillRect(xx, yy, 1, 1); }
    }
  }
  if(!painted && !insidePart(px, py)){
    st('Sirf chuna hua body part paint hoga — ya "Sab parts" chuniye.', 'info');
    return;
  }
  drawEditor();
  draw3D();
}

function hexToRgb(h){
  h = h.replace('#', '');
  if(h.length === 3){ h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; }
  var n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function floodFill(sx, sy, hex){
  var img = S.ctx.getImageData(0, 0, 64, 64);
  var d = img.data;
  var idx = (sy * 64 + sx) * 4;
  var target = [d[idx], d[idx+1], d[idx+2], d[idx+3]];
  var rgb = hexToRgb(hex);
  if(target[0] === rgb[0] && target[1] === rgb[1] && target[2] === rgb[2] && target[3] === 255){ return; }
  var stack = [[sx, sy]];
  function match(i){ return Math.abs(d[i]-target[0]) < 12 && Math.abs(d[i+1]-target[1]) < 12 && Math.abs(d[i+2]-target[2]) < 12 && Math.abs(d[i+3]-target[3]) < 12; }
  var guard = 0;
  while(stack.length && guard++ < 20000){
    var p = stack.pop(), x = p[0], y = p[1];
    if(x < 0 || y < 0 || x > 63 || y > 63){ continue; }
    var i2 = (y * 64 + x) * 4;
    if(!match(i2)){ continue; }
    d[i2] = rgb[0]; d[i2+1] = rgb[1]; d[i2+2] = rgb[2]; d[i2+3] = 255;
    stack.push([x+1, y], [x-1, y], [x, y+1], [x, y-1]);
  }
  S.ctx.putImageData(img, 0, 0);
}

/* ---------------- 3D preview ---------------- */
var BOXES = [
  { name:'head',  w:8, h:8,  d:8, x:0,  y:28, uv:{ top:[8,0], bottom:[16,0], right:[0,8], front:[8,8], left:[16,8], back:[24,8] }, ow:8, oh:8 },
  { name:'body',  w:8, h:12, d:4, x:0,  y:16, uv:{ top:[20,16], bottom:[28,16], right:[16,20], front:[20,20], left:[28,20], back:[32,20] }, ow:4, oh:12 },
  { name:'rarm',  w:4, h:12, d:4, x:-6, y:16, uv:{ top:[44,16], bottom:[48,16], right:[40,20], front:[44,20], left:[48,20], back:[52,20] }, ow:4, oh:12 },
  { name:'larm',  w:4, h:12, d:4, x:6,  y:16, uv:{ top:[36,48], bottom:[40,48], right:[32,52], front:[36,52], left:[40,52], back:[44,52] }, ow:4, oh:12 },
  { name:'rleg',  w:4, h:12, d:4, x:-2, y:4,  uv:{ top:[4,16],  bottom:[8,16],  right:[0,20],  front:[4,20],  left:[8,20],  back:[12,20] }, ow:4, oh:12 },
  { name:'lleg',  w:4, h:12, d:4, x:2,  y:4,  uv:{ top:[20,48], bottom:[24,48], right:[16,52], front:[20,52], left:[24,52], back:[28,52] }, ow:4, oh:12 }
];

/* outer layer (overlay) UVs — 1.8 skin layout */
var OVERLAY_UV = {
  head: { top:[40,0], bottom:[48,0], right:[32,8], front:[40,8], left:[48,8], back:[56,8] },
  body: { top:[20,32], bottom:[28,32], right:[16,36], front:[20,36], left:[28,36], back:[32,36] },
  rarm: { top:[44,32], bottom:[48,32], right:[40,36], front:[44,36], left:[48,36], back:[52,36] },
  larm: { top:[52,48], bottom:[56,48], right:[48,52], front:[52,52], left:[56,52], back:[60,52] },
  rleg: { top:[4,32], bottom:[8,32], right:[0,36], front:[4,36], left:[8,36], back:[12,36] },
  lleg: { top:[4,48], bottom:[8,48], right:[0,52], front:[4,52], left:[8,52], back:[12,52] }
};

function rot(p, yaw, pitch){
  var cy = Math.cos(yaw), sy = Math.sin(yaw);
  var cp = Math.cos(pitch), sp = Math.sin(pitch);
  var x1 = p[0] * cy + p[2] * sy;
  var z1 = -p[0] * sy + p[2] * cy;
  var y1 = p[1] * cp - z1 * sp;
  var z2 = p[1] * sp + z1 * cp;
  return [x1, y1, z2];
}

var FACE_HITS = [];   /* 3D par tap -> kaunsa body part */

var raf3d = 0;
function schedule3D(){
  if(raf3d){ return; }
  raf3d = requestAnimationFrame(function(){ raf3d = 0; draw3D(); });
}

/* preview ko container ke hisaab se size karo — mobile par crisp (devicePixelRatio) */
function fit3D(cv){
  var box = cv.parentElement;
  var availW = box ? box.clientWidth : 260;
  if(!availW || availW < 80){ availW = 260; }
  availW = Math.min(300, Math.max(140, availW));
  var cssH = Math.round(availW * 300 / 260);
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.style.width = availW + 'px';
  cv.style.height = cssH + 'px';
  cv.width = Math.round(availW * dpr);
  cv.height = Math.round(cssH * dpr);
  return { W: cv.width, H: cv.height, dpr: dpr };
}

function skinIsEmpty(){
  try{
    var d = S.ctx.getImageData(0, 0, 64, 64).data;
    for(var i = 3; i < d.length; i += 4){
      if(d[i] > 8){ return false; }
    }
  }catch(e){ return false; }
  return true;
}

/* ---- body / overlay layers (1.8 skin layout) ---- */
var LAYER_BASE = [
  [0,0,32,16], [16,16,24,16], [40,16,16,16], [0,16,16,16], [16,48,16,16], [32,48,16,16]
];
var LAYER_OVER = [
  [32,0,32,16], [16,32,24,16], [40,32,16,16], [0,32,16,16], [0,48,16,16], [48,48,16,16]
];

function skinView(mode){
  if(!S.skin || !mode || mode === 'both'){ return S.skin; }
  var c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  var x = c.getContext('2d');
  var rects = (mode === 'overlay') ? LAYER_OVER : LAYER_BASE;
  rects.forEach(function(r){ x.drawImage(S.skin, r[0], r[1], r[2], r[3], r[0], r[1], r[2], r[3]); });
  return c;
}

function drawLayerThumbs(){
  ['body', 'overlay'].forEach(function(mode){
    var cv = $('sk-thumb-' + mode);
    if(!cv){ return; }
    var x = cv.getContext('2d');
    x.clearRect(0, 0, 64, 64);
    if(S.skin){ x.drawImage(skinView(mode), 0, 0); }
  });
}

window.skLayer = function(mode){
  S.layerView = (S.layerView === mode) ? 'both' : mode;
  var b = $('sk-lay-body'), o = $('sk-lay-overlay');
  if(b){ b.classList.toggle('on', S.layerView === 'body'); }
  if(o){ o.classList.toggle('on', S.layerView === 'overlay'); }
  draw3D();
  st(S.layerView === 'both' ? 'Body + Overlay dono dikh rahe hain' :
     (S.layerView === 'body' ? 'Sirf Body layer' : 'Sirf Overlay layer'), 'info');
};

function draw3D(){
  var cv = $('sk-3d');
  if(!cv || !S.skin){ return; }
  var empty = $('sk-empty');

  /* pehle asli WebGL 3D try karo */
  if(!S.noGL && window.MCGL && window.MCGL.available()){
    fit3DStyle(cv);
    var hits = null;
    try{
      hits = window.MCGL.render(cv, BOXES, skinView(S.layerView), S.yaw, S.pitch, S.zoom3d, S.hidden);
    }catch(e){ hits = null; }
    if(hits){
      FACE_HITS.length = 0;
      for(var i = 0; i < hits.length; i++){ FACE_HITS.push(hits[i]); }
      if(empty){ empty.style.display = skinIsEmpty() ? 'flex' : 'none'; }
      /* layout settle hone par dobara render — warna canvas adhoora dikhta hai */
      var want = Math.round(cv.clientWidth * Math.min(2, window.devicePixelRatio || 1));
      if(want && cv.width !== want){ setTimeout(draw3D, 60); }
      return;
    }
    S.noGL = true;   /* WebGL fail -> canvas fallback */
  }
  draw3DCanvas();
}

function fit3DStyle(cv){
  /* wrapper khud canvas ke size par shrink hota hai — isliye stage se naapo */
  var box = (cv.closest ? cv.closest('.sk-stage') : null) || cv.parentElement;
  var availW = box ? box.clientWidth : 260;
  if(availW){ availW -= 2; }
  if(!availW || availW < 80){ availW = 260; }
  availW = Math.min(300, Math.max(140, availW));
  var cssH = Math.round(availW * 300 / 260);
  cv.style.width = availW + 'px';
  cv.style.height = cssH + 'px';
  return { w: availW, h: cssH };
}

function draw3DCanvas(){
  var cv = $('sk-3d');
  if(!cv || !S.skin){ return; }
  var empty = $('sk-empty');
  if(empty){ empty.style.display = 'none'; }
  var x;
  try{ x = cv.getContext('2d'); }catch(e){ x = null; }
  if(!x){ st('Preview render nahi ho paya — browser canvas support nahi kar raha.', 'bad'); return; }

  var dims = fit3D(cv);
  var W = dims.W, H = dims.H, dpr = dims.dpr;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, W, H);

  /* background */
  var g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f2f4f7');
  x.fillStyle = g; x.fillRect(0, 0, W, H);

  /* khaali skin par saaf message — khaali dabba nahi */
  if(skinIsEmpty()){
    x.fillStyle = 'rgba(20,24,36,0.65)';
    x.font = Math.round(13 * dpr) + 'px sans-serif';
    x.textAlign = 'center';
    x.fillText('Skin khaali hai', W / 2, H / 2 - 8 * dpr);
    x.fillStyle = 'rgba(20,24,36,0.45)';
    x.font = Math.round(11 * dpr) + 'px sans-serif';
    x.fillText('Draw karein ya PNG upload kijiye', W / 2, H / 2 + 12 * dpr);
    return;
  }

  var yaw = S.yaw * Math.PI / 180, pitch = S.pitch * Math.PI / 180;
  var scale = 4.9 * (W / 260) * (S.zoom3d || 1);
  var cx = W / 2, cy = H * 0.47;

  var faces = [];
  FACE_HITS.length = 0;
  BOXES.forEach(function(b){
    /* chhupaya gaya part draw nahi hota (dono naming styles check) */
    var HIDE_KEY = { head:'head', body:'body', rarm:'rightArm', larm:'leftArm', rleg:'rightLeg', lleg:'leftLeg' };
    if(S.hidden[b.name] || S.hidden[HIDE_KEY[b.name]]){ return; }
    var hw = b.w / 2, hd = b.d / 2;
    var corners = [
      [-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd],
      [-hw, b.h, -hd], [hw, b.h, -hd], [hw, b.h, hd], [-hw, b.h, hd]
    ].map(function(p){ return rot([p[0] + b.x, p[1] + b.y - 28, p[2]], yaw, pitch); });
    /* corners: 0-3 = neeche (y=0), 4-7 = upar (y=h) */
    var defs = [
      { key:'front',  idx:[3,2,6,7], n:[0,0,1] },
      { key:'back',   idx:[1,0,4,5], n:[0,0,-1] },
      { key:'right',  idx:[1,2,6,5], n:[1,0,0] },
      { key:'left',   idx:[0,3,7,4], n:[-1,0,0] },
      { key:'top',    idx:[4,5,6,7], n:[0,1,0] },
      { key:'bottom', idx:[0,1,2,3], n:[0,-1,0] }
    ];
    defs.forEach(function(f){
      var n = rot(f.n, yaw, pitch);
      if(n[2] <= 0.02){ return; }
      var pts = f.idx.map(function(i){ return corners[i]; });
      var depth = (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4;
      faces.push({ b: b, key: f.key, pts: pts, depth: depth });
    });

    /* ---- outer layer (overlay) — thoda bada box, apne UVs ---- */
    if(S.overlay && S.overlay.on && S.overlay.parts[b.name] && OVERLAY_UV[b.name]){
      var pad = 0.6;
      var hw2 = b.w / 2 + pad, hd2 = b.d / 2 + pad;
      var oc = [
        [-hw2, -pad, -hd2], [hw2, -pad, -hd2], [hw2, -pad, hd2], [-hw2, -pad, hd2],
        [-hw2, b.h + pad, -hd2], [hw2, b.h + pad, -hd2], [hw2, b.h + pad, hd2], [-hw2, b.h + pad, hd2]
      ].map(function(p){ return rot([p[0] + b.x, p[1] + b.y - 28, p[2]], yaw, pitch); });
      var ouv = OVERLAY_UV[b.name];
      defs.forEach(function(f){
        var n = rot(f.n, yaw, pitch);
        if(n[2] <= 0.02){ return; }
        var pts = f.idx.map(function(i){ return oc[i]; });
        var depth = (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4 + 0.4;
        faces.push({ b: { uv: ouv, w: b.w, h: b.h, d: b.d }, key: f.key, pts: pts, depth: depth, ov: true });
      });
    }
  });
  faces.sort(function(a, b){ return a.depth - b.depth; });

  faces.forEach(function(f){
    var p = f.pts.map(function(v){ return [cx + v[0] * scale, cy - v[1] * scale]; });
    var uv = f.b.uv[f.key];
    var uw = (f.key === 'top' || f.key === 'bottom') ? f.b.w : (f.key === 'front' || f.key === 'back' ? f.b.w : f.b.d);
    var uh = (f.key === 'top' || f.key === 'bottom') ? f.b.d : f.b.h;

    var ax = (p[1][0] - p[0][0]) / uw, ay = (p[1][1] - p[0][1]) / uw;
    var bx = (p[3][0] - p[0][0]) / uh, by = (p[3][1] - p[0][1]) / uh;

    x.save();
    x.globalAlpha = f.ov ? Math.max(0, Math.min(1, (S.overlay.opacity || 100) / 100)) : 1;
    x.beginPath();
    x.moveTo(p[0][0], p[0][1]); x.lineTo(p[1][0], p[1][1]);
    x.lineTo(p[2][0], p[2][1]); x.lineTo(p[3][0], p[3][1]);
    x.closePath(); x.clip();
    x.setTransform(ax, ay, bx, by, p[0][0], p[0][1]);
    x.imageSmoothingEnabled = false;          /* nearest-neighbour */
    x.drawImage(skinView(S.layerView), uv[0], uv[1], uw, uh, 0, 0, uw, uh);
    FACE_HITS.push({ part: f.b.name, key: f.key, poly: p, cu: [[uv[0],uv[1]],[uv[0]+uw,uv[1]],[uv[0]+uw,uv[1]+uh],[uv[0],uv[1]+uh]] });
    x.setTransform(1, 0, 0, 1, 0, 0);
    /* ambient + directional shading */
    var shade = f.key === 'top' ? 0.02 : (f.key === 'front' ? 0.06 : (f.key === 'back' ? 0.34 : (f.key === 'bottom' ? 0.45 : 0.20)));
    x.fillStyle = 'rgba(0,0,0,' + shade + ')';
    x.fillRect(0, 0, W, H);
    x.restore();
  });

  /* shadow */
  x.fillStyle = 'rgba(0,0,0,0.35)';
  x.beginPath(); x.ellipse(cx, H - 24 * (H / 300), 46 * (W / 260), 10 * (H / 300), 0, 0, 7); x.fill();
}

/* ---------------- actions ---------------- */
/* base + overlay ki copy — Reset Overlay ke liye */
function snapshotOrig(){
  try{
    S.orig = document.createElement('canvas');
    S.orig.width = 64; S.orig.height = 64;
    S.orig.getContext('2d').drawImage(S.skin, 0, 0);
  }catch(e){}
}

/* ---------------- overlay controls ---------------- */
window.skOverlayToggle = function(){
  S.overlay.on = !S.overlay.on;
  var b = $('sk-ov-toggle');
  if(b){ b.textContent = 'Overlay: ' + (S.overlay.on ? 'ON' : 'OFF'); }
  draw3D();
  st(S.overlay.on ? 'Overlay dikh raha hai' : 'Overlay chhupa hua hai', 'info');
};

window.skOverlayPart = function(p){
  if(!S.overlay.parts.hasOwnProperty(p)){ return; }
  S.overlay.parts[p] = !S.overlay.parts[p];
  var b = document.querySelector('.sk-ovp[data-p="' + p + '"]');
  if(b){ b.classList.toggle('on', S.overlay.parts[p]); }
  draw3D();
};

window.skOverlayOpacity = function(v){
  S.overlay.opacity = Math.max(0, Math.min(100, parseInt(v, 10) || 0));
  draw3D();
};

/* overlay pixels clear — sirf outer layer saaf hoti hai */
window.skOverlayClear = function(){
  if(!S.ctx){ return; }
  pushUndo();
  LAYER_OVER.forEach(function(r){ S.ctx.clearRect(r[0], r[1], r[2], r[3]); });
  draw3D();
  st('Overlay clear ho gaya (base skin waisi hai).', 'ok');
};

/* overlay wapas — jo skin upload/save hui thi uske outer layer se */
window.skOverlayReset = function(){
  if(!S.ctx || !S.orig){ st('Reset ke liye pehle skin upload kijiye.', 'bad'); return; }
  pushUndo();
  S.ctx.save();
  S.ctx.beginPath();
  LAYER_OVER.forEach(function(r){ S.ctx.rect(r[0], r[1], r[2], r[3]); });
  S.ctx.clip();
  S.ctx.clearRect(0, 0, 64, 64);
  S.ctx.drawImage(S.orig, 0, 0);
  S.ctx.restore();
  draw3D();
  st('Overlay reset ho gaya.', 'ok');
};

window.skTool = function(t){
  S.tool = t;
  S.rotating = (t === 'move');
  document.querySelectorAll('.sk-tool').forEach(function(b){ b.classList.toggle('pri', b.dataset.tool === t); });
  st('Tool: ' + t, 'info');
};
window.skColor = function(v){ S.color = v; };
window.skZoom = function(d){
  S.zoom = Math.max(4, Math.min(16, S.zoom + d));
  drawEditor();
  var zl = $('sk-zoom'); if(zl){ zl.textContent = S.zoom + '×'; }
};
window.skGrid = function(on){ S.grid = !!on; drawEditor(); };
window.skPart = function(part){
  S.part = part;
  document.querySelectorAll('.sk-part').forEach(function(b){ b.classList.toggle('pri', b.dataset.part === part); });
  drawEditor();
  st('Part: ' + (part === 'all' ? 'sab parts' : part), 'info');
};
window.skPartOnly = function(on){ S.partOnly = !!on; };

/* 3D par tap -> body part select */
function pointInPoly(px, py, poly){
  var inside = false;
  for(var i = 0, j = poly.length - 1; i < poly.length; j = i++){
    var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if(((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)){ inside = !inside; }
  }
  return inside;
}

/* 3D model par seedha paint */
function quadST(px, py, poly){
  /* p0,p1,p2,p3 parallelogram — s,t nikaalo */
  var ax = poly[1][0] - poly[0][0], ay = poly[1][1] - poly[0][1];
  var bx = poly[3][0] - poly[0][0], by = poly[3][1] - poly[0][1];
  var dx = px - poly[0][0], dy = py - poly[0][1];
  var det = ax * by - ay * bx;
  if(Math.abs(det) < 1e-6){ return null; }
  var s = (dx * by - dy * bx) / det;
  var t = (ax * dy - ay * dx) / det;
  return { s: s, t: t };
}

window.skPaint3D = function(ev){
  var cv = $('sk-3d');
  if(!cv){ return false; }
  var r = cv.getBoundingClientRect();
  var dpr = cv.width / r.width;
  var px = (ev.clientX - r.left) * dpr;
  var py = (ev.clientY - r.top) * dpr;
  for(var i = FACE_HITS.length - 1; i >= 0; i--){
    var h = FACE_HITS[i];
    if(!pointInPoly(px, py, h.poly)){ continue; }
    var stt = quadST(px, py, h.poly);
    if(!stt || stt.s < -0.05 || stt.s > 1.05 || stt.t < -0.05 || stt.t > 1.05){ continue; }
    var s01 = Math.max(0, Math.min(1, stt.s)), t01 = Math.max(0, Math.min(1, stt.t));
    var cu = h.cu;
    var u = (1-s01)*(1-t01)*cu[0][0] + s01*(1-t01)*cu[1][0] + s01*t01*cu[2][0] + (1-s01)*t01*cu[3][0];
    var v = (1-s01)*(1-t01)*cu[0][1] + s01*(1-t01)*cu[1][1] + s01*t01*cu[2][1] + (1-s01)*t01*cu[3][1];
    var ux = Math.max(0, Math.min(63, Math.floor(u)));
    var uy = Math.max(0, Math.min(63, Math.floor(v)));

    if(S.tool === 'picker'){
      var d = S.ctx.getImageData(ux, uy, 1, 1).data;
      if(d[3] > 0){
        S.color = '#' + [d[0], d[1], d[2]].map(function(q){ return ('0' + q.toString(16)).slice(-2); }).join('');
        var ci = $('sk-color'); if(ci){ ci.value = S.color; }
        st('Rang liya: ' + S.color, 'ok');
      }
      return true;
    }
    if(!insidePart(ux, uy)){ return true; }
    var size = Math.max(1, Math.min(8, S.brush || 1));
    var st0 = Math.floor((size - 1) / 2), en0 = Math.ceil((size - 1) / 2);
    for(var yy = uy - st0; yy <= uy + en0; yy++){
      for(var xx = ux - st0; xx <= ux + en0; xx++){
        if(xx < 0 || xx > 63 || yy < 0 || yy > 63 || !insidePart(xx, yy)){ continue; }
        if(S.tool === 'eraser'){ S.ctx.clearRect(xx, yy, 1, 1); }
        else { S.ctx.fillStyle = S.color; S.ctx.fillRect(xx, yy, 1, 1); }
      }
    }
    drawEditor();
    draw3D();
    return true;
  }
  return false;
};

window.skTap3D = function(ev){
  var cv = $('sk-3d');
  if(!cv || !S.ctx){ return; }
  var r = cv.getBoundingClientRect();
  var dpr = cv.width / r.width;
  var px = (ev.clientX - r.left) * dpr;
  var py = (ev.clientY - r.top) * dpr;
  for(var i = FACE_HITS.length - 1; i >= 0; i--){
    var h = FACE_HITS[i];
    if(!pointInPoly(px, py, h.poly)){ continue; }
    var q = h.poly, cu = h.cu;
    var ax = q[1][0] - q[0][0], ay = q[1][1] - q[0][1];
    var bx = q[3][0] - q[0][0], by = q[3][1] - q[0][1];
    var dx = px - q[0][0], dy = py - q[0][1];
    var det = ax * by - ay * bx;
    if(!det){ return; }
    var s2 = Math.max(0, Math.min(0.999, (dx * by - dy * bx) / det));
    var t2 = Math.max(0, Math.min(0.999, (ax * dy - ay * dx) / det));
    var u = Math.floor(cu[0][0] + s2 * (cu[1][0] - cu[0][0]));
    var v = Math.floor(cu[0][1] + t2 * (cu[3][1] - cu[0][1]));

    if(S.tool === 'picker'){
      try{
        var d = S.ctx.getImageData(u, v, 1, 1).data;
        if(d[3] > 0){
          S.color = '#' + [d[0], d[1], d[2]].map(function(x){ return ('0' + x.toString(16)).slice(-2); }).join('');
          var ci = $('sk-color'); if(ci){ ci.value = S.color; }
        }
      }catch(e){}
    } else if(S.tool === 'fill'){
      pushUndo();
      S.ctx.fillStyle = S.color;
      S.ctx.fillRect(cu[0][0], cu[0][1], cu[2][0] - cu[0][0], cu[2][1] - cu[0][1]);
    } else if(S.tool === 'eraser'){
      pushUndo();
      S.ctx.clearRect(u, v, 1, 1);
    } else {
      pushUndo();
      S.ctx.fillStyle = S.color;
      S.ctx.fillRect(u, v, 1, 1);
    }
    draw3D();
    return;
  }
};

/* ---------- Hide / Show Body Parts ---------- */

window.skHideDlg = function(){
  var old = $('sk-hide-dlg');
  if(old){ old.remove(); }
  var box = document.createElement('div');
  box.id = 'sk-hide-dlg';
  box.className = 'sk-modal';

  function part(key, cls){
    var off = !!S.hidden[key];
    return '<div class="bp ' + cls + (off ? ' off' : '') + '" data-k="' + key + '" onclick="skTogglePart(\'' + key + '\')"></div>';
  }

  box.innerHTML =
    '<div class="sk-dlg bp-dlg">' +
      '<div class="sk-dlg-h">Hide/Show Body Parts</div>' +
      '<div class="bp-fig">' +
        '<div class="bp-row">' + part('head', 'bp-head') + '</div>' +
        '<div class="bp-row">' + part('rightArm', 'bp-arm') + part('body', 'bp-torso') + part('leftArm', 'bp-arm') + '</div>' +
        '<div class="bp-row">' + part('rightLeg', 'bp-leg') + part('leftLeg', 'bp-leg') + '</div>' +
      '</div>' +
      '<div class="sk-dlg-f"><button class="act bp-ok" onclick="document.getElementById(\'sk-hide-dlg\').remove()">OK</button></div>' +
    '</div>';
  document.body.appendChild(box);
};

window.skTogglePart = function(k){
  S.hidden[k] = !S.hidden[k];
  var cell = document.querySelector('#sk-hide-dlg .bp[data-k="' + k + '"]');
  if(cell){ cell.classList.toggle('off', !!S.hidden[k]); }
  draw3D();
  st(k + (S.hidden[k] ? ' chhup gaya' : ' wapas dikh raha hai'), 'info');
};

/* ---------- Select Color palette ---------- */
var PALETTE = (function(){
  var rows = [
    ['#5b0f0f','#a51d1d','#e03131'],
    ['#5a2b00','#b35c00','#ff7a1a'],
    ['#5c5c00','#a8a800','#ffe600'],
    ['#0f4d0f','#1f9d1f','#57e389'],
    ['#004d4d','#009e9e','#33d6d6'],
    ['#0f2459','#1d4ed8','#60a5fa'],
    ['#3b0f5c','#7e22ce','#c084fc'],
    ['#2b2b2b','#7a7a7a','#e5e5e5']
  ];
  var skin = ['#5c3b1e','#9c6b3f','#e0b088'];
  return { rows: rows, skin: skin };
})();

window.skColorDlg = function(){
  var old = $('sk-color-dlg');
  if(old){ old.remove(); }
  var cells = '';
  PALETTE.rows.forEach(function(row){
    row.forEach(function(c){
      cells += '<button class="sk-sw" style="background:' + c + '" onclick="skPick(\'' + c + '\')"></button>';
    });
    cells += '<span style="width:8px"></span>';
    PALETTE.skin.forEach(function(c){
      cells += '<button class="sk-sw" style="background:' + c + '" onclick="skPick(\'' + c + '\')"></button>';
    });
    cells += '<div style="height:8px;grid-column:1/-1"></div>';
  });
  var box = document.createElement('div');
  box.id = 'sk-color-dlg';
  box.className = 'sk-modal';
  box.innerHTML =
    '<div class="sk-dlg">' +
      '<div class="sk-dlg-h">Select Color</div>' +
      '<div class="sk-swatches">' + cells + '</div>' +
      '<div class="sk-dlg-f">' +
        '<button class="act" onclick="document.getElementById(\'sk-color-dlg\').remove()">Cancel</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(box);
};

window.skPick = function(c){
  S.color = c;
  var ci = $('sk-color'); if(ci){ ci.value = c; }
  var old = $('sk-color-dlg'); if(old){ old.remove(); }
  st('Rang chuna: ' + c, 'ok');
};
window.skBrush = function(v){
  S.brush = Math.max(1, Math.min(8, parseInt(v, 10) || 1));
  var l = $('sk-brushval'); if(l){ l.textContent = S.brush + ' px'; }
};
window.skTexToggle = function(){
  var w = $('sk-texwrap');
  if(!w){ return; }
  var show = (w.style.display === 'none');
  w.style.display = show ? 'flex' : 'none';
  var b = $('sk-textoggle');
  if(b){ b.classList.toggle('pri', show); }
  if(show){ drawEditor(); }
};
window.skAuto = function(){
  S.autoRotate = !S.autoRotate;
  var b = $('sk-auto');
  if(b){ b.textContent = 'Auto Rotate: ' + (S.autoRotate ? 'ON' : 'OFF'); b.classList.toggle('pri', S.autoRotate); }
};
window.skZoom3D = function(d){
  S.zoom3d = Math.max(0.6, Math.min(2.2, S.zoom3d + d));
  draw3D();
  var l = $('sk-z3d'); if(l){ l.textContent = S.zoom3d.toFixed(2) + '×'; }
};

/* auto-rotate loop */
(function autoLoop(){
  if(S.autoRotate){
    S.yaw += 0.7;
    if(S.yaw > 360){ S.yaw -= 360; }
    draw3D();
  }
  requestAnimationFrame(autoLoop);
})();

window.skUndo = function(){
  if(!S.undo.length){ st('Undo ke liye kuch nahi.', 'info'); return; }
  S.redo.push(S.ctx.getImageData(0, 0, 64, 64));
  S.ctx.putImageData(S.undo.pop(), 0, 0);
  drawEditor(); draw3D();
};
window.skRedo = function(){
  if(!S.redo.length){ st('Redo ke liye kuch nahi.', 'info'); return; }
  S.undo.push(S.ctx.getImageData(0, 0, 64, 64));
  S.ctx.putImageData(S.redo.pop(), 0, 0);
  drawEditor(); draw3D();
};
window.skClear = function(){
  if(!confirm('Poori skin saaf karni hai?')){ return; }
  pushUndo();
  S.ctx.clearRect(0, 0, 64, 64);
  snapshotOrig();
  drawEditor(); draw3D();
  st('Skin saaf ho gayi.', 'ok');
};
window.skNew = function(){
  pushUndo();
  var c = newSkin(true);
  S.ctx.clearRect(0, 0, 64, 64);
  S.ctx.drawImage(c, 0, 0);
  snapshotOrig();
  drawEditor(); draw3D();
  st('New skin bani.', 'ok');
};
window.skRandom = function(){
  pushUndo();
  var c = newSkin(false);
  var x = c.getContext('2d');
  var palette = ['#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#4c8dff', '#22c55e', '#ef4444', '#f59e0b', '#a855f7', '#111827'];
  for(var i = 0; i < 64; i++){
    for(var j = 0; j < 64; j++){
      if(Math.random() < 0.72){
        x.fillStyle = palette[Math.floor(Math.random() * palette.length)];
        x.fillRect(i, j, 1, 1);
      }
    }
  }
  S.ctx.clearRect(0, 0, 64, 64);
  S.ctx.drawImage(c, 0, 0);
  snapshotOrig();
  drawEditor(); draw3D();
  st('Random skin ban gayi.', 'ok');
};
window.skRotate = function(d){ S.yaw += d; draw3D(); };

window.skUpload = function(file){
  if(!file){ return; }
  /* kuch pickers MIME type khaali bhejte hain — extension se bhi pehchano */
  var typeOk = /^image\//.test(file.type || '');
  var nameOk = /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name || '');
  if(!typeOk && !nameOk){ st('Ye image file nahi hai — PNG/JPG chuniye.', 'bad'); return; }
  st('Skin load ho rahi hai…', 'info');
  var fr = new FileReader();
  fr.onerror = function(){ st('File padhi nahi ja saki.', 'bad'); };
  fr.onload = function(){
    var img = new Image();
    img.onload = function(){
      var w = img.naturalWidth, h = img.naturalHeight;
      if(!w || !h){ st('Image khaali hai.', 'bad'); return; }
      /* 64x64 (ya purani 64x32) — baaki HD skins ko 64x64 par scale kar dete hain */
      var legacy = (h * 2 === w);
      var scaled = !(w === 64 && (h === 64 || h === 32));
      if(!legacy && w !== h){
        st('Ye skin image nahi lagti (' + w + '×' + h + '). Minecraft skin 64×64 hoti hai.', 'bad');
        return;
      }
      pushUndo();
      S.ctx.clearRect(0, 0, 64, 64);
      S.ctx.imageSmoothingEnabled = false;
      if(scaled){
        S.ctx.drawImage(img, 0, 0, w, h, 0, 0, 64, 64);
      } else {
        S.ctx.drawImage(img, 0, 0);
      }
      snapshotOrig();
      drawEditor(); draw3D();
      /* layout settle hone ke baad dobara render — warna preview adhoora dikhta hai */
      [120, 350, 700, 1200, 2000].forEach(function(ms){
        setTimeout(function(){ try{ schedule3D(); }catch(e){ draw3D(); } }, ms);
      });
      var msg = 'Skin load ho gayi (' + w + '×' + h + ')' +
         (scaled ? ' — 64×64 mein convert kar di.' : (h === 32 ? ' — purana format, outer layers seemit hain.' : '.'));
      st(msg, 'ok');
      setTimeout(function(){ st(msg, 'ok'); }, 2100);   /* re-render ke baad dobara */

    };
    img.onerror = function(){ st('Image khul nahi paayi.', 'bad'); };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
};

window.skDownload = function(){
  if(!S.skin){ return; }
  var name = (($('sk-name') || {}).value || 'minecraft-skin').trim().replace(/[^a-z0-9_-]/gi, '-');
  if(!/\.png$/i.test(name)){ name += '.png'; }
  var d = S.skin.toDataURL('image/png');
  var bin = atob(d.split(',')[1] || '');
  var arr = new Uint8Array(bin.length);
  for(var i = 0; i < bin.length; i++){ arr[i] = bin.charCodeAt(i); }
  var b = new Blob([arr], { type: 'image/png' });
  if(window.imSave){ imSave(b, name); }
  else { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); }
  st('✓ ' + name + ' download ho gayi (64×64 PNG). Ab Minecraft mein import kijiye.', 'ok');
};

window.skSaveProject = function(){
  var data = { v: 1, model: S.model, png: S.skin.toDataURL('image/png') };
  var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  if(window.imSave){ imSave(blob, 'skin-project.json'); }
  else { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'skin-project.json'; a.click(); }
  st('Project JSON save ho gaya.', 'ok');
};
window.skLoadProject = function(file){
  if(!file){ return; }
  var fr = new FileReader();
  fr.onload = function(){
    try{
      var o = JSON.parse(fr.result);
      var img = new Image();
      img.onload = function(){
        pushUndo();
        S.ctx.clearRect(0, 0, 64, 64);
        S.ctx.drawImage(img, 0, 0);
        drawEditor(); draw3D();
        st('Project load ho gaya.', 'ok');
      };
      img.src = o.png;
    }catch(e){ st('Project file galat hai.', 'bad'); }
  };
  fr.readAsText(file);
};

/* ---------------- panel ---------------- */
function build(){
  var main = document.querySelector('main');
  var grp = document.getElementById('g-mc');
  if(!main || !grp || document.getElementById('t-sk')){ return; }

  grp.insertAdjacentHTML('beforeend',
    '<button class="nav" onclick="openTool(\'sk\',this)">MC Skin Creator</button>');
  var cnt = document.querySelector('[data-g="mc"] .count');
  if(cnt){ cnt.textContent = String(document.querySelectorAll('#g-mc .nav').length); }

  main.insertAdjacentHTML('beforeend',
    '<section id="t-sk" class="tool">' +
      '<h2>MC Skin Creator</h2>' +
      '<p class="desc">Create a 64×64 skin or open your own PNG — pixel editor, live 3D preview and real skin PNG download. All in your browser, no server.</p>' +

      '<div class="row" style="flex-wrap:wrap">' +
        '<button class="act sk-tool" data-tool="eraser" onclick="skTool(\'eraser\')">Eraser</button>' +
        '<button class="act sk-tool" data-tool="fill" onclick="skTool(\'fill\')">Fill</button>' +
        '<button class="act sk-tool" data-tool="picker" onclick="skTool(\'picker\')">Picker</button>' +
        '<button class="act sk-tool" data-tool="move" onclick="skTool(\'move\')">Rotate</button>' +
        '<input type="color" id="sk-color" value="#4c8dff" onchange="skColor(this.value)" style="width:44px;height:32px;padding:0">' +
        '<button class="act" onclick="skUndo()" title="Undo">&lt;</button>' +
        '<button class="act" onclick="skRedo()" title="Redo">&gt;</button>' +
      '</div>' +
      '<div class="row" style="flex-wrap:wrap">' +
        '<button class="act" onclick="skZoom(-1)">−</button><span class="lbl" id="sk-zoom" style="width:auto">8×</span><button class="act" onclick="skZoom(1)">+</button>' +
      '</div>' +

      '<div class="row" style="flex-wrap:wrap">' +
        '<button class="act" onclick="skHideDlg()">Hide / Show Parts</button>' +
        '<button class="act" onclick="skColorDlg()">Select Color</button>' +
      '</div>' +


      '<div class="sk-stage">' +
        '<div class="sk-3dwrap"><canvas id="sk-3d"></canvas>' +
          '<div id="sk-empty" class="sk-empty"><div>Skin khaali hai</div><div style="font-size:11px;opacity:.7;margin-top:4px">Draw karein ya PNG upload kijiye</div></div>' +
        '</div>' +
        '<div class="sk-3dctl">' +
          '<button class="act" onclick="skZoom3D(-0.15)">Zoom −</button>' +
          '<button class="act" onclick="skZoom3D(0.15)">Zoom +</button>' +
        '</div>' +
        '<div class="sk-ov">' +
          '<button class="act" id="sk-ov-toggle" onclick="skOverlayToggle()">Overlay: ON</button>' +
        '</div>' +
      '</div>' +

      '<div class="row" style="flex-wrap:wrap;margin-top:10px">' +
        '<input type="file" id="sk-file" accept="image/png,image/jpeg,image/webp,image/gif,image/*" style="display:none">' +
        '<button class="act" onclick="document.getElementById(\'sk-file\').click()">Upload skin</button>' +
        '<button class="act" onclick="skClear()">Clear all</button>' +
      '</div>' +
      '<div class="row" style="flex-wrap:wrap">' +
        '<input type="text" id="sk-name" value="minecraft-skin" style="width:170px">' +
        '<button class="act pri" onclick="skDownload()">Download Skin PNG</button>' +
      '</div>' +
      '<div class="status" id="sk-st"></div>' +

      '<h3 style="font-size:13px;margin:16px 0 6px">Minecraft Bedrock / PE mein kaise lagayein</h3>' +
      '<ol style="font-size:12.5px;line-height:1.8;color:var(--muted);padding-left:18px;margin:0">' +
        '<li>"Download Skin PNG" dabaiye.</li>' +
        '<li>Minecraft Bedrock/PE kholiye.</li>' +
        '<li>Dressing Room / Profile kholein.</li>' +
        '<li>Edit Character → Classic Skins / Owned Skins.</li>' +
        '<li>Import / Choose New Skin.</li>' +
        '<li>Downloads se <b>minecraft-skin.png</b> chuniye.</li>' +
        '<li>Model chuniye — Classic (Steve) ya Slim (Alex).</li>' +
        '<li>Apply/Confirm kijiye.</li>' +
      '</ol>' +
      '<div style="font-size:12px;color:var(--warn);margin-top:8px">Website seedha skin install nahi kar sakti — Minecraft ka import screen hi use karna padta hai. Ye tool sahi 64×64 PNG deta hai, bas.</div>' +

      '<h3 style="font-size:13px;margin:16px 0 6px">Minecraft Java Edition</h3>' +
      '<div style="font-size:12.5px;line-height:1.8;color:var(--muted)">' +
        'Wahi 64×64 PNG use hoti hai. Java Launcher → Minecraft: Java Edition → Skins → New skin → file upload. ' +
        'Slim (Alex) chuniye to 3px patli bahein hongi. Website aapke Microsoft account mein skin upload nahi kar sakti — uske liye login/authorization chahiye, isliye hum kabhi password nahi maangte.' +
      '</div>' +
    '</section>');

  /* init */
  if(window.innerWidth <= 760){ S.zoom = 6; }
  S.skin = newSkin(false);
  S.ctx = S.skin.getContext('2d');
  S.ctx.imageSmoothingEnabled = false;
  var base = newSkin(false);
  S.ctx.drawImage(base, 0, 0);
  drawEditor();
  draw3D();
  var zl0 = $('sk-zoom'); if(zl0){ zl0.textContent = S.zoom + '×'; }

  /* events */
  var cv = $('sk-canvas');
  var drawing = false;
  function down(e){
    e.preventDefault();
    pushUndo();
    drawing = true;
    paintAt(e);
  }
  function move(e){
    if(!drawing){ return; }
    e.preventDefault();
    paintAt(e);
  }
  function up(){ drawing = false; }
  /* 2D canvas hata diya gaya hai — sirf tab bind karo jab wo maujood ho */
  if(cv){
    cv.addEventListener('mousedown', down);
    cv.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    cv.addEventListener('touchstart', down, { passive:false });
    cv.addEventListener('touchmove', move, { passive:false });
    cv.addEventListener('touchend', up);
  }

  /* 3D rotate by drag */
  var cv3 = $('sk-3d');
  var rot = false, lastX = 0, lastY = 0;
  function pitchAdd(dy){
    S.pitch = Math.max(-75, Math.min(75, (S.pitch || 0) + dy * 0.4));
  }
  var tapMoved = false, tapX = 0, painting3D = false;
  cv3.addEventListener('mousedown', function(e){
    /* screen par drag = skin ghumao (har tool mein) */
    rot = true; tapMoved = false; lastX = e.clientX; lastY = e.clientY; tapX = e.clientX;
    painting3D = false;
  });
  cv3.addEventListener('click', function(e){ if(!tapMoved){ skTap3D(e); } });
  window.addEventListener('mousemove', function(e){
    if(rot && Math.abs(e.clientX - tapX) > 6){ tapMoved = true; }
    if(painting3D){ skPaint3D(e); }
  });
  window.addEventListener('mouseup', function(){ painting3D = false; });
  window.addEventListener('mousemove', function(e){
    if(!rot){ return; }
    S.yaw += (e.clientX - lastX) * 0.6;
    pitchAdd(e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
    draw3D();
  });
  window.addEventListener('mouseup', function(){ rot = false; });
  var tMoved = false, tX = 0;
  cv3.addEventListener('touchstart', function(e){
    /* touch drag = skin ghumao */
    rot = true; tMoved = false;
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; tX = e.touches[0].clientX;
    painting3D = false;
  }, { passive:true });
  cv3.addEventListener('touchend', function(e){
    if(painting3D){ painting3D = false; return; }
    if(!tMoved && e.changedTouches && e.changedTouches[0]){
      skTap3D({ clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY });
    }
  });
  cv3.addEventListener('touchmove', function(e){
    if(!rot){ return; }
    if(Math.abs(e.touches[0].clientX - tX) > 6){ tMoved = true; }
    S.yaw += (e.touches[0].clientX - lastX) * 0.6;
    pitchAdd(e.touches[0].clientY - lastY);
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
    draw3D();
    if(e.cancelable){ e.preventDefault(); }
  }, { passive:false });
  cv3.addEventListener('touchend', function(){ rot = false; });

  /* preview ko container ke size par fit rakho */
  var pv = $('sk-3d');
  if(pv && pv.parentElement){
    if(window.ResizeObserver){
      try{
        var ro = new ResizeObserver(function(){ schedule3D(); });
        ro.observe(pv.parentElement);
      }catch(e){}
    }
    window.addEventListener('resize', schedule3D);
    window.addEventListener('orientationchange', function(){ setTimeout(schedule3D, 250); });
  }
  schedule3D();

  var f = $('sk-file');
  if(f){ f.addEventListener('change', function(){ skUpload(f.files[0]); f.value = ''; }); }
  var pj = $('sk-proj');
  if(pj){ pj.addEventListener('change', function(){ skLoadProject(pj.files[0]); pj.value = ''; }); }
}

var css = document.createElement('style');
css.textContent =
  /* dono ek hi card mein — 3D upar, texture neeche */
  '.sk-stage{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff;margin-bottom:12px}' +
  '.sk-3dwrap{position:relative;display:flex;justify-content:center;width:100%;background:#fff}' +
  '.sk-3dctl{display:flex;gap:6px;justify-content:space-between;align-items:center;flex-wrap:wrap;padding:8px 6px;background:#fff;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}' +
  '.sk-3dctl .act{min-height:28px;padding:3px 9px;font-size:11.5px}' +
  '.sk-ov{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 6px;background:#fff;border-bottom:1px solid var(--line)}' +
  '.sk-ov .act{min-height:28px;padding:3px 9px;font-size:11.5px}' +
  '.sk-ovp{opacity:.45}' +
  '.sk-ovp.on{opacity:1;font-weight:700}' +
  '.sk-texwrap{display:flex;justify-content:center;padding:10px;background:#fff}' +
  '.sk-modal{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px}' +
  '.sk-dlg{background:#1c2737;border:1px solid var(--line);border-radius:14px;max-width:360px;width:100%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6)}' +
  '.sk-dlg-h{background:#1e9df5;color:#fff;font-weight:700;font-size:15px;padding:12px;text-align:center}' +
  '.sk-figure{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(8,26px);gap:6px;padding:18px 22px;background:#f2f4f7}' +
  '.sk-cell{background:#19d219;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#0a3d0a;font-weight:700;cursor:pointer;user-select:none}' +
  '.sk-cell.off{background:#d61b1b;color:#fff}' +
  '.sk-swatches{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;padding:16px;background:#f2f4f7;align-items:center}' +
  '.sk-sw{aspect-ratio:1;border:0;border-radius:2px;cursor:pointer;padding:0}' +
  '.sk-dlg-f{display:flex;gap:10px;padding:12px;background:#f2f4f7;border-top:1px solid #d8dde3}' +
  '.sk-dlg-f .act{flex:1;background:#1e9df5;color:#fff}' +
  '.bp-dlg{background:#e9e9e9!important;max-width:340px!important}' +
  '.bp-dlg .sk-dlg-h{background:#3a97d4!important;color:#fff!important;font-size:17px!important;padding:14px!important}' +
  '.bp-fig{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 20px 8px;background:#e9e9e9}' +
  '.bp-row{display:flex;gap:7px;align-items:flex-start;justify-content:center}' +
  '.bp{background:#00e000;cursor:pointer;transition:background .12s,transform .1s}' +
  '.bp:active{transform:scale(.96)}' +
  '.bp.off{background:#e00000}' +
  '.bp-head{width:64px;height:64px}' +
  '.bp-torso{width:64px;height:92px}' +
  '.bp-arm{width:30px;height:92px}' +
  '.bp-leg{width:30px;height:78px}' +
  '.bp-dlg .sk-dlg-f{background:#e9e9e9!important;border-top:0!important;justify-content:center;padding:8px 14px 16px!important}' +
  'body .bp-dlg .sk-dlg-f .bp-ok{flex:0 0 auto!important;min-width:170px!important;height:40px!important;' +
    'background:#3a97d4!important;border:1px solid #3a97d4!important;color:#fff!important;' +
    'font-size:15px!important;font-weight:600!important;box-shadow:none!important}' +
  'body .bp-dlg .sk-dlg-f .bp-ok:hover{background:#3289c2!important;border-color:#3289c2!important;color:#fff!important}' +
  '.sk-3dwrap{position:relative;display:flex;justify-content:center;align-items:center;width:100%;max-width:100%;background:#fff}' +
  '#sk-3d{display:block;border:0;background:#fff;touch-action:none;max-width:100%}' +
  '.sk-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'color:rgba(255,255,255,.65);font-size:13px;pointer-events:none;text-align:center;border-radius:10px}';
document.head.appendChild(css);

build();

})();

/* ===== colorpicker ===== */
// @ts-nocheck — plain JavaScript file, TypeScript type-checking not needed

/* ===================================================================
   GLOBAL COLOR PICKER — gradient + hue + hex
   Har <input type="color"> par yahi khulta hai
   =================================================================== */
(function(){

var CP = {
  h: 0, s: 1, v: 1,
  target: null,
  cb: null,
  el: null
};

function $(id){ return document.getElementById(id); }

/* ---------- colour maths ---------- */
function hsv2rgb(h, s, v){
  h = ((h % 360) + 360) % 360;
  var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  var r = 0, g = 0, b = 0;
  if(h < 60){ r = c; g = x; }
  else if(h < 120){ r = x; g = c; }
  else if(h < 180){ g = c; b = x; }
  else if(h < 240){ g = x; b = c; }
  else if(h < 300){ r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
function rgb2hsv(r, g, b){
  r /= 255; g /= 255; b /= 255;
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  var h = 0;
  if(d){
    if(mx === r){ h = 60 * (((g - b) / d) % 6); }
    else if(mx === g){ h = 60 * ((b - r) / d + 2); }
    else { h = 60 * ((r - g) / d + 4); }
  }
  if(h < 0){ h += 360; }
  return [h, mx ? d / mx : 0, mx];
}
function hex2rgb(h){
  h = String(h || '').replace('#', '').trim();
  if(h.length === 3){ h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; }
  if(!/^[0-9a-fA-F]{6}$/.test(h)){ return null; }
  var n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb2hex(r, g, b){
  function f(x){ x = Math.max(0, Math.min(255, Math.round(x))); return ('0' + x.toString(16)).slice(-2).toUpperCase(); }
  return '#' + f(r) + f(g) + f(b);
}

/* ---------- UI ---------- */
function build(){
  if(CP.el){ return; }
  var d = document.createElement('div');
  d.id = 'cp-modal';
  d.className = 'cp-modal';
  d.innerHTML =
    '<div class="cp-dlg">' +
      '<div class="cp-head">Select Color</div>' +
      '<div class="cp-body">' +
        '<div class="cp-area">' +
          '<canvas id="cp-sv" width="240" height="240"></canvas>' +
          '<div id="cp-cursor" class="cp-cursor"></div>' +
        '</div>' +
        '<div class="cp-hue"><canvas id="cp-huec" width="26" height="240"></canvas>' +
          '<div id="cp-hcur" class="cp-hcur"></div>' +
        '</div>' +
      '</div>' +
      '<div class="cp-row">' +
        '<div id="cp-prev" class="cp-prev"></div>' +
        '<span class="cp-hash">#</span>' +
        '<input id="cp-hex" class="cp-hex" maxlength="7" spellcheck="false" placeholder="FF0000">' +
      '</div>' +
      '<div class="cp-actions">' +
        '<button class="cp-btn" onclick="CPCancel()">Cancel</button>' +
        '<button class="cp-btn cp-ok" onclick="CPOk()">OK</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(d);
  CP.el = d;

  /* hue strip */
  var hc = $('cp-huec'), hx = hc.getContext('2d');
  for(var y = 0; y < 240; y++){
    var hh = (y / 240) * 360;
    var c = hsv2rgb(hh, 1, 1);
    hx.fillStyle = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    hx.fillRect(0, y, 26, 1);
  }

  bindDrag($('cp-sv'), function(x, y, w, h){
    CP.s = Math.max(0, Math.min(1, x / w));
    CP.v = 1 - Math.max(0, Math.min(1, y / h));
    paint();
  });
  bindDrag(hc, function(x, y, w, h){
    CP.h = Math.max(0, Math.min(359.9, (y / h) * 360));
    paint();
  });

  $('cp-hex').addEventListener('input', function(){
    var rgb = hex2rgb(this.value);
    if(rgb){
      var hsv = rgb2hsv(rgb[0], rgb[1], rgb[2]);
      CP.h = hsv[0]; CP.s = hsv[1]; CP.v = hsv[2];
      paint(true);
    }
  });

  d.addEventListener('click', function(e){ if(e.target === d){ CPCancel(); } });
}

function bindDrag(cv, fn){
  function pos(e){
    var r = cv.getBoundingClientRect();
    var cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    var cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    fn(cx, cy, r.width, r.height);
  }
  var down = false;
  cv.addEventListener('mousedown', function(e){ down = true; e.preventDefault(); pos(e); });
  window.addEventListener('mousemove', function(e){ if(down){ pos(e); } });
  window.addEventListener('mouseup', function(){ down = false; });
  cv.addEventListener('touchstart', function(e){ down = true; e.preventDefault(); pos(e); }, { passive:false });
  cv.addEventListener('touchmove', function(e){ if(down){ e.preventDefault(); pos(e); } }, { passive:false });
  cv.addEventListener('touchend', function(){ down = false; });
}

function paint(skipHex){
  var sv = $('cp-sv');
  if(!sv){ return; }
  var w = sv.width, h = sv.height, x = sv.getContext('2d');
  var base = hsv2rgb(CP.h, 1, 1);
  x.fillStyle = 'rgb(' + base[0] + ',' + base[1] + ',' + base[2] + ')';
  x.fillRect(0, 0, w, h);
  var g1 = x.createLinearGradient(0, 0, w, 0);
  g1.addColorStop(0, 'rgba(255,255,255,1)');
  g1.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g1; x.fillRect(0, 0, w, h);
  var g2 = x.createLinearGradient(0, 0, 0, h);
  g2.addColorStop(0, 'rgba(0,0,0,0)');
  g2.addColorStop(1, 'rgba(0,0,0,1)');
  x.fillStyle = g2; x.fillRect(0, 0, w, h);

  var cur = $('cp-cursor');
  if(cur){ cur.style.left = (CP.s * 100) + '%'; cur.style.top = ((1 - CP.v) * 100) + '%'; }
  var hc = $('cp-hcur');
  if(hc){ hc.style.top = ((CP.h / 360) * 100) + '%'; }

  var rgb = hsv2rgb(CP.h, CP.s, CP.v);
  var hex = rgb2hex(rgb[0], rgb[1], rgb[2]);
  var prev = $('cp-prev');
  if(prev){ prev.style.background = hex; }
  if(!skipHex){
    var inp = $('cp-hex');
    if(inp){ inp.value = hex.slice(1); }
  }
}

window.openColorPicker = function(initial, cb){
  build();
  var rgb = hex2rgb(initial || '#4c8dff') || [76, 141, 255];
  var hsv = rgb2hsv(rgb[0], rgb[1], rgb[2]);
  CP.h = hsv[0]; CP.s = hsv[1]; CP.v = hsv[2];
  CP.cb = cb || null;
  CP.el.style.display = 'flex';
  paint();
};
window.CPCancel = function(){
  if(CP.el){ CP.el.style.display = 'none'; }
  CP.cb = null;
};
window.CPOk = function(){
  var rgb = hsv2rgb(CP.h, CP.s, CP.v);
  var hex = rgb2hex(rgb[0], rgb[1], rgb[2]);
  var cb = CP.cb;
  if(CP.el){ CP.el.style.display = 'none'; }
  CP.cb = null;
  if(cb){ cb(hex); }
};

/* ---------- har colour input par hook ---------- */
function hook(){
  document.addEventListener('click', function(e){
    var el = e.target;
    if(!el || el.tagName !== 'INPUT' || el.type !== 'color'){ return; }
    e.preventDefault();
    e.stopPropagation();
    openColorPicker(el.value || '#4c8dff', function(hex){
      el.value = hex;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }, true);
}

/* ---------- CSS ---------- */
var css = document.createElement('style');
css.textContent =
  '.cp-modal{position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.62);display:none;align-items:center;justify-content:center;padding:16px}' +
  '.cp-dlg{width:100%;max-width:330px;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.5);color:#222}' +
  '.cp-head{background:#3a97d4;color:#fff;text-align:center;font-size:17px;font-weight:600;padding:12px}' +
  '.cp-body{display:flex;gap:10px;padding:14px 14px 6px;background:#eceff1}' +
  '.cp-area{position:relative;flex:1;min-width:0}' +
  '#cp-sv{display:block;width:100%;height:auto;aspect-ratio:1/1;border-radius:0;cursor:crosshair;touch-action:none}' +
  '.cp-cursor{position:absolute;width:12px;height:12px;border:2px solid #fff;border-radius:50%;' +
    'transform:translate(-50%,-50%);box-shadow:0 0 0 1px rgba(0,0,0,.5);pointer-events:none}' +
  '.cp-hue{position:relative;width:26px;flex:0 0 26px;display:flex}' +
  '#cp-huec{display:block;width:26px;height:100%;border-radius:0;cursor:pointer;touch-action:none}' +
  '.cp-hcur{position:absolute;left:-3px;right:-3px;height:4px;background:#fff;border:1px solid #666;' +
    'transform:translateY(-50%);pointer-events:none}' +
  '.cp-row{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#eceff1}' +
  '.cp-prev{width:40px;height:40px;border:1px solid #b0bec5;border-radius:0;flex:0 0 40px}' +
  '.cp-hash{font-size:15px;color:#37474f}' +
  '.cp-hex{flex:1;min-width:0;height:40px;border:1px solid #b0bec5;border-radius:0;background:#cfd8dc;' +
    'color:#263238;font-size:15px;padding:0 10px;letter-spacing:.06em;text-transform:uppercase}' +
  '.cp-actions{display:flex;gap:10px;padding:12px 14px 16px;background:#eceff1}' +
  '.cp-btn{flex:1;height:40px;border:0;border-radius:0;background:#3a97d4;color:#fff;font-size:15px;font-weight:600;cursor:pointer}' +
  '.cp-btn:hover{background:#3289c2}' +
  '.cp-ok{background:#3a97d4}' +
  '@media (max-width:380px){.cp-dlg{max-width:100%}}';
document.head.appendChild(css);

hook();

})();

/* ===== forceBlackText ===== */
/* light theme mein saara text kaala — JS se pakka */
(function(){
  var SKIP = /^(SCRIPT|STYLE|CANVAS|IMG|SVG|PATH|CIRCLE|RECT|LINE|TEXT|G|DEFS|POLYGON|ELLIPSE)$/;
  function paint(root){
    if(!document.body){ return; }
    var light = document.body.classList.contains('light');
    var col = light ? '#0a0a0a' : '#ffffff';
    var nodes = (root || document.body).querySelectorAll('*');
    for(var i = 0; i < nodes.length; i++){
      var el = nodes[i];
      if(SKIP.test(el.tagName)){ continue; }
      /* skin ka 3D stage gehra hai — wahan text safed hi rahe */
      if(el.closest && el.closest('.sk-stage')){ continue; }
      el.style.setProperty('color', col, 'important');
      if(el.style.borderTopWidth || /^(INPUT|TEXTAREA|SELECT|BUTTON|TABLE|TD|TH)$/.test(el.tagName) ||
         /\.(act|pri|up-btn|panel|card|mc-card|sk-stage|drop|thumb|grp-btn|nav|status|mc-thumb|burger|themebtn|search)/.test(el.className)){
        el.style.setProperty('border-color', col, 'important');
      }
    }
  }
  window.__fbt = paint;
  var t = null;
  function later(){ clearTimeout(t); t = setTimeout(function(){ paint(); }, 60); }

  function hook(name){
    if(typeof window[name] !== 'function'){ return; }
    var orig = window[name];
    window[name] = function(){
      var r = orig.apply(this, arguments);
      paint();
      later();
      setTimeout(paint, 150);
      setTimeout(paint, 400);
      return r;
    };
  }

  function boot(){
    paint();
    hook('openTool');
    hook('toggleTheme');
    hook('applyTheme');
    hook('burgerClick');
    hook('toggleGroup');
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot, 300); });
  } else { setTimeout(boot, 300); }
  setTimeout(boot, 900);
})();

/* ===== hideOutputTillClick ===== */
/* output box pehle chhupa rahe — button dabane par dikhe */
(function(){
  function isLive(panel){
    var ins = panel.querySelectorAll('input,textarea,select');
    for(var i = 0; i < ins.length; i++){
      if(ins[i].hasAttribute('oninput') || ins[i].hasAttribute('onchange')){ return true; }
    }
    return false;
  }
  function setup(panel){
    if(!panel || panel.dataset.outGate === '1'){ return; }
    var outs = panel.querySelectorAll('[id$="-out"],[id$="Out"]');
    if(!outs.length){ return; }
    if(isLive(panel)){ return; }              /* live tools chhod do */
    panel.dataset.outGate = '1';
    Array.prototype.forEach.call(outs, function(o){ o.style.display = 'none'; });
    panel.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('button') : null;
      if(!b){ return; }
      Array.prototype.forEach.call(outs, function(o){ o.style.display = ''; });
    }, true);
  }
  function scan(){
    document.querySelectorAll('.tool.active').forEach(setup);
  }
  var t = null;
  function later(){ clearTimeout(t); t = setTimeout(scan, 100); }
  function hook(name){
    if(typeof window[name] !== 'function'){ return; }
    var orig = window[name];
    window[name] = function(){ var r = orig.apply(this, arguments); later(); return r; };
  }
  function boot(){ hook('openTool'); scan(); }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
  setTimeout(boot, 600);
  setInterval(scan, 800);
})();

/* ===== data.json (optional tool catalogue) ===== */
(function(){
  try{
    if(typeof fetch !== 'function'){ return; }
    fetch(window.TOOL_DATA_URL || 'data.json').then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){ if(d && d.tools){ window.__toolData = d; } })
      .catch(function(){ /* file:// par fetch block ho sakta hai — koi baat nahi */ });
  }catch(e){}
})();
