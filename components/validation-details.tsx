import type { ValidationResponse } from "@peppol/types/validation";

interface ValidationDetailsProps {
  validation: ValidationResponse;
}

export function ValidationDetails({ validation }: ValidationDetailsProps) {
  return (
    <>
      {validation.errors && validation.errors.length > 0 && (
        <>
          <div className="text-sm font-medium mb-2">Errors:</div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {validation.errors.map((error, index) => (
              <div key={index} className="text-xs border-l-2 border-destructive pl-2">
                {error.fieldName && (
                  <div className="font-medium text-foreground mb-0.5">
                    {error.fieldName}
                  </div>
                )}
                <div className="text-muted-foreground">
                  {error.errorMessage}
                </div>
                {error.ruleCode && (
                  <div className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                    {error.ruleCode}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {(!validation.errors || validation.errors.length === 0) && (
        <div className="text-xs text-muted-foreground">
          No detailed error information available.
        </div>
      )}
    </>
  );
}

