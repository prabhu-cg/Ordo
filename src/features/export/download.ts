/** Save text or a blob as a file, using only the browser's own download. Nothing is sent anywhere. */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const downloadText = (filename: string, text: string, type: string) =>
  downloadBlob(filename, new Blob([text], { type }))

/** A name that is safe in any file system: letters, digits, dashes. */
export function slug(text: string, fallback = 'ordo'): string {
  const s = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return s || fallback
}

export const stamp = (now: Date = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

export const exportFileName = (parts: string[], ext: string, now?: Date) =>
  `${[...parts.map((p) => slug(p)), stamp(now)].join('-')}.${ext}`
