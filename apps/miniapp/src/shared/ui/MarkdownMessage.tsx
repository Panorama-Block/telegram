import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark'
// Register a few common languages (fallback to plain if not matched)
import ts from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import js from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'

SyntaxHighlighter.registerLanguage('ts', ts)
SyntaxHighlighter.registerLanguage('tsx', ts)
SyntaxHighlighter.registerLanguage('typescript', ts)
SyntaxHighlighter.registerLanguage('js', js)
SyntaxHighlighter.registerLanguage('javascript', js)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('sh', bash)
SyntaxHighlighter.registerLanguage('json', json)

interface MarkdownMessageProps {
  text: string
}

// Renders assistant messages using Markdown with safe defaults and design-system styles.
// Uses a "prose-like" wrapper that adds vertical rhythm between block elements.
export function MarkdownMessage({ text }: MarkdownMessageProps) {
  return (
    <div className="max-w-none space-y-3 text-[14px] leading-relaxed text-gray-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-xl sm:text-2xl font-bold text-white mt-4 mb-2" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-lg sm:text-xl font-semibold text-white mt-4 mb-2" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-base sm:text-lg font-semibold text-white mt-3 mb-1.5" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="text-sm sm:text-base font-semibold text-white mt-3 mb-1" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="text-[14px] text-gray-200 leading-relaxed mb-2" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-white" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="text-gray-300 italic" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-5 space-y-1.5 text-gray-200 my-2" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-5 space-y-1.5 text-gray-200 my-2" {...props} />
          ),
          li: ({ node, children, ...props }) => (
            <li className="leading-relaxed text-gray-200" {...props}>
              {children}
            </li>
          ),
          a: ({ node, ...props }) => (
            <a className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...props} />
          ),
          hr: () => <hr className="my-4 border-cyan-500/20" />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-cyan-500/40 pl-3 my-3 text-gray-300 italic" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-gray-700/50">
              <table className="w-full text-left border-collapse text-sm" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-gray-800/60" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-3 py-2 border-b border-cyan-500/20 text-gray-200 font-semibold" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3 py-2 border-b border-gray-700/30 text-gray-300" {...props} />
          ),
          // Use `any` typing here to avoid strict mismatch with react-markdown v9 CodeProps
          code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            if (inline || !match) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-gray-800/80 border border-cyan-500/20 text-cyan-300 font-mono text-[0.85em]"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            const language = match[1]
            return (
              <SyntaxHighlighter
                style={oneDark as any}
                language={language}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  borderRadius: '0.5rem',
                  background: 'rgba(31,31,31,0.9)',
                  border: '1px solid rgba(0,217,255,0.15)',
                  padding: '0.75rem',
                }}
                codeTagProps={{ className: 'font-mono text-[0.85em]' }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            )
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownMessage
