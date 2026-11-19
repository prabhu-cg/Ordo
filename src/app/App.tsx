import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { useWorkspaceStore } from '@/store/workspace-store'
import { router } from './router'

export function App() {
  const init = useWorkspaceStore((s) => s.init)
  useEffect(() => {
    void init()
  }, [init])
  return <RouterProvider router={router} />
}
