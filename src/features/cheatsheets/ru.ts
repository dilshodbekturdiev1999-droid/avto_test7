// Russian text for the cheat sheets, keyed by the Uzbek line of cheatsheets.ts.
// Terms follow Russian traffic-rules wording (ПДД): "T/v" = ТС, "tirkama" =
// прицеп, "shatakka olish" = буксировка. Figures are never translated or changed.
// Lines not listed here fall back to the Uzbek original.

export const SHEET_RU: Record<string, string> = {
  // --- headings
  "Imtihonda ko'p uchraydigan, yodlash qiyin ma'lumotlar": 'Часто встречающиеся на экзамене данные, которые трудно запомнить',
  // --- Ruxsat etilgan tezlik
  'Ruxsat etilgan tezlik': 'Разрешённая скорость',
  'Aholi punktidan tashqarida va maxsus joylarda': 'Вне населённых пунктов и в особых местах',
  'Aholi punktlaridan tashqarida': 'Вне населённых пунктов',
  'Yengil avto': 'Легковой автомобиль',
  '3.5 tonnagacha yuk avto': 'Грузовой автомобиль до 3,5 т',
  'Shaharlararo avtobus va mikroavtobus': 'Междугородный автобус и микроавтобус',
  "Shaharlararo bo'lmagan avtobus": 'Автобус, не междугородный',
  '3.5 tonnadan ortiq yuk avto': 'Грузовой автомобиль более 3,5 т',
  Mototsikl: 'Мотоцикл',
  'Tirkamali yengil avto': 'Легковой автомобиль с прицепом',
  'Tirkamali yuk avto': 'Грузовой автомобиль с прицепом',
  'Odam tashiyotgan yuk avto': 'Грузовой автомобиль, перевозящий людей',
  'Maxsus tezlik chegaralari': 'Особые ограничения скорости',
  'T/v shatakka olganida': 'При буксировке ТС',
  "Maktab, bog'cha oldida": 'У школы и детского сада',
  'Turar joy dahasi': 'Жилая зона',
  'Alohida holatlar': 'Особые случаи',
  "Temir yo'l kesishmasi: temir yo'l boshlig'idan ruxsat so'raladi":
    'Железнодорожный переезд: разрешение запрашивается у начальника железной дороги',
  "Og'ir vaznli va katta o'lchamli yuk avto — kelishilgan tezlikda":
    'Тяжеловесный и крупногабаритный грузовой автомобиль: скорость, согласованная с ГУБДД',
  // --- Tezlik va reaktsiya
  'Tezlik va reaktsiya': 'Скорость и реакция',
  'Tezlikdan 1 sekundlik masofani chiqarish': 'Как по скорости найти путь за 1 секунду',
  "1 sekundda bosib o'tilgan masofa": 'Путь, пройденный за 1 секунду',
  '108 km/soat da': 'При 108 км/ч',
  '90 km/soat da': 'При 90 км/ч',
  '72 km/soat da': 'При 72 км/ч',
  'Reaktsiya vaqti': 'Время реакции',
  // --- To'xtash taqiqlangan masofalar
  "To'xtash taqiqlangan masofalar": 'Расстояния, где остановка запрещена',
  "Qayerdan necha metr ichida to'xtab bo'lmaydi": 'В пределах скольких метров от чего нельзя останавливаться',
  "To'xtash taqiqlanadi": 'Остановка запрещена',
  'Kesishmagacha va kesishmadan keyin': 'До перекрёстка и после него',
  "Piyodalar o'tish joyigacha": 'До пешеходного перехода',
  "Velosiped o'tish joyigacha": 'До велосипедного перехода',
  'Qayrilib olish joyigacha va undan keyin': 'До места разворота и после него',
  'Bekat maydonchasigacha va undan keyin': 'До остановочной площадки и после неё',
  "To'xtab turish taqiqlanadi": 'Стоянка запрещена',
  "Temir yo'l kesishmasigacha va undan keyin": 'До железнодорожного переезда и после него',
  "Quvib o'tish taqiqlangan": 'Обгон запрещён',
  // --- Favqulodda to'xtash belgisi
  "Favqulodda to'xtash belgisi": 'Знак аварийной остановки',
  "Belgi va ogohlantirish qancha masofaga qo'yiladi": 'На каком расстоянии ставится знак и предупреждение',
  "Falokat sababli to'xtash belgisi": 'Знак аварийной остановки при аварии',
  'Aholi punktida': 'В населённом пункте',
  'Aholi punktidan tashqarida': 'Вне населённого пункта',
  'Ogohlantiruvchi belgilar masofasi': 'Расстояние до предупреждающих знаков',
  // --- Gabarit o'lchamlari
  "Gabarit o'lchamlari": 'Габаритные размеры',
  "Ruxsatsiz yurish mumkin bo'lgan o'lchamlar": 'Размеры, при которых можно ехать без специального разрешения',
  'T/v gabaritlari (ruxsatsiz)': 'Габариты ТС (без разрешения)',
  Uzunligi: 'Длина',
  'Maksimal kengligi': 'Максимальная ширина',
  Balandligi: 'Высота',
  'Umumiy uzunlik chegaralari': 'Предельная общая длина',
  'Tirkama bilan': 'С прицепом',
  'Shatakka olishda': 'При буксировке',
  // --- Yuk joylashtirish
  'Yuk joylashtirish': 'Размещение груза',
  'Ruxsat etilgan chiqish va balandliklar': 'Допустимые выступы и высоты',
  'Yuk gabaritlari': 'Габариты груза',
  'Yengil avto — gabarit': 'Легковой автомобиль: габарит',
  'Yengil avto — yuk balandligi': 'Легковой автомобиль: высота груза',
  'Yuk avto — old/orqa chiqish': 'Грузовой автомобиль: выступ спереди и сзади',
  'Velosiped gabarit': 'Габарит велосипеда',
  "Katta o'lchamli yuk belgisi kerak": 'Нужен знак «Крупногабаритный груз»',
  'Yon tarafga chiqsa': 'Если выступает в сторону',
  'Old yoki orqadan chiqsa': 'Если выступает спереди или сзади',
  'Yuk avtoda odam tashish': 'Перевозка людей в грузовом автомобиле',
  'Bort balandligi': 'Высота борта',
  "O'rindiqlar balandligi": 'Высота сидений',
  // --- Shatakka olish
  'Shatakka olish': 'Буксировка',
  'Ulagich uzunligi va umumiy chegara': 'Длина сцепки и общий предел',
  'Ulagich uzunligi': 'Длина сцепки',
  'Egiluvchan ulagichda': 'На гибкой сцепке',
  'Qattiq ulagichda': 'На жёсткой сцепке',
  'Umumiy uzunlik': 'Общая длина',
  // --- Shina naqshlari
  'Shina naqshlari': 'Рисунок протектора шин',
  "Naqsh qoldig'ining eng kam balandligi": 'Наименьшая остаточная высота рисунка протектора',
  "Naqsh qoldig'i (eng kam)": 'Остаточная глубина рисунка (наименьшая)',
  'Mototsikl (L toifa)': 'Мотоцикл (категория L)',
  // --- Rul lyufti va tormoz
  'Rul lyufti va tormoz': 'Люфт руля и тормоза',
  "Ruxsat etilgan lyuft va tormoz ko'rsatkichlari": 'Допустимые значения люфта и показатели тормозов',
  'Rul lyufti (ruxsat etilgan)': 'Люфт рулевого колеса (допустимый)',
  'M1 (yengil avto)': 'M1 (легковой автомобиль)',
  "To'xtab turish tormoz tizimi": 'Стояночная тормозная система',
  'M toifa': 'Категория M',
  'N toifa': 'Категория N',
  "To'la jihozlangan T/v": 'Полностью снаряжённое ТС',
  'Pnevmatik zichlik': 'Пневматическая герметичность',
};

/** Units shown next to the big figure. */
export const UNIT_RU: Record<string, string> = {
  'km/soat': 'км/ч',
  'km/soat dan kam': 'км/ч и меньше',
  m: 'м',
  'm dan ortiq': 'м и более',
  mm: 'мм',
  sekund: 'сек',
  MPa: 'МПа',
};

/** Figures that are words, not numbers. */
export const VALUE_RU: Record<string, string> = {
  DYHXX: 'ГУБДД',
};
