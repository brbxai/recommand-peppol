import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

interface SyntaxHighlighterProps {
  code: string;
  language: string;
  className?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function SyntaxHighlighter({
  code,
  language,
  className,
}: SyntaxHighlighterProps) {
  const [highlightedCode, setHighlightedCode] = useState<string>("");

  useEffect(() => {
    const highlightCode = async () => {
      try {
        const html = await codeToHtml(code, {
          lang: language,
          theme: "github-light",
        });
        setHighlightedCode(html);
      } catch (error) {
        console.error("Failed to highlight code:", error);
        setHighlightedCode(`<pre><code>${escapeHtml(code)}</code></pre>`);
      }
    };

    highlightCode();
  }, [code, language]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: highlightedCode }}
      style={{
        fontSize: "12px",
        lineHeight: "1.4",
        height: "100%",
      }}
    />
  );
}
