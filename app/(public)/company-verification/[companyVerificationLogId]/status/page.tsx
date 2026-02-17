import { rc } from "@recommand/lib/client";
import type { Companies } from "@peppol/api/companies";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useActiveTeam } from "@core/hooks/user";
import { stringifyActionFailure } from "@recommand/lib/utils";
import { Card, CardContent } from "@core/components/ui/card";
import { Alert, AlertDescription } from "@core/components/ui/alert";
import { Loader2, AlertCircle, ShieldCheck, XCircle } from "lucide-react";

const client = rc<Companies>("v1");

const FINAL_STATUSES = ["verified", "rejected"] as const;
const POLLING_STATUSES = ["idVerificationRequested"] as const;
const POLL_INTERVAL = 5000;

type VerificationStatus = "opened" | "formSubmitted" | "idVerificationRequested" | "verified" | "rejected";

type StatusData = {
    status: VerificationStatus;
    companyName: string;
    companyId: string;
};

export default function Page() {
    const { companyVerificationLogId } = useParams<{ companyVerificationLogId: string }>();
    const activeTeam = useActiveTeam();
    const navigate = useNavigate();

    const [statusData, setStatusData] = useState<StatusData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchStatus = useCallback(async () => {
        if (!activeTeam?.id || !companyVerificationLogId) return;

        try {
            const response = await client[":teamId"]["companies"]["verification"][":companyVerificationLogId"]["context"].$get({
                param: {
                    teamId: activeTeam.id,
                    companyVerificationLogId,
                },
            });
            const json = await response.json();
            if (!json.success) {
                setLoadError(stringifyActionFailure(json.errors));
                return;
            }

            const data = json as unknown as {
                success: true;
                verificationLog: { id: string; status: VerificationStatus; companyName: string | null };
                company: { id: string; name: string; enterpriseNumber: string | null };
            };

            const status = data.verificationLog.status;

            if (!(FINAL_STATUSES as readonly string[]).includes(status) && !(POLLING_STATUSES as readonly string[]).includes(status)) {
                navigate(`/company-verification/${companyVerificationLogId}/verify`, { replace: true });
                return;
            }

            setStatusData({ status, companyName: data.company.name, companyId: data.company.id });
            setIsLoading(false);

            if ((FINAL_STATUSES as readonly string[]).includes(status) && intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        } catch {
            setLoadError("Failed to load verification status. Please try again.");
            setIsLoading(false);
        }
    }, [activeTeam?.id, companyVerificationLogId, navigate]);

    useEffect(() => {
        if (!activeTeam?.id || !companyVerificationLogId) return;

        fetchStatus();

        intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [activeTeam?.id, companyVerificationLogId, fetchStatus]);

    if (isLoading) {
        return (
            <div className="min-h-svh flex items-center justify-center bg-muted/30">
                <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading verification status...</p>
                </div>
            </div>
        );
    }

    if (loadError || !statusData) {
        return (
            <div className="min-h-svh flex items-center justify-center bg-muted/30 px-4">
                <div className="w-full max-w-md text-center space-y-6">
                    <img src="/logo.svg" alt="Recommand" className="h-7 w-auto mx-auto opacity-40" />
                    <Card>
                        <CardContent className="pt-6">
                            <div className="space-y-4">
                                <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
                                <p className="text-sm text-muted-foreground">
                                    {loadError || "Verification status could not be loaded."}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (statusData.status === "idVerificationRequested") {
        return (
            <div className="min-h-svh flex items-center justify-center bg-muted/30 px-4 py-12">
                <div className="w-full max-w-lg space-y-8">
                    <div className="text-center space-y-2">
                        <img src="/logo.svg" alt="Recommand" className="h-7 w-auto mx-auto opacity-40 mb-12 -mt-12" />
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
                            <Loader2 className="h-6 w-6 text-primary animate-spin" />
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight">Verification in Progress</h1>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto text-balance">
                            Your identity verification for <span className="font-medium text-foreground">{statusData.companyName}</span> is being processed. This page will update automatically.
                        </p>
                    </div>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
                                <div>
                                    <p className="text-sm font-medium">Awaiting verification result</p>
                                    <p className="text-xs text-muted-foreground">Checking status every few seconds...</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (statusData.status === "verified") {
        return (
            <div className="min-h-svh flex items-center justify-center bg-muted/30 px-4 py-12">
                <div className="w-full max-w-lg space-y-8">
                    <div className="text-center space-y-2">
                        <img src="/logo.svg" alt="Recommand" className="h-7 w-auto mx-auto opacity-40 mb-12 -mt-12" />
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-2">
                            <ShieldCheck className="h-6 w-6 text-green-600" />
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight">Verification Successful</h1>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto text-balance">
                            <span className="font-medium text-foreground">{statusData.companyName}</span> has been successfully verified and is now active on the Peppol network.
                        </p>
                    </div>

                    <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
                        <ShieldCheck className="h-4 w-4 !text-green-800" />
                        <AlertDescription className="text-green-800 dark:text-green-200">
                            Identity verification completed successfully. You can close this page.
                        </AlertDescription>
                    </Alert>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-svh flex items-center justify-center bg-muted/30 px-4 py-12">
            <div className="w-full max-w-lg space-y-8">
                <div className="text-center space-y-2">
                    <img src="/logo.svg" alt="Recommand" className="h-7 w-auto mx-auto opacity-40 mb-12 -mt-12" />
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mb-2">
                        <XCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Verification Rejected</h1>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto text-balance">
                        The identity verification for <span className="font-medium text-foreground">{statusData.companyName}</span> was not successful.
                    </p>
                </div>

                <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                        <div>
                            Your identity could not be verified. Please contact <a href={`mailto:support@recommand.eu?subject=Company Verification Assistance for ${statusData.companyId}`} className="underline underline-offset-4 hover:text-primary/80">support@recommand.eu</a> for assistance.
                        </div>
                    </AlertDescription>
                </Alert>
            </div>
        </div>
    );
}
