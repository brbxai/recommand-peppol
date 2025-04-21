import { PageTemplate } from "@core/components/page-template";
import Logo from "@core/assets/recommand-logo.svg";

export default function Page() {
  return (
    <PageTemplate>
      <div className="flex flex-col items-center justify-center py-12 space-y-6 h-[calc(100vh-10rem)]">
        <div className="p-6">
          <img src={Logo} alt="Recommand Logo" className="h-8 w-auto min-w-32" />
        </div>
        <p className="text-muted-foreground max-w-md text-center">
          Manage your companies, send and receive Peppol documents, and monitor your subscription all in one place.
        </p>
      </div>
    </PageTemplate>
  );
}
