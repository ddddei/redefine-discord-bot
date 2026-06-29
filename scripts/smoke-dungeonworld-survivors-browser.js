const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const GAME_DIR = path.join(__dirname, '..', 'public', 'dungeonworld-survivors');
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
};

function findChrome() {
  return CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
}

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, 'http://127.0.0.1');
    const relativePath = requestUrl.pathname === '/' ? 'index.html' : requestUrl.pathname.replace(/^\/+/, '');
    const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(GAME_DIR, normalized);
    if (!filePath.startsWith(GAME_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDevToolsPort(profileDir) {
  const portFile = path.join(profileDir, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (fs.existsSync(portFile)) {
      const [port] = fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
      if (port) return Number(port);
    }
    await wait(100);
  }
  throw new Error('Chrome DevTools port did not become available');
}

async function openCdp(chromePath, url) {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dws-chrome-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    url,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const port = await waitForDevToolsPort(profileDir);
  const targets = await requestJson(`http://127.0.0.1:${port}/json/list`);
  const target = targets.find((entry) => entry.url.includes('/?qa=1')) || targets[0];
  assert.ok(target && target.webSocketDebuggerUrl, 'Chrome should expose a page target');
  const cdp = await CdpConnection.connect(target.webSocketDebuggerUrl);
  return { chrome, cdp, profileDir };
}

class CdpConnection {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result || {});
    });
  }

  static connect(url) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener('open', () => resolve(new CdpConnection(socket)));
      socket.addEventListener('error', reject);
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(payload);
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
  }
  return result.result.value;
}

async function waitFor(cdp, expression, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const value = await evaluate(cdp, expression);
    if (value) return value;
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function pressKey(cdp, key) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key });
  await wait(320);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key });
}

async function assertViewportHealthy(cdp, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await wait(180);
  const metrics = await evaluate(cdp, `(() => {
    const canvas = document.getElementById('game-canvas');
    const rect = canvas.getBoundingClientRect();
    const data = canvas.getContext('2d').getImageData(0, 0, 16, 16).data;
    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
      canvasHasPixels: Array.from(data).some((value) => value !== 0),
    };
  })()`);
  assert.ok(metrics.scrollWidth <= metrics.innerWidth + 1, `${width}px viewport should not horizontally overflow`);
  assert.ok(metrics.canvasWidth > 0 && metrics.canvasHeight > 0, `${width}px viewport should keep the canvas visible`);
  assert.strictEqual(metrics.canvasHasPixels, true, `${width}px viewport should render nonblank canvas pixels`);
}

async function main() {
  assert.ok(typeof WebSocket === 'function', 'Node 20 WebSocket support is required for CDP smoke QA');
  const chromePath = findChrome();
  assert.ok(chromePath, 'Chrome or Chromium should be installed, or CHROME_PATH should point to it');
  const server = await startStaticServer();
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/?qa=1`;
  let browser = null;

  try {
    browser = await openCdp(chromePath, url);
    const { cdp } = browser;
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await waitFor(cdp, 'Boolean(window.DungeonworldSurvivorsQa)', 'QA API');
    await waitFor(cdp, "Boolean(document.querySelector('[data-playbook=\"fighter\"]'))", 'playbook options');
    await evaluate(cdp, "document.querySelector('[data-playbook=\"fighter\"]').click()");
    await waitFor(cdp, "window.DungeonworldSurvivorsQa.getSnapshot().status === 'running'", 'running state');
    await waitFor(cdp, "window.DungeonworldSurvivorsQa.getSnapshot().background.groundLoadState === 'loaded'", 'initial background load');

    const beforeMove = await evaluate(cdp, 'window.DungeonworldSurvivorsQa.getSnapshot()');
    await pressKey(cdp, 'ArrowRight');
    const afterMove = await evaluate(cdp, 'window.DungeonworldSurvivorsQa.getSnapshot()');
    assert.ok(afterMove.player.x > beforeMove.player.x, 'ArrowRight should move the player to the right');
    assert.strictEqual(afterMove.background.backgroundKey, 'inn');
    assert.ok(afterMove.readability);
    assert.strictEqual(afterMove.readability.hudContrast, 'reinforced');

    const basin = await evaluate(cdp, 'window.DungeonworldSurvivorsQa.jumpTo(91)');
    assert.strictEqual(basin.wave.id, 'basin');
    assert.strictEqual(basin.background.backgroundKey, 'basin');
    assert.strictEqual(basin.background.groundKey, 'basin');
    assert.ok(basin.background.setpieces.includes('basinSetpiece'));

    await evaluate(cdp, "window.DungeonworldSurvivorsQa.forceBackgroundFailure('basin')");
    const fallback = await evaluate(cdp, 'window.DungeonworldSurvivorsQa.getSnapshot()');
    assert.strictEqual(fallback.background.groundLoadState, 'failed');
    assert.strictEqual(fallback.background.usingProcedural, true);

    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'L', modifiers: 8 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'L', modifiers: 8 });
    await waitFor(cdp, "document.getElementById('modal').dataset.mode === 'upgrade'", 'level-up modal');
    const levelModal = await evaluate(cdp, `(() => ({
      mode: document.getElementById('modal').dataset.mode,
      options: document.querySelectorAll('.upgrade-option').length,
      hasEvolutionLine: Boolean(document.querySelector('.evolution-line')),
    }))()`);
    assert.strictEqual(levelModal.mode, 'upgrade');
    assert.strictEqual(levelModal.options, 3);
    assert.strictEqual(levelModal.hasEvolutionLine, true);
    await evaluate(cdp, "document.querySelector('.upgrade-option').click()");
    await waitFor(cdp, "window.DungeonworldSurvivorsQa.getSnapshot().status === 'running'", 'running after upgrade');

    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'C', modifiers: 8 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'C', modifiers: 8 });
    await waitFor(cdp, "document.getElementById('modal').dataset.mode === 'chest'", 'chest modal');
    const chestModal = await evaluate(cdp, `(() => ({
      title: document.getElementById('modal-title').textContent,
      hasReward: Boolean(document.querySelector('.chest-reward-option')),
    }))()`);
    assert.strictEqual(chestModal.hasReward, true);
    assert.match(chestModal.title, /상자|무기/);
    await evaluate(cdp, "document.querySelector('.chest-reward-option').click()");
    await waitFor(cdp, "window.DungeonworldSurvivorsQa.getSnapshot().status === 'running'", 'running after chest');

    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'E', modifiers: 8 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'E', modifiers: 8 });
    await waitFor(cdp, "document.getElementById('modal').dataset.mode === 'chest'", 'evolution chest modal');
    const evolutionModal = await evaluate(cdp, `(() => ({
      title: document.getElementById('modal-title').textContent,
      ready: Boolean(document.querySelector('.chest-reward-option.evolution-ready')),
      copy: document.querySelector('.effect-line') ? document.querySelector('.effect-line').textContent : '',
    }))()`);
    assert.strictEqual(evolutionModal.ready, true);
    assert.match(evolutionModal.title, /진화/);
    assert.match(evolutionModal.copy, /진화/);
    await evaluate(cdp, "document.querySelector('.chest-reward-option').click()");
    await waitFor(cdp, "window.DungeonworldSurvivorsQa.getSnapshot().status === 'running'", 'running after evolution');

    const boss = await evaluate(cdp, 'window.DungeonworldSurvivorsQa.jumpTo(199)');
    assert.strictEqual(boss.background.backgroundKey, 'towerGate');
    assert.ok(boss.background.setpieces.includes('towerGate'));
    assert.strictEqual(boss.bossSpawned, true);
    assert.strictEqual(boss.bossPresent, true);
    assert.ok(boss.bossPhase);
    assert.ok(boss.readability.bossPhaseLabel);
    assert.ok(boss.readability.activeElitePatterns.length >= 0);

    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'N', modifiers: 8 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'N', modifiers: 8 });
    await waitFor(cdp, "window.DungeonworldSurvivorsQa.getSnapshot().status === 'won'", 'boss shortcut win');
    await waitFor(cdp, "document.getElementById('modal').dataset.mode === 'result'", 'result modal');
    const resultModal = await evaluate(cdp, `(() => ({
      heading: document.querySelector('.result-ledger-head h3') ? document.querySelector('.result-ledger-head h3').textContent : '',
      hasUltimate: document.getElementById('upgrade-options').textContent.includes('궁극기'),
      hasBossContribution: document.getElementById('upgrade-options').textContent.includes('보스전 기여'),
    }))()`);
    assert.ok(resultModal.heading.length > 0);
    assert.strictEqual(resultModal.hasUltimate, true);
    assert.strictEqual(resultModal.hasBossContribution, true);

    const canvasHasPixels = await evaluate(cdp, "(() => { const canvas = document.getElementById('game-canvas'); const data = canvas.getContext('2d').getImageData(0, 0, 16, 16).data; return Array.from(data).some((value) => value !== 0); })()");
    assert.strictEqual(canvasHasPixels, true, 'canvas should render nonblank pixels');

    await assertViewportHealthy(cdp, 375, 812);
    await assertViewportHealthy(cdp, 768, 900);
    await assertViewportHealthy(cdp, 1280, 900);
  } finally {
    if (browser) {
      browser.cdp.close();
      browser.chrome.kill('SIGTERM');
      fs.rmSync(browser.profileDir, { recursive: true, force: true });
    }
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('dungeonworld survivors browser smoke passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
