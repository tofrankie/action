import { execa } from 'execa'
import { getReleaseBranchName } from './release-config.js'

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
})

async function run(): Promise<void> {
  const branch = getReleaseBranchName()
  const status = await execa('git', ['status', '--porcelain'])
  if (status.stdout.trim().length > 0) {
    throw new Error('Working tree is dirty. Commit changes before release.')
  }

  await execa('git', ['checkout', '--detach'], { stdio: 'inherit' })
  await execa('git', ['checkout', '-B', branch], { stdio: 'inherit' })
  await execa('git', ['add', '--force', 'dist'], { stdio: 'inherit' })

  if (process.env.GITHUB_ACTIONS === 'true') {
    const name = process.env.RELEASE_GIT_USER_NAME
    const email = process.env.RELEASE_GIT_USER_EMAIL
    if (!name?.trim() || !email?.trim()) {
      throw new Error(
        'In CI, set RELEASE_GIT_USER_NAME and RELEASE_GIT_USER_EMAIL (e.g. in the workflow env).'
      )
    }
    await execa('git', ['config', 'user.name', name])
    await execa('git', ['config', 'user.email', email])
  }

  await execa('git', ['commit', '-m', `chore(release): update dist for ${branch}`], {
    stdio: 'inherit',
  })
  await execa('git', ['push', '-u', 'origin', branch], { stdio: 'inherit' })
}
