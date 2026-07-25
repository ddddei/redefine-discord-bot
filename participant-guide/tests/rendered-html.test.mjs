import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://guide.example.com/", {
      headers: { accept: "text/html", host: "guide.example.com" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the participant guide", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /리디파인 참여자 가이드/);
  assert.match(html, /가이드 검색/);
  assert.match(html, /명령어나 궁금한 내용을 검색해 보세요/);
  assert.match(html, /빠른 시작/);
  assert.match(html, /처음 72시간/);
  assert.match(html, /Discord 명령어/);
  assert.match(html, /href="#quick-start"/);
  assert.match(html, /<search class="guide-search">/);
  assert.match(html, /<details><summary>/);
  assert.match(html, /https:\/\/guide\.example\.com\/og\.png/);
});

test("server-renders accessible navigation, search, and disclosures", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /<a class="skip-link" href="#main-content">/);
  assert.match(html, /<main id="main-content">/);
  assert.match(html, /<aside class="table-of-contents" aria-label="참여자 가이드 목차">/);
  assert.match(html, /<label for="guide-search-input">가이드 검색<\/label>/);
  assert.match(html, /<input[^>]+id="guide-search-input"[^>]+type="search"/);
  assert.match(html, /<div class="search-feedback" aria-live="polite">/);
  assert.match(html, /<div class="command-table-wrap" tabindex="0" aria-label="Discord 명령어 표\. 좌우 방향키로 전체 내용을 확인할 수 있습니다\.">/);
  assert.match(html, /<section id="faq"[^>]+aria-labelledby="faq-title">/);
  assert.match(html, /<details><summary>채널이 다른 사람보다 적게 보여요\.<\/summary>/);
});

test("matches conversational Korean searches after normalizing punctuation", async () => {
  const source = await readFile(new URL("../app/guide-search.ts", import.meta.url), "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
  const { searchGuideItems } = await import(moduleUrl);
  const items = [{
    id: "faq",
    label: "미션을 했는데 포인트가 안 들어왔어요",
    summary: "승인 반응과 포인트 기록을 확인합니다.",
    keywords: "미션 포인트 미지급 승인",
  }];

  assert.equal(searchGuideItems(items, "미션을 했는데 포인트가 안 들어왔어요.").length, 1);
  assert.equal(searchGuideItems(items, "  포인트, 미지급 ").length, 1);
  assert.equal(searchGuideItems(items, "채널이 안 보여요").length, 0);
});
