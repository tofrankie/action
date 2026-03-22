export interface ReleaseClient {
  getReleaseByTag: (tag: string) => Promise<{ id: number } | null>
  getTagCommit?: (tag: string) => Promise<string | null>
  getRefCommit?: (ref: string) => Promise<string | null>
  createRelease: (input: {
    tag_name: string
    name: string
    body: string
    target_commitish?: string
    prerelease: boolean
  }) => Promise<{ html_url: string }>
  updateRelease: (input: {
    release_id: number
    tag_name: string
    name: string
    body: string
    target_commitish?: string
    prerelease: boolean
  }) => Promise<{ html_url: string }>
}

export interface EnsureReleaseInput {
  client: ReleaseClient
  tag: string
  title: string
  body: string
  targetCommitish?: string
  isPrerelease: boolean
}

export interface EnsureReleaseResult {
  githubReleaseUrl: string
  action: 'created' | 'updated'
}

export async function ensureRelease(input: EnsureReleaseInput): Promise<EnsureReleaseResult> {
  const existing = await input.client.getReleaseByTag(input.tag)
  if (!existing) {
    const created = await input.client.createRelease({
      tag_name: input.tag,
      name: input.title,
      body: input.body,
      target_commitish: input.targetCommitish,
      prerelease: input.isPrerelease,
    })
    return { githubReleaseUrl: created.html_url, action: 'created' }
  }

  const updated = await input.client.updateRelease({
    release_id: existing.id,
    tag_name: input.tag,
    name: input.title,
    body: input.body,
    target_commitish: input.targetCommitish,
    prerelease: input.isPrerelease,
  })
  return { githubReleaseUrl: updated.html_url, action: 'updated' }
}
