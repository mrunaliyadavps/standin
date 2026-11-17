/**
 * This script runs INSIDE the page being tested. It measures every interactive
 * element: its accessible name, size, font size, colour contrast, and whether
 * it is a real control or just a clickable <div>.
 *
 * It is kept as a plain string on purpose. Code passed to the browser must be
 * self-contained, and build tools can inject helpers that don't exist there.
 */
export const OBSERVE_SCRIPT = String.raw`(() => {
  const NATIVE = 'a[href], button, input:not([type=hidden]), select, textarea, summary';
  const ROLES = '[role=button], [role=link], [role=checkbox], [role=radio], [role=tab], [role=menuitem], [role=option], [role=switch]';

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0.05;
  };

  const parseColor = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const background = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = parseColor(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.5) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const contrast = (el) => {
    const fg = parseColor(getComputedStyle(el).color);
    if (!fg) return null;
    const a = lum(fg), b = lum(background(el));
    return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
  };

  const text = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const accessibleName = (el) => {
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const t = by.split(/\s+/).map((id) => text(document.getElementById(id) || document.createElement('i'))).join(' ').trim();
      if (t) return t;
    }
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
      if (el.id) {
        const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (l && text(l)) return text(l);
      }
      const wrap = el.closest('label');
      if (wrap && text(wrap)) return text(wrap);
      if (el.type === 'submit' || el.type === 'button') return el.value || '';
      return el.getAttribute('title') || el.getAttribute('placeholder') || '';
    }
    const t = text(el);
    if (t) return t;
    const img = el.querySelector('img[alt]');
    if (img && img.getAttribute('alt')) return img.getAttribute('alt');
    return el.getAttribute('title') || '';
  };

  const region = (el) => {
    if (el.closest('nav, header, [role=navigation], [role=banner]')) return 'nav';
    if (el.closest('footer, [role=contentinfo]')) return 'footer';
    return 'main';
  };

  // Real controls, plus anything that merely LOOKS clickable (pointer cursor).
  const found = new Set(document.querySelectorAll(NATIVE + ', ' + ROLES));
  document.querySelectorAll('body *').forEach((el) => {
    if (found.has(el) || el.closest(NATIVE + ', ' + ROLES)) return;
    if (getComputedStyle(el).cursor !== 'pointer') return;
    const parent = el.parentElement;
    if (parent && parent !== document.body && getComputedStyle(parent).cursor === 'pointer') return;
    found.add(el);
  });

  const list = Array.from(found).filter(visible);
  list.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

  // Sibling options (three or more similar controls under one parent) form a group.
  const parents = new Map();
  list.forEach((el) => {
    const p = el.parentElement;
    if (!p) return;
    const key = el.tagName + '.' + el.className;
    if (!parents.has(p)) parents.set(p, new Map());
    const m = parents.get(p);
    m.set(key, (m.get(key) || 0) + 1);
  });
  const groupIds = new Map();
  const groupOf = (el) => {
    const p = el.parentElement;
    if (!p || !parents.has(p)) return null;
    if ((parents.get(p).get(el.tagName + '.' + el.className) || 0) < 3) return null;
    if (!groupIds.has(p)) groupIds.set(p, groupIds.size + 1);
    return groupIds.get(p);
  };

  const seen = new Map();
  const vh = window.innerHeight, vw = window.innerWidth;
  const elements = list.map((el, i) => {
    el.setAttribute('data-standin-id', String(i));
    const r = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    const native = el.matches(NATIVE);
    const name = accessibleName(el).slice(0, 120);
    const kind = tag === 'a' || role === 'link' ? 'link'
      : tag === 'select' ? 'select'
      : (tag === 'input' && !/^(submit|button|checkbox|radio)$/.test(el.type)) || tag === 'textarea' ? 'input'
      : native || role ? 'button' : 'clickable';
    const base = tag + ':' + name;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return {
      id: i,
      sig: base + ':' + n,
      tag,
      kind,
      inputType: tag === 'input' ? el.type : undefined,
      value: 'value' in el ? String(el.value || '') : undefined,
      name,
      semantic: native || !!role,
      iconOnly: !text(el) && kind !== 'input' && kind !== 'select',
      box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      fontSize: parseFloat(getComputedStyle(el).fontSize),
      contrast: contrast(el),
      inViewport: r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw,
      region: region(el),
      group: groupOf(el),
      disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true',
    };
  });

  return {
    url: location.href,
    title: document.title,
    elements,
    scrollY: Math.round(window.scrollY),
    maxScrollY: Math.max(0, Math.round(document.documentElement.scrollHeight - vh)),
  };
})()`;
