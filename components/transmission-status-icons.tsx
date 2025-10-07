import { CloudAlert, Mail } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@core/components/ui/tooltip";

interface TransmissionStatusIconsProps {
  sentOverPeppol: boolean;
  sentOverEmail: boolean;
  emailRecipients?: string[];
}

export function TransmissionStatusIcons({ 
  sentOverPeppol, 
  sentOverEmail, 
  emailRecipients 
}: TransmissionStatusIconsProps) {
  return (
    <div className="flex items-center gap-1">
      {!sentOverPeppol && (
        <Tooltip>
          <TooltipTrigger asChild>
            <CloudAlert className="h-4 w-4 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent>
            <p>Not sent over Peppol network</p>
          </TooltipContent>
        </Tooltip>
      )}
      {sentOverEmail && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent>
            <div>
              <p className="font-medium">Sent via email to:</p>
              <ul className="mt-1 space-y-1">
                {emailRecipients?.map((email, index) => (
                  <li key={index} className="text-xs">{email}</li>
                ))}
              </ul>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
