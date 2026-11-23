export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const anterior = document.activeElement;
    const area = document.createElement("textarea");
    area.value = texto;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    try {
      area.select();
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      area.remove();
      if (anterior instanceof HTMLElement) anterior.focus({ preventScroll: true });
    }
  }
}
