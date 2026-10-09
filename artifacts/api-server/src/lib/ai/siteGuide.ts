// Mədinə AI — saytdan istifadə bələdçisi.
//
// Statik, daxili bilik bazası. Bölmə və düymə adları tələbə kabinetinin və admin panelin real
// interfeysindən (artifacts/medine-lms/src/...) götürülüb. İnterfeys dəyişəndə bu fayl da yenilənməlidir.
import type { AiMode, AiReply } from "./aiProvider.js";
import { countKeywords, hasKeyword, type ParsedMessage } from "./text.js";
import { blockReply } from "./blocks.js";

export interface GuideTopic {
  id: string;
  modes: AiMode[];
  title: string;
  /** Mövzunu tanıdan açar sözlər (normallaşdırılmış: ə→e, ı→i, ö→o, ü→u, ş→s, ç→c, ğ→g). */
  keywords: string[];
  /** "Necə/harada" sözü olmasa belə bələdçini açan açar sözlər. */
  standalone?: string[];
  steps: string[];
  tips?: string[];
  /** Əlaqəli mövzular üçün təklif (düymə) mətnləri. */
  related?: string[];
  /** Admin paneldə bu mövzunun aid olduğu bölmə (istifadəçidə yoxdursa, addımlar əvəzinə qısa izah verilir). */
  section?: AdminSectionId;
}

/** Sualın "necə / harada" (istifadə qaydası) sualı olduğunu göstərən sözlər. */
export const GUIDE_CUES = [
  "harada", "harda", "hara", "haradadir", "hardadir", "haradan", "hardan",
  "nasil", "nerede", "nerde", "nereden", "nereye", "hangi bolum",
  "istifade", "kullan", "yolu", "addim", "telimat", "beledci", "rehber", "bolmesi harada",
  "hansi bolme", "hansi duyme", "duymesi", "olarmi", "mumkundurmu", "bilmirem", "tapa bilmirem", "gore bilmirem", "goremirem", "tapmiram",
];

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: "overview",
    modes: ["student"],
    title: "Tələbə kabinetindən istifadə",
    keywords: ["sayt", "menyu", "menu", "kabinet", "bolme", "panel", "sehife"],
    standalone: ["saytdan istifade", "sayt nece", "kabinetden istifade"],
    steps: [
      "Kompüterdə sol tərəfdəki menyudan, telefonda isə yuxarı sağdakı «Menyunu aç» (☰) düyməsindən istifadə edin.",
      "Menyu bölmələri: «İcmal», «Profilim», «Dərs Cədvəlim», «Yeniliklər», «İmtahan və testlər», «Məsləhətləşmə / Əlaqə», «Sual-cavab».",
      "Menyunun altında: «Nəticə kartı», «Məlumatlarımı düzəlt», «Şifrəni dəyiş».",
      "Ev tapşırıqları və testlər əsas səhifədə «Ev tapşırıqları» və «Testlər» kartlarındadır.",
      "Yuxarı sağda zəng ikonu bildirişləri, qırmızı «Çıxış» düyməsi isə hesabdan çıxışı açır.",
    ],
    related: ["Tapşırığı necə göndərim?", "Dərs cədvəlini harada görüm?", "Müəllimə necə mesaj yazım?"],
  },
  {
    id: "schedule",
    modes: ["student"],
    title: "Dərs cədvəlinə baxmaq",
    keywords: ["cedvel", "cizelge", "ders vaxt", "ders saat", "dersler ne vaxt", "hansi gun", "dersim"],
    steps: [
      "Menyuda «Dərs Cədvəlim» bölməsini seçin.",
      "Həftənin günlərindən birini seçin — həmin gün üçün dərslər, saat və müəllim adı görünəcək. Dərs gedirsə «CANLI» işarəsi çıxır.",
      "Dərsin linkləri və kitabı üçün dərs kartında «PDF və bütün linklərə bax» düyməsini basın.",
    ],
    tips: [
      "Cədvəl bağlıdırsa və «Dərs cədvəlinə giriş gözləmədədir» yazılıbsa, akademiya əməkdaşının təsdiqini gözləyin.",
      "«Dərs cədvəlini açmaq üçün qəbul testini tamamlayın» yazılıbsa, «Qəbul testinə keç» düyməsi ilə testi verin.",
    ],
    related: ["Dərsə necə qoşulum?", "Resurslar haradadır?", "Fənni necə silim?"],
  },
  {
    id: "join-lesson",
    modes: ["student"],
    title: "Onlayn dərsə qoşulmaq",
    keywords: ["qosul", "katil", "zoom", "meet", "telegram", "canli", "link", "kecid", "baglanti"],
    steps: [
      "Menyuda «Dərs Cədvəlim» bölməsini açın — bu günün dərsinin altında «Dərsə qoşul» düyməsi var.",
      "Və ya dərs kartında «PDF və bütün linklərə bax» düyməsini basıb «Dərs bağlantıları» hissəsindən Zoom və ya Google Meet linkinə klikləyin.",
      "Dərs vaxtı sayt üzərindən qoşulduqda girişiniz avtomatik qeyd olunur və müəllim davamiyyəti bu əsasda təsdiqləyir.",
    ],
    tips: [
      "Davamiyyətin qeyd olunması üçün linki birbaşa kopyalamayın, saytdakı düymə ilə qoşulun (dərsdən 15 dəqiqə əvvəldən 3 saat sonrasına qədər).",
      "Link görünmürsə, müəllim hələ əlavə etməyib — «Məsləhətləşmə / Əlaqə» bölməsindən müəllimə yaza bilərsiniz.",
    ],
    related: ["Resurslar haradadır?", "Dərs cədvəlini harada görüm?"],
  },
  {
    id: "resources",
    modes: ["student"],
    title: "Resurslar, kitablar və materiallar",
    keywords: ["resurs", "material", "kitab", "pdf", "kaynak", "qaynaq", "konspekt", "muhazire"],
    steps: [
      "Menyuda «Dərs Cədvəlim» bölməsini açın, dərs kartında «PDF və bütün linklərə bax» düyməsini basın.",
      "Açılan pəncərədə: «Əsas kitab PDF-i» («PDF-i aç» / «PDF-i yüklə»), «Dərs resursları» («Resursu aç»), «Tədris proqramı» və «Dərs bağlantıları».",
      "Alternativ yol: «Dərs Cədvəlim» → «Fənləri idarə et» → fənnin üzərindəki «Kitab və materiallara bax».",
    ],
    tips: ["Materiallar dərs cədvəliniz açıldıqdan sonra görünür."],
    related: ["Dərsə necə qoşulum?", "Tapşırığı necə göndərim?"],
  },
  {
    id: "assignment",
    modes: ["student"],
    title: "Ev tapşırığını göndərmək",
    keywords: ["tapsiriq", "tapsirig", "odev", "tehvil", "teslim", "ev isi", "homework", "yukle", "fayl"],
    steps: [
      "Əsas səhifədə (menyuda «İcmal») «Ev tapşırıqları» kartına basın.",
      "Siyahıdan tapşırığı seçin — təsvir, son tarix və müəllimin faylları açılacaq.",
      "Cavabı «Cavabınızı burada yazın...» sahəsinə yazın və/və ya «Fayllar əlavə et (ən çox 5, hər biri 10 MB)» ilə fayl seçin (PDF, DOC, DOCX, PNG, JPG, TXT).",
      "«Təhvili göndər» düyməsini basın. Uğurlu olsa «Təhviliniz yadda saxlanıldı.» yazısı çıxır.",
    ],
    tips: [
      "Statuslar: «Açıq», «Təhvil verilib», «Qiymətləndirilib», «Yenidən təhvil tələb olunur», «Bağlanıb».",
      "Müəllim yenidən təhvil istəsə, «Yenidən təhvil ver» düyməsi ilə yenidən göndərin. Müəllimin rəyi «Müəllim rəyi:» hissəsində görünür.",
      "Son tarix keçəndə «Bu tapşırığa artıq təhvil göndərmək mümkün deyil.» yazılır.",
    ],
    related: ["Tapşırıqlarım", "İmtahan necə verilir?"],
  },
  {
    id: "exam",
    modes: ["student"],
    title: "İmtahan və test vermək",
    keywords: ["imtahan", "sinav", "test", "quiz", "exam"],
    steps: [
      "Menyuda «İmtahan və testlər» bölməsini və ya əsas səhifədəki «Testlər» kartını açın.",
      "Açıq testin yanında «Cavablandır» düyməsini basın.",
      "Seçimli suallarda bir variant seçin; «Açıq sual» olan suallarda cavabı xanaya özünüz yazın (ərəbcə də yaza bilərsiniz).",
      "Bütün suallara cavab verib «Cavabları göndər» düyməsini basın.",
    ],
    tips: [
      "Testin vaxt limiti varsa, vaxt başladığınız andan sayılır; vaxt bitəndə «Vaxt bitdi — göndər» düyməsi çıxır.",
      "Göndərilən cavab dəyişdirilə bilməz. Yalnız seçimli suallardan ibarət testin nəticəsi dərhal «Test nəticəniz» hissəsində görünür.",
      "Testdə açıq sual varsa, status «Yoxlanılır» olur: müəllim açıq cavablara bal verəndən sonra yekun bal (seçimli + açıq suallar) və müəllimin şərhi görünür, sizə bildiriş də gəlir.",
      "Ərəbcə testlərdə suallar və variantlar sağdan sola göstərilir.",
      "Siyahıya qayıtmaq üçün «← Test siyahısına qayıt».",
    ],
    related: ["İmtahanlarım", "Qiymətlərimi harada görüm?"],
  },
  {
    id: "grades",
    modes: ["student"],
    title: "Qiymətlər və nəticə kartı",
    keywords: ["qiymet", "not", "transkript", "transcript", "netice karti", "karne", "ortalama", "gpa", "bal"],
    steps: [
      "Menyuda «Profilim» bölməsində «Semestr ortalaması» göstərilir.",
      "Fənlər üzrə qiymətlər «Dərs Cədvəlim» → «Fənləri idarə et» siyahısında «… / 5.0» kimi görünür.",
      "Tam nəticə üçün menyuda «Nəticə kartı» düyməsini basın — «Nəticə kartı və transkript» pəncərəsi açılır.",
      "Sənədi saxlamaq üçün «PDF kimi saxla» düyməsini basın.",
    ],
    related: ["Qiymətlərim", "Davamiyyətimi harada görüm?"],
  },
  {
    id: "excuse",
    modes: ["student"],
    title: "Qayıb üçün üzr bildirmək",
    keywords: ["uzr", "mazeret", "uzur", "behane"],
    steps: [
      "Menyuda «Profilim» → «Davamiyyət» kartına basın.",
      "Fənnin yanında «Qeydlərə bax» düyməsini basın.",
      "«Qayıb» qeydinin yanında «Üzr bildir» düyməsini basın.",
      "«Üzrünüzü yazın...» sahəsinə səbəbi yazıb «Üzrü göndər» düyməsini basın. «Üzrünüz müəllimə göndərildi.» yazısı çıxacaq.",
    ],
    tips: [
      "Üzr yalnız «Qayıb» qeydləri üçün göndərilə bilər.",
      "Statusu görmək üçün «Profilim» bölməsində «Davamiyyətə görə üzr» düyməsinə basın — «Göndərdiyim üzrlər»: «Gözləmədə», «Təsdiqlənib» və ya «Qəbul edilməyib».",
    ],
    related: ["Davamiyyətimi harada görüm?", "Müəllimə necə mesaj yazım?"],
  },
  {
    id: "attendance",
    modes: ["student"],
    title: "Davamiyyətə baxmaq",
    keywords: ["davamiyyet", "qayib", "devamsiz", "devam", "istirak"],
    steps: [
      "Menyuda «Profilim» bölməsində «Davamiyyət» kartına (… qayıb) basın.",
      "«Davamiyyət üzrə fənn detalları» açılır — hər fənn üzrə qayıb sayı və faiz görünür.",
      "Tarixləri görmək üçün fənnin yanında «Qeydlərə bax» düyməsini basın.",
    ],
    related: ["Qayıb üçün üzr necə yazım?", "Davamiyyətim"],
  },
  {
    id: "message",
    modes: ["student"],
    title: "Müəllimə mesaj yazmaq",
    keywords: ["mesaj", "elaqe", "meslehet", "iletisim", "yazisma", "muellime", "ogretmene", "hocaya", "ustada"],
    steps: [
      "Menyuda «Məsləhətləşmə / Əlaqə» bölməsini seçin — «Müəllimlərlə əlaqə» pəncərəsi açılır.",
      "«Müəllim seçin» siyahısından müəllimi seçin.",
      "«Mesajınızı yazın...» sahəsinə mesajı yazıb «Göndər» düyməsini basın.",
      "Müəllimin cavabı həmin pəncərədə söhbətin içində görünəcək.",
    ],
    tips: [
      "Mesajın altında «Göndərilib» və ya «Oxunub» statusu göstərilir.",
      "İlk mesajınızı «Redaktə et» düyməsi ilə düzəldə bilərsiniz.",
    ],
    related: ["Sual-cavab necə işləyir?", "Qayıb üçün üzr necə yazım?"],
  },
  {
    id: "qa",
    modes: ["student"],
    title: "Sual-cavab bölməsi",
    keywords: ["sual cavab", "soru cevap", "sual ver", "sual gonder", "soru sor", "sualimi", "sual sor"],
    standalone: ["sual cavab", "soru cevap"],
    steps: [
      "Menyuda «Sual-cavab» bölməsini seçin — «Açıq suallar və cavablar» pəncərəsi açılır.",
      "«Sual başlığı» və «Sualınızı yazın...» sahələrini doldurun.",
      "«Sualı göndər» düyməsini basın.",
      "Müəllim cavab verəndə cavab sualın altında «Cavablayan müəllim» adı ilə görünür. Cavabsız suallar menyuda qırmızı rəqəmlə işarələnir.",
    ],
    tips: ["Suallar ümumi şəkildə verilir — şəxsi məlumat yazmayın. Şəxsi məsələlər üçün «Məsləhətləşmə / Əlaqə» bölməsindən istifadə edin."],
    related: ["Müəllimə necə mesaj yazım?"],
  },
  {
    id: "profile",
    modes: ["student"],
    title: "Şəxsi məlumatları dəyişmək",
    keywords: ["profil", "melumatlarim", "melumatimi", "duzelt", "telefon", "email", "e poct", "soyad", "dogum", "adimi"],
    steps: [
      "Menyunun altında «Məlumatlarımı düzəlt» düyməsini basın.",
      "Lazım olan sahələri dəyişin: «Ad», «Soyad», «E-poçt», «Telefon», «Doğum tarixi», «Ərəb dili səviyyəsi».",
      "«Dəyişiklikləri yadda saxla» düyməsini basın. «Məlumatlarınız uğurla yeniləndi.» yazısı çıxacaq.",
    ],
    related: ["Şifrəmi necə dəyişim?"],
  },
  {
    id: "password",
    modes: ["student"],
    title: "Şifrəni dəyişmək",
    keywords: ["sifre", "parol", "password"],
    standalone: ["sifremi deyis", "sifreni deyis", "sifre deyis", "sifremi degis"],
    steps: [
      "Menyunun altında «Şifrəni dəyiş» düyməsini basın.",
      "«Mövcud şifrə» və «Yeni şifrə» sahələrini doldurun.",
      "«Yenilə» düyməsini basın.",
    ],
    tips: ["Şifrəni unutmusunuzsa, çıxış edib giriş səhifəsində «Şifrəni unutmusunuz?» linkindən istifadə edin."],
    related: ["Şifrəmi unutdum", "Çıxış necə edim?"],
  },
  {
    id: "forgot-password",
    modes: ["student", "admin"],
    title: "Şifrəni unutmusunuzsa",
    keywords: ["unut", "berpa", "sifirla", "hatirla"],
    standalone: ["sifremi unut", "sifreni unut", "parolu unut", "sifremi unuttum"],
    steps: [
      "Giriş səhifəsində «Şifrəni unutmusunuz?» linkinə basın.",
      "«Email ünvanı» sahəsinə qeydiyyat e-poçtunuzu yazıb «Bərpa kodunu göndər» düyməsini basın.",
      "E-poçta gələn kodu «Bərpa kodu» sahəsinə yazıb «Kodu təsdiqlə» basın.",
      "«Yeni şifrə» yazıb (ən azı 8 simvol) «Şifrəni yenilə» düyməsini basın.",
    ],
    related: ["Sayta necə daxil olum?"],
  },
  {
    id: "login",
    modes: ["student"],
    title: "Sayta daxil olmaq",
    keywords: ["giris et", "daxil ol", "login", "oturum ac", "hesaba gir", "sayta gir"],
    steps: [
      "Giriş səhifəsində «Email və ya tələbə nömrəsi» sahəsinə e-poçtunuzu və ya tələbə nömrənizi (məs. T0001) yazın.",
      "«Şifrə» sahəsini doldurub «Giriş et» düyməsini basın.",
      "Yeni cihazdan girirsinizsə, e-poçta gələn «Təhlükəsizlik kodu»nu yazıb «Kodu təsdiqlə» basın.",
    ],
    related: ["Şifrəmi unutdum"],
  },
  {
    id: "notifications",
    modes: ["student"],
    title: "Bildirişlər və yeniliklər",
    keywords: ["bildiris", "bildirim", "elan", "duyuru", "yenilik", "zeng"],
    steps: [
      "Yuxarı sağdakı zəng ikonuna («Bildirişləri göstər») basın — «Bildirişlər» paneli açılır.",
      "Panelde «Yaxınlaşan dərs», «Tapşırıq son tarixləri» və «Akademiya elanı» hissələri var.",
      "Akademiyanın xəbərləri üçün menyuda «Yeniliklər» bölməsini seçin.",
    ],
    tips: ["Vacib bildiriş «Akademiyadan bildiriş» pəncərəsi kimi açıla bilər — oxuduqdan sonra X ilə bağlayın."],
    related: ["Elanlar"],
  },
  {
    id: "logout",
    modes: ["student", "admin"],
    title: "Hesabdan çıxmaq",
    keywords: ["cixis", "cixim", "cikis", "logout", "hesabdan cix", "oturumu kapat", "sign out"],
    standalone: ["cixis", "cikis", "logout", "hesabdan cix"],
    steps: [
      "Səhifənin yuxarı sağ hissəsindəki qırmızı «Çıxış» düyməsini basın.",
    ],
    tips: ["Çox dar telefon ekranında bu düymə gizlənə bilər — telefonu üfüqi vəziyyətə çevirin və ya daha geniş ekrandan istifadə edin."],
  },
  {
    id: "subjects",
    modes: ["student"],
    title: "Fənləri və müəllimi idarə etmək",
    keywords: ["muellimi", "ogretmeni", "deyis", "degis", "fenni", "fenn sil", "fenni sil", "dersi sil", "ders sil", "muellimi deyis", "muellim deyis", "ogretmen degis", "fenleri idare", "cedvelden sil", "ixtiyari", "secmeli", "icbari"],
    steps: [
      "Menyuda «Dərs Cədvəlim» bölməsində «Fənləri idarə et» düyməsini basın.",
      "Müəllimi dəyişmək üçün fənnin yanında «Müəllimi dəyiş» basın və uyğun müəllim qrupunda «Seç» düyməsini seçin — seçim təsdiq üçün göndərilir.",
      "İxtiyari fənni silmək üçün «Cədvəldən sil» basın və təsdiqləyin.",
      "İcbari fənn üçün «Müraciət et» basın, «Müraciət səbəbinizi yazın...» sahəsini doldurub «Müraciəti göndər» basın.",
    ],
    tips: ["Müraciətlərin vəziyyəti «Fənn silinməsi müraciətləriniz» hissəsində görünür. Redaktəni bitirmək üçün «Düzəlişi bağla»."],
    related: ["Dərs cədvəlini harada görüm?"],
  },
  {
    id: "onboarding",
    modes: ["student"],
    title: "Qəbul testi və cədvəlin açılması",
    keywords: ["qebul testi", "qebul imtahan", "cedvel acilmir", "cedvel bagli", "gozlemede", "acilmir"],
    steps: [
      "«Dərs Cədvəlim» hissəsində «Qəbul testinə keç» düyməsini basın.",
      "Testi cavablandırıb «Cavabları göndər» basın.",
      "Nəticə təsdiqləndikdən sonra dərs cədvəliniz açılacaq.",
    ],
    tips: ["«Dərs cədvəlinə giriş gözləmədədir» yazılıbsa, akademiya əməkdaşının təsdiqini gözləmək lazımdır."],
  },
  {
    id: "ai",
    modes: ["student", "admin"],
    title: "Mədinə AI-dan istifadə",
    keywords: ["medine ai", "suni intellekt", "yapay zeka", "chatbot", "bu bot", "ai"],
    steps: [
      "Sualınızı «Nə ilə kömək edim?» sahəsinə yazın və ya hazır kartlardan birini seçin.",
      "Söhbət tarixçəsi yalnız bu brauzerdə saxlanılır; silmək üçün «Tarixçəni təmizlə» düyməsini basın.",
    ],
  },

  // ----------------------------- Admin panel -----------------------------
  {
    id: "admin-overview",
    modes: ["admin"],
    title: "Admin paneldən istifadə",
    keywords: ["panel", "bolme", "tab", "menyu", "menu", "sayt", "admin"],
    standalone: ["paneldan istifade", "paneldən istifade", "admin panel nece"],
    steps: [
      // Bu sətir cavabda istifadəçinin öz bölmələri ilə əvəz olunur (bax adminOverviewSteps).
      "Yuxarıdakı bölmə düymələri rolunuza və icazələrinizə görə görünür.",
      "Aşağıda: «Mənim cədvəlim», «Müəllimlər cədvəli», «Məsləhətləşmə / Əlaqə», «Sual-cavab».",
      "Tələbə, müraciət və ya dərsi tez tapmaq üçün «Tələbə, müraciət və ya dərs axtar...» axtarış sahəsindən istifadə edin.",
    ],
    tips: ["Bir bölməyə yenidən bassanız, o bağlanır."],
    related: ["Tələbələri harada idarə edim?", "Elanı necə yayımlayım?"],
  },
  {
    id: "admin-research",
    modes: ["admin"],
    title: "Şamilə və Dorar-da mənbə axtarışı",
    keywords: ["samile", "samilede", "shamela", "dorar", "hedis yoxla", "hedis axtar", "hadis ara", "kitablarda axtar", "menbe axtar", "hedis"],
    standalone: ["samilede axtar", "shamela", "dorar", "hedis yoxla"],
    steps: [
      "Şamilə kitabxanasında axtarmaq üçün yazın: «Şamilədə axtar: إنما الأعمال بالنيات» (və ya «shamela …», «kitablarda axtar …», «الشاملة …»).",
      "Hədisi Dorar (الدرر السنية) bazasında yoxlamaq üçün yazın: «Hədis yoxla: إنما الأعمال بالنيات» (və ya «dorar …», «hədis axtar …», «hadis ara …»).",
      "Nəticələr Mədinə AI-ın içində göstərilir: Şamilədə kitab, müəllif, cild/səhifə və səhifə mətni; Dorar-da hədis mətni, ravi, mühəddis, mənbə, səhifə/nömrə və hökm.",
      "Şamilə nəticəsində «Davamı» düyməsi səhifənin tam mətnini burada açır, hədis kartında isə hədisin tam mətnini gətirir; «Əvvəlki / Növbəti səhifə» ilə vərəqləyə bilərsiniz. «Kopyala» düyməsi mətni kopyalayır.",
    ],
    tips: [
      "Ən yaxşı nəticə üçün ərəbcə açar sözlər yazın.",
      "Axtarış hər dəfə canlı aparılır; saytda heç nə saxlanmır. Bu imkan yalnız heyət üzvləri üçündür.",
    ],
    related: ["Şamilədə axtar: إنما الأعمال بالنيات", "Hədis yoxla: إنما الأعمال بالنيات"],
  },
  {
    id: "admin-search",
    modes: ["admin"],
    title: "Qlobal axtarış",
    keywords: ["axtaris", "qlobal", "arama", "axtar"],
    steps: [
      "Panelin yuxarısındakı «Tələbə, müraciət və ya dərs axtar...» sahəsinə ən azı 2 hərf yazın.",
      "Nəticədən tələbəni seçin — «Tələbələri idarə et» bölməsi həmin tələbə ilə açılır.",
    ],
    tips: ["Mədinə AI-da da tələbənin adını, e-poçtunu və ya T-nömrəsini yazıb tam məlumat ala bilərsiniz."],
  },
  {
    id: "admin-students",
    section: "student-management",
    modes: ["admin"],
    title: "Tələbələri idarə etmək",
    keywords: ["telebeleri", "idare", "telebeleri idare", "qiymet yaz", "qiymet daxil", "qiymetlendirme", "davamiyyet", "uzr muraciet", "semestr kecid", "cedvele giris", "muellim secim", "texerruc", "mezun", "silinmis hesab"],
    steps: [
      "«Tələbələri idarə et» bölməsini açın.",
      "Alt bölmələr (icazəyə görə): «Dərs silinməsi», «Qiymətləndirmə», «Davamiyyət», «Üzr müraciətləri», «Müəllim seçimləri», «Semestr keçidini təsdiqlə», «Cədvələ giriş təsdiqi», «Ev tapşırıqları», «Təxərrüc et», «Silinmiş hesablar».",
    ],
  },
  {
    id: "admin-announcement",
    section: "announcement",
    modes: ["admin"],
    title: "Elan və bildiriş göndərmək",
    keywords: ["elan", "bildiris", "duyuru", "xeber"],
    steps: [
      "Ümumi elan üçün «Yeni elan» bölməsini açın, başlığı («Yeni xəbər başlığı») və mətni yazıb «Elanı yayımla» basın. Köhnə elanlar «Mövcud elanlar» düyməsindədir.",
      "Tələbələrə hədəfli bildiriş üçün «Tələbələrə bildiriş» bölməsini açın, formu doldurub «Bildirişi göndər» basın.",
    ],
  },
  {
    id: "admin-exams",
    section: "exams",
    modes: ["admin"],
    title: "Test və tapşırıq yaratmaq",
    keywords: ["imtahan", "test", "sinav", "tapsiriq", "tapsirig", "odev", "aciq sual", "erebce test"],
    steps: [
      "Test üçün «İmtahan və testlər» bölməsini açıb «Yeni test» düyməsini basın, sualları və düzgün variantları daxil edib yadda saxlayın. Cavablar «Cavablara bax» düyməsindədir.",
      "Testin dilini «Ərəbcə (sağdan sola)» seçsəniz, bütün suallar və variantlar sağdan sola yazılır və göstərilir.",
      "Hər sualda «Seçimli» və ya «Açıq sual» növünü seçin. Açıq sual üçün maksimum bal və istəsəniz yalnız müəllimin gördüyü nümunə cavab yazın.",
      "Açıq cavablar «Yoxlanılır» statusunda gəlir: «Cavablara bax» → «Yoxla» ilə hər açıq cavaba bal (və istəsəniz şərh) verib «Balları yadda saxla» basın. Yekun bal = seçimli suallar + açıq suallar; nəticə tələbəyə yoxlamadan sonra açılır.",
      "Ev tapşırığı üçün «Tələbələri idarə et» → «Ev tapşırıqları» → «Yeni tapşırıq».",
    ],
  },
  {
    id: "admin-messages",
    modes: ["admin"],
    title: "Tələbə mesajlarına və suallarına cavab",
    keywords: ["mesaj", "elaqe", "meslehet", "sual cavab", "cavab ver", "cavablandir"],
    steps: [
      "Mesajlar üçün «Məsləhətləşmə / Əlaqə» bölməsini açın, söhbəti seçin, «Cavabınızı yazın...» sahəsinə yazıb göndərin.",
      "Ümumi suallar üçün «Sual-cavab» bölməsində sualın altında cavabı yazıb «Cavablandır» basın.",
    ],
  },
  {
    id: "admin-applications",
    section: "application",
    modes: ["admin"],
    title: "Müraciətlərə baxmaq",
    keywords: ["muraciet", "qebul", "basvuru"],
    steps: [
      "«Müraciətlər» bölməsini açın — gözləyən müraciətlərin sayı düymənin üstündə qırmızı rəqəmlə göstərilir.",
      "Müraciəti açıb qərar verin (bu hüquq rolunuza bağlıdır).",
    ],
  },
];

// ---------------------------------------------------------------------------
// Admin panel bölmələri — admin-panel.tsx-dəki düymələrin görünmə qaydası ilə eyni
// (İdarə paneli plitələri + «Şəhadətnamə idarəsi», «Cədvəl hazırlama», «Mədrəsə Kitabxanası»).

export type AdminSectionId =
  | "announcement" | "student-notifications" | "article" | "benefit" | "student-management" | "application" | "exams"
  | "course-content" | "users" | "course-activation" | "statistics" | "audit-history" | "graduation-certificates"
  | "schedule-prep" | "library";

export interface AdminGuideAccess {
  isOwner: boolean;
  /** owner, owner_assistant, admin, teacher, supervisor */
  role: string;
  permissions: ReadonlySet<string>;
}

const ADMIN_SECTIONS: Array<{ id: AdminSectionId; label: string; visible: (access: AdminGuideAccess) => boolean }> = (() => {
  const perm = (permission: string) => (access: AdminGuideAccess) => access.permissions.has(permission);
  const board = (access: AdminGuideAccess) => access.role === "owner_assistant";
  return [
    { id: "announcement", label: "Yeni elan", visible: perm("announcements") },
    { id: "student-notifications", label: "Tələbələrə bildiriş", visible: perm("announcements") },
    { id: "article", label: "Məqalə", visible: perm("articles") },
    { id: "benefit", label: "Günün faydası", visible: perm("dailyBenefits") },
    {
      id: "student-management", label: "Tələbələri idarə et",
      visible: (access) => access.permissions.has("students")
        || (access.permissions.has("assignments") && ["teacher", "admin", "owner_assistant"].includes(access.role)),
    },
    { id: "application", label: "Müraciətlər", visible: perm("applications") },
    { id: "exams", label: "İmtahan və testlər", visible: perm("assignments") },
    { id: "course-content", label: "Tədris proqramı", visible: perm("schedule") },
    { id: "users", label: "İstifadəçi rolları", visible: board },
    { id: "course-activation", label: "Dərsləri idarə et", visible: board },
    { id: "statistics", label: "Statistika", visible: () => false },
    { id: "audit-history", label: "Audit tarixçəsi", visible: () => false },
    { id: "graduation-certificates", label: "Şəhadətnamə idarəsi", visible: board },
    { id: "schedule-prep", label: "Cədvəl hazırlama", visible: (access) => board(access) || access.role === "admin" },
    { id: "library", label: "Mədrəsə Kitabxanası", visible: () => true },
  ];
})();

/** İstifadəçinin admin paneldə həqiqətən gördüyü bölmələr (sahib hamısını görür). */
export function adminSectionsFor(access: AdminGuideAccess) {
  return ADMIN_SECTIONS.filter((section) => access.isOwner || section.visible(access)).map((section) => ({ id: section.id, label: section.label }));
}

function adminOverviewSteps(topic: GuideTopic, access: AdminGuideAccess) {
  const labels = adminSectionsFor(access).map((section) => `«${section.label}»`);
  return topic.steps.map((step, index) => (index === 0 ? `Sizin hesabınızda açıq olan bölmələr: ${labels.join(", ")}.` : step));
}

export function isGuideQuestion(parsed: ParsedMessage) {
  // «necə» (how) və «neçə» (how many) normallaşdırmadan sonra eyni olur, ona görə orijinal mətnə baxırıq:
  // «neçə» (ç ilə) say sualıdır və bələdçini açmamalıdır.
  const howWord = /(^|[^\p{L}])nec[əe](?![\p{L}])/iu.test(parsed.raw);
  return howWord || countKeywords(parsed, GUIDE_CUES) > 0;
}

function scoreTopic(parsed: ParsedMessage, topic: GuideTopic) {
  return topic.keywords.reduce((total, keyword) => total + (hasKeyword(parsed, keyword) ? (keyword.includes(" ") ? 3 : 2) : 0), 0);
}

export function findGuideTopic(parsed: ParsedMessage, mode: AiMode): GuideTopic | null {
  const topics = GUIDE_TOPICS.filter((topic) => topic.modes.includes(mode));
  const cue = isGuideQuestion(parsed);
  let best: GuideTopic | null = null;
  let bestScore = 0;
  for (const topic of topics) {
    const standalone = topic.standalone?.some((keyword) => hasKeyword(parsed, keyword)) ?? false;
    if (!cue && !standalone) continue;
    const score = scoreTopic(parsed, topic) + (standalone ? 5 : 0);
    if (score > bestScore) {
      best = topic;
      bestScore = score;
    }
  }
  return best;
}

export function guideReply(topic: GuideTopic, access?: AdminGuideAccess): AiReply {
  if (access && topic.section && !adminSectionsFor(access).some((section) => section.id === topic.section)) {
    const label = ADMIN_SECTIONS.find((section) => section.id === topic.section)?.label ?? topic.title;
    return blockReply([{
      type: "text",
      text: `«${label}» bölməsi sizin hesabınızda açıq deyil. Bu imkan lazımdırsa, sistem sahibindən icazə istəyin.`,
    }], ["Admin paneldən necə istifadə edim?"]);
  }
  const steps = access && topic.id === "admin-overview" ? adminOverviewSteps(topic, access) : topic.steps;
  return blockReply([{ type: "steps", title: topic.title, steps, tips: topic.tips?.length ? topic.tips : undefined }], topic.related ?? []);
}

export function guideTopicList(mode: AiMode) {
  return GUIDE_TOPICS.filter((topic) => topic.modes.includes(mode)).map((topic) => topic.title);
}

/**
 * "Necə / harada" sualı və ya müstəqil açar söz (məs. «çıxış») varsa bələdçi cavabı qaytarır.
 * Mövzu tapılmasa, amma sual istifadə qaydası barədədirsə, ümumi bələdçi qaytarılır.
 * access (admin rejimi) verilərsə, bələdçi yalnız istifadəçinin gördüyü bölmələri sadalayır.
 */
export function answerGuide(parsed: ParsedMessage, mode: AiMode, access?: AdminGuideAccess): AiReply | null {
  const topic = findGuideTopic(parsed, mode);
  if (topic) return guideReply(topic, access);
  if (isGuideQuestion(parsed) && countKeywords(parsed, ["sayt", "kabinet", "panel", "istifade", "kullan"]) > 0) {
    const overview = GUIDE_TOPICS.find((item) => item.id === (mode === "admin" ? "admin-overview" : "overview"));
    return overview ? guideReply(overview, access) : null;
  }
  return null;
}
