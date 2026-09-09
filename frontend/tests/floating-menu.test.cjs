const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const test = require('node:test')
const source = fs.readFileSync(path.join(__dirname, '../../frontend_static/app.js'), 'utf8')
const context = { Vue: { createApp: () => ({ mount() {} }), nextTick() {} } }
vm.runInNewContext(source, context)
const bounds = { top: 100, bottom: 600, left: 8, right: 992 }

test('bottom-edge menus flip above the trigger inside the form scrollport', () => {
  const p = context.floatingMenuPosition({ top: 530, bottom: 570, left: 400 }, bounds, 300, 330)
  assert.equal(p.opensAbove, true)
  assert.equal(p.top, 193)
  assert.ok(p.top + p.maxHeight < 530)
})
test('top-edge menus stay below and right-edge menus shift into the viewport', () => {
  const p = context.floatingMenuPosition({ top: 110, bottom: 150, left: 900 }, bounds, 292, 330)
  assert.equal(p.opensAbove, false)
  assert.equal(p.left + p.width, bounds.right)
  assert.ok(p.top + p.maxHeight <= bounds.bottom)
})
test('short/narrow windows constrain both dimensions without overflow', () => {
  const b = { top: 8, bottom: 260, left: 8, right: 312 }
  const p = context.floatingMenuPosition({ top: 100, bottom: 140, left: 12 }, b, 400, 380)
  assert.equal(p.width, 304)
  assert.ok(p.top >= b.top)
  assert.ok(p.top + p.maxHeight <= b.bottom)
})
test('dates render Chinese year/month/day while model values remain ISO dates', () => {
  assert.equal(context.chineseDate('2026-09-02'), '2026年09月02日')
  assert.equal(context.chineseDate(''), '')
})

test('reopened menus stay anchored, follow movement, and stop stale callbacks', () => {
  for (const legacy of [false, true]) {
    const attrs = new Map()
    const classes = new Set(['custom-select-menu'])
    let anchor = { top: 700, bottom: 740, left: 700, width: 220 }
    const portal = { dataset: {} }
    const frames = new Map()
    let sequence = 0
    const themeShell = { dataset: { theme: 'fresh' } }
    const trigger = {
      isConnected: true,
      getBoundingClientRect: () => anchor,
      setAttribute() {}, addEventListener() {}, removeEventListener() {}, focus() {},
    }
    const field = {
      className: 'custom-select-field', isConnected: true,
      querySelector: () => trigger, closest: selector => selector === '.app-shell' ? themeShell : null,
    }
    const menu = {
      parentElement: field, isConnected: true, style: {}, dataset: {}, scrollHeight: 330,
      closest: () => portal,
      classList: { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c) },
      getAttribute: n => attrs.get(n) ?? null,
      setAttribute: (n, v) => attrs.set(n, v),
      removeAttribute(n) { attrs.delete(n); if (n === 'style') this.style = {} },
      querySelector: () => legacy ? null : {}, querySelectorAll: () => [],
      showPopover() { throw new Error('Native popover must not be used') },
      addEventListener() {}, removeEventListener() {},
    }
    const sandbox = {
      Vue: { createApp: () => ({ mount() {} }), nextTick() {} },
      window: { innerWidth: 1920, innerHeight: 920, dispatchEvent() {}, addEventListener() {}, removeEventListener() {} },
      CustomEvent: class {},
      cancelAnimationFrame(id) { frames.delete(id) },
      requestAnimationFrame(callback) { frames.set(++sequence, callback); return sequence },
      // Simulate the reported second-open case: percentage popup width was
      // resolved against the viewport instead of the 220px trigger.
      getComputedStyle: () => ({ width: '1904px', maxHeight: '330px', getPropertyValue: () => '' }),
      menu, binding: { instance: { popoverId: 'repeat-test' }, value: { field, close() {} } },
    }
    vm.runInNewContext(source, sandbox)
    for (let attempt = 0; attempt < 5; attempt++) {
      anchor = { top: 700, bottom: 740, left: 700, width: 220 }
      vm.runInNewContext('FloatingMenuPositioner.mounted(menu, binding)', sandbox)
      assert.equal(menu.style.width, '220px')
      assert.equal(menu.style.left, '700px')
      assert.equal(menu.dataset.placement, 'top')
      assert.equal(menu.style.top, '363px')
      assert.equal(portal.dataset.theme, 'fresh')
      const [id, trackAnchor] = [...frames][0]
      frames.delete(id)
      // Position-only changes don't trigger ResizeObserver. The next frame must
      // preserve the exact 7px gap and align to the new trigger, not cached coords.
      anchor = { top: 600, bottom: 640, left: 100, width: 394 }
      trackAnchor()
      assert.equal(menu.style.left, '100px')
      assert.equal(menu.style.width, '394px')
      assert.equal(menu.style.top, '263px')
      vm.runInNewContext('FloatingMenuPositioner.beforeUnmount(menu)', sandbox)
      assert.equal(frames.size, 0)
      assert.equal(menu.parentElement, field)
      trackAnchor() // A callback already queued before close cannot revive it.
      assert.equal(frames.size, 0)
      assert.equal(classes.has('floating-menu-layer'), false)
      assert.equal(attrs.has('popover'), false)
      assert.equal(menu.style.width, undefined)
    }
  }
})
test('every template menu is positioned and no native selects or dates remain', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8')
  assert.doesNotMatch(html, /<select\b|type="date"/)
  for (const tag of html.match(/<[^>]+class="custom-select-menu[^>]*>/g) || []) {
    assert.match(tag, /^<floating-menu/)
  }
  assert.match(source, /<Teleport to="body">/)
  assert.doesNotMatch(source, /appendChild\(menu\)|menu\.showPopover\(/)
  assert.doesNotMatch(source, /近30天 · Asia\/Shanghai/)
})
