// The 14 official exam centers (imtihon markazlari), transcribed by hand from the
// screenshots of the official bot the owner sent (2026-11-16). Addresses are the
// official ones and stay in Latin. Map links are built from the coordinates in
// the Google links of those screenshots.

export interface ExamCenter {
  id: string;
  name: string;
  nameRu: string;
  address: string;
  /** Bus / metro, only where the source gives it. */
  transport?: string;
  transportRu?: string;
  phones: string[];
  email: string;
  lat: number;
  lng: number;
}

const COMMON_PHONE = '+998 55 510 20 02';
const COMMON_EMAIL = 'info@yim.uz';

export const EXAM_CENTERS: ExamCenter[] = [
  {
    id: 'toshkent-shahri',
    name: 'Toshkent shahri',
    nameRu: 'город Ташкент',
    address: '100012, Toshkent sh., Yangihayot tumani, Fayzli MFY, 87-uy',
    transport: 'Avtobus: 40, 58, 62, 66, 105, 126, 143; Metro: Turon bekati',
    transportRu: 'Автобус: 40, 58, 62, 66, 105, 126, 143; Метро: станция Turon',
    phones: ['+998 55 513 20 02', COMMON_PHONE],
    email: COMMON_EMAIL,
    lat: 41.20725,
    lng: 69.24436,
  },
  {
    id: 'toshkent-viloyati',
    name: 'Toshkent viloyati',
    nameRu: 'Ташкентская область',
    address: 'Toshkent viloyati, Ohangaron tumani, Ubayd MFY hududida',
    phones: [COMMON_PHONE],
    email: COMMON_EMAIL,
    lat: 40.93416,
    lng: 69.59209,
  },
  {
    id: 'fargona-viloyati',
    name: "Farg'ona viloyati",
    nameRu: 'Ферганская область',
    address: "Farg'ona shahri, O'rtashura MFY, Vodiy ko'chasi, 60A",
    transport: 'Avtobus: 6-A, 6-B',
    transportRu: 'Автобус: 6-А, 6-Б',
    phones: [COMMON_PHONE],
    email: COMMON_EMAIL,
    lat: 40.370621,
    lng: 71.757844,
  },
  {
    id: 'andijon-viloyati',
    name: 'Andijon viloyati',
    nameRu: 'Андижанская область',
    address: "Andijon tumani, Toshloq MFY, Toshloq ko'chasi, 553-uy",
    phones: [COMMON_PHONE],
    email: COMMON_EMAIL,
    lat: 40.715834,
    lng: 72.296228,
  },
  {
    id: 'sirdaryo-viloyati',
    name: 'Sirdaryo viloyati',
    nameRu: 'Сырдарьинская область',
    address: 'Sirdaryo viloyati, Sayxunobod tumani, Baxmalsoy MFY',
    phones: [COMMON_PHONE],
    email: COMMON_EMAIL,
    lat: 40.617398,
    lng: 68.8281,
  },
  {
    id: 'jizzax-viloyati',
    name: 'Jizzax viloyati',
    nameRu: 'Джизакская область',
    address: 'Jizzax viloyati, Sharof Rashidov tumani',
    phones: [COMMON_PHONE],
    email: COMMON_EMAIL,
    lat: 40.21134,
    lng: 67.938327,
  },
  {
    id: 'namangan-viloyati',
    name: 'Namangan viloyati',
    nameRu: 'Наманганская область',
    address: "Namangan shahri, Yuksalish MFY, Nurobod-7 ko'chasi, 31-uy",
    phones: [COMMON_PHONE],
    email: COMMON_EMAIL,
    lat: 41.032183,
    lng: 71.539529,
  },
  {
    id: 'qashqadaryo-viloyati',
    name: 'Qashqadaryo viloyati',
    nameRu: 'Кашкадарьинская область',
    address: "Qarshi shahri, Qavali MFY, Janubiy sanoat zonasi, 115-uy",
    phones: [COMMON_PHONE],
    email: COMMON_EMAIL,
    lat: 38.798938,
    lng: 65.812593,
  },
  {
    id: 'samarqand-viloyati',
    name: 'Samarqand viloyati',
    nameRu: 'Самаркандская область',
    address: "Pastdarg'om tumani, Kamolot MFY, Kamolot qishlog'i, 369-uy",
    phones: [COMMON_PHONE],
    email: COMMON_EMAIL,
    lat: 39.667623,
    lng: 66.811112,
  },
  {
    id: 'buxoro-viloyati',
    name: 'Buxoro viloyati',
    nameRu: 'Бухарская область',
    address: "Buxoro tumani, Istiqbol MFY, Kobdun ko'chasi, 189-uy",
    phones: [COMMON_PHONE],
    email: COMMON_EMAIL,
    lat: 39.841361,
    lng: 64.496064,
  },
  {
    id: 'navoiy-viloyati',
    name: 'Navoiy viloyati',
    nameRu: 'Навоийская область',
    address: "Karmana tumani, Yangi ariq ko'chasi, 712-uy",
    phones: [COMMON_PHONE],
    email: COMMON_EMAIL,
    lat: 40.066251,
    lng: 65.356825,
  },
  {
    id: 'qoraqalpogiston',
    name: "Qoraqalpog'iston Respublikasi",
    nameRu: 'Республика Каракалпакстан',
    address: "Nukus shahri, Taxiatosh shoh ko'chasi, Naukan bog'i ko'chasi, 30-uy",
    phones: [COMMON_PHONE],
    email: COMMON_EMAIL,
    lat: 42.411405,
    lng: 59.633039,
  },
  {
    id: 'xorazm-viloyati',
    name: 'Xorazm viloyati',
    nameRu: 'Хорезмская область',
    address: "Urganch tumani, Komiljon Otaniyozov MFY, Istiqlol ko'chasi, 27/1-uy",
    phones: [COMMON_PHONE],
    email: COMMON_EMAIL,
    lat: 41.638021,
    lng: 60.687047,
  },
  {
    id: 'surxondaryo-viloyati',
    name: 'Surxondaryo viloyati',
    nameRu: 'Сурхандарьинская область',
    address: "Termiz shahri, Yangiobod MFY, Limonzor ko'chasi, 99-uy",
    phones: [COMMON_PHONE],
    email: COMMON_EMAIL,
    lat: 37.280899,
    lng: 67.198739,
  },
];

export const googleMapsUrl = (c: ExamCenter) => `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
export const yandexMapsUrl = (c: ExamCenter) => `https://yandex.uz/maps/?pt=${c.lng},${c.lat}&z=16&l=map`;
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
