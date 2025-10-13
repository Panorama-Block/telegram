'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface FormattedMessageProps {
  content: string;
  isAgent?: boolean;
}

export function FormattedMessage({ content, isAgent = false }: FormattedMessageProps) {
  // For user messages, keep simple text rendering
  if (!isAgent) {
    return <span className="whitespace-pre-wrap break-words">{content}</span>;
  }

  // For agent messages, apply ChatGPT-like formatting
  const formatContent = (text: string): string => {
    let formatted = text;

    // Step 1: Add line breaks before and after ALL headers (###, ##, #)
    // This is CRITICAL for markdown parsing
    formatted = formatted.replace(/([^\n])(#{1,6}\s)/g, '$1\n\n$2');
    formatted = formatted.replace(/(#{1,6}\s[^\n]+)([^\n])/g, '$1\n\n$2');

    // Step 2: Add line breaks before ALL bullet points (*)
    // Handle both "text * item" and "text. * item"
    formatted = formatted.replace(/([^\n])(\s*\*\s+)/g, (match, before, star) => {
      // Don't add break if already at start of line or if it's part of **bold**
      if (before === '\n' || match.includes('**')) {
        return match;
      }
      return `${before}\n${star}`;
    });

    // Step 3: Handle numbered lists - add breaks before them
    formatted = formatted.replace(/([.!?:)])\s+(\d+\.\s+)/g, '$1\n\n$2');

    // Step 4: Ensure proper spacing between consecutive list items
    // Pattern: "end of item. 2. Next item"
    formatted = formatted.replace(/(\d+\.\s+[^\n]+[.!?])\s+(\d+\.\s+)/g, '$1\n\n$2');

    // Step 5: Clean up: remove triple+ newlines
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    // Step 6: Ensure headers that end a sentence get proper spacing
    formatted = formatted.replace(/:\s+(###?\s)/g, ':\n\n$1');

    return formatted.trim();
  };

  const formattedContent = formatContent(content);

  // Debug: log the formatted content to see what's being rendered
  if (process.env.NODE_ENV === 'development') {
    console.log('=== FormattedMessage Debug ===');
    console.log('Original (first 300 chars):', content.substring(0, 300));
    console.log('Formatted (first 300 chars):', formattedContent.substring(0, 300));
    console.log('Has ###?:', content.includes('###'));
    console.log('Has **?:', content.includes('**'));
    console.log('Has bullets (*)?:', /\s\*\s/.test(content));
  }

  return (
    <div className="formatted-message prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Style paragraphs
          p: ({ children }) => (
            <p className="mb-4 last:mb-0 leading-[1.7] text-[15px] text-gray-200">
              {children}
            </p>
          ),

          // Style strong/bold text
          strong: ({ children }) => (
            <strong className="font-semibold text-white">
              {children}
            </strong>
          ),

          // Style emphasis/italic text
          em: ({ children }) => (
            <em className="italic text-gray-300">
              {children}
            </em>
          ),

          // Style unordered lists
          ul: ({ children }) => (
            <ul className="mb-4 space-y-2 pl-0 list-none">
              {children}
            </ul>
          ),

          // Style ordered lists
          ol: ({ children }) => (
            <ol className="mb-4 space-y-2 pl-6 list-decimal marker:text-cyan-400 marker:font-medium">
              {children}
            </ol>
          ),

          // Style list items
          li: ({ children, node, ...props }) => {
            // Check if parent is an ordered list by checking if it has a start attribute or list-style
            const hasOrderedClass = props.className?.includes('list-decimal');
            const parentIsOl = hasOrderedClass || (node?.tagName === 'li' && (props as any).ordered);

            if (parentIsOl) {
              return (
                <li className="text-gray-200 leading-[1.7] text-[15px] pl-2" {...props}>
                  <span className="inline-block">{children}</span>
                </li>
              );
            }

            // Unordered list with custom bullet
            return (
              <li className="text-gray-200 leading-[1.7] text-[15px] flex items-start" {...props}>
                <span className="text-cyan-400 mr-3 mt-[0.35em] flex-shrink-0 font-bold text-base leading-none">
                  •
                </span>
                <span className="flex-1">{children}</span>
              </li>
            );
          },

          // Style inline code
          code: ({ children, className, ...props }) => {
            const isInline = !(props as any).inline === false && !className;

            if (isInline) {
              return (
                <code
                  className="bg-gray-800/70 text-cyan-300 px-1.5 py-0.5 rounded text-[0.9em] font-mono border border-gray-700/40"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            // Code block
            const language = className?.replace('language-', '') || 'text';
            return (
              <code
                className="block text-cyan-300 text-[13px] font-mono leading-relaxed"
                data-language={language}
                {...props}
              >
                {children}
              </code>
            );
          },

          // Style pre blocks (code blocks)
          pre: ({ children }) => (
            <pre className="bg-gray-900/80 backdrop-blur-sm p-4 rounded-lg overflow-x-auto mb-4 border border-gray-700/50 shadow-md">
              {children}
            </pre>
          ),

          // Style headers
          h1: ({ children }) => (
            <h1 className="text-[18px] font-bold text-white mb-3 mt-6 first:mt-0 leading-tight border-b border-cyan-500/30 pb-2">
              {children}
            </h1>
          ),

          h2: ({ children }) => (
            <h2 className="text-[17px] font-bold text-white mb-3 mt-5 first:mt-0 leading-tight">
              {children}
            </h2>
          ),

          h3: ({ children }) => (
            <h3 className="text-[16px] font-semibold text-white mb-3 mt-4 first:mt-0 leading-tight">
              {children}
            </h3>
          ),

          h4: ({ children }) => (
            <h4 className="text-[15px] font-semibold text-white mb-2 mt-3 first:mt-0 leading-tight">
              {children}
            </h4>
          ),

          // Style links
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline decoration-cyan-400/50 hover:decoration-cyan-300 underline-offset-2 transition-colors"
            >
              {children}
            </a>
          ),

          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-cyan-500/70 pl-4 pr-3 py-2 my-4 bg-gray-800/40 backdrop-blur-sm rounded-r italic text-gray-300 text-[15px]">
              {children}
            </blockquote>
          ),

          // Style horizontal rules
          hr: () => (
            <hr className="my-6 border-t border-gray-700/50" />
          ),

          // Style tables (GFM support)
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-gray-700/50">
              <table className="min-w-full divide-y divide-gray-700">
                {children}
              </table>
            </div>
          ),

          thead: ({ children }) => (
            <thead className="bg-gray-800/60">
              {children}
            </thead>
          ),

          tbody: ({ children }) => (
            <tbody className="divide-y divide-gray-700/30 bg-gray-900/20">
              {children}
            </tbody>
          ),

          tr: ({ children }) => (
            <tr className="hover:bg-gray-800/30 transition-colors">
              {children}
            </tr>
          ),

          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-[13px] font-semibold text-white border-r border-gray-700/30 last:border-r-0">
              {children}
            </th>
          ),

          td: ({ children }) => (
            <td className="px-4 py-2 text-[14px] text-gray-200 border-r border-gray-700/20 last:border-r-0">
              {children}
            </td>
          ),

          // Style inline breaks
          br: () => <br className="my-1" />,
        }}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
}
