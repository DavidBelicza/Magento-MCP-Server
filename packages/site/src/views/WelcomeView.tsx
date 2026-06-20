import React from 'react'
import readme from '../../README.md?raw'
import { Markdown } from '../components/Markdown'
import { Panel, SectionHeader } from '../components/Panel'

export const WelcomeView: React.FC = () => {
  return (
    <div className="grid min-h-full grid-rows-[auto_auto_auto] gap-5">
      <section className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-gray-900 lg:h-64 lg:flex-row lg:items-stretch">
        <div
          role="img"
          aria-label="Magentic logo"
          className="mx-auto mt-6 h-[200px] w-[200px] shrink-0 rounded-lg bg-cover bg-center lg:hidden"
          style={{ backgroundImage: "url('/logo.png')" }}
        />
        <div className="min-w-0 flex-1 overflow-hidden p-6">
          <h2 className="mt-4 text-3xl font-black tracking-wide text-gray-900">Magentic MCP Server</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
            Magentic is a standard <strong className="font-semibold text-gray-900">Model Context Protocol server</strong>{' '}
            that connects to any agentic AI, including <em>Anthropic Claude</em>, <em>OpenAI Codex</em>, and{' '}
            <em>Google Antigravity</em>, as well as the embedded agents in <em>JetBrains</em> and <em>VS Code</em>. It
            provides an <strong className="font-semibold text-gray-900">intelligent layer</strong> over{' '}
            <em>Adobe Commerce</em>, <em>Magento Open Source</em>, <em>MageOS</em>, and other PHP applications, giving an
            agent a precise map of the codebase. Use it as a toolkit for{' '}
            <strong className="font-semibold text-gray-900">code analysis, technical investigations, and architectural
            summaries</strong>.
          </p>
        </div>
        <div
          role="img"
          aria-label="Magentic logo"
          className="hidden aspect-square shrink-0 self-stretch bg-cover bg-center lg:block"
          style={{ backgroundImage: "url('/logo.png')" }}
        />
      </section>

      <section className="grid min-h-0 grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel className="p-5">
          <SectionHeader title="Getting Started" />
          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-6 text-gray-700">
            <li>
              <strong className="font-semibold text-gray-900">Mount your source</strong> so the analyzed-source volume
              points at your PHP/Magento project.
            </li>
            <li>
              <strong className="font-semibold text-gray-900">Configure the analyzer</strong> with the PHP syntax
              version and analyzed subpath in Settings.
            </li>
            <li>
              <strong className="font-semibold text-gray-900">Build the graph</strong> by running indexing to map
              packages, symbols, and their types.
            </li>
            <li>
              <strong className="font-semibold text-gray-900">Connect the MCP server</strong> to your AI agent and
              start querying the graph.
            </li>
          </ul>
        </Panel>

        <Panel className="p-5">
          <SectionHeader title="Useful Links" />
          <div className="mt-5 space-y-3">
            <LinkRow
              title="GitHub repository"
              meta="github.com/DavidBelicza/Magento-MCP-Server"
              href="https://github.com/DavidBelicza/Magento-MCP-Server"
            />
          </div>
        </Panel>
      </section>

      <Panel className="min-w-0 overflow-hidden p-6">
        <SectionHeader title="README" />
        <div className="mt-5 min-w-0">
          <Markdown content={readme} />
        </div>
      </Panel>
    </div>
  )
}

const LinkRow: React.FC<{ title: string; meta: string; href: string }> = ({ title, meta, href }) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block rounded-lg border border-gray-200 bg-white p-4 transition hover:border-slate-300 hover:bg-gray-100"
    >
      <div className="text-sm font-semibold text-gray-900">{title}</div>
      <div className="mt-1 text-xs font-bold text-accent-hover">{meta}</div>
    </a>
  )
}
