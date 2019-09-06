module.exports.getAttachmentData = function getAttachmentData(gmail, messageId, attachmentId) {
  return gmail.users.messages.attachments
    .get({
      userId: "me",
      messageId,
      id: attachmentId
    })
    .then(response => {
      return response;
    });
};
