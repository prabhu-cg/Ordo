import { ChevronsUpDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useWorkspaceStore } from '@/store/workspace-store'

export function ProductSwitcher({ onCreate }: { onCreate: () => void }) {
  const { products, activeProductId, selectProduct } = useWorkspaceStore()
  const active = products.find((p) => p.id === activeProductId)

  if (!active) {
    return (
      <Button variant="outline" className="w-full justify-start" onClick={onCreate}>
        <Plus aria-hidden /> New product
      </Button>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
          aria-label={`Product: ${active.name}. Switch product`}
        >
          <span className="truncate">{active.name}</span>
          <ChevronsUpDown className="text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56">
        <DropdownMenuLabel>Products</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={active.id} onValueChange={(id) => void selectProduct(id)}>
          {products.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={p.id}>
              {p.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onCreate}>
          <Plus aria-hidden /> New product
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
