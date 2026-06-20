import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createLowlight } from 'lowlight'
import { visit } from 'unist-util-visit'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import ini from 'highlight.js/lib/languages/ini'
import 'highlight.js/styles/github.css'

const lowlight = createLowlight({ bash, json, ini })
lowlight.registerAlias({ ini: ['toml'], bash: ['sh', 'shell'] })

function rehypeShellHighlight() {
  return (tree: unknown) => {
    visit(tree as never, 'element', (node: any, _index, parent: any) => {
      if (node.tagName !== 'code' || !parent || parent.tagName !== 'pre') {
        return
      }

      const classes: unknown = node.properties?.className
      const languageClass = Array.isArray(classes)
        ? (classes.find((entry) => typeof entry === 'string' && entry.startsWith('language-')) as string | undefined)
        : undefined

      const language = languageClass?.slice('language-'.length)

      if (!language || !lowlight.registered(language)) {
        return
      }

      const text = node.children.map((child: any) => (child.type === 'text' ? child.value : '')).join('')
      const result = lowlight.highlight(language, text)

      node.properties.className = [...(Array.isArray(classes) ? classes : []), 'hljs']
      node.children = result.children
    })
  }
}

const repoBlobBase = 'https://github.com/DavidBelicza/Magento-MCP-Server/blob/main/'
const repoRawBase = 'https://raw.githubusercontent.com/DavidBelicza/Magento-MCP-Server/main/'

function toAbsolute(url: string | undefined, base: string): string | undefined {
  if (!url || /^(https?:|mailto:|#|data:)/i.test(url)) {
    return url
  }

  return base + url.replace(/^\.?\//, '')
}

export const Markdown: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="min-w-0 break-words text-sm leading-6 text-gray-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeShellHighlight]}
        components={{
          h1: ({ children }) => <h1 className="mt-6 mb-3 text-2xl font-bold text-gray-900 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-6 mb-3 text-xl font-bold text-gray-900">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-5 mb-2 text-base font-bold text-gray-900">{children}</h3>,
          p: ({ children }) => <p className="my-3">{children}</p>,
          ul: ({ children }) => <ul className="my-3 list-disc pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 list-decimal pl-6">{children}</ol>,
          li: ({ children }) => <li className="my-1">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={toAbsolute(href, repoBlobBase)}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand transition hover:text-brand-hover"
            >
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <img
              src={toAbsolute(typeof src === 'string' ? src : undefined, repoRawBase)}
              alt={alt}
              className="my-4 max-w-full rounded-lg border border-gray-200"
            />
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-4 border-gray-200 pl-4 text-gray-500">{children}</blockquote>
          ),
          code: ({ className, children }) =>
            className?.includes('language-') ? (
              <code className={className}>{children}</code>
            ) : (
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[13px] text-gray-900">{children}</code>
            ),
          pre: ({ children }) => (
            <pre className="my-4 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-[13px] leading-6">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-auto">
              <table className="w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-gray-200 bg-gray-50 px-3 py-2 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-gray-200 px-3 py-2">{children}</td>,
          hr: () => <hr className="my-6 border-gray-200" />
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
