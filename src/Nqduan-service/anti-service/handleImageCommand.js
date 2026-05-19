import schedule from "node-schedule";
import { sendMessageWarning, sendMessageStateQuote, sendMessageCompleteRequest } from "../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../service.js";
import { removeMention } from "../../utils/format-util.js";
import { readGroupSettings, writeGroupSettings } from "../../utils/io-json.js";

export async function handleKickImageCommand(api, message, groupSettings) {
  const threadId = message.threadId;
  const content = removeMention(message);
  const status = content.split(" ")[1];

  if (!groupSettings[threadId]) {
    groupSettings[threadId] = {};
  }

  let newStatus;
  if (status === "on") {
    groupSettings[threadId].enableKickImage = true;
    newStatus = "bật";
  } else if (status === "off") {
    groupSettings[threadId].enableKickImage = false;
    newStatus = "tắt";
  } else {
    groupSettings[threadId].enableKickImage = !groupSettings[threadId].enableKickImage;
    newStatus = groupSettings[threadId].enableKickImage ? "bật" : "tắt";
  }

  const caption = `Chức năng thông báo kick thành viên đã được ${newStatus}!`;
  await sendMessageStateQuote(api, message, caption, groupSettings[threadId].enableKickImage, 300000);

  return true;
}
export async function handleBlockImageCommand(api, message, groupSettings) {
  const threadId = message.threadId;
  const content = removeMention(message);
  const status = content.split(" ")[1];

  if (!groupSettings[threadId]) {
    groupSettings[threadId] = {};
  }

  let newStatus;
  if (status === "on") {
    groupSettings[threadId].enableBlockImage = true;
    newStatus = "bật";
  } else if (status === "off") {
    groupSettings[threadId].enableBlockImage = false;
    newStatus = "tắt";
  } else {
    groupSettings[threadId].enableBlockImage = !groupSettings[threadId].enableBlockImage;
    newStatus = groupSettings[threadId].enableBlockImage ? "bật" : "tắt";
  }

  const caption = `Chức năng thông báo block thành viên đã được ${newStatus}!`;
  await sendMessageStateQuote(api, message, caption, groupSettings[threadId].enableBlockImage, 300000);

  return true;
}