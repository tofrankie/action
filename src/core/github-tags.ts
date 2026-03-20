import semver from 'semver'
import { parseTag } from '@/core/tag.js'

export interface SelectableTag {
  rawTag: string
  version: string
  isPrerelease: boolean
}

export function selectTagsForPackage(params: {
  tags: string[]
  packageName: string
  allowVersionOnlyTag: boolean
}): SelectableTag[] {
  const result: SelectableTag[] = []
  const targetUnscoped = params.packageName.split('/').pop() ?? params.packageName

  for (const rawTag of params.tags) {
    try {
      const parsed = parseTag(rawTag, params.allowVersionOnlyTag)
      if (!parsed.packageName) {
        result.push({
          rawTag,
          version: parsed.normalizedVersion,
          isPrerelease: parsed.isPrerelease,
        })
        continue
      }

      const parsedUnscoped = parsed.packageName.split('/').pop() ?? parsed.packageName
      const matched = parsed.packageName === params.packageName || parsedUnscoped === targetUnscoped
      if (!matched) continue

      result.push({
        rawTag,
        version: parsed.normalizedVersion,
        isPrerelease: parsed.isPrerelease,
      })
    } catch {
      // Ignore non-matching or invalid tags.
    }
  }

  return result.sort((a, b) => semver.rcompare(a.version, b.version))
}
