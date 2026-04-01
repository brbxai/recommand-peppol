import { useState } from "react";
import { Button } from "@core/components/ui/button";
import { AsyncButton } from "@core/components/async-button";
import { ShieldCheck, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { StatusMessage } from "@recommand/components/status-feedback";
import { rc } from "@recommand/lib/client";
import type { Companies } from "@peppol/api/companies";
import type { Company } from "@peppol/types/company";
import { stringifyActionFailure } from "@recommand/lib/utils";
import { ForwardSection } from "@peppol/app/(public)/company-verification/[companyVerificationLogId]/verify/forward-section";

const client = rc<Companies>("peppol");

type Step6Props = {
    teamId: string;
    company: Company;
    onComplete: (company: Company) => void;
};

export function Step6Verification({ teamId, company, onComplete }: Step6Props) {
    const [verificationLogId, setVerificationLogId] = useState<string | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState<string | null>(null);

    const handleVerify = async () => {
        setIsVerifying(true);
        setVerifyError(null);
        try {
            const response = await client[":teamId"]["companies"][":companyId"]["verify"].$post({
                param: { teamId, companyId: company.id },
            });
            const json = await response.json();
            if (!json.success) {
                setVerifyError(stringifyActionFailure(json.errors));
                return;
            }
            window.open(json.verificationUrl, "_blank");
            const match = json.verificationUrl.match(/\/company-verification\/([^/]+)\/verify/);
            if (match) {
                setVerificationLogId(match[1]);
            }
        } catch {
            setVerifyError("Failed to start verification session");
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                To send or receive documents on behalf of <strong>{company.name}</strong>, you must verify your identity to confirm you are authorized to act for this company.
            </p>
            {verificationLogId ? (
                <div className="space-y-4">
                    <StatusMessage
                        tone="success"
                        icon={CheckCircle2}
                        title="Verification session opened"
                        description="Complete the verification in the new tab, then come back here to finish."
                    />
                    <ForwardSection companyVerificationLogId={verificationLogId} />
                    <div className="flex justify-end">
                        <Button type="button" onClick={() => onComplete(company)}>
                            Done
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <AsyncButton onClick={handleVerify} disabled={isVerifying} className="w-full">
                        {isVerifying ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Starting...
                            </>
                        ) : (
                            <>
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Start Verification
                            </>
                        )}
                    </AsyncButton>
                    {verifyError && (
                        <StatusMessage tone="error" icon={AlertCircle} description={verifyError} />
                    )}
                    <ForwardSection companyVerificationLogId={null} teamId={teamId} companyId={company.id} />
                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => onComplete(company)}
                            className="text-sm text-muted-foreground hover:underline"
                        >
                            Skip for now
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
