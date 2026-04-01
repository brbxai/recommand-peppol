import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@core/components/ui/button";
import { rc } from "@recommand/lib/client";
import type { Companies } from "@peppol/api/companies";
import type { Company, CompanyFormData } from "@peppol/types/company";
import { stringifyActionFailure } from "@recommand/lib/utils";

const client = rc<Companies>("peppol");

type Step4Props = {
    teamId: string;
    data: CompanyFormData;
    onNext: (company: Company) => void;
    onBack: () => void;
};

export function Step4Create({ teamId, data, onNext, onBack }: Step4Props) {
    const [error, setError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const hasStarted = useRef(false);

    useEffect(() => {
        if (hasStarted.current) return;
        hasStarted.current = true;
        createCompany();
    }, []);

    const createCompany = async () => {
        setIsCreating(true);
        setError(null);
        try {
            const response = await client[":teamId"]["companies"].$post({
                param: { teamId },
                json: data,
            });
            const json = await response.json();
            if (!json.success) {
                setError(stringifyActionFailure(json.errors));
                return;
            }
            onNext(json.company as Company);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
        } finally {
            setIsCreating(false);
        }
    };

    if (isCreating) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Creating your company...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/5">
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    <div>
                        <p className="font-medium text-sm text-destructive">Failed to create company</p>
                        <p className="text-sm text-muted-foreground mt-1">{error}</p>
                    </div>
                </div>
                <div className="flex justify-between gap-2">
                    <Button type="button" variant="outline" onClick={onBack}>
                        Back
                    </Button>
                    <Button type="button" onClick={createCompany}>
                        Try again
                    </Button>
                </div>
            </div>
        );
    }

    return null;
}
