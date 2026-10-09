// Mədinə AI (brauzer): «Daha çox göstər» səhifələməsi, sürüşmə hesabları və strukturlu blokların yoxlanması.
// Bu fayl tətbiqin typecheck-inə daxil deyil (*.test.ts); api-server-in `test:ai-polish` skripti tsx ilə işlədir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { anchorCorrection, answerScrollTop, hiddenCount, initialShown, moreLabel, pagerState, pageSlice, revealMore } from "./paginate";
import { readBlocks, safeBlockHref, type AiBlock } from "./ai-blocks";

// ---------------------------------------------------------------------------
// Səhifələmə

test("pagination: first 5, then 5 more, label shows remaining count", () => {
  assert.equal(initialShown(3), 3);
  assert.equal(initialShown(12), 5);
  assert.equal(revealMore(5, 12), 10);
  assert.equal(revealMore(10, 12), 12);
  assert.equal(hiddenCount(5, 12), 7);
  assert.equal(moreLabel(7), "Daha çox göstər (7)");
  assert.equal(moreLabel(null), "Daha çox göstər");
  assert.deepEqual(pageSlice([1, 2, 3, 4, 5, 6, 7], 5), [1, 2, 3, 4, 5]);

  const local = pagerState({ shown: 5, loaded: 15 });
  assert.deepEqual([local.shown, local.hidden, local.canShowMore, local.needsServer, local.label], [5, 10, true, false, "Daha çox göstər (10)"]);
  assert.equal(pagerState({ shown: 5, loaded: 5 }).canShowMore, false);
  assert.equal(pagerState({ shown: 4, loaded: 4 }).canShowMore, false);
});

test("pagination: server-backed lists (library total, Shamela cursor)", () => {
  // Kitabxana: 10 yüklənib, cəmi 23; 10-u göstərilib → serverdən yüklənməlidir.
  const library = pagerState({ shown: 10, loaded: 10, total: 23 });
  assert.deepEqual([library.hidden, library.needsServer, library.label], [13, true, "Daha çox göstər (13)"]);
  assert.equal(pagerState({ shown: 5, loaded: 10, total: 23 }).needsServer, false);
  // Şamilə: ümumi say məlum deyil, kursor var.
  const shamela = pagerState({ shown: 5, loaded: 5, serverHasMore: true });
  assert.deepEqual([shamela.hidden, shamela.canShowMore, shamela.needsServer, shamela.label], [null, true, true, "Daha çox göstər"]);
  assert.equal(pagerState({ shown: 5, loaded: 5, serverHasMore: false }).canShowMore, false);
});

test("scroll helpers: answer top-aligned, expansions keep the anchor", () => {
  // Cavab konteynerin yuxarısından 640px aşağıdadır, sahə artıq 1000px sürüşüb → 1000 + 640 − 8.
  assert.equal(answerScrollTop({ containerTop: 100, elementTop: 740, scrollTop: 1000 }), 1632);
  assert.equal(answerScrollTop({ containerTop: 100, elementTop: 740, scrollTop: 1000, maxScrollTop: 1200 }), 1200);
  assert.equal(answerScrollTop({ containerTop: 100, elementTop: 50, scrollTop: 0 }), 0);
  assert.equal(anchorCorrection(220, 220), 0);
  assert.equal(anchorCorrection(220, 260.4), 40);
});

test("client blocks: only known blocks, safe links", () => {
  const blocks: AiBlock[] = [
    { type: "text", text: "Bu həftə 2 dərsiniz var:" },
    { type: "card", title: "Bazar ertəsi", items: [{ title: "Fiqh", meta: ["18:00–19:30"], action: { label: "Dərsə qoşul", href: "/api/lessons/5/join" } }] },
    { type: "steps", title: "Necə qoşulum?", steps: ["«Dərslərim» bölməsini açın"] },
  ];
  // Brauzer tərəfi: yalnız tanınan bloklar, təhlükəsiz keçidlər.
  const read = readBlocks([...blocks, { type: "html", html: "<script>" }, { type: "card", items: [{ title: "X", action: { label: "Aç", href: "javascript:alert(1)" } }] }]);
  assert.equal(read?.length, 4);
  const last = read?.[3];
  assert.ok(last && last.type === "card" && last.items?.[0].action === undefined);
  assert.equal(readBlocks("mətn"), undefined);
  assert.deepEqual(safeBlockHref("/kitabxana/tuhfa?page=3"), { href: "/kitabxana/tuhfa?page=3", internal: true });
  assert.equal(safeBlockHref("//evil.example"), null);
  assert.equal(safeBlockHref("http://plain.example"), null);
  assert.deepEqual(safeBlockHref("https://dorar.net/h/x"), { href: "https://dorar.net/h/x", internal: false });
});
