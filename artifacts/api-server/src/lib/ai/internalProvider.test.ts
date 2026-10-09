import assert from "node:assert/strict";
import test from "node:test";
import { internalAiProvider, normalizeText } from "./internalProvider.js";
import type { AdminAiContext, StudentAiContext } from "./aiProvider.js";
import { adminContext, allDays, fiqhLesson, quranLesson, roster, studentContext, students } from "./internalProvider.fixtures.js";

const ask = (message: string, context: StudentAiContext | AdminAiContext) => internalAiProvider.answer({ message, history: [] }, context);

test("normalizes Azerbaijani and Turkish letters", () => {
  assert.equal(normalizeText("Qiymətlərim NƏDİR? Öğrenci şçğ"), "qiymetlerim nedir ogrenci scg");
});

test("student schedule, today and locked schedule", async () => {
  assert.match((await ask("Dərs cədvəlim", studentContext())).reply, /Bazar ertəsi[\s\S]*Fiqh/);
  assert.match((await ask("Bu gün dərsim var?", studentContext())).reply, /Bu gün .*Quran/s);
  assert.match((await ask("ders programim ne zaman", studentContext(false))).reply, /hələ açılmayıb[\s\S]*Qəbul testi/);
});

test("student assignments, exams, grades, attendance, resources", async () => {
  assert.match((await ask("Tapşırıqlarım", studentContext())).reply, /Fatihə əzbəri.*göndərilməyib/);
  assert.match((await ask("ödevlerim neler", studentContext())).reply, /95\/100/);
  assert.match((await ask("imtahanlarım", studentContext())).reply, /Təcvid testi/);
  assert.match((await ask("Qiymətlərim", studentContext())).reply, /Quran[^\n]*4\.5/);
  assert.match((await ask("Fiqh notum", studentContext())).reply, /Fiqh[^\n]*hələ qiymət yoxdur/);
  assert.doesNotMatch((await ask("Fiqh notum", studentContext())).reply, /Quran/);
  assert.match((await ask("davamiyyətim", studentContext())).reply, /Quran[^\n]*1 qayıb/);
  assert.match((await ask("Resurslar", studentContext())).reply, /zoom\.example/);
  assert.match((await ask("elanlar", studentContext())).reply, /Bayram/);
});

test("student cannot ask about other students and gets help fallback", async () => {
  assert.match((await ask("başqa tələbələrin qiymətləri", studentContext())).reply, /yalnız sizin öz/);
  assert.match((await ask("asdfgh", studentContext())).reply, /başa düşmədim/);
  assert.match((await ask("Salam", studentContext())).reply, /Salam, Aişə/);
});

test("admin search: single match returns full details, multiple returns list", async () => {
  const single = await ask("Aişə Həsənova haqqında məlumat", adminContext());
  assert.match(single.reply, /T0012[\s\S]*aise@example\.com[\s\S]*Quran[\s\S]*Təcvid testi — Quran: 7\/10/);
  assert.match((await ask("T0013", adminContext())).reply, /Məmmədov/);
  assert.match((await ask("ali@example.com", adminContext())).reply, /Məmmədov/);
  const multi = await ask("Əli", adminContext());
  assert.match(multi.reply, /2 tələbə tapdım/);
  assert.deepEqual(multi.suggestions, ["T0013", "T0014"]);
  assert.match((await ask("Əlinin qiymətləri", adminContext())).reply, /2 tələbə tapdım/);
});

test("admin courses, teacher schedule, stats and permissions", async () => {
  assert.match((await ask("Kurs siyahısı", adminContext())).reply, /Quran \(Quran elmləri\)/);
  assert.match((await ask("Quran tələbələri", adminContext())).reply, /Tələbələr \(1\)[\s\S]*T0012/);
  assert.match((await ask("Müəllim cədvəli", adminContext())).reply, /Ustad Əli:[\s\S]*Bazar ertəsi 18:00/);
  assert.match((await ask("Tələbə statistikası", adminContext())).reply, /tələbə sayı: 3/);
  assert.match((await ask("Müəllim cədvəli", adminContext(["students"]))).reply, /icazə/);
  assert.match((await ask("Tələbə axtar", adminContext())).reply, /Kimi axtarım/);
});

test("student site guide: how/where questions win over data questions", async () => {
  const cases: Array<[string, RegExp]> = [
    ["Tapşırığı necə göndərim?", /Ev tapşırığını göndərmək[\s\S]*«Təhvili göndər»/],
    ["Dərs cədvəlini harada görüm?", /Dərs cədvəlinə baxmaq[\s\S]*«Dərs Cədvəlim»/],
    ["Qayıb üzrlü necə yazım?", /Qayıb üçün üzr bildirmək[\s\S]*«Üzr bildir»[\s\S]*«Üzrü göndər»/],
    ["Resurslar haradadır?", /Resurslar, kitablar və materiallar[\s\S]*«PDF və bütün linklərə bax»/],
    ["Müəllimə necə mesaj yazım?", /Müəllimə mesaj yazmaq[\s\S]*«Müəllim seçin»/],
    ["Sual-cavab necə işləyir?", /Sual-cavab bölməsi[\s\S]*«Sualı göndər»/],
    ["Profilimi necə dəyişim?", /Şəxsi məlumatları dəyişmək[\s\S]*«Dəyişiklikləri yadda saxla»/],
    ["İmtahan necə verilir?", /İmtahan və test vermək[\s\S]*«Cavabları göndər»/],
    ["Bildirişlər harada?", /Bildirişlər və yeniliklər[\s\S]*«Bildirişləri göstər»/],
    ["Çıxış necə edim?", /Hesabdan çıxmaq[\s\S]*«Çıxış»/],
    ["çıxış", /Hesabdan çıxmaq/],
    ["Saytdan istifadə", /Tələbə kabinetindən istifadə[\s\S]*«Menyunu aç»/],
    ["ödevimi nasıl yüklerim", /Ev tapşırığını göndərmək/],
    ["derse nasıl katılırım", /Onlayn dərsə qoşulmaq/],
    ["Şifrəmi unutdum", /Şifrəni unutmusunuzsa[\s\S]*«Bərpa kodunu göndər»/],
    ["şifrəmi necə dəyişim", /Şifrəni dəyişmək[\s\S]*«Mövcud şifrə»/],
    ["müəllimi necə dəyişim", /Fənləri və müəllimi idarə etmək[\s\S]*«Müəllimi dəyiş»/],
  ];
  for (const [question, expected] of cases) {
    assert.match((await ask(question, studentContext())).reply, expected, question);
  }
});

test("data questions without how/where cues still return data", async () => {
  assert.match((await ask("Tapşırıqlarım", studentContext())).reply, /Fatihə əzbəri/);
  assert.match((await ask("Neçə qayıbım var?", studentContext())).reply, /Quran[^\n]*1 qayıb/);
  assert.match((await ask("Neçə tələbə var?", adminContext())).reply, /tələbə sayı: 3/);
  assert.match((await ask("salam", studentContext())).reply, /Tapşırığı necə göndərim/);
});

test("admin site guide", async () => {
  assert.match((await ask("Elanı necə yayımlayım?", adminContext())).reply, /«Elanı yayımla»/);
  assert.match((await ask("Tələbələri harada idarə edim?", adminContext())).reply, /«Tələbələri idarə et»[\s\S]*«Qiymətləndirmə»/);
  assert.match((await ask("Test necə yaradım?", adminContext())).reply, /«Yeni test»/);
  assert.match((await ask("Mesajlara necə cavab verim?", adminContext())).reply, /«Məsləhətləşmə \/ Əlaqə»/);
  assert.match((await ask("Admin paneldən necə istifadə edim?", adminContext())).reply, /Admin paneldən istifadə/);
  assert.doesNotMatch((await ask("Tapşırığı necə göndərim?", adminContext())).reply, /Ev tapşırığını göndərmək/);
});

test("admin fuzzy student search tolerates typos, order and transliteration", async () => {
  assert.match((await ask("Aishe Hesenova", adminContext())).reply, /T0012[\s\S]*aise@example\.com/);
  assert.match((await ask("Hesenova Aise", adminContext())).reply, /T0012/);
  assert.match((await ask("Mamedov Ali", adminContext())).reply, /Məmmədov \(T0013\)/);
  assert.match((await ask("Əli Mämmädov", adminContext())).reply, /T0013/);
  assert.match((await ask("Məmədof", adminContext())).reply, /T0013/);
  assert.match((await ask("Kuliyev", adminContext())).reply, /Quliyev \(T0014\)/);
  assert.match((await ask("Алиев Мамедов", adminContext())).reply, /T0013/);
  assert.match((await ask("055 111 22 33", adminContext())).reply, /T0013/);
  assert.match((await ask("+994 70 111 22 44", adminContext())).reply, /T0014/);
  assert.match((await ask("t13", adminContext())).reply, /Məmmədov/);
});

test("admin typo-tolerant intents and filters", async () => {
  assert.match((await ask("qayıbı çox olanlar", adminContext())).reply, /3 və daha çox qayıb[\s\S]*T0013 — Əli Məmmədov[\s\S]*5 qayıb/);
  assert.match((await ask("davamiyet", adminContext())).reply, /qayıbı olan tələbələr: 2 \/ 3/);
  assert.match((await ask("ortalaması 60-dan aşağı olanlar", adminContext())).reply, /60-dən aşağı[\s\S]*T0013[\s\S]*ortalama: 55/);
  assert.doesNotMatch((await ask("ortalaması 60-dan aşağı olanlar", adminContext())).reply, /T0012/);
  assert.match((await ask("qiymtlr", adminContext())).reply, /Ən aşağı ortalamalar/);
  assert.match((await ask("2-ci semestr tələbələri", adminContext())).reply, /2-ci semestr[\s\S]*2 tələbə tapdım/);
  assert.match((await ask("neçə tələbə var 2 semestr", adminContext())).reply, /Uyğun tələbə sayı: 2/);
  assert.match((await ask("tapşırığı təhvil verməyənlər", adminContext())).reply, /T0013[\s\S]*Fiqh esse/);
  assert.match((await ask("tapsirigi vermeyen telebeler", adminContext())).reply, /T0013/);
  assert.match((await ask("Hafizlik proqramı tələbələri", adminContext())).reply, /T0014/);
  assert.match((await ask("ərəb dili orta olanlar", adminContext())).reply, /T0013[\s\S]*T0014/);
  assert.match((await ask("cədvəli açılmayan tələbələr", adminContext())).reply, /T0014/);
  assert.match((await ask("Ustad Ömər qrupunun tələbələri", adminContext())).reply, /T0013[\s\S]*T0014/);
});

test("admin teachers, staff and other entities", async () => {
  assert.match((await ask("neçə müəllim var", adminContext())).reply, /Müəllim sayı: 2/);
  assert.match((await ask("nece muelim var", adminContext())).reply, /Müəllim sayı: 2/);
  assert.match((await ask("Ustad Omer", adminContext())).reply, /Ustad Ömər[\s\S]*tələbə sayı: 2[\s\S]*Fiqh/);
  assert.match((await ask("müəllimlər", adminContext(["students"]))).reply, /icazə/);
  assert.match((await ask("heyət siyahısı", adminContext())).reply, /yalnız sahib/);
  assert.match((await ask("heyət siyahısı", adminContext([], { isOwner: true }))).reply, /Heyət üzvləri: 3[\s\S]*nergiz@example\.com/);
  assert.match((await ask("neçə admin var", adminContext([], { isOwner: true }))).reply, /Admin sayı: 1/);
  assert.match((await ask("neçə müraciət gözləyir", adminContext())).reply, /Gözləyən müraciətlər: 2/);
  assert.match((await ask("muracietler", adminContext())).reply, /Rəşad Kərimov[\s\S]*Murad Səfərov/);
  assert.match((await ask("rədd edilən müraciətlər", adminContext())).reply, /Murad Səfərov[\s\S]*Natamam sənəd/);
  assert.match((await ask("müraciətlər", adminContext(["students"]))).reply, /icazə/);
  assert.match((await ask("fənn silmə müraciətləri", adminContext())).reply, /Əli Quliyev[\s\S]*Fiqh/);
  assert.match((await ask("gözləyən üzrlər", adminContext())).reply, /Əli Məmmədov[\s\S]*Xəstə idim/);
  assert.match((await ask("cavabsız suallar", adminContext())).reply, /Təcvid qaydaları/);
  assert.doesNotMatch((await ask("cavabsız suallar", adminContext())).reply, /Namaz vaxtları/);
  assert.match((await ask("son elanlar", adminContext())).reply, /Bayram tətili/);
  assert.match((await ask("tapşırıqlar", adminContext())).reply, /Fiqh esse[\s\S]*Fatihə əzbəri/);
  assert.match((await ask("yoxlanılmamış tapşırıqlar", adminContext())).reply, /Fiqh esse/);
  assert.match((await ask("Fiqh esse tapşırığı", adminContext())).reply, /Təhvil verməyən \(cari qrupda\): 1[\s\S]*Əli Məmmədov/);
  assert.match((await ask("Quran imtahan nəticələri", adminContext())).reply, /Təcvid testi[\s\S]*Aişə Həsənova[\s\S]*9\/10 \(90%\)/);
  assert.match((await ask("imtahnlar", adminContext())).reply, /Testlər: 2/);
  assert.match((await ask("neçə kurs var", adminContext())).reply, /Dərslər \(2\)/);
  assert.match((await ask("ümumi statistika", adminContext())).reply, /Aktiv tələbə: 3[\s\S]*Müəllim: 2[\s\S]*Müraciətlər: 3/);
});

test("admin global search and did-you-mean suggestions", async () => {
  const global = await ask("Bayram", adminContext());
  assert.match(global.reply, /Elanlar \(1\)[\s\S]*Bayram tətili/);
  assert.match((await ask("Təcvid", adminContext())).reply, /Testlər[\s\S]*Təcvid testi/);
  const near = await ask("Hüsenzade", adminContext());
  assert.match(near.reply, /Bunu nəzərdə tuturdunuz\?/);
  assert.match((await ask("zzqxwv", adminContext())).reply, /başa düşmədim/);
});
