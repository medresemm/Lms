import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergeStudentExternalMetadata,
  readStudentExternalSetting,
  routeStudentExternal,
  STUDENT_EXTERNAL_METADATA_KEY,
  updateStudentExternalSetting,
} from "./studentExternal.js";
import type { ResearchIntent, ResearchReply } from "./research.js";

function researchSpy() {
  const calls: ResearchIntent[] = [];
  const research = async (intent: ResearchIntent): Promise<ResearchReply> => {
    calls.push(intent);
    return { reply: `${intent.kind} ok`, suggestions: [], sources: { kind: intent.kind, query: intent.query, sourceUrl: "https://x", items: [] } as ResearchReply["sources"] };
  };
  return { calls, research };
}

test("setting defaults to OFF and only accepts real booleans from owner metadata", () => {
  assert.deepEqual(readStudentExternalSetting(undefined), { shamela: false, dorar: false });
  assert.deepEqual(readStudentExternalSetting({ rolePermissions: {} }), { shamela: false, dorar: false });
  assert.deepEqual(readStudentExternalSetting({ [STUDENT_EXTERNAL_METADATA_KEY]: { shamela: "true", dorar: 1 } }), { shamela: false, dorar: false });
  assert.deepEqual(readStudentExternalSetting({ [STUDENT_EXTERNAL_METADATA_KEY]: { shamela: true, dorar: false } }), { shamela: true, dorar: false });
});

test("OFF: student external requests are rejected (403) and no external source is called", async () => {
  for (const target of ["shamela", "dorar", "all"] as const) {
    const { calls, research } = researchSpy();
    const result = await routeStudentExternal({ message: "إنما الأعمال بالنيات", target }, { shamela: false, dorar: false }, research);
    assert.equal(result.status, 403, target);
    assert.equal(calls.length, 0, target);
  }
});

test("ON: student external requests are allowed and searched", async () => {
  const { calls, research } = researchSpy();
  const result = await routeStudentExternal({ message: "إنما الأعمال بالنيات", target: "all" }, { shamela: true, dorar: true }, research);
  assert.equal(result.status, 200);
  assert.deepEqual(calls.map((intent) => intent.kind), ["shamela", "dorar"]);
  assert.ok("sources" in result.body && result.body.sources.length === 2);
});

test("per-source switches: a disabled source is never called", async () => {
  let spy = researchSpy();
  let result = await routeStudentExternal({ message: "الصبر", target: "shamela" }, { shamela: false, dorar: true }, spy.research);
  assert.equal(result.status, 403);
  assert.equal(spy.calls.length, 0);

  spy = researchSpy();
  result = await routeStudentExternal({ message: "الصبر", target: "all" }, { shamela: false, dorar: true }, spy.research);
  assert.equal(result.status, 200);
  assert.deepEqual(spy.calls.map((intent) => intent.kind), ["dorar"]);

  spy = researchSpy();
  result = await routeStudentExternal({ message: "Şamilədə axtar: الصبر", target: "dorar" }, { shamela: false, dorar: true }, spy.research);
  assert.equal(result.status, 200);
  assert.equal(spy.calls.length, 0);
  assert.ok("reply" in result.body && /açıq deyil/.test(result.body.reply));
});

test("only the system owner can change the setting", async () => {
  let saved: Record<string, unknown> | null = null;
  const save = async (metadata: Record<string, unknown>) => { saved = metadata; };
  const denied = await updateStudentExternalSetting({ actorIsOwner: false, body: { shamela: true, dorar: true }, ownerMetadata: {} }, save);
  assert.equal(denied.status, 403);
  assert.equal(saved, null);

  const invalid = await updateStudentExternalSetting({ actorIsOwner: true, body: { shamela: "yes" }, ownerMetadata: {} }, save);
  assert.equal(invalid.status, 400);
  assert.equal(saved, null);

  const ok = await updateStudentExternalSetting({ actorIsOwner: true, body: { shamela: true, dorar: false }, ownerMetadata: { role: "owner", rolePermissions: { teacher: ["students"] } } }, save);
  assert.equal(ok.status, 200);
  assert.deepEqual(saved, { role: "owner", rolePermissions: { teacher: ["students"] }, [STUDENT_EXTERNAL_METADATA_KEY]: { shamela: true, dorar: false } });
});

test("merging keeps other owner metadata intact", () => {
  const merged = mergeStudentExternalMetadata({ rolePermissions: { teacher: [] }, x: 1 }, { shamela: false, dorar: true });
  assert.deepEqual(merged, { rolePermissions: { teacher: [] }, x: 1, [STUDENT_EXTERNAL_METADATA_KEY]: { shamela: false, dorar: true } });
});
