import { Input } from "@core/components/ui/input";
import { useState } from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@core/components/ui/tooltip";

interface RecipientSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function RecipientSelector({ value, onChange }: RecipientSelectorProps) {
  const [inputValue, setInputValue] = useState(value);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          placeholder="0208:1234567894"
          required
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <Info className="h-4 w-4 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm">
              Enter the recipient's Peppol ID. Format:{" "}
              <code>[scheme]:[identifier]</code>
            </p>
            <p className="text-sm mt-2">
              E.g. <code>0208:[Belgian Enterprise Number]</code>
            </p>
            <p className="text-sm mt-2">
              Enter the full Peppol ID including the scheme prefix.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
