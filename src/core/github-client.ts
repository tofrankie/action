import type { getOctokit } from '@actions/github'
import type { ReleaseClient } from '@/core/release.js'

export type OctokitClient = ReturnType<typeof getOctokit>

export function createGitHubReleaseClient(
  octokit: OctokitClient,
  repoContext: { owner: string; repo: string }
): ReleaseClient {
  const { owner, repo } = repoContext

  return {
    async getReleaseByTag(tag: string) {
      try {
        const res = await octokit.rest.repos.getReleaseByTag({ owner, repo, tag })
        return { id: res.data.id }
      } catch (error: unknown) {
        if (isNotFoundError(error)) return null
        throw error
      }
    },

    async createRelease(input) {
      const res = await octokit.rest.repos.createRelease({
        owner,
        repo,
        tag_name: input.tag_name,
        name: input.name,
        body: input.body,
        target_commitish: input.target_commitish,
        prerelease: input.prerelease,
      })
      return { html_url: res.data.html_url }
    },

    async updateRelease(input) {
      const res = await octokit.rest.repos.updateRelease({
        owner,
        repo,
        release_id: input.release_id,
        tag_name: input.tag_name,
        name: input.name,
        body: input.body,
        target_commitish: input.target_commitish,
        prerelease: input.prerelease,
      })
      return { html_url: res.data.html_url }
    },

    async getTagCommit(tag: string) {
      try {
        const ref = await octokit.rest.git.getRef({ owner, repo, ref: `tags/${tag}` })
        const sha = ref.data.object.sha
        if (ref.data.object.type === 'commit') return sha
        const annotated = await octokit.rest.git.getTag({ owner, repo, tag_sha: sha })
        return annotated.data.object.sha
      } catch (error: unknown) {
        if (isNotFoundError(error)) return null
        throw error
      }
    },

    async getRefCommit(ref: string) {
      const normalized = ref.replace(/^refs\//, '')
      try {
        const data = await octokit.rest.git.getRef({ owner, repo, ref: normalized })
        if (data.data.object.type === 'commit') return data.data.object.sha
        const annotated = await octokit.rest.git.getTag({
          owner,
          repo,
          tag_sha: data.data.object.sha,
        })
        return annotated.data.object.sha
      } catch (error: unknown) {
        if (isNotFoundError(error)) return null
        throw error
      }
    },
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: number }).status === 404
  )
}
