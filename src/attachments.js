function getAttachmentData(gmail, messageId, attachmentId) {
  return gmail.users.messages.attachments
    .get({
      userId: "me",
      messageId,
      id: attachmentId
    })
    .then(response => {
      return response;
    });
}

function appendMediaAttachment(gmail, messageParts, attachment, messageId) {
  return getAttachmentData(gmail, messageId, attachment.body.attachmentId).then(resp => {
    const fs = require("fs");
    const tempFile = "./src/temp";
    fs.writeFileSync(tempFile, Buffer.from(resp.data.data, "base64"));
    messageParts.push("");
    messageParts.push(fs.readFileSync(tempFile, { encoding: "base64" }));
    fs.unlinkSync(tempFile);
  });
}

function appendTextAttachment(messageParts, message) {
  const encoding = message.headers.find(header => header.name === "Content-Transfer-Encoding");
  const contentType = message.headers.find(header => header.name === "Content-Type");
  const content = Buffer.from(message.body.data, "base64").toString();
  messageParts.push(`${contentType.name}: ${contentType.value}`);
  if (encoding) {
    messageParts.push(`${encoding.name}: ${encoding.value}`);
  }
  if (contentType.value.includes("html")) {
    messageParts.push(`Content-Disposition: inline`);
  }
  messageParts.push("");
  messageParts.push(content);
}

module.exports.appendTextAttachment = appendTextAttachment;
module.exports.appendMediaAttachment = appendMediaAttachment;
module.exports.getAttachmentData = getAttachmentData;
