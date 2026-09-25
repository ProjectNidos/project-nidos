/*
 * The site's own stylesheets read as rules, and a block's rules scoped to the
 * block (plan 1b; spec §14). Not a general CSS parser: it reads plain rules
 * and one level of @media or @supports, which is all the site's sheets use,
 * and throws on anything else rather than guess. It assumes no string in a
 * sheet holds a brace, a semicolon or a comment marker; the site's have none.
 */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const squash = (s) => s.replace(/\s+/g, ' ').trim();

// Commas inside :is(...) and the like do not separate selectors.
function splitSelectors(prelude) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < prelude.length; i++) {
    if (prelude[i] === '(') depth++;
    else if (prelude[i] === ')') depth--;
    else if (prelude[i] === ',' && depth === 0) {
      out.push(prelude.slice(start, i));
      start = i + 1;
    }
  }
  out.push(prelude.slice(start));
  return out.map(squash).filter(Boolean);
}

// The index of the "}" that closes the "{" at `open`.
function closing(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return i;
  }
  throw new Error('css: a "{" is never closed');
}

// [{ at: '@media (max-width: 720px)' or null, selectors: [...], decls: [...] }]
function parseCss(text, at = null) {
  const src = stripComments(text);
  const rules = [];
  let i = 0;
  for (;;) {
    const open = src.indexOf('{', i);
    const prelude = squash(src.slice(i, open === -1 ? undefined : open));
    if (open === -1) {
      if (prelude) throw new Error(`css: "${prelude.slice(0, 40)}" is outside any rule`);
      return rules;
    }
    if (/[;}]/.test(prelude)) throw new Error(`css: cannot read "${prelude.slice(0, 40)}"`);
    const end = closing(src, open);
    const inner = src.slice(open + 1, end);
    if (prelude.startsWith('@')) {
      if (at || !/^@(media|supports)\b/.test(prelude)) throw new Error(`css: "${prelude}" is not supported here`);
      rules.push(...parseCss(inner, prelude));
    } else {
      if (inner.includes('{')) throw new Error(`css: nested rules in "${prelude}" are not supported`);
      rules.push({ at, selectors: splitSelectors(prelude), decls: inner.split(';').map(squash).filter(Boolean) });
    }
    i = end + 1;
  }
}

/* :where() adds no specificity, so a scoped rule weighs exactly what it
   weighed in the sheet it came from, and the cascade between the blocks,
   base.css and the frames is decided as it was. "&" is the block's own
   element and starts the selector: "&.hero" is the section itself,
   ".hero-title" anything inside it. */
function scopeSelector(selector, type) {
  const where = `blocks/${type}/style.css: "${selector}"`;
  if (/^(html|body|:root)(?![\w-])/.test(selector)) {
    throw new Error(`${where} reaches outside the block; page rules belong in server/cms/styles/`);
  }
  if (/\.b-[a-z]/.test(selector)) throw new Error(`${where} names a block class; write "&" for the block's own element`);
  const scope = `:where(.b-${type})`;
  if (!selector.includes('&')) return `${scope} ${selector}`;
  const rest = selector.slice(1);
  if (selector[0] !== '&' || rest.includes('&') || /^[a-z]/i.test(rest)) {
    throw new Error(`${where}: "&" starts a selector, followed by the element's class`);
  }
  return scope + rest;
}

function scopeCss(text, type) {
  let out = '';
  let open = null;
  for (const r of parseCss(text)) {
    if (r.at !== open) {
      if (open) out += '}\n';
      if (r.at) out += `${r.at} {\n`;
      open = r.at;
    }
    out += `${r.selectors.map((s) => scopeSelector(s, type)).join(', ')} { ${r.decls.map((d) => `${d};`).join(' ')} }\n`;
  }
  return open ? `${out}}\n` : out;
}

module.exports = { parseCss, scopeCss, scopeSelector, stripComments };
