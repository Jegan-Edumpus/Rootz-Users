const { PublishCommand } = require("@aws-sdk/client-sns");
const { sns } = require("../config/aws");

/*    
    @params: 
        targerArns -> List of target ARNS
        notificationData --> notification message data
*/

const sendNotification = async ({ deviceArns, messageContent }) => {
  /* Notification message */
  const message = {
    GCM: JSON.stringify(messageContent),
  };

  /* Send push notification to provided device arns*/
  for (const arn of deviceArns) {
    console.log("---->>> for loop ARN", arn);
    const sendNotificationCommand = new PublishCommand({
      Message: JSON.stringify(message),
      MessageStructure: "json",
      TargetArn: process.env.SNS_ENDPOINT_ARN + arn,
    });

    try {
      const sendNotification = await sns.send(sendNotificationCommand);
      // console.log("----->>>>>notification send", sendNotification);
    } catch (error) {
      // console.log("------>>>>>notification send error", error);
    }
  }
};

module.exports = sendNotification;
