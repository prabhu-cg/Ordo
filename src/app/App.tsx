import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { useAppearanceStore } from '@/store/appearance-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import { router } from './router'

export function App() {
  const init = useWorkspaceStore((s) => s.init)
  const loadAppearance = useAppearanceStore((s) => s.load)
  useEffect(() => {
    void init()
    void loadAppearance() // independent of the workspace: how things look should not wait for what they show
  }, [init, loadAppearance])
  return <RouterProvider router={router} />
}
