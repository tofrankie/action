import { DomainError } from '@/core/errors.js'

export interface ActionInputs {
  tag?: string
  ref?: string
  changelogPathInput?: string
  publishNpm: boolean
  githubToken: string
  npmToken?: string
}

export interface TriggerContext {
  eventName: string
  githubRef?: string
  sha?: string
}

export interface ResolvedContext {
  tag: string
  ref?: string
  publishNpm: boolean
  changelogPathInput?: string
  githubToken: string
  npmToken?: string
}

function extractTagFromRef(ref?: string): string | undefined {
  if (!ref) return undefined
  if (!ref.startsWith('refs/tags/')) return undefined
  return ref.replace('refs/tags/', '')
}

export function resolveContext(inputs: ActionInputs, trigger: TriggerContext): ResolvedContext {
  const fromRef = extractTagFromRef(trigger.githubRef)
  const tag = inputs.tag ?? fromRef
  if (!tag) {
    throw new DomainError('MISSING_TAG', 'Unable to resolve tag from inputs or GitHub ref.', {
      hint: 'Provide `tag` input for workflow_dispatch.',
    })
  }

  if (inputs.publishNpm && !inputs.npmToken) {
    throw new DomainError('MISSING_NPM_TOKEN', '`publish-npm` is true but `npm-token` is missing.')
  }

  return {
    tag,
    ref: inputs.ref ?? trigger.githubRef,
    publishNpm: inputs.publishNpm,
    changelogPathInput: inputs.changelogPathInput,
    githubToken: inputs.githubToken,
    npmToken: inputs.npmToken,
  }
}
