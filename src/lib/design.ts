// The app's design: "Sokin" (see src/styles/design.css). The attribute is also set
// in index.html before the first paint, so there is no flash of the old look.
export function applyDesign(): void {
  document.documentElement.setAttribute('data-design', 'c');
}
