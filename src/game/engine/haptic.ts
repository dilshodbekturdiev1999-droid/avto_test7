// Short vibration on a penalty (site: the browser's vibrate API where it exists).
export function buzz() {
  try {
    navigator.vibrate?.(40);
  } catch {
    /* not supported */
  }
}
