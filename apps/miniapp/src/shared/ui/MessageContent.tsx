'use client';

import React from 'react';
import { SimpleMarkdown } from './SimpleMarkdown';

// Try to import React Markdown dependencies (may not be installed yet)
let ReactMarkdown: any;
let remarkGfm: any;
let rehypeSanitize: any;
let rehypeHighlight: any;
let hasMarkdownDeps = false;

try {
  ReactMarkdown = require('react-markdown').default;
  remarkGfm = require('remark-gfm').default;
  rehypeSanitize = require('rehype-sanitize').default;
  rehypeHighlight = require('rehype-highlight').default;
  require('highlight.js/styles/github-dark.css');
  hasMarkdownDeps = true;
} catch (e) {
  console.warn('[MessageContent] React Markdown dependencies not installed, using fallback renderer');
  hasMarkdownDeps = false;
}

interface MessageContentProps {
  content: string;
  role: 'user' | 'assistant';
}

/**
 * Pre-processes plain text to add proper line breaks and formatting
 * Handles mixed markdown/plain text from backend
 */
function preprocessText(text: string): string {
  let processed = text;

  // Step 1: Fix bullet points FIRST - protect them with a placeholder
  // Pattern: "* Text:** description" -> "* **Text:** description"
  const bulletMatches: Array<{ placeholder: string; replacement: string }> = [];
  let bulletIndex = 0;

  processed = processed.replace(/\*\s+([A-Z][a-zA-Z\s'.-]+):\*\*/g, (match, captured) => {
    const placeholder = `__BULLET_${bulletIndex}__`;
    bulletMatches.push({
      placeholder,
      replacement: `* **${captured}:**`
    });
    bulletIndex++;
    return placeholder;
  });

  // Step 2: Fix malformed bold syntax where ** comes after the text instead of wrapping it
  // Pattern: "Title:** text" -> "**Title:** text"
  // This won't affect the placeholders
  processed = processed.replace(/([A-Z][a-zA-Z\s'-]+):\*\*/g, '**$1:**');

  // Step 3: Restore the bullet points
  bulletMatches.forEach(({ placeholder, replacement }) => {
    processed = processed.replace(placeholder, replacement);
  });

  // Step 3: Add line breaks before numbered list items (1., 2., 3., etc.)
  // Match patterns like ": 1. " or ". 2. "
  processed = processed.replace(/([.:?!])\s+(\d+\.)\s+/g, '$1\n\n$2 ');

  // Step 4: Add line breaks before bullet points when they follow a period or colon
  processed = processed.replace(/([.:])\s+(\*\s+)/g, '$1\n\n$2');

  // Step 5: Add line breaks before bullets that come after bold titles with colon (:**)
  // This handles cases like "Title:** * Item"
  processed = processed.replace(/:\*\*\s+\*\s+/g, ':**\n\n* ');

  // Step 6: Add line breaks before standalone bullet points at sentence boundaries
  // This catches cases where there's a sentence ending followed by a bullet
  processed = processed.replace(/(\w\.)\s+(\*\s+\*\*)/g, '$1\n\n$2');

  // Step 7: Ensure proper spacing between list items
  // When we have a sentence ending and then a number or bullet, add double newline
  processed = processed.replace(/([a-z]\.)\s+(\d+\.\s+\*\*)/g, '$1\n\n$2');
  processed = processed.replace(/([a-z]\.)\s+(\*\s+\*\*)/g, '$1\n\n$2');

  // Step 8: Handle nested bullets (sub-items with just one asterisk after double newline)
  processed = processed.replace(/\n\n\*\s+([A-Z])/g, '\n\n* $1');

  return processed.trim();
}

/**
 * MessageContent component that renders markdown content with:
 * - GitHub Flavored Markdown (tables, task lists, strikethrough)
 * - Syntax highlighting for code blocks
 * - Sanitization to prevent XSS
 * - ChatGPT/Claude AI-like formatting with proper headers, lists, and bold text
 * - Automatic text preprocessing for plain text without markdown
 */
export function MessageContent({ content, role }: MessageContentProps) {
  // Preprocess the content to add proper line breaks
  const processedContent = preprocessText(content);

  // Use fallback renderer if React Markdown is not installed
  if (!hasMarkdownDeps) {
    return <SimpleMarkdown content={processedContent} />;
  }

  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize, rehypeHighlight]}
        components={{
          // Custom styling for different markdown elements (ChatGPT-like)
          p: ({ children }) => (
            <p className="mb-4 last:mb-0 text-gray-200 leading-[1.7] text-[15px]">
              {children}
            </p>
          ),
          h1: ({ children }) => (
            <h1 className="text-[22px] font-bold mb-4 mt-6 first:mt-0 text-white leading-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[19px] font-bold mb-3 mt-5 first:mt-0 text-white leading-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[17px] font-semibold mb-2 mt-4 first:mt-0 text-white leading-tight">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="list-none pl-0 mb-4 space-y-2 text-gray-200">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 mb-4 space-y-2 text-gray-200 marker:font-semibold">
              {children}
            </ol>
          ),
          li: ({ children, node, ...props }) => {
            // Check if this is inside an unordered list
            const isUnordered = !props.className?.includes('decimal');

            if (isUnordered) {
              return (
                <li className="text-gray-200 leading-relaxed flex items-start gap-2">
                  <span className="text-cyan-400 mt-1.5 text-xs">•</span>
                  <span className="flex-1">{children}</span>
                </li>
              );
            }

            return (
              <li className="text-gray-200 leading-relaxed pl-2" {...props}>
                {children}
              </li>
            );
          },
          strong: ({ children }) => (
            <strong className="font-bold text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-100">{children}</em>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline transition-colors"
            >
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;

            if (isInline) {
              // Inline code (ChatGPT style)
              return (
                <code
                  className="bg-gray-800/80 text-cyan-300 px-1.5 py-0.5 rounded text-[13px] font-mono border border-gray-700/50"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            // Code block (will be handled by rehype-highlight)
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-gray-900/90 rounded-md p-4 mb-4 overflow-x-auto border border-gray-700/50 shadow-sm">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-[3px] border-cyan-500/70 pl-4 pr-2 py-2 my-4 bg-gray-800/30 rounded-r text-gray-300 italic text-[15px]">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border border-gray-700">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-800">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="bg-gray-900">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-gray-700">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-white font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-gray-200">{children}</td>
          ),
          hr: () => <hr className="my-6 border-gray-700" />,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
