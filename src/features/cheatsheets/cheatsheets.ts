// "Shpargalkalar": numbers that are asked in the exam and hard to memorise.
// Transcribed by hand, word for word, from the 11 screenshots the owner sent on
// 2026-11-16 (Uzbek, Latin script). Nothing here is translated or invented: a
// wrong number on an exam cheat sheet is worse than a missing translation, so
// Russian text is added only when the owner supplies it (`textRu`).

export type SheetIcon = 'gauge' | 'timer' | 'ban' | 'warning' | 'ruler' | 'package' | 'link' | 'tyre' | 'wrench';
export type SheetTone = 'red' | 'blue' | 'purple' | 'yellow' | 'green';

export interface SheetRow {
  /** The big green figure, e.g. "100" or "4–6". */
  value: string;
  /** Small unit next to it, e.g. "km/soat". */
  unit?: string;
  text: string;
  textRu?: string;
}

export interface SheetSection {
  title: string;
  rows: SheetRow[];
}

export interface CheatSheet {
  id: string;
  title: string;
  subtitle: string;
  icon: SheetIcon;
  tone: SheetTone;
  sections: SheetSection[];
}

export const CHEAT_SHEETS_HEADING = "Imtihonda ko'p uchraydigan, yodlash qiyin ma'lumotlar";

export const CHEAT_SHEETS: CheatSheet[] = [
  {
    id: 'ruxsat-etilgan-tezlik',
    title: 'Ruxsat etilgan tezlik',
    subtitle: 'Aholi punktidan tashqarida va maxsus joylarda',
    icon: 'gauge',
    tone: 'red',
    sections: [
      {
        title: 'Aholi punktlaridan tashqarida',
        rows: [
          { value: '100', unit: 'km/soat', text: 'Yengil avto' },
          { value: '100', unit: 'km/soat', text: '3.5 tonnagacha yuk avto' },
          { value: '90', unit: 'km/soat', text: 'Shaharlararo avtobus va mikroavtobus' },
          { value: '80', unit: 'km/soat', text: "Shaharlararo bo'lmagan avtobus" },
          { value: '80', unit: 'km/soat', text: '3.5 tonnadan ortiq yuk avto' },
          { value: '80', unit: 'km/soat', text: 'Mototsikl' },
          { value: '80', unit: 'km/soat', text: 'Tirkamali yengil avto' },
          { value: '70', unit: 'km/soat', text: 'Tirkamali yuk avto' },
          { value: '60', unit: 'km/soat', text: 'Odam tashiyotgan yuk avto' },
        ],
      },
      {
        title: 'Maxsus tezlik chegaralari',
        rows: [
          { value: '50', unit: 'km/soat', text: 'T/v shatakka olganida' },
          { value: '30', unit: 'km/soat', text: "Maktab, bog'cha oldida" },
          { value: '20', unit: 'km/soat', text: 'Turar joy dahasi' },
        ],
      },
      {
        title: 'Alohida holatlar',
        rows: [
          {
            value: '8',
            unit: 'km/soat dan kam',
            text: "Temir yo'l kesishmasi: temir yo'l boshlig'idan ruxsat so'raladi",
          },
          { value: 'DYHXX', text: "Og'ir vaznli va katta o'lchamli yuk avto — kelishilgan tezlikda" },
        ],
      },
    ],
  },
  {
    id: 'tezlik-va-reaktsiya',
    title: 'Tezlik va reaktsiya',
    subtitle: 'Tezlikdan 1 sekundlik masofani chiqarish',
    icon: 'timer',
    tone: 'blue',
    sections: [
      {
        title: "1 sekundda bosib o'tilgan masofa",
        rows: [
          { value: '30', unit: 'm', text: '108 km/soat da' },
          { value: '25', unit: 'm', text: '90 km/soat da' },
          { value: '20', unit: 'm', text: '72 km/soat da' },
          { value: '1', unit: 'sekund', text: 'Reaktsiya vaqti' },
        ],
      },
    ],
  },
  {
    id: 'toxtash-taqiqlangan-masofalar',
    title: "To'xtash taqiqlangan masofalar",
    subtitle: "Qayerdan necha metr ichida to'xtab bo'lmaydi",
    icon: 'ban',
    tone: 'purple',
    sections: [
      {
        title: "To'xtash taqiqlanadi",
        rows: [
          { value: '30', unit: 'm', text: 'Kesishmagacha va kesishmadan keyin' },
          { value: '10', unit: 'm', text: "Piyodalar o'tish joyigacha" },
          { value: '10', unit: 'm', text: "Velosiped o'tish joyigacha" },
          { value: '30', unit: 'm', text: 'Qayrilib olish joyigacha va undan keyin' },
          { value: '15', unit: 'm', text: 'Bekat maydonchasigacha va undan keyin' },
        ],
      },
      {
        title: "To'xtab turish taqiqlanadi",
        rows: [
          { value: '50', unit: 'm', text: "Temir yo'l kesishmasigacha va undan keyin" },
          { value: '100', unit: 'm', text: "Quvib o'tish taqiqlangan" },
        ],
      },
    ],
  },
  {
    id: 'favqulodda-toxtash-belgisi',
    title: "Favqulodda to'xtash belgisi",
    subtitle: "Belgi va ogohlantirish qancha masofaga qo'yiladi",
    icon: 'warning',
    tone: 'red',
    sections: [
      {
        title: "Falokat sababli to'xtash belgisi",
        rows: [
          { value: '15', unit: 'm', text: 'Aholi punktida' },
          { value: '30', unit: 'm', text: 'Aholi punktidan tashqarida' },
        ],
      },
      {
        title: 'Ogohlantiruvchi belgilar masofasi',
        rows: [
          { value: '50–100', unit: 'm', text: 'Aholi punktida' },
          { value: '150–300', unit: 'm', text: 'Aholi punktidan tashqarida' },
        ],
      },
    ],
  },
  {
    id: 'gabarit-olchamlari',
    title: "Gabarit o'lchamlari",
    subtitle: "Ruxsatsiz yurish mumkin bo'lgan o'lchamlar",
    icon: 'ruler',
    tone: 'blue',
    sections: [
      {
        title: 'T/v gabaritlari (ruxsatsiz)',
        rows: [
          { value: '12', unit: 'm', text: 'Uzunligi' },
          { value: '2.55', unit: 'm', text: 'Maksimal kengligi' },
          { value: '4', unit: 'm', text: 'Balandligi' },
        ],
      },
      {
        title: 'Umumiy uzunlik chegaralari',
        rows: [
          { value: '20', unit: 'm', text: 'Tirkama bilan' },
          { value: '20', unit: 'm', text: 'Shatakka olishda' },
        ],
      },
    ],
  },
  {
    id: 'yuk-joylashtirish',
    title: 'Yuk joylashtirish',
    subtitle: 'Ruxsat etilgan chiqish va balandliklar',
    icon: 'package',
    tone: 'yellow',
    sections: [
      {
        title: 'Yuk gabaritlari',
        rows: [
          { value: '0.5', unit: 'm', text: 'Yengil avto — gabarit' },
          { value: '1', unit: 'm', text: 'Yengil avto — yuk balandligi' },
          { value: '2', unit: 'm', text: 'Yuk avto — old/orqa chiqish' },
          { value: '0.5', unit: 'm', text: 'Velosiped gabarit' },
        ],
      },
      {
        title: "Katta o'lchamli yuk belgisi kerak",
        rows: [
          { value: '0.4', unit: 'm dan ortiq', text: 'Yon tarafga chiqsa' },
          { value: '1', unit: 'm dan ortiq', text: 'Old yoki orqadan chiqsa' },
        ],
      },
      {
        title: 'Yuk avtoda odam tashish',
        rows: [
          { value: '1.3', unit: 'm', text: 'Bort balandligi' },
          { value: '0.3–0.5', unit: 'm', text: "O'rindiqlar balandligi" },
        ],
      },
    ],
  },
  {
    id: 'shatakka-olish',
    title: 'Shatakka olish',
    subtitle: 'Ulagich uzunligi va umumiy chegara',
    icon: 'link',
    tone: 'green',
    sections: [
      {
        title: 'Ulagich uzunligi',
        rows: [
          { value: '4–6', unit: 'm', text: 'Egiluvchan ulagichda' },
          { value: '4', unit: 'm', text: 'Qattiq ulagichda' },
          { value: '20', unit: 'm', text: 'Umumiy uzunlik' },
        ],
      },
    ],
  },
  {
    id: 'shina-naqshlari',
    title: 'Shina naqshlari',
    subtitle: "Naqsh qoldig'ining eng kam balandligi",
    icon: 'tyre',
    tone: 'purple',
    sections: [
      {
        title: "Naqsh qoldig'i (eng kam)",
        rows: [
          { value: '0.8', unit: 'mm', text: 'Mototsikl (L toifa)' },
          { value: '1', unit: 'mm', text: 'N2/N3/O3/O4' },
          { value: '1.6', unit: 'mm', text: 'M1/N1/O1/O2' },
          { value: '2', unit: 'mm', text: 'M2/M3' },
        ],
      },
    ],
  },
  {
    id: 'rul-lyufti-va-tormoz',
    title: 'Rul lyufti va tormoz',
    subtitle: "Ruxsat etilgan lyuft va tormoz ko'rsatkichlari",
    icon: 'wrench',
    tone: 'yellow',
    sections: [
      {
        title: 'Rul lyufti (ruxsat etilgan)',
        rows: [
          { value: '10°', text: 'M1 (yengil avto)' },
          { value: '20°', text: 'M2/M3/N1' },
          { value: '25°', text: 'N2/N3' },
        ],
      },
      {
        title: "To'xtab turish tormoz tizimi",
        rows: [
          { value: '25°', text: 'M toifa' },
          { value: '31°', text: 'N toifa' },
          { value: '16°', text: "To'la jihozlangan T/v" },
          { value: '0.05', unit: 'MPa', text: 'Pnevmatik zichlik' },
        ],
      },
    ],
  },
];

export const getCheatSheet = (id: string | undefined) => CHEAT_SHEETS.find((s) => s.id === id) ?? null;
