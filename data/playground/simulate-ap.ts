import { UserFacingError } from "@peppol/utils/util";
import { getCompanyByPeppolId } from "../companies";
import { receiveDocument } from "../receive-document";

export async function simulateSendAs4(options: {
  senderId: string;
  receiverId: string;
  docTypeId: string;
  processId: string;
  countryC1: string;
  body: string; // XML string

  // Playground specific options
  playgroundTeamId: string;
}) {

  // If the recipientId is "404:404", throw an error
  if (options.receiverId === "404:404") {
    throw new UserFacingError("This document was sent to recipient 404:404, simulating the sending of a document to a Peppol address that does not exist.");
  }

  // Check if the receiverId is registered as a company in this playground team, search by enterprise number
  try {
    const receivingCompany = await getCompanyByPeppolId({
      peppolId: options.receiverId,
      playgroundTeamId: options.playgroundTeamId,
    });
    if (!receivingCompany || receivingCompany.teamId !== options.playgroundTeamId || !receivingCompany.isSmpRecipient) {
      // Silently fail, the receiver is not registered in this playground team or is not an SMP recipient, so we don't need to send the document
      return
    }
  } catch (error) {
    // Silently fail, the receiver is not registered in this playground team, so we don't need to send the document
    return
  }

  // The company is registered, so we can receive the document
  await receiveDocument({
    senderId: options.senderId,
    receiverId: options.receiverId,
    docTypeId: options.docTypeId,
    processId: options.processId,
    countryC1: options.countryC1,
    body: options.body,
    skipBilling: true,
    playgroundTeamId: options.playgroundTeamId,
  });

}
