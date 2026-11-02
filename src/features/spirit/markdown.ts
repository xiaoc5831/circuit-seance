/**
 * Markdown → HTML for spirit text. Raw HTML in the source is escaped first, so a
 * model answer can never inject markup or scripts into the page.
 */
import { marked } from 'marked';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderMarkdown(md: string): string {
  return marked.parse(esc(md), { async: false, gfm: true, breaks: true }) as string;
}
