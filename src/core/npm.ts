import { execa } from 'execa'

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
  npmToken: string
}): Promise<void> {
  const args = ['publish']
  if (input.packageName.startsWith('@')) {
    args.push('--access', 'public')
  }
  if (input.isPrerelease) {
    args.push('--tag', 'next')
  }

  await execa('npm', ['pack', '--dry-run'], {
    cwd: input.packageDir,
    env: { NODE_AUTH_TOKEN: input.npmToken },
  })
  await execa('npm', args, {
    cwd: input.packageDir,
    env: { NODE_AUTH_TOKEN: input.npmToken },
    stdio: 'inherit',
  })
}
