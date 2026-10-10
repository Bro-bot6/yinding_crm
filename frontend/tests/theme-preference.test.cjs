const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(values = {}, blocked = false) {
  const saved = new Map(Object.entries(values));
  let options;
  const context = {
    Vue: { createApp(value) { options = value; return { mount() {} }; }, nextTick() {} },
    localStorage: {
      getItem(key) { if (blocked) throw Error('storage blocked'); return saved.get(key) || null; },
      setItem(key, value) { if (blocked) throw Error('storage blocked'); saved.set(key, value); },
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../frontend_static/app.js'), 'utf8'), context);
  return { saved, read: () => context.readThemePreference(), set: theme => {
    const instance = { theme: 'fresh' };
    options.methods.setTheme.call(instance, theme);
    return instance.theme;
  } };
}

test('new browser and legacy minimal/midnight preferences migrate to fresh once', () => {
  for (const legacy of [undefined, 'minimal', 'midnight', 'fresh']) {
    const app = setup(legacy ? { 'yd-theme': legacy } : {});
    assert.equal(app.read(), 'fresh');
    assert.equal(app.saved.get('yd-theme-v2'), 'fresh');
  }
});
test('explicit later selection survives reload for all three themes', () => {
  const app = setup({ 'yd-theme': 'minimal' });
  app.read();
  for (const theme of ['midnight', 'minimal', 'fresh']) {
    assert.equal(app.set(theme), theme);
    assert.equal(app.read(), theme);
  }
});
test('invalid preference recovers to fresh and unsupported choices are ignored', () => {
  const app = setup({ 'yd-theme-v2': 'unknown' });
  assert.equal(app.read(), 'fresh');
  assert.equal(app.set('unknown'), 'fresh');
  assert.equal(app.read(), 'fresh');
});
test('blocked storage does not prevent default rendering or current-page theme selection', () => {
  const app = setup({}, true);
  assert.equal(app.read(), 'fresh');
  assert.equal(app.set('midnight'), 'midnight');
});
