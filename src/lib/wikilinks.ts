/**
 * Parse [[wiki-links]] from note content and resolve them to entities.
 */

const WIKI_REGEX = /\[\[([^\]]+)\]\]/g

export interface WikiLink {
  /** The full match e.g. "[[my note]]" */
  raw: string
  /** The target text e.g. "my note" */
  target: string
  /** Resolved entity type if found */
  entityType?: 'meeting' | 'literature' | 'work' | 'note'
  /** Resolved entity ID if found */
  entityId?: string
}

/** Extract all wiki links from text */
export function parseWikiLinks(text: string): WikiLink[] {
  const links: WikiLink[] = []
  let match
  while ((match = WIKI_REGEX.exec(text)) !== null) {
    links.push({ raw: match[0], target: match[1].trim() })
  }
  return links
}

/** Resolve wiki links against known entities and notes */
export function resolveWikiLinks(
  links: WikiLink[],
  context: {
    meetings: Array<{ id: string; title: string }>
    literature: Array<{ id: string; title: string }>
    works: Array<{ id: string; name: string }>
    allNotes: Array<{ id: string; title: string; sourceKey: string }>
  },
): WikiLink[] {
  return links.map((link) => {
    const target = link.target.toLowerCase()

    // Check meetings
    const m = context.meetings.find((x) => x.title.toLowerCase() === target)
    if (m) return { ...link, entityType: 'meeting' as const, entityId: m.id }

    // Check literature
    const l = context.literature.find((x) => x.title.toLowerCase().includes(target))
    if (l) return { ...link, entityType: 'literature' as const, entityId: l.id }

    // Check works
    const w = context.works.find((x) => x.name.toLowerCase() === target)
    if (w) return { ...link, entityType: 'work' as const, entityId: w.id }

    // Check notes
    const n = context.allNotes.find((x) => x.title.toLowerCase() === target)
    if (n) return { ...link, entityType: 'note' as const, entityId: n.id }

    return link
  })
}

/** Find backlinks: notes that reference a given entity title */
export function findBacklinks(
  targetTitle: string,
  allNotes: Array<{ id: string; title: string; content: string; sourceLabel?: string }>,
) {
  return allNotes.filter((n) => {
    const links = parseWikiLinks(n.content)
    return links.some((l) => l.target.toLowerCase() === targetTitle.toLowerCase())
  })
}

/** Split text into segments: normal text and wiki links */
export interface TextSegment {
  type: 'text' | 'link'
  content: string
  link?: WikiLink
}

export function segmentText(text: string, resolvedLinks: WikiLink[]): TextSegment[] {
  const segments: TextSegment[] = []
  const regex = /\[\[([^\]]+)\]\]/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    // Text before this link
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    // The link itself
    const target = match[1].trim()
    const resolved = resolvedLinks.find((l) => l.target === target)
    segments.push({ type: 'link', content: match[0], link: resolved || { raw: match[0], target } })
    lastIndex = match.index + match[0].length
  }

  // Remaining text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return segments
}
