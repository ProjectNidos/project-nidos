/*
 * The template engine both page generators share.
 *
 * Deliberately tiny and deliberately not a library: three substitutions and a
 * block hook. Blocks are plain functions supplied by each build script, so the
 * repeated markup (six practices, seven form options, footer columns) is built
 * in JavaScript rather than by inventing a loop syntax.
 */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESC[c]);

const INDENT = (n) => ' '.repeat(n);

/* Dot-path lookup that throws rather than rendering "undefined" into a page. */
function get(obj, pathStr) {
    const value = pathStr.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
    if (value === undefined || value === null) throw new Error(`missing content key: ${pathStr}`);
    return value;
}

function render(template, content, blocks) {
    let out = template;

    // Blocks first: they introduce markup that must not then be scanned for slots.
    out = out.replace(/^[ \t]*\{\{BLOCK:(\w+)\}\}[ \t]*$/gm, (_, name) => {
        if (!blocks[name]) throw new Error(`unknown block: ${name}`);
        return blocks[name](content);
    });

    /* {{{path}}} — raw HTML, for the few strings carrying inline markup
       (<strong>, <span class="key">). Never given a data-cms key: CMS overrides
       are text-only and would strip the tags. */
    out = out.replace(/\{\{\{([\w.]+)\}\}\}/g, (_, p) => String(get(content, p)));

    // {{path}} — escaped text
    out = out.replace(/\{\{([\w.]+)\}\}/g, (_, p) => esc(get(content, p)));

    const leftover = out.match(/\{\{[^}]*\}\}/);
    if (leftover) throw new Error(`unfilled slot: ${leftover[0]}`);
    return out;
}

/* Every data-cms key on a rendered page, sorted - the fields the admin panel
   will offer for it. */
const cmsKeys = (html) => [...html.matchAll(/data-cms="([^"]+)"/g)].map((m) => m[1]).sort();

module.exports = { esc, get, render, cmsKeys, INDENT };
