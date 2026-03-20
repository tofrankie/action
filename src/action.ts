import * as core from '@actions/core'
import { getOctokit } from '@actions/github'
import { actionLogger, readActionInputs, readTriggerContext, setOutputs } from '@/action/io.js'
import { resolveContext } from '@/core/context.js'
import { toErrorMessage } from '@/core/errors.js'
import { publishRelease } from '@/core/publish-service.js'

main().catch((error: unknown) => {
  core.setFailed(toErrorMessage(error))
})

async function main(): Promise<void> {
  const inputs = readActionInputs()
  const trigger = readTriggerContext()
  const context = resolveContext(inputs, trigger)

  const octokit = getOctokit(context.githubToken)
  const repository = process.env.GITHUB_REPOSITORY
  if (!repository || !repository.includes('/')) {
    throw new Error('GITHUB_REPOSITORY is missing or invalid.')
  }
  const [owner, repo] = repository.split('/')

  const releaseClient = {
    async getReleaseByTag(tag: string): Promise<{ id: number } | null> {
      try {
        const res = await octokit.rest.repos.getReleaseByTag({ owner, repo, tag })
        return { id: res.data.id }
      } catch (error: unknown) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          error.status === 404
        ) {
          return null
        }
        throw error
      }
    },
    async createRelease(input: {
      tag_name: string
      name: string
      body: string
      target_commitish?: string
      prerelease: boolean
    }): Promise<{ html_url: string }> {
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
    async getTagCommit(tag: string): Promise<string | null> {
      try {
        const ref = await octokit.rest.git.getRef({ owner, repo, ref: `tags/${tag}` })
        const sha = ref.data.object.sha
        if (ref.data.object.type === 'commit') return sha
        const annotated = await octokit.rest.git.getTag({ owner, repo, tag_sha: sha })
        return annotated.data.object.sha
      } catch {
        return null
      }
    },
    async getRefCommit(ref: string): Promise<string | null> {
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
      } catch {
        return null
      }
    },
    async updateRelease(input: {
      release_id: number
      tag_name: string
      name: string
      body: string
      target_commitish?: string
      prerelease: boolean
    }): Promise<{ html_url: string }> {
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
  }

  const result = await publishRelease(
    {
      tag: context.tag,
      ref: context.ref,
      changelogPathInput: context.changelogPathInput,
      publishNpm: context.publishNpm,
      npmToken: context.npmToken,
    },
    {
      releaseClient,
      logger: actionLogger(),
    }
  )

  setOutputs({
    releaseUrl: result.releaseUrl,
    npmStatus: result.npmStatus,
    packageName: result.packageName,
    version: result.version,
  })
}
