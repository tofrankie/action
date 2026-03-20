import fs from 'node:fs/promises'
import path from 'node:path'
import { getOctokit } from '@actions/github'
import { confirm, select } from '@inquirer/prompts'
import { Command } from 'commander'
import { execa } from 'execa'
import { formatMessage } from '@/cli/ux.js'
import { resolveChangelogPath } from '@/core/changelog-path.js'
import { readChangelogEntry } from '@/core/changelog.js'
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
    console.error(msg)
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

  console.log(`\n${formatMessage('GitHub Release preview')}`)
  console.log(formatMessage(`  - package: ${resolvedPackage.packageName}`))
  console.log(formatMessage(`  - tag: ${selectedTag}`))
  console.log(formatMessage(`  - version: ${parsed.normalizedVersion}`))
  console.log(formatMessage(`  - changelog title: ${entry.title}`))
  console.log(
    formatMessage(
      `  - changelog body:\n${entry.body
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n')}`
    )
  )

  const shouldRelease = args.yes
    ? true
    : await confirm({ message: 'Create or update GitHub Release?', default: false })
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

  const releaseClient = {
    async getReleaseByTag(tag: string): Promise<{ id: number } | null> {
      try {
        const res = await octokit.rest.repos.getReleaseByTag({ owner, repo, tag })
        return { id: res.data.id }
      } catch (error: unknown) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          error.status === 404
        ) {
          return null
        }
        throw error
      }
    },

    async createRelease(input: {
      tag_name: string
      name: string
      body: string
      target_commitish?: string
      prerelease: boolean
    }): Promise<{ html_url: string }> {
      const res = await octokit.rest.repos.createRelease({
        owner,
        repo,
        tag_name: input.tag_name,
        name: input.name,
        body: input.body,
        target_commitish: input.target_commitish,
        prerelease: input.prerelease,
      })
      return { html_url: res.data.html_url }
    },

    async getTagCommit(tag: string): Promise<string | null> {
      try {
        const ref = await octokit.rest.git.getRef({ owner, repo, ref: `tags/${tag}` })
        const sha = ref.data.object.sha
        if (ref.data.object.type === 'commit') return sha
        const annotated = await octokit.rest.git.getTag({ owner, repo, tag_sha: sha })
        return annotated.data.object.sha
      } catch {
        return null
      }
    },

    async getRefCommit(ref: string): Promise<string | null> {
      const normalized = ref.replace(/^refs\//, '')
      try {
        const data = await octokit.rest.git.getRef({ owner, repo, ref: normalized })
        if (data.data.object.type === 'commit') return data.data.object.sha
        const annotated = await octokit.rest.git.getTag({
          owner,
          repo,
          tag_sha: data.data.object.sha,
        })
        return annotated.data.object.sha
      } catch {
        return null
      }
    },

    async updateRelease(input: {
      release_id: number
      tag_name: string
      name: string
      body: string
      target_commitish?: string
      prerelease: boolean
    }): Promise<{ html_url: string }> {
      const res = await octokit.rest.repos.updateRelease({
        owner,
        repo,
        release_id: input.release_id,
        tag_name: input.tag_name,
        name: input.name,
        body: input.body,
        target_commitish: input.target_commitish,
        prerelease: input.prerelease,
      })
      return { html_url: res.data.html_url }
    },
  }

  const result = await publishRelease(
    {
      tag: selectedTag,
      ref: args.ref,
      publishNpm: shouldPublishNpm,
      npmToken: shouldPublishNpm ? (args.npmToken ?? process.env.NPM_TOKEN) : undefined,
    },
    {
      releaseClient,
      logger: {
        info: msg => console.log(msg),
        warn: msg => console.warn(msg),
      },
    }
  )

  console.log(`\n${formatMessage('GitHub Release completed')}`)
  console.log(formatMessage(`  - action: ${result.releaseAction}`))
  console.log(formatMessage(`  - url: ${result.releaseUrl}`))
}

export interface CliArgs {
  token?: string
  npmToken?: string
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
    .option('--npm-token <token>', 'npm token for publish')
    .option('--tag <tag>', 'tag to release (skip tag prompt)')
    .option('--ref <ref>', 'ref to validate against tag')
    .option('--publish-npm', 'publish package to npm', false)
    .option('-y, --yes', 'skip confirmation prompt', false)

  program.parse(argv, { from: 'user' })
  const opts = program.opts<{
    token?: string
    npmToken?: string
    tag?: string
    ref?: string
    publishNpm: boolean
    yes: boolean
  }>()

  return {
    token: opts.token,
    npmToken: opts.npmToken,
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
