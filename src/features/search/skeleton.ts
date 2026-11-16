// Search without caring about the alphabet. Uzbek is written in Cyrillic in the
// bank but students type Latin (and Russian questions are Cyrillic), so both
// the text and the query are reduced to the same coarse Latin "skeleton" and
// compared there. The reduction is lossy on purpose: қ/к/q/k, ҳ/х/h/x, ғ/г/g,
// ў/о/o and e/э/е all collapse, so "haydovchi", "xaydovchi" and "ҳайдовчи" meet.

const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  // Uzbek-only letters
  қ: 'k', ҳ: 'h', ғ: 'g', ў: 'o', ҷ: 'j', ӯ: 'o',
};

const APOSTROPHES = /[’'ʻʼ`´‘]/g;

export function skeleton(input: string): string {
  let out = '';
  for (const ch of input.toLowerCase()) out += CYRILLIC[ch] ?? ch;
  return out
    .replace(/o['’ʻʼ`´‘]/g, 'o') // o' -> o (before apostrophes are dropped)
    .replace(/g['’ʻʼ`´‘]/g, 'g')
    .replace(APOSTROPHES, '')
    .replace(/q/g, 'k')
    .replace(/x/g, 'h')
    .replace(/\s+/g, ' ')
    .trim();
}
