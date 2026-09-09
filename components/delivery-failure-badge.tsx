import { Badge } from "@core/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@core/components/ui/tooltip";
import { useTranslation } from "@core/hooks/use-translation";

type DeliveryFailureBadgeProps = {
  failure: {
    code: string | null;
    message: string | null;
    category: string | null;
  } | null | undefined;
  size?: "sm" | "md";
};

/**
 * Marks an outgoing document the access point accepted and then reported as failed.
 * The transmission icons next to it still say the document went over Peppol, which
 * it did; this says it did not arrive.
 */
export function DeliveryFailureBadge({ failure, size = "md" }: DeliveryFailureBadgeProps) {
  const { t } = useTranslation();
  if (!failure) {
    return null;
  }

  const details: string[] = [t`The access point could not deliver this document.`];
  if (failure.message) {
    details.push(failure.message);
  }
  if (failure.code) {
    details.push(t`Error code ${failure.code}.`);
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="destructive" className={size === "sm" ? "text-xs" : undefined}>
          {t`Delivery failed`}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="max-w-sm space-y-1 text-xs">
          {details.map((detail) => (
            <p key={detail}>{detail}</p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
