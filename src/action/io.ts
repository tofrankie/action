import type { ActionInputs, TriggerContext } from '@/core/context.js'
import * as core from '@actions/core'

function readBooleanInput(name: string, defaultValue: boolean): boolean {
  const raw = core.getInput(name)
  if (!raw) return defaultValue
  return raw.toLowerCase() === 'true'
}

export function readActionInputs(): ActionInputs {
  const githubToken = core.getInput('github-token', { required: true })
  return {
    githubToken,
    publishNpm: readBooleanInput('publish-npm', false),
    tag: core.getInput('tag') || undefined,
    ref: core.getInput('ref') || undefined,
    changelogPathInput: core.getInput('changelog-path') || undefined,
  }
}

export function readTriggerContext(): TriggerContext {
  return {
    eventName: process.env.GITHUB_EVENT_NAME ?? '',
    githubRef: process.env.GITHUB_REF,
    sha: process.env.GITHUB_SHA,
  }
}

export function setOutputs(outputs: {
  githubReleaseUrl: string
  npmStatus: string
  packageName: string
  version: string
}): void {
  core.setOutput('github-release-url', outputs.githubReleaseUrl)
  core.setOutput('npm-status', outputs.npmStatus)
  core.setOutput('resolved-package-name', outputs.packageName)
  core.setOutput('resolved-version', outputs.version)
}

export function actionLogger() {
  return {
    info: (msg: string) => core.info(msg),
    warn: (msg: string) => core.warning(msg),
    error: (msg: string) => core.error(msg),
  }
}
