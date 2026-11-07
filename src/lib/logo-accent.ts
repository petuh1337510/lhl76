const accents = new Map<string, string | null>();

function sampleLogo(image: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 40;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const buckets = new Map<number, { weight: number; red: number; green: number; blue: number }>();
  let hasDarkPixels = false;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 128) continue;
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const brightest = Math.max(red, green, blue);
    const chroma = brightest - Math.min(red, green, blue);
    if (brightest < 64) hasDarkPixels = true;
    // Transparent, white, and nearly grey areas should not drown out the crest colours.
    if (chroma < 32 || brightest < 55) continue;

    const key = (red >> 5) * 64 + (green >> 5) * 8 + (blue >> 5);
    const weight = chroma * (alpha / 255);
    const bucket = buckets.get(key) ?? { weight: 0, red: 0, green: 0, blue: 0 };
    bucket.weight += weight;
    bucket.red += red * weight;
    bucket.green += green * weight;
    bucket.blue += blue * weight;
    buckets.set(key, bucket);
  }

  let best: { weight: number; red: number; green: number; blue: number } | undefined;
  for (const bucket of buckets.values()) {
    if (!best || bucket.weight > best.weight) best = bucket;
  }
  if (!best || best.weight < 96) return hasDarkPixels ? "#252932" : null;

  const channels = [best.red, best.green, best.blue].map((value) => value / best.weight);
  const [red, green, blue] = channels;
  const brightness = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  const shade = Math.min(1, 160 / brightness);
  return `rgb(${channels.map((value) => Math.round(value * shade)).join(", ")})`;
}

/** Reads the already loaded logo and shares the result across match cards. */
export function getLogoAccent(image: HTMLImageElement): string | null {
  const source = image.currentSrc || image.src;
  if (!source) return null;
  if (accents.has(source)) return accents.get(source) ?? null;

  let color: string | null = null;
  try {
    color = sampleLogo(image);
  } catch {
    // A browser may block access to pixels from a cross-origin image.
  }
  accents.set(source, color);
  return color;
}
