"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const extractText = (node: ReactNode): string => {
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(extractText).join("");
    if (node && typeof node === "object" && "props" in node) {
      const el = node as ReactElement<{ children?: ReactNode }>;
      return extractText(el.props.children);
    }
    return "";
  };

  const codeText = extractText(children).replace(/\n$/, "");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="group relative isolate my-4 mb-5 overflow-hidden rounded-xl">
      <pre className="relative overflow-x-auto bg-[#1e1e1e] p-4 pt-10 text-[13px] leading-6 text-gray-100">
        <button
          type="button"
          onClick={handleCopy}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-white/10 bg-black/50 px-2 py-1 text-xs text-gray-200 transition-colors hover:bg-black/70"
          title="复制代码"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "已复制" : "复制"}
        </button>
        {children}
      </pre>
    </div>
  );
}

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="chat-markdown text-[15px] text-gray-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-4 text-xl font-semibold text-gray-900 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-4 text-lg font-semibold text-gray-900 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-3 text-base font-semibold text-gray-900 first:mt-0">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-3 leading-7 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1.5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1.5">{children}</ol>,
          li: ({ children }) => <li className="leading-7">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-4 border-gray-300 pl-4 text-gray-600">{children}</blockquote>
          ),
          hr: () => <hr className="my-4 border-gray-200" />,
          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
          em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          code: ({ className, children, ...props }) => {
            if (className) {
              return (
                <code className={`font-mono ${className}`} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded-md bg-gray-200/70 px-1.5 py-0.5 font-mono text-[0.9em] text-gray-800"
                {...props}
              >
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border border-gray-200 px-3 py-2">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
