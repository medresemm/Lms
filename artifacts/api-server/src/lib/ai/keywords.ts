// Mədinə AI açar sözləri (normallaşdırılmış: ə→e, ı→i, ö→o, ü→u, ş→s, ç→c, ğ→g).

// ---------------------------------------------------------------------------
// Açar sözlər (normallaşdırılmış: ə→e, ı→i, ö→o, ü→u, ş→s, ç→c, ğ→g)
// ---------------------------------------------------------------------------

export const KW = {
  greeting: ["salam", "merhaba", "selam", "aleykum", "salamun", "hey", "xos gordu"],
  thanks: ["tesekkur", "sag ol", "sagol", "cox sag", "eyvallah", "minnetdar", "allah razi", "tsk", "sagolun"],
  help: ["komek", "yardim", "ne bacarir", "neler", "ne ede biler", "help", "nece istifade", "ne sorus", "ne soru", "menu"],
  scheduleStrong: ["cedvel", "cizelge", "bugun", "bu gun", "sabah", "yarin", "hefte", "hafta", "zoom", "meet", "telegram", "ders vaxt", "ders saat", "ne vaxt ders", "dersim var", "ders var", "dersler ne vaxt"],
  scheduleWeak: ["vaxt", "saat", "zaman", "proqram", "program", "gun"],
  assignments: ["tapsiriq", "odev", "ev isi", "ev tapsir", "homework", "teslim", "deadline", "son tarix", "muddet", "tehvil"],
  exams: ["imtahan", "sinav", "test", "quiz", "exam"],
  grades: ["qiymet", "not", "bal", "gpa", "ortalama", "orta bal", "puan", "netice", "sonuc", "karne", "transkript", "transcript", "akademik"],
  attendance: ["davamiyyet", "devam", "qayib", "qaib", "istirak", "katilim", "gelmedi", "buraxdig", "kacirdig", "uzrlu", "gecikme"],
  resources: ["resurs", "material", "kitab", "pdf", "link", "kaynak", "qaynaq", "fayl", "dosya", "video", "muhazire", "konspekt", "sened", "belge", "kecid"],
  courses: ["ders", "fenn", "fenler", "kurs", "muellim", "ogretmen", "hoca", "ustad", "ustaz", "predmet"],
  profile: ["profil", "semestr", "donem", "sinif", "nomrem", "numaram", "melumatim", "haqqimda", "hakkimda", "kimem", "kim oldug", "adim", "statusum", "veziyyet"],
  notices: ["elan", "duyuru", "bildiris", "bildirim", "xeber", "haber", "yenilik"],
  others: ["diger telebe", "basqa telebe", "diger ogrenci", "baska ogrenci", "yoldas", "sinif arkadas", "qrup yoldas", "telebelerin", "butun telebe", "hamisinin", "ogrencilerin"],
  // Admin
  studentWords: ["telebe", "ogrenci", "sagird", "student"],
  search: ["axtar", "tap", "ara", "bul", "goster", "haqqinda", "hakkinda", "melumat", "bilgi", "kimdir", "profil"],
  stats: ["nece telebe", "nece nefer", "statistika", "istatistik", "sayi", "say", "cemi", "toplam", "kac ogrenci", "kac telebe"],
  teacher: ["muellim", "ogretmen", "hoca", "ustaz", "ustad", "teacher"],
  courseList: ["kurs", "kurslar", "ders", "dersler", "fenn", "fenler", "fennler", "predmet"],
  listWords: ["siyahi", "liste", "list", "kimler", "hansi telebe", "telebeleri", "ogrencileri", "qeydiyyat", "oxuyur", "oxuyan"],
} as const;

export const STOPWORDS = new Set([
  "ve", "ile", "da", "de", "bu", "o", "mene", "bana", "zehmet", "olmasa", "lutfen", "xahis", "edirem", "ederim", "ver", "verin",
  "goster", "gostar", "goster", "gosterin", "tap", "tapin", "axtar", "axtarin", "ara", "bul", "bulun", "haqqinda", "hakkinda",
  "melumat", "melumati", "melumatlari", "bilgi", "bilgileri", "telebe", "telebenin", "telebeni", "telebeler", "ogrenci", "ogrencinin",
  "ogrenciyi", "sagird", "student", "kimdir", "kim", "ne", "nedir", "neler", "hansi", "olan", "adli", "adinda", "isimli",
  "qiymet", "qiymetleri", "qiymetlerini", "notlari", "notlarini", "davamiyyet", "davamiyyeti", "devamsizlik", "profil", "profili",
  "tam", "butun", "her", "sey", "hamisi", "infos", "info", "pls", "zehmet", "olmasa", "salam", "merhaba", "selam", "nomre", "nomresi",
  "numara", "numarasi", "email", "e-poct", "poct", "telefon", "nin", "nun", "in", "un", "un", "ucun", "icin", "uzre", "imtahan", "tapsiriq",
  "netice", "neticeleri", "akademik", "haqqinda", "barede", "barəsində", "baresinde", "bax", "baxim", "isteyirem", "istiyorum",
]);
