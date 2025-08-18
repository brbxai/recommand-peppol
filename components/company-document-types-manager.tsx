import { useState, useEffect } from "react";
import { Button } from "@core/components/ui/button";
import { Input } from "@core/components/ui/input";
import { Label } from "@core/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@core/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@core/components/ui/select";
import { Textarea } from "@core/components/ui/textarea";
import { AsyncButton } from "@core/components/async-button";
import { toast } from "@core/components/ui/sonner";
import { Plus, Edit, Trash2, X, Check } from "lucide-react";
import { rc } from "@recommand/lib/client";
import type { CompanyDocumentTypes } from "@peppol/api/company-document-types";
import type { CompanyDocumentType } from "@peppol/data/company-document-types";
import { stringifyActionFailure } from "@recommand/lib/utils";

const DOCUMENT_TYPE_PRESETS = [
    {
        title: "Invoice",
        docTypeId: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1",
        processId: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"
    },
    {
        title: "Credit Note",
        docTypeId: "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1",
        processId: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"
    },
]

const client = rc<CompanyDocumentTypes>("peppol");

type CompanyDocumentTypesManagerProps = {
    teamId: string;
    companyId: string;
};

type DocumentTypeFormData = {
    docTypeId: string;
    processId: string;
};

export function CompanyDocumentTypesManager({ teamId, companyId }: CompanyDocumentTypesManagerProps) {
    const [documentTypes, setDocumentTypes] = useState<CompanyDocumentType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<DocumentTypeFormData>({ docTypeId: "", processId: "" });
    const [editFormData, setEditFormData] = useState<DocumentTypeFormData>({ docTypeId: "", processId: "" });

    useEffect(() => {
        fetchDocumentTypes();
    }, [teamId, companyId]);

    const fetchDocumentTypes = async () => {
        try {
            setIsLoading(true);
            const response = await client[":teamId"]["companies"][":companyId"]["documentTypes"].$get({
                param: { teamId, companyId },
            });
            const json = await response.json();

            if (!json.success) {
                toast.error(stringifyActionFailure(json.errors));
                return;
            }

            setDocumentTypes((json.documentTypes || []).map(dt => ({
                ...dt,
                createdAt: new Date(dt.createdAt),
                updatedAt: new Date(dt.updatedAt),
            })));
        } catch (error) {
            console.error("Error fetching document types:", error);
            toast.error("Failed to load company document types");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!formData.docTypeId.trim()) {
            toast.error("Document Type ID is required");
            return;
        }
        if (!formData.processId.trim()) {
            toast.error("Process ID is required");
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await client[":teamId"]["companies"][":companyId"]["documentTypes"].$post({
                param: { teamId, companyId },
                json: formData,
            });

            const json = await response.json();
            if (!json.success) {
                throw new Error(stringifyActionFailure(json.errors));
            }

            toast.success("Document type added successfully");
            setFormData({ docTypeId: "", processId: "" });
            setIsAdding(false);
        } catch (error) {
            toast.error("Failed to add document type: " + error);
        } finally {
            setIsSubmitting(false);
            fetchDocumentTypes();
        }
    };

    const handleEdit = async () => {
        if (!editingId) {
            toast.error("No document type selected for editing");
            return;
        }
        if (!editFormData.docTypeId.trim()) {
            toast.error("Document Type ID is required");
            return;
        }
        if (!editFormData.processId.trim()) {
            toast.error("Process ID is required");
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await client[":teamId"]["companies"][":companyId"]["documentTypes"][":documentTypeId"].$put({
                param: { teamId, companyId, documentTypeId: editingId },
                json: editFormData,
            });

            const json = await response.json();
            if (!json.success) {
                throw new Error(stringifyActionFailure(json.errors));
            }

            toast.success("Document type updated successfully");
            setEditingId(null);
            setEditFormData({ docTypeId: "", processId: "" });
        } catch (error) {
            toast.error("Failed to update document type: " + error);
        } finally {
            setIsSubmitting(false);
            fetchDocumentTypes();
        }
    };

    const handleDelete = async (documentTypeId: string) => {
        try {
            const response = await client[":teamId"]["companies"][":companyId"]["documentTypes"][":documentTypeId"].$delete({
                param: { teamId, companyId, documentTypeId },
            });

            const json = await response.json();
            if (!json.success) {
                throw new Error(stringifyActionFailure(json.errors));
            }

            toast.success("Document type deleted successfully");
        } catch (error) {
            toast.error("Failed to delete document type: " + error);
        } finally {
            fetchDocumentTypes();
        }
    };

    const startEdit = (documentType: CompanyDocumentType) => {
        setEditingId(documentType.id);
        setEditFormData({
            docTypeId: documentType.docTypeId,
            processId: documentType.processId,
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditFormData({ docTypeId: "", processId: "" });
    };

    const cancelAdd = () => {
        setIsAdding(false);
        setFormData({ docTypeId: "", processId: "" });
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Company Document Types</CardTitle>
                    <CardDescription>Manage your company document types</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-32">
                        <div className="text-center text-muted-foreground">Loading...</div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <CardTitle>Company Document Types</CardTitle>
                        <CardDescription className="text-balance">
                            Document types define what types of documents your company can receive over the Peppol network.
                            This does not limit the types of documents you can send.
                        </CardDescription>
                    </div>
                    {!isAdding && (
                        <Button onClick={() => setIsAdding(true)} size="sm">
                            <Plus className="h-4 w-4" />
                            Add Document Type
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Add Form */}
                {isAdding && (
                    <div className="p-4 border rounded-lg bg-muted/50">
                        <div className="space-y-2">
                            <div className="space-y-2">
                                <Label htmlFor="add-docTypeId">Document Type ID</Label>
                                <Textarea
                                    id="add-docTypeId"
                                    placeholder="e.g., urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1"
                                    value={formData.docTypeId}
                                    onChange={(e) => setFormData({ ...formData, docTypeId: e.target.value })}
                                    className="min-h-[60px] break-all"
                                    spellCheck={false}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="add-processId">Process ID</Label>
                                <Textarea
                                    id="add-processId"
                                    placeholder="e.g., urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"
                                    value={formData.processId}
                                    onChange={(e) => setFormData({ ...formData, processId: e.target.value })}
                                    className="min-h-[60px] break-all"
                                    spellCheck={false}
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 mt-4 justify-between">
                            <div className="flex gap-2 justify-end">
                                <Select onValueChange={(value) => {
                                    const selectedPreset = DOCUMENT_TYPE_PRESETS.find(preset => preset.title === value);
                                    if (selectedPreset) {
                                        setFormData({
                                            docTypeId: selectedPreset.docTypeId,
                                            processId: selectedPreset.processId
                                        });
                                    }
                                }}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Select a preset..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DOCUMENT_TYPE_PRESETS.map((preset) => (
                                            <SelectItem key={preset.title} value={preset.title}>
                                                {preset.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <AsyncButton onClick={handleAdd} size="sm" disabled={isSubmitting}>
                                    <Check className="h-4 w-4" />
                                    Add
                                </AsyncButton>
                                <Button onClick={cancelAdd} variant="outline" size="sm" disabled={isSubmitting}>
                                    <X className="h-4 w-4" />
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Document Types List */}
                <div className="space-y-2">
                    {documentTypes.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>No document types found</p>
                            <p className="text-sm">Add your first document type to get started</p>
                        </div>
                    ) : (
                        documentTypes.map((documentType) => {
                            const matchingPreset = DOCUMENT_TYPE_PRESETS.find(preset => preset.docTypeId === documentType.docTypeId && preset.processId === documentType.processId);
                            return (
                                <div key={documentType.id} className="flex items-center justify-between p-3 border rounded-lg gap-4">
                                    {editingId === documentType.id ? (
                                        // Edit Form
                                        <div className="flex-1 space-y-4">
                                            <div className="space-y-2">
                                                <div className="space-y-1">
                                                    <Label htmlFor={`edit-docTypeId-${documentType.id}`} className="text-xs">Document Type ID</Label>
                                                    <Textarea
                                                        id={`edit-docTypeId-${documentType.id}`}
                                                        value={editFormData.docTypeId}
                                                        onChange={(e) => setEditFormData({ ...editFormData, docTypeId: e.target.value })}
                                                        className="min-h-[60px] max-w-full break-all"
                                                        spellCheck={false}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`edit-processId-${documentType.id}`} className="text-xs">Process ID</Label>
                                                    <Textarea
                                                        id={`edit-processId-${documentType.id}`}
                                                        value={editFormData.processId}
                                                        onChange={(e) => setEditFormData({ ...editFormData, processId: e.target.value })}
                                                        className="min-h-[60px] max-w-full break-all"
                                                        spellCheck={false}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <AsyncButton onClick={handleEdit} size="sm" variant="default" disabled={isSubmitting}>
                                                    <Check className="h-4 w-4" />
                                                    Save Changes
                                                </AsyncButton>
                                                <Button onClick={cancelEdit} size="sm" variant="outline" disabled={isSubmitting}>
                                                    <X className="h-4 w-4" />
                                                    Cancel Edit
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        // Display
                                        <div className="flex-1">
                                            <div className="font-medium text-sm break-all">
                                                {matchingPreset?.title || documentType.docTypeId}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Updated: {new Date(documentType.updatedAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    )}

                                    {editingId === documentType.id ? null : (
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => startEdit(documentType)}
                                                size="sm"
                                                variant="outline"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <AsyncButton
                                                onClick={() => handleDelete(documentType.id)}
                                                size="sm"
                                                variant="destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </AsyncButton>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
