const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/orientation/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/orientation/styles.css'), 'utf8');
const javascript = fs.readFileSync(path.join(root, 'public/orientation/app.js'), 'utf8');

assert.match(html, /TODAY'S ROUTE/);
assert.match(html, /role="alert" aria-live="assertive"/);
assert.match(html, /role="status" aria-live="polite"/);
assert.match(html, /선택이 어렵다면 현장 운영진에게 말해 주세요/);

assert.match(css, /--ease-out: cubic-bezier\(0\.23, 1, 0\.32, 1\)/);
assert.match(css, /--ease-in-out: cubic-bezier\(0\.77, 0, 0\.175, 1\)/);
assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
assert.match(css, /scale\(0\.97\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /@media \(max-width: 899px\)/);
assert.match(css, /transform: scaleX\(0\)/);
assert.match(css, /\.choice-card:has\(input:checked\) \.choice-state/);
assert.doesNotMatch(css, /transition:\s*width/);
assert.doesNotMatch(css, /animation[^;]*infinite/);
assert.doesNotMatch(css, /scale\(0\)/);
assert.doesNotMatch(css, /font-size:\s*\d+px/);

assert.match(javascript, /window\.requestAnimationFrame/);
assert.match(javascript, /fill\.style\.transform = 'scaleX\('/);
assert.match(javascript, /id: 'worker-lab'[\s\S]*disabled: true/);
assert.match(javascript, /class="choice-state" aria-hidden="true">선택됨/);
assert.doesNotMatch(javascript, /my-selection'\)\.innerHTML[\s\S]{0,160}current\.name/);
assert.doesNotMatch(javascript, /style="--option-accent/);

console.log('Orientation static checks passed.');
