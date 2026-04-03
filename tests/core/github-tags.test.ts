import { describe, expect, it } from 'vitest'
import { selectTagsForPackage } from '@/core/github-tags.js'

describe('selectTagsForPackage', () => {
  it('filters and sorts tags for selected package', () => {
    const got = selectTagsForPackage({
      tags: ['@tofrankie/action@1.0.0', '@tofrankie/other@2.0.0', '@tofrankie/action@1.2.0'],
      packageName: '@tofrankie/action',
      allowVersionOnlyTag: false,
    })

    expect(got.map(item => item.rawTag)).toEqual(['@tofrankie/action@1.2.0', '@tofrankie/action@1.0.0'])
  })
})
