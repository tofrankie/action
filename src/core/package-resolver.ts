import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import YAML from 'yaml'
import { DomainError } from '@/core/errors.js'

export interface WorkspacePackage {
  name: string
  dir: string
}

export interface PackageResolution {
  isMonorepo: boolean
  packageName: string
  packageDir: string
}

interface PackageJson {
  name?: string
  workspaces?: string[] | { packages?: string[] }
}

async function readJson<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf8')
  return JSON.parse(content) as T
}

async function loadWorkspaceGlobs(rootDir: string): Promise<string[]> {
  const rootPkgPath = path.join(rootDir, 'package.json')
  const rootPkg = await readJson<PackageJson>(rootPkgPath)
  const fromPkg = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : rootPkg.workspaces?.packages

  if (fromPkg && fromPkg.length > 0) {
    return fromPkg
  }

  const pnpmWsPath = path.join(rootDir, 'pnpm-workspace.yaml')
  try {
    const pnpmWsContent = await fs.readFile(pnpmWsPath, 'utf8')
    const parsed = YAML.parse(pnpmWsContent) as { packages?: string[] } | null
    return parsed?.packages ?? []
  } catch {
    return []
  }
}

export function matchPackageBySpecifier(packages: WorkspacePackage[], specifier: string): WorkspacePackage {
  const trimmed = specifier.trim()
  if (!trimmed) {
    throw new DomainError('INVALID_PACKAGE_SPEC', 'Package name must be non-empty.')
  }

  const exact = packages.filter(item => item.name === trimmed)
  if (exact.length === 1) return exact[0]

  const unscoped = trimmed.split('/').pop() ?? trimmed
  const byUnscoped = packages.filter(item => (item.name.split('/').pop() ?? item.name) === unscoped)
  if (byUnscoped.length === 1) return byUnscoped[0]
  if (byUnscoped.length > 1) {
    throw new DomainError(
      'PACKAGE_AMBIGUOUS',
      `Ambiguous package "${trimmed}". Matches: ${byUnscoped.map(p => p.name).join(', ')}.`
    )
  }

  throw new DomainError(
    'PACKAGE_NOT_FOUND',
    `Unknown package "${trimmed}". Known packages: ${packages.map(p => p.name).join(', ')}.`
  )
}

export async function scanWorkspacePackages(rootDir: string): Promise<WorkspacePackage[]> {
  const globs = await loadWorkspaceGlobs(rootDir)
  if (globs.length === 0) return []

  const packageJsonFiles = await fg(
    globs.map(item => `${item}/package.json`),
    { cwd: rootDir, absolute: true, dot: false }
  )

  const result: WorkspacePackage[] = []
  for (const file of packageJsonFiles) {
    const pkg = await readJson<PackageJson>(file)
    if (!pkg.name) continue
    result.push({
      name: pkg.name,
      dir: path.dirname(file),
    })
  }
  return result
}

export async function resolvePackageDir(params: {
  rootDir: string
  packageName?: string
  fallbackRootPackageName?: string
}): Promise<PackageResolution> {
  const { rootDir, packageName, fallbackRootPackageName } = params
  const workspacePackages = await scanWorkspacePackages(rootDir)
  const isMonorepo = workspacePackages.length > 0

  if (!isMonorepo) {
    const rootPkg = await readJson<PackageJson>(path.join(rootDir, 'package.json'))
    const name = packageName ?? fallbackRootPackageName ?? rootPkg.name
    if (!name) {
      throw new DomainError('PACKAGE_NAME_NOT_FOUND', 'Cannot resolve package name from package.json.')
    }
    return { isMonorepo: false, packageName: name, packageDir: rootDir }
  }

  if (!packageName) {
    throw new DomainError('MONOREPO_PACKAGE_NAME_REQUIRED', 'Monorepo tag must include package name.', {
      hint: 'Use tag like @scope/name@1.2.3 or name@1.2.3.',
    })
  }

  const exact = workspacePackages.filter(item => item.name === packageName)
  if (exact.length === 1) {
    return { isMonorepo: true, packageName: exact[0].name, packageDir: exact[0].dir }
  }
  if (exact.length > 1) {
    throw new DomainError('PACKAGE_CONFLICT', `Multiple packages matched: ${packageName}`)
  }

  const unscoped = packageName.split('/').pop() ?? packageName
  const byUnscoped = workspacePackages.filter(item => item.name.split('/').pop() === unscoped)
  if (byUnscoped.length === 1) {
    return { isMonorepo: true, packageName: byUnscoped[0].name, packageDir: byUnscoped[0].dir }
  }
  if (byUnscoped.length > 1) {
    throw new DomainError('PACKAGE_CONFLICT', `Unscoped package name is ambiguous: ${unscoped}`)
  }

  throw new DomainError('PACKAGE_NOT_FOUND', `Package from tag was not found: ${packageName}`)
}

export async function isMonorepoWorkspace(rootDir: string): Promise<boolean> {
  const workspacePackages = await scanWorkspacePackages(rootDir)
  return workspacePackages.length > 0
}
