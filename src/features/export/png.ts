/**
 * Draw a roadmap view to a PNG. The view on screen is the source, so colours, labels and layout are what you see.
 * The library is loaded only when someone exports, so it costs nothing until then.
 */
export interface PngOptions {
  /** The element to capture. */
  node: HTMLElement
  title: string
  subtitle: string
  /** Sharpness. 2 is crisp on a retina screen; it is lowered for very large views to stay inside canvas limits. */
  scale?: number
}

/** Browsers refuse canvases beyond about 16,000 pixels on a side, or about 268 million pixels in all. */
const MAX_SIDE = 16000
const MAX_AREA = 200_000_000

export function chooseScale(width: number, height: number, wanted = 2): number {
  const bySide = Math.min(MAX_SIDE / Math.max(width, 1), MAX_SIDE / Math.max(height, 1))
  const byArea = Math.sqrt(MAX_AREA / Math.max(width * height, 1))
  return Math.max(0.25, Math.min(wanted, bySide, byArea))
}

/** Things that are controls, not content, so they are left out of a picture of the roadmap. */
const isControl = (n: Node) =>
  !(n instanceof HTMLElement) ||
  !(
    n.hasAttribute('data-export-hide') ||
    n.getAttribute('aria-label')?.startsWith('Quick edit') ||
    n.getAttribute('aria-label')?.startsWith('Actions for')
  )

export async function viewToPng({ node, title, subtitle, scale = 2 }: PngOptions): Promise<Blob> {
  const { toCanvas } = await import('html-to-image')
  await document.fonts?.ready

  // Let everything show: scroll areas open out to their full size so nothing is cut at an edge.
  const undo = openOut(node)
  let content: HTMLCanvasElement
  let px: number
  try {
    const width = Math.ceil(node.scrollWidth)
    const height = Math.ceil(node.scrollHeight)
    px = chooseScale(width + 96, height + 220, scale)
    const style = getComputedStyle(document.body)
    content = await toCanvas(node, {
      width,
      height,
      pixelRatio: px,
      backgroundColor: style.backgroundColor,
      filter: isControl,
      cacheBust: false,
      style: { margin: '0' },
    })
  } finally {
    undo()
  }

  const pad = Math.round(32 * px)
  const headerH = Math.round(76 * px)
  const footerH = Math.round(44 * px)
  const out = document.createElement('canvas')
  out.width = content.width + pad * 2
  out.height = content.height + headerH + footerH + pad
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('This browser cannot draw the image.')
  const css = getComputedStyle(document.body)
  ctx.fillStyle = css.backgroundColor
  ctx.fillRect(0, 0, out.width, out.height)

  const family = css.fontFamily || 'sans-serif'
  const ink = css.color
  const muted =
    getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground').trim() ||
    '#6b6b6b'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle =
    getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim() || ink
  ctx.font = `700 ${Math.round(26 * px)}px ${family}`
  ctx.fillText(title, pad, pad + Math.round(24 * px), out.width - pad * 2)
  ctx.fillStyle = muted
  ctx.font = `400 ${Math.round(15 * px)}px ${family}`
  ctx.fillText(subtitle, pad, pad + Math.round(52 * px), out.width - pad * 2)
  ctx.drawImage(content, pad, headerH + Math.round(pad / 2))
  ctx.fillStyle = muted
  ctx.font = `400 ${Math.round(12 * px)}px ${family}`
  ctx.fillText('Made with Ordo', pad, out.height - Math.round(16 * px))

  return new Promise((resolve, reject) =>
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('The image could not be created.'))),
      'image/png',
    ),
  )
}

/**
 * Temporarily lift every limit that hides content: scroll containers stop scrolling, and the element is made as
 * wide and tall as its widest content. Returns a function that puts everything back exactly as it was.
 */
function openOut(root: HTMLElement): () => void {
  const touched: { el: HTMLElement; css: string }[] = []
  const set = (el: HTMLElement, rules: Record<string, string>) => {
    touched.push({ el, css: el.getAttribute('style') ?? '' })
    for (const [k, v] of Object.entries(rules)) el.style.setProperty(k, v, 'important')
  }
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const o = getComputedStyle(el)
    if (o.overflowX !== 'visible' || o.overflowY !== 'visible') {
      if (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)
        set(el, { overflow: 'visible', 'max-height': 'none' })
    }
  })
  const width = Math.max(
    root.scrollWidth,
    ...[...root.querySelectorAll<HTMLElement>('*')].map((e) => e.scrollWidth),
  )
  set(root, { width: `${Math.ceil(width)}px`, 'max-width': 'none', overflow: 'visible' })
  return () => {
    for (const { el, css } of touched.reverse()) {
      if (css) el.setAttribute('style', css)
      else el.removeAttribute('style')
    }
  }
}
