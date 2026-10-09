import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSourceSelection, routeAdminMessage, type AdminRoutingDeps } from "./adminRouting.js";
import { answerResearch, type FetchLike, type ResearchIntent } from "./research.js";

function spies() {
  const calls = { internal: 0, research: [] as ResearchIntent[], fetch: [] as string[] };
  const fetchImpl: FetchLike = async (url) => {
    calls.fetch.push(url);
    if (url.includes("dorar")) return new Response(JSON.stringify({ ahadith: { result: "" } }), { status: 200 });
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: JSON.stringify({ layers: [], evidence: { sources: [] } }) }] } }), { status: 200 });
  };
  const deps: AdminRoutingDeps = {
    internal: async () => {
      calls.internal += 1;
      return { reply: "LMS cavabı", suggestions: [] };
    },
    research: async (intent) => {
      calls.research.push(intent);
      return answerResearch(intent, { fetchImpl });
    },
  };
  return { calls, deps };
}

test("parseSourceSelection defaults to internal/shamela and rejects unknown values", () => {
  assert.deepEqual(parseSourceSelection({ message: "x" }), { mode: "internal", target: "shamela" });
  assert.deepEqual(parseSourceSelection({ source: "external", target: "all" }), { mode: "external", target: "all" });
  assert.equal(parseSourceSelection({ source: "both" }), null);
  assert.equal(parseSourceSelection({ source: "external", target: "google" }), null);
});

test("internal mode never calls external sources, even for Shamela/Dorar commands", async () => {
  for (const message of ["Şamilədə axtar: إنما الأعمال بالنيات", "hədis yoxla: من غشنا", "dorar الصبر", "الشاملة الصبر"]) {
    const { calls, deps } = spies();
    const reply = await routeAdminMessage({ message, mode: "internal", target: "all", canReadLms: true }, deps);
    assert.equal(calls.research.length, 0, message);
    assert.equal(calls.fetch.length, 0, message);
    assert.equal(calls.internal, 0, message);
    assert.equal(reply.mode, "internal");
    assert.equal(reply.sources, undefined);
    assert.match(reply.reply, /«Xarici» rejimə keçin/);
  }
});

test("internal mode answers LMS questions from LMS data only", async () => {
  const { calls, deps } = spies();
  const reply = await routeAdminMessage({ message: "Qayıbı çox olanlar", mode: "internal", target: "shamela", canReadLms: true }, deps);
  assert.equal(calls.internal, 1);
  assert.equal(calls.fetch.length, 0);
  assert.equal(reply.reply, "LMS cavabı");
});

test("internal mode refuses LMS data politely without the students permission", async () => {
  const { calls, deps } = spies();
  const reply = await routeAdminMessage({ message: "Qayıbı çox olanlar", mode: "internal", target: "shamela", canReadLms: false }, deps);
  assert.equal(calls.internal, 0);
  assert.equal(calls.fetch.length, 0);
  assert.match(reply.reply, /«Tələbələr» icazəsi lazımdır/);
});

test("external mode never queries LMS data and searches whatever is typed (default Shamela)", async () => {
  for (const message of ["Qayıbı çox olanlar", "Ümumi statistika", "إنما الأعمال بالنيات"]) {
    const { calls, deps } = spies();
    const reply = await routeAdminMessage({ message, mode: "external", target: "shamela", canReadLms: true }, deps);
    assert.equal(calls.internal, 0, message);
    assert.deepEqual(calls.research, [{ kind: "shamela", query: message }]);
    assert.ok(calls.fetch.every((url) => url.startsWith("https://mcp.shamela.ws/")));
    assert.equal(reply.mode, "external");
    assert.equal(reply.sources?.[0]?.kind, "shamela");
  }
});

test("external mode routes hadith commands and the Dorar sub-option to Dorar", async () => {
  let { calls, deps } = spies();
  await routeAdminMessage({ message: "hədis yoxla: من غشنا", mode: "external", target: "shamela", canReadLms: false }, deps);
  assert.deepEqual(calls.research, [{ kind: "dorar", query: "من غشنا" }]);
  assert.equal(calls.internal, 0);
  ({ calls, deps } = spies());
  await routeAdminMessage({ message: "من غشنا", mode: "external", target: "dorar", canReadLms: true }, deps);
  assert.deepEqual(calls.research, [{ kind: "dorar", query: "من غشنا" }]);
  assert.ok(calls.fetch.every((url) => url.startsWith("https://dorar.net/")));
});

test("external «Hamısı» searches both sources and groups the results", async () => {
  const { calls, deps } = spies();
  const reply = await routeAdminMessage({ message: "Şamilədə axtar: الصبر", mode: "external", target: "all", canReadLms: true }, deps);
  assert.deepEqual(calls.research.map((intent) => intent.kind), ["shamela", "dorar"]);
  assert.ok(calls.research.every((intent) => intent.query === "الصبر"));
  assert.equal(calls.internal, 0);
  assert.deepEqual(reply.sources?.map((group) => group.kind), ["shamela", "dorar"]);
});

test("teachers without the students permission can still use external mode", async () => {
  const { calls, deps } = spies();
  const reply = await routeAdminMessage({ message: "طلب العلم", mode: "external", target: "shamela", canReadLms: false }, deps);
  assert.equal(calls.research.length, 1);
  assert.equal(reply.mode, "external");
});
