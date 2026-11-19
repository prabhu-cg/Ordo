import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge has to know our custom tokens. Without this it reads `text-body` (a font size) as a text
 * colour and drops the real colour class beside it, so a destructive button would quietly lose its red.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['label', 'caption', 'body', 'title', 'headline'],
      radius: ['input', 'menu', 'card'],
      shadow: ['menu', 'drawer', 'raised'],
    },
  },
})

/** Merge conditional class names, resolving Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
