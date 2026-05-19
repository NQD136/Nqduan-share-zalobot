import { handleReactionConfirmJoinGroup } from "../commands/bot-manager/remote-action-group.js";
import { handleReactionConfirmAutoJoin } from "../commands/bot-manager/auto-join.js";
// import { handleReactionLinkConfirm } from "../Nqduan-service/chat-zalo/chat-special/send-image/send-image.js";
import { handleTikTokReaction } from "../Nqduan-service/api-crawl/tiktok/tiktok-service.js";

//Xử Lý Sự Kiện Reaction
export async function reactionEvents(api, reaction) {
  if (await handleReactionConfirmJoinGroup(api, reaction)) return;
  if (await handleReactionConfirmAutoJoin(api, reaction)) return;
  // if (await handleReactionLinkConfirm(api, reaction)) return;
  if (await handleTikTokReaction(api, reaction)) return;
}
