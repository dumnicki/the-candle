export type CandleScene = {
  setLit(lit: boolean): void;
  setLean(degrees: number, shiftX: number): void;
  flamePoint(): { x: number; y: number };
};

/** The candle in the middle of the room. The flame leans while the wind blows. */
export function mountCandle(host: HTMLElement): CandleScene {
  host.replaceChildren();
  const candle = document.createElement("div");
  candle.className = "candle";
  candle.dataset.lit = "true";
  candle.dataset.blowing = "false";
  candle.setAttribute("role", "img");
  candle.setAttribute("aria-label", "A lit candle");

  const body = document.createElement("img");
  body.className = "candle-body";
  body.src = new URL("../assets/candle.png", import.meta.url).href;
  body.alt = "";
  body.draggable = false;

  const anchor = document.createElement("div");
  anchor.className = "wick-anchor";

  const ember = document.createElement("div");
  ember.className = "ember";

  const flame = document.createElement("div");
  flame.className = "flame";
  const glow = document.createElement("span");
  glow.className = "flame-glow";
  const blink = document.createElement("span");
  blink.className = "blinking-glow";
  const art = document.createElement("img");
  art.className = "flame-art";
  art.src = new URL("../assets/flame.png", import.meta.url).href;
  art.alt = "";
  art.draggable = false;
  flame.append(glow, blink, art);

  const smoke = document.createElement("div");
  smoke.className = "smoke";
  anchor.append(ember, flame, smoke);
  candle.append(body, anchor);
  host.append(candle);

  return {
    setLit(lit) {
      candle.dataset.lit = lit ? "true" : "false";
      candle.setAttribute("aria-label", lit ? "A lit candle" : "A candle that has gone out");
      if (lit) {
        flame.style.transform = "";
        candle.dataset.blowing = "false";
      }
    },
    setLean(degrees, shiftX) {
      if (candle.dataset.lit === "false") return;
      if (degrees === 0 && shiftX === 0) {
        flame.style.transform = "";
        candle.dataset.blowing = "false";
        return;
      }
      candle.dataset.blowing = "true";
      flame.style.transform = `translateX(${shiftX}px) rotate(${degrees}deg)`;
    },
    flamePoint() {
      const rect = flame.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.4 };
    },
  };
}
