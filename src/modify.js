module.exports.removeLabels = function removeLabels(gmail, msgData, labels) {
  return gmail.users.messages
    .modify({
      userId: "me",
      id: msgData.id,
      resource: {
        addLabelIds: [],
        removeLabelIds: labels
      }
    })
    .then(msg => {
      global.logger.info(`Modified message ${msg.data.id}`);
      return msg;
    })
    .catch(err => {
      global.logger.info("Couldn't modify message");
      console.error(err);
    });
};
