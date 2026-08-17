/**
 * Utility functions for parsing metadata and preserving uploaded HTML proposals.
 */

export interface ParsedHtmlResult {
  title: string;
  clientName: string;
  content: string;
  isCustomHtml: boolean;
}

export function parseUploadedHtml(html: string, fallbackFileName?: string): ParsedHtmlResult {
  let title = '';
  let clientName = '';
  const content = html.trim();

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract Title: <title> tag, or first <h1>, or fallback to file name
    const titleTag = doc.querySelector('title');
    if (titleTag && titleTag.textContent?.trim()) {
      title = titleTag.textContent.trim();
    } else {
      const h1Tag = doc.querySelector('h1');
      if (h1Tag && h1Tag.textContent?.trim()) {
        title = h1Tag.textContent.trim();
      } else if (fallbackFileName) {
        title = fallbackFileName.replace(/\.(html|htm)$/i, '').replace(/[-_]/g, ' ');
      }
    }

    // Attempt to extract client name from common patterns
    const bodyText = doc.body?.textContent || '';
    const clientMatch = bodyText.match(/(?:prepared for|client|for|attention|attn):\s*([A-Za-z0-9\s&.,'-]{2,50})/i);
    if (clientMatch && clientMatch[1]) {
      clientName = clientMatch[1].trim();
    }
  } catch (err) {
    console.error('Error extracting HTML metadata:', err);
  }

  const isCustomHtml = html.includes('<!DOCTYPE') || html.includes('<html') || html.includes('<head') || html.includes('<body') || html.includes('<style') || html.includes('<script');

  return {
    title: title || (fallbackFileName ? fallbackFileName.replace(/\.(html|htm)$/i, '').replace(/[-_]/g, ' ') : 'Custom HTML Webpage Proposal'),
    clientName: clientName || '',
    content: content || html,
    isCustomHtml: true,
  };
}
