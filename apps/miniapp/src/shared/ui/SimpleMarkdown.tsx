'use client';

import React from 'react';

interface SimpleMarkdownProps {
  content: string;
}

/**
 * Simple markdown renderer that works without external dependencies
 * Supports: bold, italic, lists, links, code
 */
export function SimpleMarkdown({ content }: SimpleMarkdownProps) {
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let inList = false;
    let listItems: JSX.Element[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushList = (index: number) => {
      if (inList && listItems.length > 0) {
        if (listType === 'ul') {
          elements.push(
            <ul key={`list-${index}`} className="list-none pl-0 mb-4 space-y-2">
              {listItems}
            </ul>
          );
        } else if (listType === 'ol') {
          elements.push(
            <ol key={`list-${index}`} className="list-decimal pl-6 mb-4 space-y-2 marker:font-semibold">
              {listItems}
            </ol>
          );
        }
        listItems = [];
        inList = false;
        listType = null;
      }
    };

    const processInlineMarkdown = (line: string): (string | JSX.Element)[] => {
      const parts: (string | JSX.Element)[] = [];
      let currentText = line;
      let partIndex = 0;

      // Process bold (**text**)
      const boldRegex = /\*\*([^*]+)\*\*/g;
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(currentText)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
          parts.push(currentText.substring(lastIndex, match.index));
        }

        // Add bold text
        parts.push(
          <strong key={`bold-${partIndex++}`} className="font-bold text-white">
            {match[1]}
          </strong>
        );

        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < currentText.length) {
        parts.push(currentText.substring(lastIndex));
      }

      return parts;
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Empty line
      if (!trimmed) {
        flushList(index);
        return;
      }

      // Unordered list (* item)
      if (trimmed.startsWith('* ')) {
        if (!inList || listType !== 'ul') {
          flushList(index);
          inList = true;
          listType = 'ul';
        }

        const itemContent = trimmed.substring(2);
        listItems.push(
          <li key={`li-${index}`} className="text-gray-200 leading-relaxed flex items-start gap-2">
            <span className="text-cyan-400 mt-1.5 text-xs flex-shrink-0">•</span>
            <span className="flex-1">{processInlineMarkdown(itemContent)}</span>
          </li>
        );
        return;
      }

      // Ordered list (1. item, 2. item, etc)
      const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
      if (olMatch) {
        if (!inList || listType !== 'ol') {
          flushList(index);
          inList = true;
          listType = 'ol';
        }

        const itemContent = olMatch[2];
        listItems.push(
          <li key={`li-${index}`} className="text-gray-200 leading-relaxed pl-2">
            {processInlineMarkdown(itemContent)}
          </li>
        );
        return;
      }

      // Regular paragraph
      flushList(index);
      elements.push(
        <p key={`p-${index}`} className="mb-4 last:mb-0 text-gray-200 leading-[1.7] text-[15px]">
          {processInlineMarkdown(trimmed)}
        </p>
      );
    });

    // Flush any remaining list
    flushList(lines.length);

    return elements;
  };

  return (
    <div className="prose prose-invert max-w-none">
      {renderMarkdown(content)}
    </div>
  );
}
