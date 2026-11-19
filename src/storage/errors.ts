import Dexie from 'dexie'
import { ZodError } from 'zod'

export type StorageErrorCode =
  | 'VALIDATION' // the data did not match the schema
  | 'NOT_FOUND' // no record with that id
  | 'CONFLICT' // the record changed since it was read
  | 'QUOTA_EXCEEDED' // the browser is out of space
  | 'UNAVAILABLE' // IndexedDB is blocked, closed or cannot open (private mode, policy)
  | 'VERSION_CONFLICT' // the stored database is newer than this app
  | 'INVALID_BACKUP' // a backup file could not be read or trusted
  | 'UNKNOWN'

/** Every failure that leaves the storage layer is one of these, so the UI never parses raw IndexedDB errors. */
export class StorageError extends Error {
  readonly code: StorageErrorCode
  /** For VALIDATION: a message per field path, ready to show next to inputs. */
  readonly fieldErrors: Record<string, string>

  constructor(
    code: StorageErrorCode,
    message: string,
    options?: { cause?: unknown; fieldErrors?: Record<string, string> },
  ) {
    super(message, { cause: options?.cause })
    this.name = 'StorageError'
    this.code = code
    this.fieldErrors = options?.fieldErrors ?? {}
  }

  /** Short, human recovery advice for the error state. */
  get recovery(): string {
    switch (this.code) {
      case 'QUOTA_EXCEEDED':
        return 'Free up browser storage or export a backup, then try again.'
      case 'UNAVAILABLE':
        return 'Ordo stores your work in this browser. Private windows and some privacy settings block that. Open Ordo in a regular window and allow site data.'
      case 'VERSION_CONFLICT':
        return 'This browser holds data from a newer version of Ordo. Reload to get the latest version.'
      case 'CONFLICT':
        return 'Reload the item to see the latest changes, then apply your edit again.'
      case 'INVALID_BACKUP':
        return 'Choose a backup file exported from Ordo.'
      default:
        return 'Try again. If it keeps happening, export a backup and reload the page.'
    }
  }
}

export function toStorageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error

  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of error.issues) {
      const key = issue.path.join('.') || '_'
      fieldErrors[key] ??= issue.message
    }
    const first = error.issues[0]
    return new StorageError('VALIDATION', first?.message ?? 'The data is not valid.', {
      cause: error,
      fieldErrors,
    })
  }

  if (error instanceof Dexie.DexieError) {
    switch (error.name) {
      case Dexie.errnames.QuotaExceeded:
        return new StorageError('QUOTA_EXCEEDED', 'This browser has no storage space left.', {
          cause: error,
        })
      case Dexie.errnames.Version:
        return new StorageError(
          'VERSION_CONFLICT',
          'The stored data is newer than this version of Ordo.',
          { cause: error },
        )
      case Dexie.errnames.OpenFailed:
      case Dexie.errnames.DatabaseClosed:
      case Dexie.errnames.MissingAPI:
      case Dexie.errnames.InvalidState:
      case 'SecurityError':
        return new StorageError('UNAVAILABLE', 'Ordo cannot open its local storage.', {
          cause: error,
        })
      default:
        return new StorageError('UNKNOWN', error.message || 'Something went wrong while saving.', {
          cause: error,
        })
    }
  }

  const message = error instanceof Error ? error.message : 'Something went wrong while saving.'
  return new StorageError('UNKNOWN', message, { cause: error })
}

/** Run a storage operation and normalise any failure to a StorageError. */
export async function guard<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toStorageError(error)
  }
}
