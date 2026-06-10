"use client";

import { memo, useDeferredValue, useState, type ReactElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

/** 流式末尾补全未闭合标记，减少 ** ` 等符号裸露 */
export function stabilizeStreamingMarkdown(text: string): string {
  if (!text) return text;
  let s = text;

  const fences = s.match(/```/g);
  if (fences && fences.length % 2 === 1) {
    s += "\n```";
  }

  const inlineTicks = s.match(/(?<!`)`(?!`)/g);
  if (inlineTicks && inlineTicks.length % 2 === 1) {
    s += "`";
  }

  if ((s.split("**").length - 1) % 2 === 1) {
    s += "**";
  }

  return s;
}

function extractText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    const el = node as ReactElement<{ children?: ReactNode }>;
    return extractText(el.props.children);
  }
  return "";
}

function extractTableAsTsv(node: ReactNode): string {
  const rows: string[][] = [];

  const collectRowCells = (rowChildren: ReactNode) => {
    const cells: string[] = [];
    const items = Array.isArray(rowChildren) ? rowChildren : [rowChildren];
    for (const item of items) {
      if (!item || typeof item !== "object" || !("props" in item)) continue;
      const el = item as ReactElement<{ children?: ReactNode }>;
      cells.push(extractText(el.props.children).replace(/\s+/g, " ").trim());
    }
    if (cells.length > 0) rows.push(cells);
  };

  const walk = (n: ReactNode) => {
    if (!n) return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (n && typeof n === "object" && "props" in n) {
      const el = n as ReactElement<{ children?: ReactNode }>;
      const tag = typeof el.type === "string" ? el.type : "";
      if (tag === "tr") {
        collectRowCells(el.props.children);
      } else {
        walk(el.props.children);
      }
    }
  };

  walk(node);
  return rows.map((row) => row.join("\t")).join("\n");
}

function CopyButton({
  text,
  title,
  className,
}: {
  text: string;
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        className ??
        "flex items-center gap-1 rounded-md border border-gray-200 bg-white/90 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-white"
      }
      title={title}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "已复制" : "复制"}
    </button>
  );
}

function CodeBlock({ children }: { children: ReactNode }) {
  const codeText = extractText(children).replace(/\n$/, "");

  return (
    <div className="group relative isolate my-4 overflow-hidden rounded-xl">
      <pre className="relative overflow-x-auto bg-[#0d0d0d] p-4 pt-10 text-[13px] leading-6 text-gray-100">
        <CopyButton
          text={codeText}
          title="复制代码"
          className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-white/10 bg-black/50 px-2 py-1 text-xs text-gray-200 transition-colors hover:bg-black/70"
        />
        {children}
      </pre>
    </div>
  );
}

function TableBlock({ children }: { children: ReactNode }) {
  const tableText = extractTableAsTsv(children);

  return (
    <div className="group relative isolate my-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="absolute right-2 top-2 z-10">
        <CopyButton text={tableText} title="复制表格" />
      </div>
      <div className="overflow-x-auto px-1 pb-1 pt-10">
        <table className="min-w-full border-collapse text-[15px]">{children}</table>
      </div>
    </div>
  );
}

const markdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-2 mt-6 text-[1.375rem] font-semibold leading-snug text-[#0d0d0d] first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mb-2 mt-6 text-[1.125rem] font-semibold leading-snug text-[#0d0d0d] first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-1.5 mt-5 text-base font-semibold leading-snug text-[#0d0d0d] first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-4 leading-[1.75] text-[#0d0d0d] last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-4 ml-6 list-disc space-y-2 leading-[1.75]">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mb-4 ml-6 list-decimal space-y-2 leading-[1.75]">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="my-4 border-l-2 border-gray-300 pl-4 text-[#5d5d5d]">{children}</blockquote>
  ),
  hr: () => <hr className="my-6 border-0 border-t border-gray-200" />,
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-[#0d0d0d]">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => <em className="text-[#0d0d0d]">{children}</em>,
  pre: ({ children }: { children?: ReactNode }) => <CodeBlock>{children}</CodeBlock>,
  code: ({
    className,
    children,
    ...props
  }: {
    className?: string;
    children?: ReactNode;
  }) => {
    if (className) {
      return (
        <code className={`font-mono ${className}`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-[#ececec] px-1 py-0.5 font-mono text-[0.875em] text-[#0d0d0d]"
        {...props}
      >
        {children}
      </code>
    );
  },
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[#2964aa] underline underline-offset-2 hover:text-[#1d4f8c]"
    >
      {children}
    </a>
  ),
  table: ({ children }: { children?: ReactNode }) => <TableBlock>{children}</TableBlock>,
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-[14px] font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border border-gray-200 px-3 py-2 text-[15px]">{children}</td>
  ),
};

export const MarkdownMessage = memo(function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="chat-markdown text-base text-[#0d0d0d]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
});

/** 流式 + 完成态统一走 Markdown，过程中即按格式渲染 */
export function AssistantMarkdown({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  const deferred = useDeferredValue(content);
  const raw = streaming ? deferred : content;
  const display = streaming ? stabilizeStreamingMarkdown(raw) : raw || "...";

  if (streaming && !display) {
    return <span className="inline-block h-5 w-2 animate-pulse rounded-sm bg-gray-300" />;
  }

  return (
    <div className="min-w-0">
      <MarkdownMessage content={display} />
      {streaming && (
        <span
          className="ml-0.5 inline-block h-[1.1em] w-0.5 translate-y-px animate-pulse bg-[#0d0d0d]/70 align-text-bottom"
          aria-hidden
        />
      )}
    </div>
  );
}
