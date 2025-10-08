'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';

interface FormattedMessageProps {
  content: string;
  isAgent?: boolean;
}

export function FormattedMessage({ content, isAgent = false }: FormattedMessageProps) {
  // For user messages, keep simple text rendering
  if (!isAgent) {
    return <span>{content}</span>;
  }

  // For agent messages, apply ChatGPT-like formatting
  const formatContent = (text: string): string => {
    let formatted = text;

    // Convert numbered lists to proper markdown format
    formatted = formatted.replace(/^(\d+\.\s+)(.+)$/gm, '$1$2');

    // Ensure proper paragraph breaks before numbered lists
    formatted = formatted.replace(/([.!?])\s*(\d+\.\s+)/g, '$1\n\n$2');

    // Convert bullet points to proper markdown
    formatted = formatted.replace(/\n\s*[-•]\s+/g, '\n- ');

    // Ensure proper spacing after headers
    formatted = formatted.replace(/(\#{1,6}.*)\n([^\n])/g, '$1\n\n$2');

    // Clean up extra whitespace but preserve intentional breaks
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    return formatted;
  };

  const formattedContent = formatContent(content);

  return (
    <div className="formatted-message">
      <ReactMarkdown
        components={{
          // Style paragraphs
          p: ({ children }) => (
            <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>
          ),

          // Style strong text
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),

          // Style lists
          ul: ({ children }) => (
            <ul className="mb-4 space-y-1 pl-0">{children}</ul>
          ),

          ol: ({ children }) => (
            <ol className="mb-4 space-y-1 pl-0">{children}</ol>
          ),

          li: ({ children, ...props }) => {
            return (
              <li className="text-gray-200 leading-relaxed flex items-start" {...props}>
                <span className="text-cyan-400 mr-3 mt-1 flex-shrink-0 text-lg leading-none">•</span>
                <span className="flex-1">{children}</span>
              </li>
            );
          },

          // Style code blocks
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-gray-800 text-cyan-300 px-1.5 py-0.5 rounded text-sm font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-gray-900 text-cyan-300 p-3 rounded-lg text-sm font-mono overflow-x-auto">
                {children}
              </code>
            );
          },

          // Style pre blocks
          pre: ({ children }) => (
            <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto mb-4 border border-gray-700">
              {children}
            </pre>
          ),

          // Style headers
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-white mb-3 mt-4 first:mt-0">{children}</h1>
          ),

          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-white mb-3 mt-4 first:mt-0">{children}</h2>
          ),

          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-white mb-2 mt-3 first:mt-0">{children}</h3>
          ),

          // Style links
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline transition-colors"
            >
              {children}
            </a>
          ),

          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-cyan-500 pl-4 py-2 my-4 bg-gray-800/30 italic text-gray-300">
              {children}
            </blockquote>
          ),
        }}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
}