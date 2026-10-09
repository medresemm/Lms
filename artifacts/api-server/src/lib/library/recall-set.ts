// Kitabxana axtarışı üçün «recall» test dəsti: istifadəçinin yazdığı kimi sorğular və gözlənilən səhifə aralıqları
// (skan/PDF səhifəsi; fəsil aralıqları kataloqdakı fihrisdən götürülüb). Nəticə ilk 10-da bu aralığa düşməlidir.
export interface RecallCase {
  /** İstifadəçinin yazdığı mesaj (Mədinə AI-də «Daxili» rejim). */
  message: string;
  kind: "arabic" | "tashkeel" | "ocr-typo" | "text" | "topic" | "chapter" | "filter" | "trigger";
  slug: "manhaj-as-salikin" | "at-tuhfa-as-saniyya";
  /** Qəbul edilən [başlanğıc, son] aralıqları. */
  ranges: Array<[number, number]>;
}

export const RECALL_SET: RecallCase[] = [
  { message: "نواقض الوضوء", kind: "arabic", slug: "manhaj-as-salikin", ranges: [[56, 69]] },
  { message: "زَكَاةُ الْفِطْرِ", kind: "tashkeel", slug: "manhaj-as-salikin", ranges: [[180, 183]] },
  { message: "صَلَاةُ الْجُمُعَةِ", kind: "tashkeel", slug: "manhaj-as-salikin", ranges: [[136, 143]] },
  { message: "كان وأخواتها", kind: "arabic", slug: "at-tuhfa-as-saniyya", ranges: [[94, 96]] },
  { message: "الْمَفْعُولُ الْمُطْلَقُ", kind: "tashkeel", slug: "at-tuhfa-as-saniyya", ranges: [[129, 130]] },
  { message: "التيمم", kind: "arabic", slug: "manhaj-as-salikin", ranges: [[74, 80]] },
  { message: "سجود السهو", kind: "arabic", slug: "manhaj-as-salikin", ranges: [[105, 107]] },
  { message: "المنادى", kind: "arabic", slug: "at-tuhfa-as-saniyya", ranges: [[149, 150]] },
  { message: "الأسماء الخمسة", kind: "arabic", slug: "at-tuhfa-as-saniyya", ranges: [[38, 39], [59, 59]] },
  { message: "التعريض في خطبة البائن", kind: "text", slug: "manhaj-as-salikin", ranges: [[346, 346]] },
  { message: "صاعا من تمر أو صاعا من شعير", kind: "text", slug: "manhaj-as-salikin", ranges: [[180, 182]] },
  { message: "العوامل اللفظية فتغير إعرابهما", kind: "text", slug: "at-tuhfa-as-saniyya", ranges: [[94, 94]] },
  { message: "يجب في الحال أن يكون نكرة", kind: "text", slug: "at-tuhfa-as-saniyya", ranges: [[137, 137]] },
  { message: "نواقص الوضوء", kind: "ocr-typo", slug: "manhaj-as-salikin", ranges: [[56, 69]] },
  { message: "الاستنجا", kind: "ocr-typo", slug: "manhaj-as-salikin", ranges: [[33, 38]] },
  { message: "زكاة الفظر", kind: "ocr-typo", slug: "manhaj-as-salikin", ranges: [[180, 183]] },
  { message: "المبتدا والخير", kind: "ocr-typo", slug: "at-tuhfa-as-saniyya", ranges: [[88, 93]] },
  { message: "إن وأخراتها", kind: "ocr-typo", slug: "at-tuhfa-as-saniyya", ranges: [[94, 97]] },
  { message: "dəstəmazı pozan şeylər", kind: "topic", slug: "manhaj-as-salikin", ranges: [[56, 69]] },
  { message: "abdesti bozan şeyler", kind: "topic", slug: "manhaj-as-salikin", ranges: [[56, 69]] },
  { message: "fitrə zəkatı", kind: "topic", slug: "manhaj-as-salikin", ranges: [[180, 183]] },
  { message: "oruc", kind: "topic", slug: "manhaj-as-salikin", ranges: [[190, 205]] },
  { message: "talaq", kind: "topic", slug: "manhaj-as-salikin", ranges: [[382, 395]] },
  { message: "miras", kind: "topic", slug: "manhaj-as-salikin", ranges: [[322, 337]] },
  { message: "təyəmmüm", kind: "topic", slug: "manhaj-as-salikin", ranges: [[74, 80]] },
  { message: "qüsl", kind: "topic", slug: "manhaj-as-salikin", ranges: [[70, 73]] },
  { message: "alış-veriş", kind: "topic", slug: "manhaj-as-salikin", ranges: [[238, 254]] },
  { message: "kana və bacıları", kind: "topic", slug: "at-tuhfa-as-saniyya", ranges: [[94, 96]] },
  { message: "mübtəda xəbər", kind: "topic", slug: "at-tuhfa-as-saniyya", ranges: [[88, 93]] },
  { message: "temyiz", kind: "topic", slug: "at-tuhfa-as-saniyya", ranges: [[139, 142]] },
  { message: "istisna", kind: "topic", slug: "at-tuhfa-as-saniyya", ranges: [[143, 148]] },
  { message: "məfulun bih", kind: "topic", slug: "at-tuhfa-as-saniyya", ranges: [[124, 128]] },
  { message: "باب صلاة العيدين", kind: "chapter", slug: "manhaj-as-salikin", ranges: [[144, 151]] },
  { message: "علامات الفعل", kind: "chapter", slug: "at-tuhfa-as-saniyya", ranges: [[12, 14]] },
  { message: "Tuhfədə fail", kind: "filter", slug: "at-tuhfa-as-saniyya", ranges: [[77, 84]] },
  { message: "Mənhəcdə nikah", kind: "filter", slug: "manhaj-as-salikin", ranges: [[345, 367]] },
  { message: "التحفة النعت", kind: "filter", slug: "at-tuhfa-as-saniyya", ranges: [[103, 109]] },
  { message: "hansı səhifədə cənazə namazı", kind: "trigger", slug: "manhaj-as-salikin", ranges: [[152, 165]] },
  { message: "زكاة الفطر harada yazılıb", kind: "trigger", slug: "manhaj-as-salikin", ranges: [[180, 183]] },
  { message: "həcc haqqında bab", kind: "trigger", slug: "manhaj-as-salikin", ranges: [[206, 232]] },
  { message: "cuma namazı hangi sayfada", kind: "trigger", slug: "manhaj-as-salikin", ranges: [[136, 143]] },
];

/** Sinonim xəritəsi qurulandan sonra yazılmış əlavə sorğular (ayrıca ölçülür). */
export const HELD_OUT_SET: RecallCase[] = [
  { message: "aybaşı", kind: "topic", slug: "manhaj-as-salikin", ranges: [[81, 83]] },
  { message: "zəkat kimlərə verilir", kind: "topic", slug: "manhaj-as-salikin", ranges: [[166, 189]] },
  { message: "qurban", kind: "topic", slug: "manhaj-as-salikin", ranges: [[233, 237]] },
  { message: "nida", kind: "topic", slug: "at-tuhfa-as-saniyya", ranges: [[149, 150]] },
  { message: "الرهن", kind: "arabic", slug: "manhaj-as-salikin", ranges: [[267, 271]] },
  { message: "girov", kind: "topic", slug: "manhaj-as-salikin", ranges: [[267, 271]] },
  { message: "hədd cəzaları", kind: "topic", slug: "manhaj-as-salikin", ranges: [[436, 451]] },
  { message: "أنواع المضمر", kind: "chapter", slug: "at-tuhfa-as-saniyya", ranges: [[80, 84]] },
  { message: "naibi fail", kind: "topic", slug: "at-tuhfa-as-saniyya", ranges: [[85, 87]] },
  { message: "vəqf", kind: "topic", slug: "manhaj-as-salikin", ranges: [[312, 314]] },
  { message: "mehr", kind: "topic", slug: "manhaj-as-salikin", ranges: [[368, 371]] },
  { message: "zərf", kind: "topic", slug: "at-tuhfa-as-saniyya", ranges: [[131, 135]] },
  { message: "bədəl", kind: "topic", slug: "at-tuhfa-as-saniyya", ranges: [[120, 122]] },
  { message: "Mənhəcdə oruc", kind: "filter", slug: "manhaj-as-salikin", ranges: [[190, 205]] },
  { message: "kitapta ara: الطلاق", kind: "trigger", slug: "manhaj-as-salikin", ranges: [[382, 395]] },
  { message: "التميز", kind: "ocr-typo", slug: "at-tuhfa-as-saniyya", ranges: [[139, 142]] },
  { message: "الاستثنا", kind: "ocr-typo", slug: "at-tuhfa-as-saniyya", ranges: [[143, 148]] },
  { message: "سجود التلاوة", kind: "arabic", slug: "manhaj-as-salikin", ranges: [[105, 107]] },
  { message: "gusül abdesti", kind: "topic", slug: "manhaj-as-salikin", ranges: [[70, 73]] },
  { message: "cenazə namazı necə qılınır", kind: "topic", slug: "manhaj-as-salikin", ranges: [[152, 165]] },
  { message: "nikahın şərtləri", kind: "topic", slug: "manhaj-as-salikin", ranges: [[349, 356]] },
  { message: "المثنى", kind: "arabic", slug: "at-tuhfa-as-saniyya", ranges: [[57, 57]] },
  { message: "jazm", kind: "topic", slug: "at-tuhfa-as-saniyya", ranges: [[50, 52]] },
  { message: "صلاة المسافر", kind: "text", slug: "manhaj-as-salikin", ranges: [[130, 135]] },
  { message: "إذا شك في صلاته", kind: "text", slug: "manhaj-as-salikin", ranges: [[105, 107]] },
];
