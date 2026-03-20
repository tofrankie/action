import semver from 'semver'
import { DomainError } from '@/core/errors.js'

export interface ParsedTag {
  rawTag: string
  normalizedVersion: string
  packageName?: string
  unscopedName?: string
  isPrerelease: boolean
}

function getUnscopedName(packageName: string): string {
  const segments = packageName.split('/')
  return segments.at(-1) ?? packageName
}

export function parseTag(tag: string, allowVersionOnlyTag: boolean): ParsedTag {
  const scopedOrPlain = /^(@?[^@\s]+)@(.+)$/
  const versionWithV = /^v(.+)$/

  const packageMatch = tag.match(scopedOrPlain)
  if (packageMatch) {
    const packageName = packageMatch[1]
    const version = semver.valid(packageMatch[2])
    if (!version) {
      throw new DomainError('INVALID_TAG', `Invalid semver in tag: ${tag}`)
    }
    return {
      rawTag: tag,
      normalizedVersion: version,
      packageName,
      unscopedName: getUnscopedName(packageName),
      isPrerelease: semver.prerelease(version) !== null,
    }
  }

  if (!allowVersionOnlyTag) {
    throw new DomainError('INVALID_TAG', `Tag must include package name in monorepo mode: ${tag}`, {
      hint: 'Use <package>@<version> format.',
    })
  }

  const vMatch = tag.match(versionWithV)
  const candidate = vMatch ? vMatch[1] : tag
  const version = semver.valid(candidate)
  if (!version) {
    throw new DomainError('INVALID_TAG', `Unsupported tag format: ${tag}`, {
      hint: 'Use @scope/name@1.2.3, name@1.2.3, v1.2.3 or 1.2.3.',
    })
  }
  return {
    rawTag: tag,
    normalizedVersion: version,
    isPrerelease: semver.prerelease(version) !== null,
  }
}
