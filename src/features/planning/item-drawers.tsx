import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { AddItemsDrawer } from '@/features/roadmap/add-items-drawer'
import { MilestoneForm } from '@/features/roadmap/milestone-form'
import { RoadmapForm } from '@/features/roadmap/roadmap-form'
import { RoadmapItemDrawer } from '@/features/roadmap/roadmap-item-drawer'
import { EditTemplateForm } from '@/features/templates/edit-template-form'
import { SaveTemplateForm } from '@/features/templates/save-template-form'
import { useItemDrawer } from '@/store/drawer-store'
import { DeleteDialog } from './delete-dialogs'
import { ItemForm } from './item-form'
import { ObjectiveForm } from './objective-form'

/** Mounted once in the app shell. Any page opens a drawer through `useItemDrawer()`. */
export function ItemDrawers() {
  const s = useItemDrawer()
  const { target, close } = s
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

      <Drawer open={Boolean(s.item)} onOpenChange={(o) => !o && s.closeRoadmapItem()}>
        <DrawerContent size="xl">
          {s.item && (
            <RoadmapItemDrawer
              key={`${s.item.roadmapId}:${s.item.itemType}:${s.item.itemId}`}
              {...s.item}
            />
          )}
        </DrawerContent>
      </Drawer>

      <Drawer open={Boolean(s.add)} onOpenChange={(o) => !o && s.closeAddItems()}>
        <DrawerContent size="lg">
          {s.add && <AddItemsDrawer key={`${s.add.roadmapId}:${s.add.lane ?? ''}`} {...s.add} />}
        </DrawerContent>
      </Drawer>

      <Drawer open={Boolean(s.form)} onOpenChange={(o) => !o && s.closeRoadmapForm()}>
        <DrawerContent size="lg">
          {s.form && <RoadmapForm key={s.form.id ?? 'new'} id={s.form.id} />}
        </DrawerContent>
      </Drawer>

      <Drawer open={Boolean(s.milestone)} onOpenChange={(o) => !o && s.closeMilestone()}>
        <DrawerContent>
          {s.milestone && <MilestoneForm key={s.milestone.id ?? 'new'} {...s.milestone} />}
        </DrawerContent>
      </Drawer>

      <Drawer open={Boolean(s.saveTemplate)} onOpenChange={(o) => !o && s.closeSaveTemplate()}>
        <DrawerContent size="lg">
          {s.saveTemplate && (
            <SaveTemplateForm
              key={s.saveTemplate.roadmapId ?? 'any'}
              roadmapId={s.saveTemplate.roadmapId}
            />
          )}
        </DrawerContent>
      </Drawer>

      <Drawer open={Boolean(s.editTemplate)} onOpenChange={(o) => !o && s.closeEditTemplate()}>
        <DrawerContent>
          {s.editTemplate && <EditTemplateForm key={s.editTemplate.id} id={s.editTemplate.id} />}
        </DrawerContent>
      </Drawer>

      <DeleteDialog />
    </>
  )
}
