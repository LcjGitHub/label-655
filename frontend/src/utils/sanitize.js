import DOMPurify from 'dompurify'

const isSafeImageUrl = (url) => {
  if (!url) return false
  if (url.startsWith('/uploads/')) return true
  if (url.startsWith('http://') || url.startsWith('https://')) return true
  return false
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'IMG') {
    const src = node.getAttribute('src')
    if (!isSafeImageUrl(src)) {
      node.removeAttribute('src')
      node.remove()
    }
  }
  if (node.tagName === 'A') {
    const href = node.getAttribute('href')
    if (href && (href.startsWith('javascript:') || href.startsWith('data:') || href.startsWith('vbscript:'))) {
      node.removeAttribute('href')
    }
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

const purifyConfig = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
    'ul', 'ol', 'li',
    'a', 'img',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'code', 'pre', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'span', 'div'
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel',
    'src', 'alt', 'title',
    'class', 'style'
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_ATTR: [
    'onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout',
    'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset',
    'onselect', 'onkeydown', 'onkeypress', 'onkeyup',
    'ondblclick', 'onmousedown', 'onmousemove', 'onmouseup',
    'onabort', 'onunload', 'onresize', 'onscroll',
    'formaction', 'formmethod', 'formenctype', 'formtarget',
    'ping', 'srcdoc', 'sandbox', 'seamless',
    'contextmenu', 'dropzone', 'contenteditable', 'draggable',
    'spellcheck', 'translate', 'hidden'
  ],
  FORBID_TAGS: [
    'script', 'style', 'iframe', 'object', 'embed', 'applet',
    'form', 'input', 'button', 'select', 'textarea', 'option',
    'link', 'meta', 'base', 'svg', 'math',
    'video', 'audio', 'canvas', 'map', 'area',
    'frame', 'frameset', 'noframes', 'noscript'
  ],
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ADD_URI_SAFE_ATTR: [],
  KEEP_CONTENT: false,
  RETURN_TRUSTED_TYPE: false,
  WHOLE_DOCUMENT: false,
  SANITIZE_DOM: true,
  SANITIZE_HTML: true
}

export const sanitizeHtml = (html) => {
  return DOMPurify.sanitize(html, purifyConfig)
}

export const stripHtml = (html) => {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}
