import { useDeferredValue, useRef } from "react";
import { cn } from "@core/lib/utils";
import { Textarea } from "@core/components/ui/textarea";
import { SyntaxHighlighter } from "./syntax-highlighter";

interface CodeTextareaProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  language: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
  heightClassName?: string;
}

export function CodeTextarea({
  id,
  value,
  onChange,
  language,
  required,
  className,
  placeholder,
  heightClassName = "h-[420px]",
}: CodeTextareaProps) {
  const highlightRef = useRef<HTMLDivElement>(null);
  const deferredValue = useDeferredValue(value);

  return (
    <div
      className={cn(
        "relative w-full rounded-md bg-transparent dark:bg-input/30",
        heightClassName
      )}
    >
      <div
        ref={highlightRef}
        className={cn(
          "absolute inset-0 overflow-auto pointer-events-none",
          "font-mono text-xs leading-[1.4]",
          "[&_.shiki]:[background:transparent!important] [&_.shiki]:[background-color:transparent!important] [&_.shiki]:m-0 [&_.shiki]:min-h-full",
          "[&_.shiki]:px-3 [&_.shiki]:py-2 [&_.shiki]:overflow-visible"
        )}
      >
        <SyntaxHighlighter
          code={deferredValue || ""}
          language={language}
          className="h-full min-w-full"
        />
      </div>

      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        spellCheck={false}
        wrap="off"
        onScroll={(e) => {
          const el = e.currentTarget;
          const highlight = highlightRef.current;
          if (!highlight) return;
          highlight.scrollTop = el.scrollTop;
          highlight.scrollLeft = el.scrollLeft;
        }}
        className={cn(
          "relative z-10 h-full min-h-0 resize-none",
          "bg-transparent dark:bg-transparent",
          "font-mono text-xs leading-[1.4]",
          "text-transparent caret-foreground",
          "selection:bg-primary/20 selection:text-transparent",
          className
        )}
      />
    </div>
  );
}
