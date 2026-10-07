import type { ReactNode } from 'react'

// An assistant answer, written by the AI in light Markdown, shown as formatted
// text: paragraphs, headings, bullet and numbered lists (nested by indent),
// **bold**, *italic* and `code`. Dates written as 2026-10-09 read as "9 Oct".
// Everything becomes React elements, never HTML from the answer.
//
// With `reveal`, each block rises in one after another (a new answer); the
// whole text is in the page at once for screen readers.

type Block = { kind: 'heading'; text: string } | { kind: 'para'; lines: string[] } | { kind: 'list'; items: Item[] }

interface Item {
  indent: number
  ordered: boolean
  number: number
  lines: string[]
}

interface Node extends Item {
  children: Node[]
}

const LIST_ITEM = /^(\s*)([-*•]|(\d+)[.)])\s+(.*)$/
const HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/

function parse(text: string): Block[] {
  const blocks: Block[] = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  let para: string[] | null = null
  let list: Item[] | null = null

  const endPara = () => {
    if (para?.length) blocks.push({ kind: 'para', lines: para })
    para = null
  }
  const endList = () => {
    if (list?.length) blocks.push({ kind: 'list', items: list })
    list = null
  }

  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) {
      endPara()
      // A blank line between list items (or before an indented line) keeps the list going.
      const next = lines.slice(i + 1).find((l) => l.trim())
      if (list && !(next && (LIST_ITEM.test(next) || /^\s{2,}\S/.test(next)))) endList()
      return
    }
    const heading = HEADING.exec(line)
    if (heading) {
      endPara()
      endList()
      blocks.push({ kind: 'heading', text: heading[1] })
      return
    }
    const item = LIST_ITEM.exec(line)
    if (item) {
      endPara()
      list ??= []
      list.push({
        indent: item[1].length,
        ordered: item[3] !== undefined,
        number: item[3] ? Number(item[3]) : 1,
        lines: [item[4]],
      })
      return
    }
    if (list && /^\s+\S/.test(raw)) {
      // An indented line under a list item continues it.
      list[list.length - 1].lines.push(line.trim())
      return
    }
    endList()
    para ??= []
    para.push(line.trim())
  })
  endPara()
  endList()
  return blocks
}

/** Nests list items by indent. */
function tree(items: Item[]): Node[] {
  const roots: Node[] = []
  const stack: Node[] = []
  for (const item of items) {
    const node: Node = { ...item, children: [] }
    while (stack.length && stack[stack.length - 1].indent >= item.indent) stack.pop()
    const parent = stack[stack.length - 1]
    if (parent) parent.children.push(node)
    else roots.push(node)
    stack.push(node)
  }
  return roots
}

const thisYear = new Date().getFullYear()
const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const longDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** 2026-10-09 → "9 Oct" (with the year when it isn't this year). */
function readableDates(text: string) {
  return text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (match, y, m, d) => {
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    if (Number.isNaN(date.getTime()) || date.getMonth() !== Number(m) - 1) return match
    return (date.getFullYear() === thisYear ? shortDate : longDate).format(date)
  })
}

/** **bold**, *italic* and `code` within a line. */
function inline(text: string): ReactNode[] {
  const parts = readableDates(text).split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*)/)
  return parts.map((part, i) => {
    if (/^(\*\*|__).+\1$/.test(part)) {
      return (
        <strong key={i} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (/^`.+`$/.test(part)) {
      return (
        <code key={i} className="rounded bg-surface px-1 py-0.5 font-mono text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (/^\*.+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}

/** Lines that belong together, with line breaks between them. */
function Lines({ lines }: { lines: string[] }) {
  return lines.map((line, i) => (
    <span key={i}>
      {i > 0 ? <br /> : null}
      {inline(line)}
    </span>
  ))
}

function List({ nodes }: { nodes: Node[] }) {
  // Runs of numbered and bulleted items each get their own list.
  const runs: Node[][] = []
  for (const node of nodes) {
    const last = runs[runs.length - 1]
    if (last && last[0].ordered === node.ordered) last.push(node)
    else runs.push([node])
  }
  return runs.map((run, i) => {
    const items = run.map((node, j) => (
      <li key={j} className="pl-1 marker:font-semibold marker:text-ink-muted">
        <Lines lines={node.lines} />
        {node.children.length ? (
          <div className="mt-1 text-[0.95em] text-ink-muted">
            <List nodes={node.children} />
          </div>
        ) : null}
      </li>
    ))
    return run[0].ordered ? (
      <ol key={i} start={run[0].number} className="grid list-decimal gap-1.5 pl-5">
        {items}
      </ol>
    ) : (
      <ul key={i} className="grid list-disc gap-1.5 pl-5">
        {items}
      </ul>
    )
  })
}

export function AnswerText({ text, reveal = false }: { text: string; reveal?: boolean }) {
  const blocks = parse(text)
  return (
    <div className="grid gap-3 leading-relaxed">
      {blocks.map((block, i) => {
        const style = reveal ? { animationDelay: `${i * 180}ms` } : undefined
        const rise = reveal ? 'animate-rise' : undefined
        if (block.kind === 'heading') {
          return (
            <p key={i} className={`-mb-1 font-bold text-ink ${rise ?? ''}`} style={style}>
              {inline(block.text)}
            </p>
          )
        }
        if (block.kind === 'list') {
          return (
            <div key={i} className={rise} style={style}>
              <List nodes={tree(block.items)} />
            </div>
          )
        }
        return (
          <p key={i} className={rise} style={style}>
            <Lines lines={block.lines} />
          </p>
        )
      })}
    </div>
  )
}
