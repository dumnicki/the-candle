/** Visual shell for the room. The flame does not go out until blow detection lands. */
export function mountCandle(host: HTMLElement): void {
  host.replaceChildren();
  const candle = document.createElement("div");
  candle.className = "candle";
  candle.setAttribute("role", "img");
  candle.setAttribute("aria-label", "A lit candle");

  const flame = document.createElement("div");
  flame.className = "flame";
  const wick = document.createElement("div");
  wick.className = "wick";
  const wax = document.createElement("div");
  wax.className = "wax";

  candle.append(flame, wick, wax);
  host.append(candle);
}
