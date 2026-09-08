import ReactMarkdown from "react-markdown";
import remarkDirective from "remark-directive";
import type { Node } from "unist";

const colorNames = new Set(["red", "orange", "yellow", "green", "blue", "purple", "gray"]);
const blockElements = ["p", "br", "strong", "em", "ol", "ul", "li", "span", "img"];
const inlineElements = ["br", "strong", "em", "span", "img"];

export type RestrictedMarkdownProps = {
  value: string;
  className?: string;
  inline?: boolean;
};

export function RestrictedMarkdown({ value, className, inline = false }: RestrictedMarkdownProps) {
  const Tag = inline ? "span" : "div";
  return <Tag className={className} data-restricted-markdown="true">
    <RestrictedMarkdownRenderer value={value} inline={inline} />
  </Tag>;
}

export function RestrictedMarkdownRenderer({ value, inline = false }: {
  value: string;
  inline?: boolean;
}) {
  const safeValue = typeof value === "string" ? value : "";
  return (
    <ReactMarkdown
      remarkPlugins={[remarkDirective, restrictedColorDirectives, stripEmphasisBoundaries, preserveLineBreaks]}
      rehypePlugins={[removeGeneratedBreakWhitespace]}
      allowedElements={inline ? inlineElements : blockElements}
      unwrapDisallowed
      components={{ img: ({ alt }) => <span>{alt}</span> }}
    >
      {normalizeEmphasisBoundaries(normalizeUnderscoreEmphasis(safeValue))}
    </ReactMarkdown>
  );
}

const emphasisBoundary = "\u200b";

function normalizeUnderscoreEmphasis(value: string): string {
  return value
    .replace(/(^|[^\\_])__([^_\n]+?)__(?!_)/gu, "$1**$2**")
    .replace(/(^|[^\\_])_([^_\n]+?)_(?!_)/gu, "$1*$2*");
}

function normalizeEmphasisBoundaries(value: string): string {
  return value.replace(/\*+/g, (delimiter, offset: number, source: string) => {
    if (delimiter.length > 3 || source[offset - 1] === "\\") return delimiter;
    const before = source[offset - 1];
    const after = source[offset + delimiter.length];
    return (before && !/\s/.test(before)) || (after && !/\s/.test(after))
      ? `${emphasisBoundary}${delimiter}${emphasisBoundary}`
      : delimiter;
  });
}

function stripEmphasisBoundaries() {
  return (tree: Node) => stripBoundaryFromNode(tree);
}

function stripBoundaryFromNode(node: Node): void {
  if ("value" in node && typeof node.value === "string") {
    node.value = node.value.replaceAll(emphasisBoundary, "");
  }
  if ("children" in node && Array.isArray(node.children)) {
    node.children.forEach((child) => stripBoundaryFromNode(child as Node));
  }
}

interface MarkdownNode extends Node {
  children?: MarkdownNode[];
  value?: string;
  tagName?: string;
}

function removeGeneratedBreakWhitespace() {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode): void => {
      if (!node.children || node.tagName === "pre" || node.tagName === "code") return;
      const children = node.children;
      node.children = children.flatMap((child, index) => {
        // 源换行已由 br 表示，移除 HTML 转换器附加的排版换行，避免 pre-wrap 重复显示。
        if (child.type === "text" && children[index - 1]?.tagName === "br" && child.value?.startsWith("\n")) {
          child.value = child.value.slice(1);
        }
        if (child.type === "text" && (!child.value || /^\n+$/.test(child.value))) return [];
        visit(child);
        return [child];
      });
    };
    visit(tree);
  };
}

function preserveLineBreaks() {
  return (tree: MarkdownNode) => {
    replaceSoftBreaks(tree);
    preserveRootBlankLines(tree);
  };
}

function replaceSoftBreaks(node: MarkdownNode): void {
  if (!node.children) return;
  node.children = node.children.flatMap((child) => {
    if (child.type !== "text" || !child.value?.includes("\n")) {
      replaceSoftBreaks(child);
      return child;
    }
    return child.value.split("\n").flatMap((text, index) => [
      ...(index > 0 ? [{ type: "break" } satisfies MarkdownNode] : []),
      ...(text ? [{ ...child, value: text }] : []),
    ]);
  });
}

function preserveRootBlankLines(root: MarkdownNode): void {
  if (root.type !== "root" || !root.children) return;
  const children: MarkdownNode[] = [];
  root.children.forEach((child, index) => {
    const previous = root.children?.[index - 1];
    const blankLines = previous?.position && child.position
      ? child.position.start.line - previous.position.end.line - 1
      : 0;
    for (let line = 0; line < blankLines; line += 1) children.push({ type: "break" });
    children.push(child);
  });
  root.children = children;
}

function restrictedColorDirectives() {
  return (tree: Node) => transformColorDirectives(tree, false);
}

interface DirectiveNode extends Node {
  name: string;
  children?: DirectiveNode[];
  data?: Record<string, unknown>;
}

function isDirectiveNode(node: Node): node is DirectiveNode {
  return node.type.endsWith("Directive") && "name" in node && typeof node.name === "string";
}

function transformColorDirectives(node: Node, insideDirective: boolean): void {
  const directive = isDirectiveNode(node);
  if (directive && !insideDirective && colorNames.has(node.name) && !containsDirective(node.children)) {
    node.data = {
      ...node.data,
      hName: "span",
      hProperties: {
        className: ["restricted-markdown-color"],
        "data-markdown-color": node.name,
      },
    };
  }
  if ("children" in node && Array.isArray(node.children)) {
    node.children.forEach((child) => transformColorDirectives(child as Node, insideDirective || directive));
  }
}

function containsDirective(children: DirectiveNode[] | undefined): boolean {
  return children?.some((child) => child.type.endsWith("Directive") || containsDirective(child.children)) ?? false;
}
