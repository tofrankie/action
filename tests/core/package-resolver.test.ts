import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { isMonorepoWorkspace, matchPackageBySpecifier, resolvePackageDir } from '@/core/package-resolver.js'

const tempDirs: string[] = []

async function mkRepo(structure: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'resolver-test-'))
  tempDirs.push(dir)
  await Promise.all(
    Object.entries(structure).map(async ([file, content]) => {
      const abs = path.join(dir, file)
      await fs.mkdir(path.dirname(abs), { recursive: true })
      await fs.writeFile(abs, content, 'utf8')
    })
  )
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })))
})

const pkgs = (names: string[]) => names.map(name => ({ name, dir: `/x/${name}` }))

describe('matchPackageBySpecifier', () => {
  it('resolves exact package name', () => {
    const list = pkgs(['@scope/a', '@scope/b'])
    expect(matchPackageBySpecifier(list, '@scope/a').name).toBe('@scope/a')
  })

  it('resolves unique unscoped name', () => {
    const list = pkgs(['@scope/only'])
    expect(matchPackageBySpecifier(list, 'only').name).toBe('@scope/only')
  })

  it('throws when unknown', () => {
    const list = pkgs(['@scope/a'])
    expect(() => matchPackageBySpecifier(list, '@scope/z')).toThrow('Unknown package')
  })

  it('throws when unscoped is ambiguous', () => {
    const list = pkgs(['@foo/lib', '@bar/lib'])
    expect(() => matchPackageBySpecifier(list, 'lib')).toThrow('Ambiguous package')
  })
})

describe('resolvePackageDir', () => {
  it('resolves single package at repo root', async () => {
    const repo = await mkRepo({
      'package.json': JSON.stringify({ name: '@tofrankie/action' }),
    })
    const got = await resolvePackageDir({ rootDir: repo })
    expect(got.isMonorepo).toBe(false)
    expect(got.packageDir).toBe(repo)
    expect(got.packageName).toBe('@tofrankie/action')
  })

  it('resolves monorepo package by exact name', async () => {
    const repo = await mkRepo({
      'package.json': JSON.stringify({ workspaces: ['packages/*'] }),
      'packages/action/package.json': JSON.stringify({ name: '@tofrankie/action' }),
    })
    const got = await resolvePackageDir({ rootDir: repo, packageName: '@tofrankie/action' })
    expect(got.isMonorepo).toBe(true)
    expect(got.packageDir).toContain('packages/action')
  })

  it('throws when monorepo has no packageName input', async () => {
    const repo = await mkRepo({
      'package.json': JSON.stringify({ workspaces: ['packages/*'] }),
      'packages/action/package.json': JSON.stringify({ name: '@tofrankie/action' }),
    })
    await expect(resolvePackageDir({ rootDir: repo })).rejects.toThrow('Monorepo tag must include package name')
  })

  it('detects workspace mode via helper', async () => {
    const repo = await mkRepo({
      'package.json': JSON.stringify({ workspaces: ['packages/*'] }),
      'packages/a/package.json': JSON.stringify({ name: '@scope/a' }),
    })
    await expect(isMonorepoWorkspace(repo)).resolves.toBe(true)
  })
})
