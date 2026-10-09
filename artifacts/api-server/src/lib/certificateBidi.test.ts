import assert from "node:assert/strict";
import test from "node:test";
import { paragraphIsRtl, visualRuns } from "./certificateBidi.js";

const visual = (text: string) => visualRuns(text, paragraphIsRtl(text)).map((run) => run.visual).join("");

test("Latın paraqrafda ərəb ifadəsi mötərizə ilə düzgün sıralanır", () => {
  const runs = visualRuns("proqramını (العلوم الشرعية) tam", false);
  assert.deepEqual(runs.map((run) => run.visual), ["proqramını (", "ةيعرشلا مولعلا", ") tam"]);
  // fontkit ərəb run-u özü tərsinə çevirir, ona görə məntiqi sıra (bölünməz boşluqla) verilir.
  assert.equal(runs[1].draw, "العلوم\u00A0الشرعية");
});

test("RTL paraqrafda mötərizələr güzgülənir", () => {
  assert.equal(visual("(العلوم الشرعية)"), "(ةيعرشلا مولعلا)");
  assert.equal(visual("محمد عبد الله (Əliyev)"), "(Əliyev) هللا دبع دمحم");
  assert.equal(visual("[رقم 42]."), ".[42 مقر]");
});

test("rəqəmlər və Latın mətni soldan-sağa qalır", () => {
  assert.equal(visual("abc 123 def"), "abc 123 def");
  // UAX #9 (brauzerlərdə də belədir): ərəb kontekstində "–" neytral olduğu üçün iki ədəd sağdan-sola düzülür.
  assert.equal(visual("العام 2025–2026"), "2026–2025 ماعلا");
  assert.equal(visual("العام 2025/2026"), "2025/2026 ماعلا");
  assert.equal(paragraphIsRtl("Mədinə (العلوم)"), false);
  assert.equal(paragraphIsRtl("(العلوم) Mədinə"), true);
});
