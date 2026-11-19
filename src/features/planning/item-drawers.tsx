import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { useItemDrawer } from '@/store/drawer-store'
import { DeleteDialog } from './delete-dialogs'
import { ItemForm } from './item-form'
import { ObjectiveForm } from './objective-form'

/** Mounted once in the app shell. Any page opens a drawer through `useItemDrawer().open(...)`. */
export function ItemDrawers() {
  const { target, close } = useItemDrawer()
  const key = target
    ? `${target.kind}:${target.id ?? 'new'}:${target.preset?.objectiveId ?? ''}:${target.preset?.initiativeId ?? ''}`
    : 'closed'
  return (
    <>
      <Drawer open={Boolean(target)} onOpenChange={(o) => !o && close()}>
        <DrawerContent size="lg">
          {target?.kind === 'objective' && <ObjectiveForm key={key} id={target.id} />}
          {target && target.kind !== 'objective' && (
            <ItemForm key={key} kind={target.kind} target={target} />
          )}
        </DrawerContent>
      </Drawer>
      <DeleteDialog />
    </>
  )
}
