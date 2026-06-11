import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../client/src/ui/kill-feed';

describe('escapeHtml', () => {
  it('escapes all HTML-significant characters', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('neutralizes a 16-char svg onload payload that fits the name length limit', () => {
    const payload = '<svg onload=a()>';
    expect(payload.length).toBe(16);
    const escaped = escapeHtml(payload);
    expect(escaped).toBe('&lt;svg onload=a()&gt;');
    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
  });

  it('neutralizes img onerror payloads', () => {
    const escaped = escapeHtml('<img src=x onerror=alert(1)>');
    expect(escaped.startsWith('&lt;img')).toBe(true);
    expect(escaped).not.toContain('<img');
  });

  it('escapes quotes so names cannot break out of attribute context', () => {
    expect(escapeHtml('" onmouseover="x')).toBe('&quot; onmouseover=&quot;x');
  });

  it('leaves benign call signs untouched', () => {
    expect(escapeHtml('NovaStriker_42')).toBe('NovaStriker_42');
    expect(escapeHtml('')).toBe('');
  });

  it('escapes every occurrence, not just the first', () => {
    expect(escapeHtml('<<>>')).toBe('&lt;&lt;&gt;&gt;');
  });
});
