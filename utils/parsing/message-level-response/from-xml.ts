import { XMLParser } from "fast-xml-parser";
import { messageLevelResponseSchema, type MessageLevelResponse } from "./schemas";
import { getTextContent, getEndpointId } from "../xml-helpers";

export function parseMessageLevelResponseFromXML(xml: string): MessageLevelResponse {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        parseAttributeValue: false,
        parseTagValue: false,
        removeNSPrefix: true,
    });
    const parsed = parser.parse(xml);
    const messageLevelResponse = parsed.ApplicationResponse;
    if (!messageLevelResponse) {
        throw new Error("Invalid XML: No ApplicationResponse element found");
    }
    return messageLevelResponseSchema.parse({
        id: getTextContent(messageLevelResponse.ID),
        issueDate: getTextContent(messageLevelResponse.IssueDate),
        responseCode: getTextContent(messageLevelResponse.DocumentResponse.Response.ResponseCode),
        envelopeId: getTextContent(messageLevelResponse.DocumentResponse.DocumentReference.ID),
        senderEndpointId: getEndpointId(messageLevelResponse.SenderParty?.EndpointID),
        receiverEndpointId: getEndpointId(messageLevelResponse.ReceiverParty?.EndpointID),
    });
}