import { useState } from "react";
import { Textarea } from "@core/components/ui/textarea";
import { Label } from "@core/components/ui/label";
import { Input } from "@core/components/ui/input";
import { Card } from "@core/components/ui/card";
import { FileText } from "lucide-react";
import { XmlUploadZone } from "./xml-upload-zone";

interface XmlFormProps {
  document: string;
  onChange: (document: string) => void;
  doctypeId?: string;
  onDoctypeIdChange: (id: string) => void;
}

export function XmlForm({
  document,
  onChange,
  doctypeId,
  onDoctypeIdChange,
}: XmlFormProps) {
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-muted/50">
        <div className="flex items-start gap-2">
          <FileText className="h-5 w-5 mt-0.5 text-muted-foreground" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">Raw XML Document</p>
            <p className="text-xs text-muted-foreground">
              Upload or paste your UBL-formatted XML document here. The document
              should be compliant with the Peppol BIS 3.0 standard.
            </p>
          </div>
        </div>
      </Card>

      <div>
        <Label htmlFor="doctypeId">Document Type ID (Optional)</Label>
        <Input
          id="doctypeId"
          value={doctypeId || ""}
          onChange={(e) => onDoctypeIdChange(e.target.value)}
          placeholder=""
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Leave blank to use the default invoice document type ID
        </p>
      </div>

      <XmlUploadZone
        loadedFileName={uploadedFileName}
        onLoaded={(xml, fileName) => {
          setUploadedFileName(fileName);
          onChange(xml);
        }}
        onClear={() => {
          setUploadedFileName(null);
          onChange("");
        }}
      />

      <div>
        <Label htmlFor="xmlDocument">XML Document *</Label>
        <Textarea
          id="xmlDocument"
          value={document}
          onChange={(e) => onChange(e.target.value)}
          placeholder={""}
          rows={20}
          className="font-mono text-xs"
          required
        />
      </div>
    </div>
  );
}
