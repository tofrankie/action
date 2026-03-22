import fs from 'node:fs/promises'
import path from 'node:path'
import { getOctokit } from '@actions/github'
import { confirm, select } from '@inquirer/prompts'
import { Command } from 'commander'
import { execa } from 'execa'
import { formatMessage } from '@/cli/ux.js'
import { resolveChangelogPath } from '@/core/changelog-path.js'
import { readChangelogEntry } from '@/core/changelog.js'
import { toErrorMessage } from '@/core/errors.js'
import { createGitHubReleaseClient } from '@/core/github-client.js'
import { selectTagsForPackage } from '@/core/github-tags.js'
import {
  isMonorepoWorkspace,
  resolvePackageDir,
  scanWorkspacePackages,
} from '@/core/package-resolver.js'
import { publishRelease } from '@/core/publish-service.js'
import { parseTag } from '@/core/tag.js'

if (!process.env.VITEST) {
  main()
}

function main() {
  runCli().catch((error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('SIGINT') || msg.includes('User force closed')) {
      console.log(formatMessage('Cancelled...'))
      process.exit(0)
    }
    console.error(toErrorMessage(error))
    process.exit(1)
  })
}

async function runCli(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const token = resolveToken(args.token)
  const { owner, repo } = await getRepo()
  const octokit = getOctokit(token)
  const rootDir = process.cwd()

  const packages = await listPackages(rootDir)
  if (packages.length === 0) throw new Error(formatMessage('No publishable packages found.'))

  const selectedPackage =
    packages.length === 1
      ? packages[0]
      : await select({
          message: 'Select package to release',
          choices: packages.map(item => ({ name: item.name, value: item })),
        })

  const tagsResponse = await octokit.paginate(octokit.rest.repos.listTags, {
    owner,
    repo,
    per_page: 100,
  })
  const isMonorepo = await isMonorepoWorkspace(rootDir)
  const selectableTags = selectTagsForPackage({
    tags: tagsResponse.map(item => item.name),
    packageName: selectedPackage.name,
    allowVersionOnlyTag: !isMonorepo,
  })
  if (selectableTags.length === 0) {
    throw new Error(
      formatMessage(
        `No tags found for package ${selectedPackage.name}. Use --tag to specify one manually.`
      )
    )
  }

  const selectedTag = args.tag
    ? args.tag
    : await select({
        message: 'Select tag to release',
        choices: selectableTags.map(item => ({
          name: `${item.rawTag}${item.isPrerelease ? ' (prerelease)' : ''}`,
          value: item.rawTag,
        })),
      })

  const parsed = parseTag(selectedTag, !isMonorepo)
  const resolvedPackage = await resolvePackageDir({
    rootDir,
    packageName: parsed.packageName ?? selectedPackage.name,
  })
  const changelogPath = await resolveChangelogPath({
    rootDir,
    packageDir: resolvedPackage.packageDir,
    isMonorepo: resolvedPackage.isMonorepo,
  })
  const entry = await readChangelogEntry({
    changelogPath: changelogPath.path,
    packageName: resolvedPackage.packageName,
    version: parsed.normalizedVersion,
  })

  console.log(`\n${formatMessage('GitHub Release preview 🔍')}`)
  console.log(formatMessage(`  - package: ${resolvedPackage.packageName}`))
  console.log(formatMessage(`  - tag: ${selectedTag}`))
  console.log(formatMessage(`  - version: ${parsed.normalizedVersion}`))
  console.log(formatMessage(`  - changelog title: ${entry.title}`))
  console.log(
    formatMessage(
      `  - changelog body:\n${entry.body
        .split('\n')
        .map(line => `    ${line}`)
        .join('\n')}`
    )
  )

  const existingRelease = await octokit.rest.repos
    .getReleaseByTag({ owner, repo, tag: selectedTag })
    .then(() => true)
    .catch((error: unknown) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        error.status === 404
      ) {
        return false
      }
      throw error
    })
  const releaseActionLabel = existingRelease ? 'Update' : 'Create'

  const shouldRelease = args.yes
    ? true
    : await confirm({ message: `${releaseActionLabel} GitHub Release?`, default: true })
  if (!shouldRelease) {
    console.log(formatMessage('Cancelled...'))
    return
  }

  let shouldPublishNpm = args.publishNpm
  if (args.publishNpm && !args.yes) {
    shouldPublishNpm = await confirm({
      message: 'Publish package to npm as well?',
      default: false,
    })
    if (!shouldPublishNpm) {
      console.log(formatMessage('Skip npm publish, continue with GitHub Release only.'))
    }
  }

  const releaseClient = createGitHubReleaseClient(octokit, { owner, repo })

  const result = await publishRelease(
    {
      tag: selectedTag,
      ref: args.ref,
      publishNpm: shouldPublishNpm,
    },
    {
      releaseClient,
      logger: {
        info: msg => console.log(msg),
        warn: msg => console.warn(msg),
      },
    }
  )

  console.log(`\n${formatMessage('GitHub Release published 🎉')}`)
  console.log(formatMessage(`  - action: ${result.releaseAction}`))
  console.log(formatMessage(`  - url: ${result.githubReleaseUrl}`))
}

export interface CliArgs {
  token?: string
  tag?: string
  ref?: string
  publishNpm: boolean
  yes: boolean
}

export function parseArgs(argv: string[]): CliArgs {
  const program = new Command()
    .name('tofrankie-release')
    .description('Create or update GitHub Release from local repository')
    .option('--token <token>', 'GitHub token')
    .option('--tag <tag>', 'tag to release (skip tag prompt)')
    .option('--ref <ref>', 'ref to validate against tag')
    .option('--publish-npm', 'publish package to npm', false)
    .option('-y, --yes', 'skip confirmation prompt', false)

  program.parse(argv, { from: 'user' })
  const opts = program.opts<{
    token?: string
    tag?: string
    ref?: string
    publishNpm: boolean
    yes: boolean
  }>()

  return {
    token: opts.token,
    tag: opts.tag,
    ref: opts.ref,
    publishNpm: opts.publishNpm,
    yes: opts.yes,
  }
}

export function resolveToken(argvToken?: string): string {
  const token = argvToken ?? process.env.GITHUB_RELEASE_TOKEN ?? process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error('Missing GitHub token. Use --token or env GITHUB_RELEASE_TOKEN/GITHUB_TOKEN.')
  }
  return token
}

export function parseRepoFromOrigin(origin: string): { owner: string; repo: string } | null {
  const ssh = origin.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/)
  if (ssh) return { owner: ssh[1], repo: ssh[2] }
  return null
}

async function getRepo(): Promise<{ owner: string; repo: string }> {
  const origin = (await execa('git', ['config', '--get', 'remote.origin.url'])).stdout.trim()
  const parsed = parseRepoFromOrigin(origin)
  if (!parsed) throw new Error('Cannot resolve GitHub repo from git origin.')
  return parsed
}

async function listPackages(rootDir: string): Promise<Array<{ name: string; dir: string }>> {
  const isMonorepo = await isMonorepoWorkspace(rootDir)
  if (isMonorepo) return scanWorkspacePackages(rootDir)

  const rootPkg = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf8')) as {
    name?: string
  }
  if (!rootPkg.name) throw new Error('Root package.json is missing name.')
  return [{ name: rootPkg.name, dir: rootDir }]
}
