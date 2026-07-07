export type ReportMarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] };

const knownReportHeadings = new Set(['综合结论', '申报优先级', '可行建议', '材料准备清单', '风险与限制']);

function cleanInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .trim();
}

export function renderReportMarkdown(markdown: string): ReportMarkdownBlock[] {
  const blocks: ReportMarkdownBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: 'paragraph', text: cleanInline(paragraphLines.join(' ')) });
    paragraphLines = [];
  }

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push({ type: 'list', ordered: listOrdered, items: listItems });
    listItems = [];
  }

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', level: heading[1].length, text: cleanInline(heading[2]) });
      continue;
    }

    if (knownReportHeadings.has(line)) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', level: 2, text: line });
      continue;
    }

    const unordered = /^[-*+]\s+(.+)$/.exec(line);
    if (unordered) {
      flushParagraph();
      if (listItems.length > 0 && listOrdered) flushList();
      listOrdered = false;
      listItems.push(cleanInline(unordered[1]));
      continue;
    }

    const ordered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (ordered) {
      flushParagraph();
      if (listItems.length > 0 && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(cleanInline(ordered[1]));
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}
