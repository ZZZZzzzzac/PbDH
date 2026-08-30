export function splitMarkdownLabel(value: string, fallbackTitle: string): {
  title: string;
  body: string;
} {
  let bracketDepth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "[") {
      bracketDepth += 1;
      continue;
    }
    if (character === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (index > 0 && bracketDepth === 0 && (character === ":" || character === "：")) {
      return {
        title: value.slice(0, index).trim() || fallbackTitle,
        body: value.slice(index + 1).trim(),
      };
    }
  }
  return { title: fallbackTitle, body: value };
}
