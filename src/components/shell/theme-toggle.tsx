import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { useThemeStore } from '@/store/theme-store'

export function ThemeToggle() {
  const { theme, toggle } = useThemeStore()
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
  return (
    <Tooltip content={label}>
      <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={label}>
        {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
      </Button>
    </Tooltip>
  )
}
