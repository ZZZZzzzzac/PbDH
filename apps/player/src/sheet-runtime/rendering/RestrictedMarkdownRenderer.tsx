import ReactMarkdown from "react-markdown";
import remarkDirective from "remark-directive";
import type { Node } from "unist";

const colorNames = new Set(["red", "orange", "yellow", "green", "blue", "purple", "gray"]);
const allowedElements = ["p", "br", "strong", "em", "ol", "ul", "li", "span", "img"];

export function RestrictedMarkdownRenderer({ value }: { value: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkDirective, restrictedColorDirectives, stripEmphasisBoundaries, preserveLineBreaks]}
      allowedElements={allowedElements}
      unwrapDisallowed
      components={{ img: ({ alt }) => <span>{alt}</span> }}
    >
      {normalizeEmphasisBoundaries(value)}
    </ReactMarkdown>
  );
}

const emphasisBoundary = "\u200b";

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
  return (tree: Node) => {
    transformColorDirectives(tree, false);
  };
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
