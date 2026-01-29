import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@core/components/ui/card";

interface DocumentPreviewProps {
  html: string | null;
  emptyText?: string;
}

export function DocumentPreview({
  html,
  emptyText = "Fill in the required fields to see a preview.",
}: DocumentPreviewProps) {
  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader>
        <CardTitle>Document preview</CardTitle>
        <CardDescription>
          This is how your customer will see the generated billing document if
          you include it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {html && (
          <div className="border rounded-md overflow-hidden bg-background">
            <iframe
              title="Document preview"
              srcDoc={html}
              className="w-full h-[800px] border-0"
            />
          </div>
        )}
        {!html && <p className="text-sm text-muted-foreground">{emptyText}</p>}
      </CardContent>
    </Card>
  );
}
