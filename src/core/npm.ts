import { execa } from 'execa'
import { DomainError } from '@/core/errors.js'

export type NpmStatus = 'skipped' | 'published' | 'already-exists'

export async function hasNpmVersion(packageName: string, version: string): Promise<boolean> {
  try {
    const result = await execa('npm', ['view', `${packageName}@${version}`, 'version', '--json'])
    return result.stdout.trim().length > 0
  } catch {
    return false
  }
}

export async function publishNpmPackage(input: {
  packageDir: string
  packageName: string
  isPrerelease: boolean
}): Promise<void> {
  const args = ['publish']
  if (input.packageName.startsWith('@')) {
    args.push('--access', 'public')
  }
  if (input.isPrerelease) {
    args.push('--tag', 'next')
  }

  try {
    await execa('npm', ['pack', '--dry-run'], {
      cwd: input.packageDir,
    })
    await execa('npm', args, {
      cwd: input.packageDir,
      stdio: 'inherit',
    })
  } catch (error: any) {
    const stderr = error.stderr || ''
    if (stderr.includes('401') || stderr.includes('403') || stderr.includes('ENEEDAUTH')) {
      throw new DomainError('NPM_PUBLISH_AUTH_ERROR', 'npm publish failed due to authentication error.', {
        hint: 'Ensure you are logged in or have a valid .npmrc with auth token. For example: //registry.npmjs.org/:_authToken=<YOUR_TOKEN>',
      })
    }
    throw error
  }
}
