const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const css = fs.readFileSync(path.join(root, 'frontend_static', 'style.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'frontend', 'index.html'), 'utf8');

test('visitor summary icons keep a visible browser-compatible background', () => {
  const iconRule = css.match(/\.visitor-summary-card\s*>\s*i\s*\{([^}]*)\}/)?.[1] || '';
  const totalIconRule = css.match(/\.visitor-summary-total\s*>\s*i\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(iconRule, /background:\s*var\(--accent-soft\)/);
  assert.match(totalIconRule, /background:\s*var\(--accent\)/);
  assert.doesNotMatch(iconRule, /color-mix\(/);
  assert.doesNotMatch(totalIconRule, /color-mix\(/);
});

test('visitor summary switches from three columns to two and then one', () => {
  assert.match(css, /@media \(max-width:\s*960px\)[\s\S]*?\.visitor-summary-grid\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*600px\)[\s\S]*?\.visitor-summary-grid\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(max-width:\s*600px\)[\s\S]*?\.visitor-summary-grid article:last-child\s*\{\s*grid-column:\s*auto/);
});

test('visitor summary markup exposes all three complete metrics', () => {
  assert.match(html, /visitor-summary-total[\s\S]*?>访<[\s\S]*?>全部来访<[\s\S]*?>次接待记录</);
  assert.match(html, />近<[\s\S]*?>近 30 天<[\s\S]*?>次来访</);
  assert.match(html, />人<[\s\S]*?>近 30 天人数<[\s\S]*?>位到访人员</);
});
