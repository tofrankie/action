import * as core from '@actions/core'
import { getOctokit } from '@actions/github'
import { actionLogger, readActionInputs, readTriggerContext, setOutputs } from '@/action/io.js'
import { resolveContext } from '@/core/context.js'
import { toErrorMessage } from '@/core/errors.js'
import { createGitHubReleaseClient } from '@/core/github-client.js'
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

  const releaseClient = createGitHubReleaseClient(octokit, { owner, repo })

  const result = await publishRelease(
    {
      tag: context.tag,
      ref: context.ref,
      changelogPathInput: context.changelogPathInput,
      publishNpm: context.publishNpm,
    },
    {
      releaseClient,
      logger: actionLogger(),
    }
  )

  setOutputs({
    githubReleaseUrl: result.githubReleaseUrl,
    npmStatus: result.npmStatus,
    packageName: result.packageName,
    version: result.version,
  })
}
