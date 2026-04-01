import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
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
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const highlightCode = async () => {
      try {
        const html = await codeToHtml(code, {
          lang: language,
          theme: resolvedTheme === "dark" ? "github-dark" : "github-light",
        });
        setHighlightedCode(html);
      } catch (error) {
        console.error("Failed to highlight code:", error);
        setHighlightedCode(`<pre><code>${escapeHtml(code)}</code></pre>`);
      }
    };

    highlightCode();
  }, [code, language, resolvedTheme]);

  return (
    <div
      className={`[&_.shiki]:[background:transparent!important] [&_.shiki]:[background-color:transparent!important] ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: highlightedCode }}
      style={{
        fontSize: "12px",
        lineHeight: "1.4",
        height: "100%",
      }}
    />
  );
}
