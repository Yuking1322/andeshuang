function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

function sanitizeUrl(url) {
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
    return trimmed
  }

  return ''
}

function renderInline(source) {
  let text = escapeHtml(source)

  text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>')
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const safeUrl = sanitizeUrl(url)
    if (!safeUrl) {
      return label
    }

    return `<a href="${escapeAttribute(safeUrl)}" target="_blank" rel="noreferrer">${label}</a>`
  })

  return text
}

function renderCodeFence(code, language = '') {
  const languageLabel = language ? `<span class="md-code-lang">${escapeHtml(language)}</span>` : ''
  return `<pre class="md-pre">${languageLabel}<code>${escapeHtml(code)}</code></pre>`
}

function renderList(lines, ordered = false) {
  const tag = ordered ? 'ol' : 'ul'
  const items = lines
    .map((line) => {
      const content = ordered
        ? line.replace(/^\s*\d+\.\s+/, '')
        : line.replace(/^\s*[-*+]\s+/, '')
      return `<li>${renderInline(content)}</li>`
    })
    .join('')

  return `<${tag}>${items}</${tag}>`
}

function renderParagraph(lines) {
  return `<p>${lines.map((line) => renderInline(line)).join('<br>')}</p>`
}

export function renderMarkdown(source) {
  if (!source) return ''

  const normalized = String(source).replace(/\r\n/g, '\n').trim()
  if (!normalized) return ''

  const lines = normalized.split('\n')
  const blocks = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index += 1
      continue
    }

    const codeFenceMatch = line.match(/^```([\w-]+)?\s*$/)
    if (codeFenceMatch) {
      const language = codeFenceMatch[1] || ''
      const codeLines = []
      index += 1

      while (index < lines.length && !lines[index].match(/^```\s*$/)) {
        codeLines.push(lines[index])
        index += 1
      }

      if (index < lines.length) {
        index += 1
      }

      blocks.push(renderCodeFence(codeLines.join('\n'), language))
      continue
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      blocks.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`)
      index += 1
      continue
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const listLines = []
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        listLines.push(lines[index])
        index += 1
      }
      blocks.push(renderList(listLines, false))
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const listLines = []
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        listLines.push(lines[index])
        index += 1
      }
      blocks.push(renderList(listLines, true))
      continue
    }

    const paragraphLines = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].match(/^```/) &&
      !lines[index].match(/^(#{1,4})\s+/) &&
      !lines[index].match(/^\s*[-*+]\s+/) &&
      !lines[index].match(/^\s*\d+\.\s+/)
    ) {
      paragraphLines.push(lines[index])
      index += 1
    }

    blocks.push(renderParagraph(paragraphLines))
  }

  return blocks.join('')
}
