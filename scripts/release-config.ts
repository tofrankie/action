const ACTION_RELEASE_MAJOR = 1

export function getReleaseBranchName(): string {
  return `v${ACTION_RELEASE_MAJOR}`
}
