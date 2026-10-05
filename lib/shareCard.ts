export interface ShareCardHistoryPoint {
  date: string;
  marketPrice: number;
}

export interface ShareCardParams {
  fromFlag: string;
  fromCode: string;
  toFlag: string;
  toCode: string;
  amountSent: string; // pre-formatted, e.g. "5,000.00"
  amountReceived: string;
  rateLine: string; // e.g. "1 MYR = 1590 SDG"
  trendLabel?: string; // e.g. "▲ زيادة" or "▼ انخفاض"
  trendColor: "good" | "bad" | "neutral"; // "good" renders emerald, "bad" renders red
  updatedCaption?: string; // e.g. "آخر تحديث للسعر: منذ 3 ساعة"
  history?: ShareCardHistoryPoint[]; // last ~30 days, oldest first — same data as the in-app chart
}

// 4:5 portrait — sits well in WhatsApp chats, Status and Instagram feed.
const W = 1080;
const H = 1350;
const M = 60; // outer margin

const C = {
  bgTop: "#0A2A66",
  bgBottom: "#04112E",
  card: "rgba(10, 28, 64, 0.78)",
  well: "rgba(2, 8, 23, 0.55)",
  ink: "#F2F7FF",
  muted: "#9FB0CF",
  subtle: "#62739A",
  line: "rgba(140, 180, 255, 0.14)",
  royal: "#1B4C99",
  primary: "#3F7BDB",
  cyan: "#8FB6F2",
  navy: "#04112E",
  emerald: "#10B981",
  red: "#EF4444",
};

const AR = "'IBM Plex Sans Arabic', 'Noto Sans Arabic', sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const EMOJI = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

async function loadFonts() {
  const specs = [
    `500 26px ${AR}`,
    `600 30px ${AR}`,
    `700 36px ${AR}`,
    `800 40px ${AR}`,
    `500 26px ${MONO}`,
    `600 40px ${MONO}`,
    `700 96px ${MONO}`,
  ];
  try {
    await Promise.all(specs.map((s) => document.fonts.load(s, "0123456789 SDG تحويل")));
    await document.fonts.ready;
  } catch {
    // fonts API not fully supported — canvas falls back to system fonts
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function brandGradient(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, C.royal);
  g.addColorStop(0.5, C.primary);
  g.addColorStop(1, C.cyan);
  return g;
}

function noShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/** Text helper — sets font/colour/alignment/direction in one call. */
function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  opts: { font: string; color: string | CanvasGradient; align?: CanvasTextAlign; dir?: CanvasDirection }
) {
  ctx.font = opts.font;
  ctx.fillStyle = opts.color;
  ctx.textAlign = opts.align ?? "left";
  ctx.direction = opts.dir ?? "ltr";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
}

function width(ctx: CanvasRenderingContext2D, s: string, font: string) {
  ctx.font = font;
  return ctx.measureText(s).width;
}

/** Largest font size (down to min) at which `s` fits in maxWidth. */
function fit(ctx: CanvasRenderingContext2D, s: string, fontFor: (size: number) => string, start: number, min: number, maxWidth: number) {
  let size = start;
  while (size > min && width(ctx, s, fontFor(size)) > maxWidth) size -= 2;
  return size;
}

function trendHex(t: ShareCardParams["trendColor"]) {
  return t === "good" ? C.emerald : t === "bad" ? C.red : C.cyan;
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, C.bgTop);
  bg.addColorStop(1, C.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Two soft light sources
  const g1 = ctx.createRadialGradient(W * 0.85, 120, 20, W * 0.85, 120, 620);
  g1.addColorStop(0, "rgba(63,123,219,0.35)");
  g1.addColorStop(1, "rgba(63,123,219,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(W * 0.1, H * 0.78, 20, W * 0.1, H * 0.78, 560);
  g2.addColorStop(0, "rgba(34,211,238,0.16)");
  g2.addColorStop(1, "rgba(34,211,238,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);

  // Orbit arcs echoing the logo's swooshes
  ctx.save();
  ctx.lineCap = "round";
  const arcs = [
    { r: 520, w: 2, a0: 3.3, a1: 4.9, alpha: 0.18 },
    { r: 440, w: 1.5, a0: 3.6, a1: 5.4, alpha: 0.12 },
    { r: 600, w: 1, a0: 3.1, a1: 4.4, alpha: 0.1 },
  ];
  for (const arc of arcs) {
    const g = ctx.createLinearGradient(W - arc.r, 0, W, arc.r);
    g.addColorStop(0, `rgba(34,211,238,${arc.alpha})`);
    g.addColorStop(1, `rgba(63,123,219,0)`);
    ctx.strokeStyle = g;
    ctx.lineWidth = arc.w;
    ctx.beginPath();
    ctx.arc(W + 40, -60, arc.r, arc.a0, arc.a1);
    ctx.stroke();
  }
  ctx.restore();

  // Fine dot grid, fading toward the bottom
  for (let y = 30; y < H; y += 30) {
    const a = 0.05 * (1 - y / H);
    if (a < 0.006) continue;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    for (let x = 30; x < W; x += 30) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
}

/** Glass card with a gradient hairline border and a soft drop shadow. */
function drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, strong = true) {
  ctx.save();
  ctx.shadowColor = "rgba(0, 4, 18, 0.65)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.restore();

  // Inner top sheen
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  const sheen = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
  sheen.addColorStop(0, strong ? "rgba(63,123,219,0.16)" : "rgba(63,123,219,0.07)");
  sheen.addColorStop(1, "rgba(63,123,219,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  const border = ctx.createLinearGradient(x + w, y, x, y + h);
  border.addColorStop(0, strong ? "rgba(34,211,238,0.75)" : "rgba(34,211,238,0.35)");
  border.addColorStop(0.45, "rgba(63,123,219,0.28)");
  border.addColorStop(1, "rgba(63,123,219,0.08)");
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  rr(ctx, x + 1, y + 1, w - 2, h - 2, r);
  ctx.stroke();
}

/** Round flag badge — emoji flag, or a symbol (₮) for USDT. */
function drawFlagBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, flag: string) {
  ctx.save();
  ctx.shadowColor = "rgba(63,123,219,0.45)";
  ctx.shadowBlur = 28;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = C.navy;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
  ctx.strokeStyle = brandGradient(ctx, cx - r, cy - r, cx + r, cy + r);
  ctx.lineWidth = 3;
  ctx.stroke();

  const isEmoji = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(flag);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "ltr";
  if (isEmoji) {
    ctx.font = `${Math.round(r * 1.05)}px ${EMOJI}`;
    ctx.fillStyle = "#fff";
  } else {
    ctx.font = `700 ${Math.round(r * 1.05)}px ${MONO}`;
    ctx.fillStyle = C.cyan;
  }
  ctx.fillText(flag, cx, cy + r * 0.06);
  ctx.textBaseline = "alphabetic";
}

function drawArrowLeft(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number) {
  // Dashed gradient track from right (x1) to left (x0) with an arrowhead at x0.
  ctx.save();
  ctx.setLineDash([2, 12]);
  ctx.lineCap = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = brandGradient(ctx, x0, y, x1, y);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x0 + 24, y);
  ctx.stroke();
  ctx.restore();

  // Centre chip
  const cx = (x0 + x1) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(63,123,219,0.6)";
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(cx, y, 30, 0, Math.PI * 2);
  ctx.fillStyle = brandGradient(ctx, cx - 30, y - 30, cx + 30, y + 30);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = C.navy;
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx + 11, y);
  ctx.lineTo(cx - 11, y);
  ctx.moveTo(cx - 2, y - 9);
  ctx.lineTo(cx - 11, y);
  ctx.lineTo(cx - 2, y + 9);
  ctx.stroke();

  // Arrowhead at the destination
  ctx.fillStyle = C.primary;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x0 + 18, y - 11);
  ctx.lineTo(x0 + 18, y + 11);
  ctx.closePath();
  ctx.fill();
}

function drawDownBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.shadowColor = "rgba(63,123,219,0.55)";
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(cx, cy, 26, 0, Math.PI * 2);
  ctx.fillStyle = brandGradient(ctx, cx - 26, cy - 26, cx + 26, cy + 26);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = C.navy;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 10);
  ctx.lineTo(cx, cy + 10);
  ctx.moveTo(cx - 8, cy + 3);
  ctx.lineTo(cx, cy + 11);
  ctx.lineTo(cx + 8, cy + 3);
  ctx.stroke();
}

function drawChart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  points: ShareCardHistoryPoint[],
  color: string
) {
  const values = points.map((p) => p.marketPrice);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = points.map((p, i) => ({
    x: x + (i / (points.length - 1)) * w,
    y: y + 8 + (1 - (p.marketPrice - min) / range) * (h - 16),
  }));

  const trace = () => {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const mx = (p0.x + p1.x) / 2;
      ctx.bezierCurveTo(mx, p0.y, mx, p1.y, p1.x, p1.y);
    }
  };

  // Baseline guides
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 8]);
  for (const gy of [y, y + h / 2, y + h]) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Area fill
  const area = ctx.createLinearGradient(0, y, 0, y + h);
  area.addColorStop(0, hexA(color, 0.38));
  area.addColorStop(1, hexA(color, 0));
  ctx.beginPath();
  trace();
  ctx.lineTo(pts[pts.length - 1].x, y + h);
  ctx.lineTo(pts[0].x, y + h);
  ctx.closePath();
  ctx.fillStyle = area;
  ctx.fill();

  // Line with glow
  ctx.save();
  ctx.shadowColor = hexA(color, 0.8);
  ctx.shadowBlur = 18;
  ctx.beginPath();
  trace();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();

  // Last point
  const last = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 14, 0, Math.PI * 2);
  ctx.fillStyle = hexA(color, 0.25);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(last.x, last.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();
}

async function createQrCanvas(data: string, size: number): Promise<HTMLCanvasElement | null> {
  try {
    const mod = await import("qrcode-generator");
    const qrcode = mod.default;
    const qr = qrcode(0, "M");
    qr.addData(data);
    qr.make();
    const count = qr.getModuleCount();
    const cell = Math.max(1, Math.floor(size / count));
    const canvas = document.createElement("canvas");
    canvas.width = cell * count;
    canvas.height = cell * count;
    const q = canvas.getContext("2d");
    if (!q) return null;
    q.fillStyle = "#FFFFFF";
    q.fillRect(0, 0, canvas.width, canvas.height);
    q.fillStyle = C.navy;
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) q.fillRect(c * cell, r * cell, cell, cell);
      }
    }
    return canvas;
  } catch {
    return null; // QR is a nice-to-have — never block the card on it
  }
}

export async function createShareCardBlob(params: ShareCardParams): Promise<Blob | null> {
  await loadFonts();
  const [logo, qr] = await Promise.all([loadImage("/logo.png"), createQrCanvas(window.location.origin, 440)]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const accent = trendHex(params.trendColor);
  const history = params.history && params.history.length >= 2 ? params.history : null;

  drawBackground(ctx);

  // ---------- Header: logo centred, wordmark + subtitle under it ----------
  const tile = 108;
  const tileX = W / 2 - tile / 2;
  const tileY = 40;
  // Halo behind the logo
  const halo = ctx.createRadialGradient(W / 2, tileY + tile / 2, 10, W / 2, tileY + tile / 2, 170);
  halo.addColorStop(0, "rgba(63,123,219,0.40)");
  halo.addColorStop(1, "rgba(63,123,219,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(W / 2 - 200, tileY - 90, 400, tile + 180);
  ctx.save();
  ctx.shadowColor = "rgba(63,123,219,0.6)";
  ctx.shadowBlur = 44;
  rr(ctx, tileX, tileY, tile, tile, 30);
  ctx.fillStyle = "#FFFFFF"; // the shield logo is made for a white tile
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = brandGradient(ctx, tileX, tileY + tile, tileX + tile, tileY);
  ctx.lineWidth = 2.5;
  rr(ctx, tileX + 1.25, tileY + 1.25, tile - 2.5, tile - 2.5, 29);
  ctx.stroke();
  if (logo) {
    const lh = 96;
    const lw = (logo.width / logo.height) * lh;
    ctx.drawImage(logo, tileX + (tile - lw) / 2, tileY + (tile - lh) / 2, lw, lh);
  }

  const wmFont = `700 46px ${AR}`;
  const masterW = width(ctx, "MASTER ", wmFont);
  const digitalW = width(ctx, "DIGITAL", wmFont);
  const wmLeft = W / 2 - (masterW + digitalW) / 2;
  const wmY = tileY + tile + 62;
  text(ctx, "MASTER ", wmLeft, wmY, { font: wmFont, color: C.ink });
  text(ctx, "DIGITAL", wmLeft + masterW, wmY, {
    font: wmFont,
    color: brandGradient(ctx, wmLeft + masterW, 0, wmLeft + masterW + digitalW, 0),
  });

  const now = new Date();
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateStr = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const subFont = `500 24px ${AR}`;
  const dateFont = `500 22px ${MONO}`;
  const subLabel = "عرض سعر تحويل";
  const sepGap = 18;
  const subW = width(ctx, subLabel, subFont);
  const dateW = width(ctx, dateStr, dateFont);
  const subTotal = subW + sepGap * 2 + 6 + dateW;
  const subY = wmY + 38;
  const subRight = W / 2 + subTotal / 2;
  text(ctx, subLabel, subRight, subY, { font: subFont, color: C.muted, align: "right", dir: "rtl" });
  ctx.beginPath();
  ctx.arc(subRight - subW - sepGap - 3, subY - 8, 3, 0, Math.PI * 2);
  ctx.fillStyle = C.cyan;
  ctx.fill();
  text(ctx, dateStr, subRight - subW - sepGap * 2 - 6, subY, { font: dateFont, color: C.muted, align: "right" });

  // ---------- Main quote card ----------
  const cx = M;
  const cy = 270;
  const cw = W - M * 2;
  const ch = 640;
  const pad = 52;
  const inL = cx + pad;
  const inR = cx + cw - pad;
  drawCard(ctx, cx, cy, cw, ch, 44);

  // Corridor row: from on the right, to on the left (RTL reading order)
  const rowY = cy + 90;
  const badgeR = 46;
  drawFlagBadge(ctx, inR - badgeR, rowY, badgeR, params.fromFlag);
  drawFlagBadge(ctx, inL + badgeR, rowY, badgeR, params.toFlag);
  text(ctx, params.fromCode, inR - badgeR * 2 - 22, rowY + 14, { font: `700 44px ${MONO}`, color: C.ink, align: "right" });
  text(ctx, params.toCode, inL + badgeR * 2 + 22, rowY + 14, { font: `700 44px ${MONO}`, color: C.ink, align: "left" });
  const fromCodeW = width(ctx, params.fromCode, `700 44px ${MONO}`);
  const toCodeW = width(ctx, params.toCode, `700 44px ${MONO}`);
  drawArrowLeft(ctx, inL + badgeR * 2 + 22 + toCodeW + 28, inR - badgeR * 2 - 22 - fromCodeW - 28, rowY);

  // Divider
  const div1 = cy + 170;
  ctx.fillStyle = C.line;
  ctx.fillRect(inL, div1, inR - inL, 2);

  // You send
  text(ctx, "المبلغ المُرسَل", inR, div1 + 50, { font: `600 28px ${AR}`, color: C.muted, align: "right", dir: "rtl" });
  const sentCodeFont = `600 34px ${MONO}`;
  const sentCodeW = width(ctx, params.fromCode, sentCodeFont);
  const sentSize = fit(ctx, params.amountSent, (s) => `600 ${s}px ${MONO}`, 56, 34, inR - inL - sentCodeW - 120);
  text(ctx, params.amountSent, inR, div1 + 116, { font: `600 ${sentSize}px ${MONO}`, color: C.ink, align: "right" });
  const sentW = width(ctx, params.amountSent, `600 ${sentSize}px ${MONO}`);
  text(ctx, params.fromCode, inR - sentW - 16, div1 + 116, { font: sentCodeFont, color: C.subtle, align: "right" });

  // Flow connector
  const flowY = div1 + 160;
  ctx.fillStyle = C.line;
  ctx.fillRect(inL, flowY - 1, inR - inL - 90, 2);
  drawDownBadge(ctx, inR - 26, flowY);

  // They receive
  text(ctx, "المستلم يستلم", inR, flowY + 60, { font: `600 28px ${AR}`, color: C.cyan, align: "right", dir: "rtl" });
  const recvCodeFont = `700 48px ${MONO}`;
  const recvCodeW = width(ctx, params.toCode, recvCodeFont);
  const recvSize = fit(ctx, params.amountReceived, (s) => `700 ${s}px ${MONO}`, 98, 50, inR - inL - recvCodeW - 24);
  ctx.save();
  ctx.shadowColor = "rgba(63,123,219,0.45)";
  ctx.shadowBlur = 30;
  text(ctx, params.amountReceived, inR, flowY + 152, { font: `700 ${recvSize}px ${MONO}`, color: "#FFFFFF", align: "right" });
  ctx.restore();
  const recvW = width(ctx, params.amountReceived, `700 ${recvSize}px ${MONO}`);
  const codeRight = inR - recvW - 18;
  text(ctx, params.toCode, codeRight, flowY + 152, {
    font: recvCodeFont,
    color: brandGradient(ctx, codeRight - recvCodeW, 0, codeRight, 0),
    align: "right",
  });

  // Rate footer inside the card
  const rateBarY = cy + ch - 110;
  rr(ctx, inL - 12, rateBarY, inR - inL + 24, 80, 26);
  ctx.fillStyle = C.well;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(ctx, "سعر الصرف", inR + 4, rateBarY + 53, { font: `600 26px ${AR}`, color: C.muted, align: "right", dir: "rtl" });

  let rateX = inL + 8;
  // Live dot
  ctx.beginPath();
  ctx.arc(rateX + 8, rateBarY + 42, 14, 0, Math.PI * 2);
  ctx.fillStyle = hexA(accent, 0.22);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(rateX + 8, rateBarY + 42, 7, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  rateX += 34;
  const rateFontSize = fit(ctx, params.rateLine, (s) => `600 ${s}px ${MONO}`, 32, 22, 470);
  text(ctx, params.rateLine, rateX, rateBarY + 53, { font: `600 ${rateFontSize}px ${MONO}`, color: C.ink });
  rateX += width(ctx, params.rateLine, `600 ${rateFontSize}px ${MONO}`) + 16;
  if (params.trendLabel) {
    const tf = `600 22px ${AR}`;
    const tw = width(ctx, params.trendLabel, tf) + 28;
    rr(ctx, rateX, rateBarY + 24, tw, 38, 19);
    ctx.fillStyle = hexA(accent, 0.16);
    ctx.fill();
    text(ctx, params.trendLabel, rateX + tw / 2, rateBarY + 51, { font: tf, color: accent, align: "center", dir: "rtl" });
  }

  // ---------- History / features panel ----------
  const px = M;
  const py = cy + ch + 24;
  const pw = cw;
  const ph = 168;
  drawCard(ctx, px, py, pw, ph, 36, false);

  if (history) {
    const first = history[0].marketPrice;
    const lastP = history[history.length - 1].marketPrice;
    const pct = first ? ((lastP - first) / first) * 100 : 0;
    const pctText = `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`;
    text(ctx, "حركة السعر — آخر 30 يوم", px + pw - 36, py + 46, { font: `600 24px ${AR}`, color: C.muted, align: "right", dir: "rtl" });
    const pf = `700 24px ${MONO}`;
    const pwid = width(ctx, pctText, pf) + 32;
    rr(ctx, px + 36, py + 18, pwid, 40, 20);
    ctx.fillStyle = hexA(accent, 0.16);
    ctx.fill();
    text(ctx, pctText, px + 36 + pwid / 2, py + 46, { font: pf, color: accent, align: "center" });
    drawChart(ctx, px + 40, py + 70, pw - 80, 62, history, accent);
    text(ctx, history[0].date, px + 40, py + 156, { font: `500 18px ${MONO}`, color: C.subtle });
    text(ctx, history[history.length - 1].date, px + pw - 40, py + 156, { font: `500 18px ${MONO}`, color: C.subtle, align: "right" });
  } else {
    const feats = [
      ["⚡", "تحويل خلال 30 دقيقة"],
      ["🛡️", "سعر مثبّت عند التأكيد"],
      ["💬", "دعم فوري واتساب"],
    ];
    const colW = pw / 3;
    feats.forEach(([icon, label], i) => {
      const colCx = px + pw - colW * i - colW / 2;
      ctx.font = `40px ${EMOJI}`;
      ctx.fillStyle = "#FFFFFF";
      ctx.direction = "ltr";
      ctx.textAlign = "center";
      ctx.fillText(icon, colCx, py + 78);
      text(ctx, label, colCx, py + 128, { font: `600 24px ${AR}`, color: C.ink, align: "center", dir: "rtl" });
      if (i > 0) {
        ctx.fillStyle = C.line;
        ctx.fillRect(px + pw - colW * i, py + 40, 2, ph - 80);
      }
    });
  }

  // Updated caption
  if (params.updatedCaption) {
    text(ctx, params.updatedCaption, W / 2, py + ph + 38, { font: `500 22px ${AR}`, color: C.subtle, align: "center", dir: "rtl" });
  }

  // ---------- Footer CTA ----------
  const fh = 118;
  const fy = H - 44 - fh;
  ctx.save();
  ctx.shadowColor = "rgba(63,123,219,0.55)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 12;
  rr(ctx, M, fy, cw, fh, 40);
  ctx.fillStyle = brandGradient(ctx, M, fy + fh, M + cw, fy);
  ctx.fill();
  ctx.restore();
  noShadow(ctx);
  // Gloss
  ctx.save();
  rr(ctx, M, fy, cw, fh, 40);
  ctx.clip();
  const gloss = ctx.createLinearGradient(0, fy, 0, fy + fh);
  gloss.addColorStop(0, "rgba(255,255,255,0.22)");
  gloss.addColorStop(0.5, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.fillRect(M, fy, cw, fh);
  ctx.restore();

  const qrSize = 94;
  if (qr) {
    const qx = M + 16;
    const qy = fy + (fh - qrSize) / 2;
    rr(ctx, qx, qy, qrSize, qrSize, 18);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    const qp = 9;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qr, qx + qp, qy + qp, qrSize - qp * 2, qrSize - qp * 2);
    ctx.imageSmoothingEnabled = true;
  }
  const ctaR = M + cw - 40;
  text(ctx, "حوّل فلوسك الآن مع ماستر", ctaR, fy + 56, { font: `800 38px ${AR}`, color: C.navy, align: "right", dir: "rtl" });
  text(ctx, window.location.host, ctaR, fy + 94, { font: `600 26px ${MONO}`, color: "rgba(2,8,23,0.72)", align: "right" });

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
