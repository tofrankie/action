import { DomainError } from '@/core/errors.js'

export interface RefGuardClient {
  getTagCommit: (tag: string) => Promise<string | null>
  getRefCommit: (ref: string) => Promise<string | null>
}

export async function assertTagRefConsistency(input: {
  tag: string
  ref?: string
  client: RefGuardClient
  warn?: (msg: string) => void
}): Promise<void> {
  if (!input.ref) return

  const tagCommit = await input.client.getTagCommit(input.tag)
  const refCommit = await input.client.getRefCommit(input.ref)

  if (!tagCommit || !refCommit) {
    input.warn?.(
      `Skip tag/ref consistency check. tagCommit=${tagCommit ?? 'null'} refCommit=${refCommit ?? 'null'}`
    )
    return
  }

  if (tagCommit !== refCommit) {
    throw new DomainError('TAG_REF_MISMATCH', 'Tag and ref point to different commits.', {
      context: { tag: input.tag, ref: input.ref, tagCommit, refCommit },
    })
  }
}
