// Mədrəsə Kitabxanası — statik kataloq (bazada cədvəl yoxdur).
// Fəsillər hər kitabın öz «فهرس» səhifələrindən köçürülüb (skanlara baxılaraq); «printedPage» çap nömrəsi,
// «page» isə skan (PDF) səhifəsidir: hər iki kitabda skan = çap + 1 (OCR və vizual yoxlama ilə təsdiqlənib).
// Səhifə şəkilləri: src/assets/library/<slug>/pNNN.webp; OCR mətni: src/assets/library/<slug>/text.json.

export interface LibraryChapter {
  title: string;
  /** 1 — kitab / əsas bab, 2 — alt bölmə. */
  level: 1 | 2;
  printedPage: number;
  page: number;
}

export interface LibraryBook {
  slug: string;
  title: string;
  shortTitle: string;
  author: string;
  commentator: string | null;
  foreword: string | null;
  publisher: string;
  edition: string | null;
  year: string;
  subject: string;
  pageCount: number;
  /** skan səhifəsi = çap səhifəsi + pageOffset */
  pageOffset: number;
  chapters: LibraryChapter[];
}

export const LIBRARY_BOOKS: readonly LibraryBook[] = [
  {
    "slug": "manhaj-as-salikin",
    "title": "شرح منهج السالكين وتوضيح الفقه في الدين",
    "shortTitle": "Şərhu Mənhəcis-Salikin",
    "author": "الشيخ عبد الرحمن بن ناصر السعدي",
    "commentator": "د. سليمان بن عبد الله القصير",
    "foreword": "تقديم: عبد الله بن عبد العزيز بن عقيل، صالح بن عبد العزيز آل الشيخ",
    "publisher": "دار كنوز إشبيليا، الرياض",
    "edition": "الطبعة الثانية، طبعة جديدة منقحة ومصححة",
    "year": "1431هـ / 2010م",
    "subject": "Fiqh",
    "pageCount": 471,
    "pageOffset": 1,
    "chapters": [
      {
        "title": "تقديم سماحة الشيخ عبدالله بن عقيل",
        "level": 1,
        "printedPage": 5,
        "page": 6
      },
      {
        "title": "تقديم معالي الشيخ صالح بن عبدالعزيز آل الشيخ",
        "level": 1,
        "printedPage": 9,
        "page": 10
      },
      {
        "title": "ترجمة مختصرة للشيخ عبدالرحمن السعدي",
        "level": 1,
        "printedPage": 15,
        "page": 16
      },
      {
        "title": "مقدمة الشارح",
        "level": 1,
        "printedPage": 19,
        "page": 20
      },
      {
        "title": "مقدمة المصنِّف",
        "level": 1,
        "printedPage": 23,
        "page": 24
      },
      {
        "title": "كتاب الطهارة",
        "level": 1,
        "printedPage": 27,
        "page": 28
      },
      {
        "title": "باب الاستنجاء، وآداب قضاء الحاجة",
        "level": 2,
        "printedPage": 32,
        "page": 33
      },
      {
        "title": "فصل",
        "level": 2,
        "printedPage": 38,
        "page": 39
      },
      {
        "title": "باب صفة الوضوء",
        "level": 2,
        "printedPage": 46,
        "page": 47
      },
      {
        "title": "فصل",
        "level": 2,
        "printedPage": 52,
        "page": 53
      },
      {
        "title": "باب نواقض الوضوء",
        "level": 2,
        "printedPage": 55,
        "page": 56
      },
      {
        "title": "باب ما يوجب الغسل وصفته",
        "level": 2,
        "printedPage": 69,
        "page": 70
      },
      {
        "title": "باب التيمم",
        "level": 2,
        "printedPage": 73,
        "page": 74
      },
      {
        "title": "باب الحيض",
        "level": 2,
        "printedPage": 80,
        "page": 81
      },
      {
        "title": "كتاب الصلاة",
        "level": 1,
        "printedPage": 83,
        "page": 84
      },
      {
        "title": "باب صفة الصلاة",
        "level": 2,
        "printedPage": 85,
        "page": 86
      },
      {
        "title": "باب سجود السهو والتلاوة والشكر",
        "level": 2,
        "printedPage": 104,
        "page": 105
      },
      {
        "title": "باب مفسدات الصلاة ومكروهاتها",
        "level": 2,
        "printedPage": 107,
        "page": 108
      },
      {
        "title": "باب صلاة التطوع",
        "level": 2,
        "printedPage": 114,
        "page": 115
      },
      {
        "title": "باب صلاة الجماعة والإمامة",
        "level": 2,
        "printedPage": 117,
        "page": 118
      },
      {
        "title": "باب صلاة أهل الأعذار",
        "level": 2,
        "printedPage": 129,
        "page": 130
      },
      {
        "title": "باب صلاة الجمعة",
        "level": 2,
        "printedPage": 135,
        "page": 136
      },
      {
        "title": "باب صلاة العيدين",
        "level": 2,
        "printedPage": 143,
        "page": 144
      },
      {
        "title": "كتاب الجنائز",
        "level": 1,
        "printedPage": 151,
        "page": 152
      },
      {
        "title": "كتاب الزكاة",
        "level": 1,
        "printedPage": 165,
        "page": 166
      },
      {
        "title": "باب زكاة الفطر",
        "level": 2,
        "printedPage": 179,
        "page": 180
      },
      {
        "title": "باب أهل الزكاة ومن لا تدفع له",
        "level": 2,
        "printedPage": 183,
        "page": 184
      },
      {
        "title": "كتاب الصيام",
        "level": 1,
        "printedPage": 189,
        "page": 190
      },
      {
        "title": "كتاب الحج",
        "level": 1,
        "printedPage": 205,
        "page": 206
      },
      {
        "title": "باب الهدي والأضحية والعقيقة",
        "level": 2,
        "printedPage": 232,
        "page": 233
      },
      {
        "title": "كتاب البيوع",
        "level": 1,
        "printedPage": 237,
        "page": 238
      },
      {
        "title": "باب بيع الأصول والثمار",
        "level": 2,
        "printedPage": 254,
        "page": 255
      },
      {
        "title": "باب الخيار وغيره",
        "level": 2,
        "printedPage": 257,
        "page": 258
      },
      {
        "title": "باب السَّلَم",
        "level": 2,
        "printedPage": 264,
        "page": 265
      },
      {
        "title": "باب الرهن والضمان والكفالة",
        "level": 2,
        "printedPage": 266,
        "page": 267
      },
      {
        "title": "باب الحجر لفلس أو غيره",
        "level": 2,
        "printedPage": 271,
        "page": 272
      },
      {
        "title": "باب الصلح",
        "level": 2,
        "printedPage": 277,
        "page": 278
      },
      {
        "title": "باب الوكالة والشركة والمساقاة والمزارعة",
        "level": 2,
        "printedPage": 281,
        "page": 282
      },
      {
        "title": "باب إحياء الموات",
        "level": 2,
        "printedPage": 291,
        "page": 292
      },
      {
        "title": "باب الجعالة والإجارة",
        "level": 2,
        "printedPage": 293,
        "page": 294
      },
      {
        "title": "باب اللقطة",
        "level": 2,
        "printedPage": 297,
        "page": 298
      },
      {
        "title": "باب المسابقة والمغالبة",
        "level": 2,
        "printedPage": 301,
        "page": 302
      },
      {
        "title": "باب الغصب",
        "level": 2,
        "printedPage": 304,
        "page": 305
      },
      {
        "title": "باب العارية والوديعة",
        "level": 2,
        "printedPage": 307,
        "page": 308
      },
      {
        "title": "باب الشفعة",
        "level": 2,
        "printedPage": 309,
        "page": 310
      },
      {
        "title": "باب الوقف",
        "level": 2,
        "printedPage": 311,
        "page": 312
      },
      {
        "title": "باب الهبة والعطية والوصية",
        "level": 2,
        "printedPage": 314,
        "page": 315
      },
      {
        "title": "كتاب المواريث",
        "level": 1,
        "printedPage": 321,
        "page": 322
      },
      {
        "title": "باب العتق",
        "level": 2,
        "printedPage": 337,
        "page": 338
      },
      {
        "title": "كتاب النكاح",
        "level": 1,
        "printedPage": 344,
        "page": 345
      },
      {
        "title": "باب شروط النكاح",
        "level": 2,
        "printedPage": 348,
        "page": 349
      },
      {
        "title": "باب المحرمات في النكاح",
        "level": 2,
        "printedPage": 356,
        "page": 357
      },
      {
        "title": "باب الشروط في النكاح",
        "level": 2,
        "printedPage": 363,
        "page": 364
      },
      {
        "title": "باب العيوب في النكاح",
        "level": 2,
        "printedPage": 365,
        "page": 366
      },
      {
        "title": "كتاب الصداق",
        "level": 1,
        "printedPage": 367,
        "page": 368
      },
      {
        "title": "باب عشرة النساء",
        "level": 2,
        "printedPage": 371,
        "page": 372
      },
      {
        "title": "باب الخلع",
        "level": 2,
        "printedPage": 379,
        "page": 380
      },
      {
        "title": "كتاب الطلاق",
        "level": 1,
        "printedPage": 381,
        "page": 382
      },
      {
        "title": "فصل",
        "level": 2,
        "printedPage": 384,
        "page": 385
      },
      {
        "title": "باب الإيلاء والظهار واللعان",
        "level": 2,
        "printedPage": 388,
        "page": 389
      },
      {
        "title": "كتاب العدد والاستبراء",
        "level": 1,
        "printedPage": 395,
        "page": 396
      },
      {
        "title": "باب النفقات للزوجات والأقارب والمماليك والحضانة",
        "level": 2,
        "printedPage": 401,
        "page": 402
      },
      {
        "title": "كتاب الأطعمة",
        "level": 1,
        "printedPage": 407,
        "page": 408
      },
      {
        "title": "باب الذكاة والصيد",
        "level": 2,
        "printedPage": 412,
        "page": 413
      },
      {
        "title": "باب الأيمان والنذور",
        "level": 2,
        "printedPage": 417,
        "page": 418
      },
      {
        "title": "كتاب الجنايات",
        "level": 1,
        "printedPage": 425,
        "page": 426
      },
      {
        "title": "كتاب الحدود",
        "level": 1,
        "printedPage": 435,
        "page": 436
      },
      {
        "title": "باب حكم المرتد",
        "level": 2,
        "printedPage": 449,
        "page": 450
      },
      {
        "title": "كتاب القضاء والدعاوى والبينات وأنواع الشهادات",
        "level": 1,
        "printedPage": 451,
        "page": 452
      },
      {
        "title": "باب القسمة",
        "level": 2,
        "printedPage": 460,
        "page": 461
      },
      {
        "title": "باب الإقرار",
        "level": 2,
        "printedPage": 462,
        "page": 463
      },
      {
        "title": "الفهرس",
        "level": 1,
        "printedPage": 465,
        "page": 466
      }
    ]
  },
  {
    "slug": "at-tuhfa-as-saniyya",
    "title": "التحفة السنية بشرح المقدمة الآجرومية",
    "shortTitle": "ət-Tuhfətus-Səniyyə",
    "author": "محمد محيي الدين عبد الحميد",
    "commentator": null,
    "foreword": null,
    "publisher": "المكتبة العصرية، صيدا – بيروت",
    "edition": null,
    "year": "1429هـ / 2008م",
    "subject": "Nəhv",
    "pageCount": 161,
    "pageOffset": 1,
    "chapters": [
      {
        "title": "المقدمات: تعريف علم النحو، موضوعه، ثمرته، نسبته، واضعه، حكم الشارع فيه",
        "level": 1,
        "printedPage": 4,
        "page": 5
      },
      {
        "title": "تعريف الكلام، وأمثلة له، وأسئلة",
        "level": 2,
        "printedPage": 5,
        "page": 6
      },
      {
        "title": "تقسيم الكلام إلى اسم وفعل وحرف وبيان كل قسم وأنواعه وأمثلة له",
        "level": 2,
        "printedPage": 7,
        "page": 8
      },
      {
        "title": "علامات الاسم، وبيان كل علامة وأمثلة على هذه العلامات",
        "level": 2,
        "printedPage": 9,
        "page": 10
      },
      {
        "title": "علامات الفعل، وبيان كل علامة وموقعها، وأمثلة عليها",
        "level": 2,
        "printedPage": 11,
        "page": 12
      },
      {
        "title": "علامة الحرف",
        "level": 2,
        "printedPage": 14,
        "page": 15
      },
      {
        "title": "باب الإعراب: معناه لغة واصطلاحاً، وشرح التعريف",
        "level": 1,
        "printedPage": 15,
        "page": 16
      },
      {
        "title": "معنى البناء لغة واصطلاحاً",
        "level": 2,
        "printedPage": 18,
        "page": 19
      },
      {
        "title": "أمثلة للمعرب لفظاً وتقديراً، والمبني، وأسئلة على ذلك",
        "level": 2,
        "printedPage": 19,
        "page": 20
      },
      {
        "title": "باب معرفة علامات الإعراب",
        "level": 1,
        "printedPage": 20,
        "page": 21
      },
      {
        "title": "للرفع أربع علامات",
        "level": 2,
        "printedPage": 21,
        "page": 22
      },
      {
        "title": "الضمة تكون علامة على الرفع في أربعة مواضع",
        "level": 2,
        "printedPage": 21,
        "page": 22
      },
      {
        "title": "الواو تكون علامة على الرفع في موضعين",
        "level": 2,
        "printedPage": 26,
        "page": 27
      },
      {
        "title": "الألف تكون علامة على الرفع في التثنية خاصة",
        "level": 2,
        "printedPage": 30,
        "page": 31
      },
      {
        "title": "النون تكون علامة على الرفع في الفعل المضارع",
        "level": 2,
        "printedPage": 31,
        "page": 32
      },
      {
        "title": "النصب خمس علامات",
        "level": 2,
        "printedPage": 34,
        "page": 35
      },
      {
        "title": "الفتحة تكون علامة للنصب في ثلاثة مواضع",
        "level": 2,
        "printedPage": 35,
        "page": 36
      },
      {
        "title": "الألف تكون علامة على النصب في الأسماء الخمسة",
        "level": 2,
        "printedPage": 37,
        "page": 38
      },
      {
        "title": "الكسرة تكون علامة على النصب في جمع المؤنث السالم",
        "level": 2,
        "printedPage": 38,
        "page": 39
      },
      {
        "title": "الياء تكون علامة للنصب في التثنية والجمع",
        "level": 2,
        "printedPage": 39,
        "page": 40
      },
      {
        "title": "حذف النون يكون علامة على النصب في الأفعال الخمسة",
        "level": 2,
        "printedPage": 40,
        "page": 41
      },
      {
        "title": "الكسرة تكون علامة على الخفض في ثلاثة مواضع",
        "level": 2,
        "printedPage": 42,
        "page": 43
      },
      {
        "title": "الياء تكون علامة على الخفض في ثلاثة مواضع",
        "level": 2,
        "printedPage": 44,
        "page": 45
      },
      {
        "title": "الفتحة تكون علامة على الخفض في الاسم الذي لا ينصرف",
        "level": 2,
        "printedPage": 45,
        "page": 46
      },
      {
        "title": "العلل الموانع من الصرف وأمثلة لكل علة",
        "level": 2,
        "printedPage": 46,
        "page": 47
      },
      {
        "title": "للجزم علامتان",
        "level": 2,
        "printedPage": 49,
        "page": 50
      },
      {
        "title": "السكون يكون علامة على الجزم في الفعل المضارع الصحيح الآخر",
        "level": 2,
        "printedPage": 49,
        "page": 50
      },
      {
        "title": "الحذف يكون علامة على الجزم في موضعين",
        "level": 2,
        "printedPage": 49,
        "page": 50
      },
      {
        "title": "المعربات قسمان",
        "level": 2,
        "printedPage": 52,
        "page": 53
      },
      {
        "title": "الذي يعرب بالحركات أربعة أشياء",
        "level": 2,
        "printedPage": 52,
        "page": 53
      },
      {
        "title": "الأصل في الرفع أن يكون بالضمة وفي النصب بالفتحة وفي الخفض بالكسرة وفي الجزم بالسكون، وخرج عن ذلك ثلاثة أشياء",
        "level": 2,
        "printedPage": 53,
        "page": 54
      },
      {
        "title": "الذي يعرب بالحروف أربعة أنواع",
        "level": 2,
        "printedPage": 55,
        "page": 56
      },
      {
        "title": "المثنى يرفع بالألف، وينصب ويخفض بالياء",
        "level": 2,
        "printedPage": 56,
        "page": 57
      },
      {
        "title": "جمع المذكر السالم يرفع بالواو، وينصب ويخفض بالياء",
        "level": 2,
        "printedPage": 57,
        "page": 58
      },
      {
        "title": "الأسماء الخمسة ترفع بالواو، وتنصب بالألف، وتخفض بالياء",
        "level": 2,
        "printedPage": 58,
        "page": 59
      },
      {
        "title": "الأفعال الخمسة ترفع بثبوت النون وتنصب وتجزم بحذفها",
        "level": 2,
        "printedPage": 59,
        "page": 60
      },
      {
        "title": "باب الأفعال: تنقسم الأفعال إلى ثلاثة أقسام",
        "level": 1,
        "printedPage": 61,
        "page": 62
      },
      {
        "title": "أحكام أنواع الأفعال الثلاثة",
        "level": 2,
        "printedPage": 62,
        "page": 63
      },
      {
        "title": "نواصب الفعل المضارع وأقسامها",
        "level": 2,
        "printedPage": 65,
        "page": 66
      },
      {
        "title": "جوازم الفعل المضارع وأقسامها",
        "level": 2,
        "printedPage": 70,
        "page": 71
      },
      {
        "title": "باب مرفوعات الأسماء: للاسم المرفوع سبعة مواضع",
        "level": 1,
        "printedPage": 74,
        "page": 75
      },
      {
        "title": "باب الفاعل: تعريفه",
        "level": 1,
        "printedPage": 76,
        "page": 77
      },
      {
        "title": "ينقسم الفاعل إلى ظاهر ومضمر وأقسام الظاهر",
        "level": 2,
        "printedPage": 77,
        "page": 78
      },
      {
        "title": "أنواع المضمر، وأمثلة لكل نوع",
        "level": 2,
        "printedPage": 79,
        "page": 80
      },
      {
        "title": "باب المفعول الذي لم يسم فاعله: تعريفه",
        "level": 1,
        "printedPage": 84,
        "page": 85
      },
      {
        "title": "تغيير الفعل المسند لنائب الفاعل",
        "level": 2,
        "printedPage": 84,
        "page": 85
      },
      {
        "title": "نائب الفاعل ظاهر أو مضمر كالفاعل",
        "level": 2,
        "printedPage": 85,
        "page": 86
      },
      {
        "title": "باب المبتدأ والخبر: تعريفهما",
        "level": 1,
        "printedPage": 87,
        "page": 88
      },
      {
        "title": "المبتدأ ظاهر أو مضمر",
        "level": 2,
        "printedPage": 88,
        "page": 89
      },
      {
        "title": "الخبر جملة، أو شبه جملة، أو مفرد",
        "level": 2,
        "printedPage": 89,
        "page": 90
      },
      {
        "title": "باب العوامل الداخلة على المبتدأ والخبر",
        "level": 1,
        "printedPage": 93,
        "page": 94
      },
      {
        "title": "(كان) وأخواتها",
        "level": 2,
        "printedPage": 93,
        "page": 94
      },
      {
        "title": "(إن) وأخواتها",
        "level": 2,
        "printedPage": 96,
        "page": 97
      },
      {
        "title": "(ظن) وأخواتها",
        "level": 2,
        "printedPage": 97,
        "page": 98
      },
      {
        "title": "باب النعت: تعريفه، وأقسامه، وحكم كل قسم",
        "level": 1,
        "printedPage": 102,
        "page": 103
      },
      {
        "title": "المعرفة خمسة أقسام، وبيان كل قسم",
        "level": 2,
        "printedPage": 104,
        "page": 105
      },
      {
        "title": "النكرة",
        "level": 2,
        "printedPage": 106,
        "page": 107
      },
      {
        "title": "باب العطف: تعريفه، وتقسيمه حروف عطف النسق",
        "level": 1,
        "printedPage": 109,
        "page": 110
      },
      {
        "title": "حكم المعطوف",
        "level": 2,
        "printedPage": 112,
        "page": 113
      },
      {
        "title": "باب التوكيد: تعريفه، وتقسيمه المعنوي",
        "level": 1,
        "printedPage": 115,
        "page": 116
      },
      {
        "title": "ألفاظ التوكيد المعنوي",
        "level": 2,
        "printedPage": 116,
        "page": 117
      },
      {
        "title": "باب البدل: تعريفه، وتقسيمه",
        "level": 1,
        "printedPage": 119,
        "page": 120
      },
      {
        "title": "باب منصوبات الأسماء",
        "level": 1,
        "printedPage": 122,
        "page": 123
      },
      {
        "title": "باب المفعول به",
        "level": 1,
        "printedPage": 123,
        "page": 124
      },
      {
        "title": "باب المصدر (المفعول المطلق)",
        "level": 1,
        "printedPage": 128,
        "page": 129
      },
      {
        "title": "باب ظرف الزمان، وظرف المكان",
        "level": 1,
        "printedPage": 130,
        "page": 131
      },
      {
        "title": "باب الحال: تعريفه، وتقسيمه",
        "level": 1,
        "printedPage": 135,
        "page": 136
      },
      {
        "title": "باب التمييز: تعريفه، وأقسامه",
        "level": 1,
        "printedPage": 138,
        "page": 139
      },
      {
        "title": "باب الاستثناء: معناه وحروفه وحكم ما يلي كل حرف منها",
        "level": 1,
        "printedPage": 142,
        "page": 143
      },
      {
        "title": "باب المنادى: تعريفه، وتقسيمه وحكم كل قسم",
        "level": 1,
        "printedPage": 148,
        "page": 149
      },
      {
        "title": "باب المفعول من أجله: تعريفه شروطه، أنواعه، وحكم كل نوع",
        "level": 1,
        "printedPage": 150,
        "page": 151
      },
      {
        "title": "باب المفعول معه: تعريفه، تقسيمه، حكم كل قسم",
        "level": 1,
        "printedPage": 152,
        "page": 153
      },
      {
        "title": "باب المخفوضات من الأسماء",
        "level": 1,
        "printedPage": 154,
        "page": 155
      },
      {
        "title": "المخفوض بالحرف",
        "level": 2,
        "printedPage": 154,
        "page": 155
      },
      {
        "title": "المخفوض بالإضافة، وأنواعه وضابط كل نوع",
        "level": 2,
        "printedPage": 156,
        "page": 157
      }
    ]
  }
];

export function findLibraryBook(slug: string): LibraryBook | null {
  return LIBRARY_BOOKS.find((book) => book.slug === slug) ?? null;
}

/** Verilən skan səhifəsinin aid olduğu ən yaxın fəsil (həmin səhifədə və ya ondan əvvəl başlayan). */
export function chapterForPage(book: LibraryBook, page: number): LibraryChapter | null {
  let found: LibraryChapter | null = null;
  for (const chapter of book.chapters) {
    if (chapter.page <= page) found = chapter;
    else break;
  }
  return found;
}

export function libraryPageAssetPath(slug: string, page: number) {
  return `library/${slug}/p${String(page).padStart(3, "0")}.webp`;
}
