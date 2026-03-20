import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readChangelogEntry } from '@/core/changelog.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })))
})

describe('readChangelogEntry', () => {
  it('matches [title] - date format', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'changelog-test-'))
    tempDirs.push(dir)
    const changelog = path.join(dir, 'CHANGELOG.md')
    await fs.writeFile(
      changelog,
      `# Changelog

## [@tofrankie/action@1.0.0] - 2026-03-21

- hello
`,
      'utf8'
    )

    const got = await readChangelogEntry({
      changelogPath: changelog,
      packageName: '@tofrankie/action',
      version: '1.0.0',
    })
    expect(got.title).toBe('@tofrankie/action@1.0.0')
    expect(got.body).toContain('hello')
  })

  it('throws when entry not found', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'changelog-test-'))
    tempDirs.push(dir)
    const changelog = path.join(dir, 'CHANGELOG.md')
    await fs.writeFile(changelog, '# Changelog\n', 'utf8')

    await expect(
      readChangelogEntry({
        changelogPath: changelog,
        packageName: '@tofrankie/action',
        version: '9.9.9',
      })
    ).rejects.toThrow('Version entry not found')
  })
})
