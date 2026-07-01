import type { Components } from "react-markdown";
import { SyntaxHighlighter, oneDark } from "./highlighter";

/**
 * ReactMarkdown `components` override: fenced code blocks (```lang ... ```)
 * render with syntax highlighting; inline `code` stays a plain <code> tag.
 * react-markdown v9+ dropped the `inline` prop — a `language-xxx` className
 * is how remark marks a fenced block, so its absence means inline code.
 */
export const markdownCodeComponents: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? "");
    if (match) {
      return (
        <SyntaxHighlighter
          language={match[1]}
          style={oneDark}
          customStyle={{ margin: 0, borderRadius: "0.75rem", fontSize: "0.9rem" }}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};
