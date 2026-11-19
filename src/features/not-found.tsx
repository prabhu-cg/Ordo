import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export function NotFoundPage() {
  return (
    <EmptyState
      title="This page does not exist"
      description="The address may be mistyped, or the page may have moved."
      action={
        <Button asChild variant="outline">
          <Link to="/">Back to Ordo</Link>
        </Button>
      }
    />
  )
}
