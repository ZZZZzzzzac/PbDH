export function getResourceTextTemplateFields(template: string): string[] {
  return [...new Set([...template.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((match) => match[1].trim()))];
}

export function formatResourceTextTemplate(template: string, fields: Record<string, string>): string {
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, field: string) => fields[field.trim()] ?? "");
}
