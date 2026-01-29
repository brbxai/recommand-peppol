import { CheckCircle2, XCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@core/components/ui/tooltip";

interface VerificationStatusIconProps {
  isVerified: boolean;
}

export function VerificationStatusIcon({ isVerified }: VerificationStatusIconProps) {
  if (isVerified) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <CheckCircle2 className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent>
          <p>Company is verified</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <XCircle className="h-4 w-4 text-destructive" />
      </TooltipTrigger>
      <TooltipContent>
        <p>Company is not verified</p>
      </TooltipContent>
    </Tooltip>
  );
}

