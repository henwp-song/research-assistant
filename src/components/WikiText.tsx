import { parseWikiLinks, segmentText, type WikiLink } from '../lib/wikilinks'

interface Props {
  text: string
  onNavigate?: (link: WikiLink) => void
}

export default function WikiText({ text, onNavigate }: Props) {
  const links = parseWikiLinks(text)
  const segments = segmentText(text, links)

  return (
    <span>
      {segments.map((seg, i) => {
        if (seg.type === 'link') {
          return (
            <span
              key={i}
              onClick={(e) => { e.stopPropagation(); onNavigate?.(seg.link!) }}
              className="inline text-blue-400 bg-blue-500/10 px-1 rounded cursor-pointer hover:bg-blue-500/20 hover:underline"
              title={`链接到: ${seg.link!.target}`}
            >
              {seg.content}
            </span>
          )
        }
        return <span key={i}>{seg.content}</span>
      })}
    </span>
  )
}
