import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

interface SyntaxHighlighterProps {
  code: string;
  language: string;
  className?: string;
}

export function SyntaxHighlighter({
  code,
  language,
  className,
}: SyntaxHighlighterProps) {
  const [highlightedCode, setHighlightedCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const highlightCode = async () => {
      try {
        setIsLoading(true);
        const html = await codeToHtml(code, {
          lang: language,
          theme: "github-light",
        });
        setHighlightedCode(html);
      } catch (error) {
        console.error("Failed to highlight code:", error);
        // Fallback to plain text
        setHighlightedCode(`<pre><code>${code}</code></pre>`);
      } finally {
        setIsLoading(false);
      }
    };

    highlightCode();
  }, [code, language]);

  if (isLoading) {
    return (
      <div className={`animate-pulse bg-muted rounded ${className}`}>
        <div className="p-4 space-y-2">
          <div className="h-4 bg-muted-foreground/20 rounded w-3/4"></div>
          <div className="h-4 bg-muted-foreground/20 rounded w-1/2"></div>
          <div className="h-4 bg-muted-foreground/20 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

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
