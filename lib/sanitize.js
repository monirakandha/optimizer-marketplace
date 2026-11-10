(function (global) {
  function asText(value) {
    return typeof value === 'string' ? value : '';
  }

  function setText(el, value) {
    if (el) el.textContent = asText(value);
  }

  function clear(el) {
    if (el) el.textContent = '';
  }

  function create(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (k === 'className') el.className = v;
        else if (k === 'text') el.textContent = asText(v);
        else if (k === 'title') el.title = asText(v);
        else if (k === 'style' && v && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset' && v) Object.entries(v).forEach(([dk, dv]) => { el.dataset[dk] = asText(dv); });
        else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, String(v));
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach((c) => {
        if (c == null) return;
        if (typeof c === 'string') el.appendChild(document.createTextNode(c));
        else el.appendChild(c);
      });
    }
    return el;
  }

  const api = { setText, clear, create, asText };
  global.FlexloopSafeDOM = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
