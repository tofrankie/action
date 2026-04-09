import type { NpmStatus } from '@/core/npm.js'
import type { ReleaseClient } from '@/core/release.js'
import path from 'node:path'
import { resolveChangelogPath } from '@/core/changelog-path.js'
import { readChangelogEntry } from '@/core/changelog.js'
import { hasNpmVersion, publishNpmPackage } from '@/core/npm.js'
import { isMonorepoWorkspace, resolvePackageDir } from '@/core/package-resolver.js'
import { assertTagRefConsistency } from '@/core/ref-guard.js'
import { ensureRelease } from '@/core/release.js'
import { parseTag } from '@/core/tag.js'

export interface PublishRequest {
  tag: string
  ref?: string
  changelogPathInput?: string
  publishNpm: boolean
}

export interface PublishResult {
  packageName: string
  packageDir: string
  version: string
  releaseTag: string
  releaseTitle: string
  githubReleaseUrl: string
  releaseAction: 'created' | 'updated'
  npmStatus: NpmStatus
  changelogPath: string
  changelogPathSource: 'input' | 'package-default' | 'root-default'
}

export interface PublishDeps {
  releaseClient: ReleaseClient
  logger: {
    info: (msg: string) => void
    warn?: (msg: string) => void
  }
}

export async function publishRelease(
  req: PublishRequest,
  deps: PublishDeps
): Promise<PublishResult> {
  const rootDir = process.cwd()
  const isMonorepo = await isMonorepoWorkspace(rootDir)
  const firstParsed = parseTag(req.tag, !isMonorepo)
  const resolvedPackage = await resolvePackageDir({
    rootDir,
    packageName: firstParsed.packageName,
  })

  const parsed = firstParsed.packageName
    ? firstParsed
    : {
        ...firstParsed,
        packageName: resolvedPackage.packageName,
        unscopedName: resolvedPackage.packageName.split('/').pop() ?? resolvedPackage.packageName,
      }
  const packageName = parsed.packageName ?? resolvedPackage.packageName

  const changelogPath = await resolveChangelogPath({
    rootDir,
    packageDir: resolvedPackage.packageDir,
    isMonorepo: resolvedPackage.isMonorepo,
    changelogPathInput: req.changelogPathInput,
  })

  const entry = await readChangelogEntry({
    changelogPath: changelogPath.path,
    packageName,
    version: parsed.normalizedVersion,
  })

  deps.logger.info(`🐳 Resolved package: ${resolvedPackage.packageName}`)
  deps.logger.info(
    `🐳 Resolved changelog: ${path.relative(rootDir, changelogPath.path)} (${changelogPath.source})`
  )

  if (deps.releaseClient.getTagCommit && deps.releaseClient.getRefCommit) {
    await assertTagRefConsistency({
      tag: req.tag,
      ref: req.ref,
      client: {
        getTagCommit: deps.releaseClient.getTagCommit,
        getRefCommit: deps.releaseClient.getRefCommit,
      },
      warn: msg => deps.logger.warn?.(msg),
    })
  }

  const ensured = await ensureRelease({
    client: deps.releaseClient,
    tag: req.tag,
    title: entry.title,
    body: entry.body,
    targetCommitish: req.ref,
    isPrerelease: parsed.isPrerelease,
  })

  let npmStatus: NpmStatus = 'skipped'
  if (req.publishNpm) {
    const hasVersion = await hasNpmVersion(packageName, parsed.normalizedVersion)
    if (hasVersion) {
      npmStatus = 'already-exists'
      deps.logger.warn?.(`npm version already exists: ${packageName}@${parsed.normalizedVersion}`)
    } else {
      await publishNpmPackage({
        packageDir: resolvedPackage.packageDir,
        packageName,
        isPrerelease: parsed.isPrerelease,
      })
      npmStatus = 'published'
    }
  }

  return {
    packageName: resolvedPackage.packageName,
    packageDir: resolvedPackage.packageDir,
    version: parsed.normalizedVersion,
    releaseTag: req.tag,
    releaseTitle: entry.title,
    githubReleaseUrl: ensured.githubReleaseUrl,
    releaseAction: ensured.action,
    npmStatus,
    changelogPath: changelogPath.path,
    changelogPathSource: changelogPath.source,
  }
}
