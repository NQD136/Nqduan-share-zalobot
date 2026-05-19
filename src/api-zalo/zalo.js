import { deleteAvatarFactory } from "./apis/deleteavatar.js";
import { getAvatarListFactory } from "./apis/getavatarlist.js";
import { reuseAvatarFactory } from "./apis/setoldavatar.js";
import { updateLangFactory } from "./apis/setlangaccount.js";
import { undoFriendRequestFactory } from "./apis/undoFriendRequests.js";
import { fetchAccountInfoFactory } from "./apis/account-info.js";
import { updateProfileFactory } from "./apis/updateProfile.js";
import { updateSettingsFactory } from "./apis/updateSettings.js";
import { changeFriendAliasFactory } from "./apis/changeFriendAlias.js";
import { removeFriendAliasFactory } from "./apis/removeFriendAlias.js";
import { rejectFriendRequestFactory } from "./apis/rejectFriendRequest.js";
import { getFriendRequestsFactory } from "./apis/getFriendRequests.js";
import { getPendingFriendRequestsFactory } from "./apis/getPendingFriendRequests.js";
import { getGroupInviteBoxListFactory } from "./apis/getGroupInviteBoxList.js";
//deleteGroupInviteBoxFactoryimport { setPinnedConversationsFactory } from "./apis/setPinnedConversations.js";
import { deleteGroupInviteBoxFactory } from "./apis/deleteGroupInviteBox.js";
import { acceptGroupInviteFactory } from "./apis/acceptGroupInvite.js";
import { getPollDetailFactory } from "./apis/getPollDetail.js";


import { getOwnId } from "./apis/getOwnId.js";
import { getBlockedGroupMembersFactory } from "./apis/getBlockMemberList.js";
import { Listener } from "./apis/listen.js";
import { addUserToGroupFactory } from "./apis/addUserToGroup.js";
import { disperseGroupFactory } from "./apis/disperseGroup.js";
import { getFriendRequestStatusFactory } from "./apis/getFriendRequestStatus.js";
import { getGroupBlockedMemberFactory } from "./apis/getGroupBlockedMember.js";
import { acceptFriendRequestFactory } from "./apis/acpFriendRequest.js";
import { blockUserFactory } from "./apis/blockUser.js";
import { unblockUserFactory } from "./apis/unblockUser.js";
import { changeAccountAvatarFactory } from "./apis/changeAccountAvatar.js";
import { removeGroupBlockedMemberFactory } from "./apis/removeGroupBlockedMember.js";
import { getSettingsFactory } from "./apis/getSettings.js";
import { setMuteGroupFactory } from "./apis/setMuteGroup.js";
import { addFriendFactory } from "./apis/addFriend.js";
import { getServerInfo, login } from "./apis/login.js";
import { removeFriendFactory } from "./apis/rmFri.js";
import { setMuteFactory } from "./apis/setmute.js";
import { appContext } from "./context.js";
import { logger, makeURL } from "./utils.js";
import { addReactionFactory } from "./apis/addReaction.js";
import { changeGroupAvatarFactory } from "./apis/changeGroupAvatar.js";
import { changeGroupNameFactory } from "./apis/changeGroupName.js";
import { createGroupFactory } from "./apis/createGroup.js";
import { findUserFactory } from "./apis/findUser.js";
import { getGroupInfoFactory } from "./apis/getGroupInfo.js";
import { getStickersFactory } from "./apis/getStickers.js";
import { getStickersDetailFactory } from "./apis/getStickersDetail.js";
import { removeUserFromGroupFactory } from "./apis/removeUserFromGroup.js";
import { sendStickerFactory } from "./apis/sendSticker.js";
import { undoMessageFactory } from "./apis/undoMessage.js";
import { uploadAttachmentFactory } from "./apis/uploadAttachment.js";
import { checkUpdate } from "./update.js";
import { sendMessageFactory } from "./apis/sendMessage.js";
import { getCookieFactory } from "./apis/getCookie.js";
import { removeMessageFactory } from "./apis/deleteMessage.js";
import { zDeleteMessageFactory } from "./apis/zDeleteMessage.js";
import { getUserInfoFactory } from "./apis/getUserInfo.js";
import { sendVideoFactory } from "./apis/sendVideo.js";
import { getAllFriendsFactory } from "./apis/fetchAllFriend.js";
import { getAllGroupsFactory } from "./apis/fetchAllGroups.js";
import { changeGroupSettingFactory } from "./apis/changeGroupSetting.js";
import { blockUsersInGroupFactory } from "./apis/blockUsersInGroup.js";
import { addGroupAdminsFactory } from "./apis/addGroupAdmins.js";
import { removeGroupAdminsFactory } from "./apis/removeGroupAdmins.js";
import { getQRLinkFactory } from "./apis/getQRZalo.js";
import { sendBusinessCardFactory } from "./apis/sendBusinessCard.js";
import { sendFriendRequestFactory } from "./apis/sendFriendRequest.js";
import { setBotId } from "../index.js";
import { getGroupMembersJoinRequestFactory } from "./apis/getGroupMembersJoinRequest.js";
import { handleGroupPendingMembersFactory } from "./apis/handleGroupPendingMembers.js";
import { changeGroupOwnerFactory } from "./apis/changeGroupOwner.js";
import { leaveGroupFactory } from "./apis/leaveGroup.js";
import { sendCustomStickerFactory } from "./apis/sendCustomerSticker.js";
import { changeGroupLinkFactory } from "./apis/changeGroupLink.js";
import { sendToDoFactory } from "./apis/sendToDo.js";
import { getRecentMessageFactory } from "./apis/getRecentMessage.js";
import { parseLinkFactory } from "./apis/parseLink.js";
import { sendLinkFactory } from "./apis/sendLink.js";
import { changeAccountSettingFactory } from "./apis/changeAccountSettings.js";
import { sendVoiceFactory } from "./apis/sendVoice.js";
import { sendMessagePrivateFactory } from "./apis/sendMessagePrivate.js";
import { joinGroupByLinkFactory } from "./apis/joinGroupByLink.js";
import { getInfoGroupByLinkFactory } from "./apis/getGroupInfoByLink.js";
import { sendBankCardFactory } from "./apis/sendBankCard.js";
import { sendGifFactory } from "./apis/sendGif.js";
import { getGroupMembersFactory } from "./apis/getGroupMembers.js";
import { checkImageFactory } from "./apis/checkImage.js";
import { sendImageFactory } from "./apis/sendImage.js";
import { sendFileFactory } from "./apis/sendFile.js";
import { uploadThumbnailFactory } from "./apis/uploadThumbnail.js";
import { sendMessageForwardFactory } from "./apis/sendMessageForward.js";
import { zSendLocalImageFactory } from "./apis/zSendLocalImage.js";
import { zSendMultiLocalImageFactory } from "./apis/zSendLocalImages.js";
import { getBotName } from "../utils/env.js";
import { sendCallVoiceFactory } from "./apis/SendCallVoice.js";
class Zalo {
  constructor(credentials, options) {
    this.enableEncryptParam = true;
    this.validateParams(credentials);
    appContext.imei = credentials.imei;
    appContext.cookie = this.parseCookies(credentials.cookie);
    appContext.userAgent = credentials.userAgent;
    appContext.language = credentials.language || "vi";
    appContext.timeMessage = credentials.timeMessage || 0;
    appContext.secretKey = null;
    this.userId = null;
    this.send2meId = null;
    this.secretKey = null;
    this.is_main_bot = getBotName() === "admin";

    if (options) Object.assign(appContext.options, options);
  }

  parseCookies(cookie) {
    if (typeof cookie === "string") return cookie;
    if (cookie && Array.isArray(cookie.cookies)) {
      return cookie.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    }
    if (cookie && typeof cookie === "object") {
      return Object.entries(cookie).map(([name, value]) => `${name}=${value}`).join("; ");
    }
    throw new Error("Invalid cookie format");
  }

  validateParams(credentials) {
    if (!credentials.imei || !credentials.cookie || !credentials.userAgent) {
      throw new Error("Missing required params");
    }
  }

  async login() {
    await checkUpdate();
    const loginData = await login(this.enableEncryptParam);
    const serverInfo = await getServerInfo(this.enableEncryptParam);

    if (!loginData || !serverInfo) throw new Error("Failed to login");

    const uid = loginData.data.uid;
    const secretKey = loginData.data.zpw_enk;
    const send2meId = loginData.data.send2me_id;

    if (!send2meId) {
      console.error("[ERROR] Failed to get send2me_id from loginData");
    }

    appContext.secretKey = secretKey;
    appContext.uid = uid;
    appContext.send2meId = send2meId;
    appContext.settings = serverInfo.setttings || serverInfo.settings;

    setBotId(uid);
    this.userId = uid;
    this.send2meId = send2meId;
    const botType = this.is_main_bot ? "Main Bot" : "Mini Bot";
    console.debug(`Đăng nhập thành công trên ${botType} ${uid}`);

    return new API(
      secretKey,
      loginData.data.zpw_service_map_v3,
      makeURL(`${loginData.data.zpw_ws[0]}`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
        t: Date.now(),
      }),
      this.is_main_bot
    );
  }
}


Zalo.API_TYPE = 30;
Zalo.API_VERSION = 649;

class API {
  constructor(secretKey, zpwServiceMap, wsUrl, is_main_bot = false) {
    this.secretKey = secretKey;
    this.zpwServiceMap = zpwServiceMap;
    this.listener = new Listener(wsUrl);
    this.is_main_bot = is_main_bot;
    this.getOwnId = getOwnId;
    this.getStickers = getStickersFactory(this);
    this.getStickersDetail = getStickersDetailFactory(this);
    this.findUser = findUserFactory(this);
    this.acceptFriendRequest = acceptFriendRequestFactory(this);
    this.uploadAttachment = uploadAttachmentFactory(this);
    this.getFriendRequestStatus = getFriendRequestStatusFactory(this);
    this.uploadThumbnail = uploadThumbnailFactory(this);
    this.getGroupInfo = getGroupInfoFactory(this);
    this.disperseGroup = disperseGroupFactory(this);
    this.getGroupBlockedMember = getGroupBlockedMemberFactory(this);
    this.createGroup = createGroupFactory(this);
    this.changeGroupAvatar = changeGroupAvatarFactory(this);
    this.removeUserFromGroup = removeUserFromGroupFactory(this);
    this.removeGroupBlockedMember = removeGroupBlockedMemberFactory(this);
    this.changeGroupName = changeGroupNameFactory(this);
    this.getUserInfo = getUserInfoFactory(this);
    this.removeFriend = removeFriendFactory(this);
    this.setMute = setMuteFactory(this);
    this.changeAccountAvatar = changeAccountAvatarFactory(this);
    this.addReaction = addReactionFactory(this);
    this.setMuteGroup = setMuteGroupFactory(this);
    this.getSettings = getSettingsFactory(this);
    this.blockUser = blockUserFactory(this);
    this.unblockUser = unblockUserFactory(this);
    this.sendSticker = sendStickerFactory(this);
    this.undoMessage = undoMessageFactory(this);
    this.sendMessage = sendMessageFactory(this);
    this.getCookie = getCookieFactory();
    this.deleteMessage = removeMessageFactory(this);
    this.zDeleteMessage = zDeleteMessageFactory(this);
    this.sendVideo = sendVideoFactory(this);
    this.getAllFriends = getAllFriendsFactory(this);
    this.getAllGroups = getAllGroupsFactory(this);
    this.changeGroupSetting = changeGroupSettingFactory(this);
    this.blockUsers = blockUsersInGroupFactory(this);
    this.addGroupAdmins = addGroupAdminsFactory(this);
    this.addUserToGroup = addUserToGroupFactory(this);
    this.removeGroupAdmins = removeGroupAdminsFactory(this);
    this.getQRLink = getQRLinkFactory(this);
    this.sendBusinessCard = sendBusinessCardFactory(this);
    this.sendFriendRequest = sendFriendRequestFactory(this);
    this.getGroupPendingMembers = getGroupMembersJoinRequestFactory(this);
    this.handleGroupPendingMembers = handleGroupPendingMembersFactory(this);
    this.changeGroupOwner = changeGroupOwnerFactory(this);
    this.leaveGroup = leaveGroupFactory(this);
    this.sendCustomSticker = sendCustomStickerFactory(this);
    this.changeGroupLink = changeGroupLinkFactory(this);
    this.sendTodo = sendToDoFactory(this);
    this.changeAccountSetting = changeAccountSettingFactory(this)
    this.getRecentMessages = getRecentMessageFactory(this);
    this.parseLink = parseLinkFactory(this);
    this.sendLink = sendLinkFactory(this);
    this.sendVoice = sendVoiceFactory(this);
    this.sendPrivate = sendMessagePrivateFactory(this);
    this.getGroupInfoByLink = getInfoGroupByLinkFactory(this);
    this.joinGroup = joinGroupByLinkFactory(this);
    this.sendBankCard = sendBankCardFactory(this);
    this.sendGif = sendGifFactory(this);
    this.getGroupMembers = getGroupMembersFactory(this);
    this.checkImage = checkImageFactory();
    this.sendCallVoice = sendCallVoiceFactory(this);
    this.sendImage = sendImageFactory(this);
    this.sendFile = sendFileFactory(this);
    this.sendMessageForward = sendMessageForwardFactory(this);
    this.zSendLocalImage= zSendLocalImageFactory(this);
    this.zSendLocalImages= zSendMultiLocalImageFactory(this);
    this.addFriend = addFriendFactory(this);
    this.getBlockedGroupMembers = getBlockedGroupMembersFactory(this);


    this.getAvatarList = getAvatarListFactory(this);
    this.deleteAvatar = deleteAvatarFactory(this);
    this.reuseAvatar = reuseAvatarFactory(this);
    this.updateLang = updateLangFactory(this);
    this.undoFriendRequest = undoFriendRequestFactory(this);
    this.fetchAccountInfo = fetchAccountInfoFactory(this);
    this.updateProfile = updateProfileFactory(this);
    this.updateSettings = updateSettingsFactory(this);
    this.changeFriendAlias = changeFriendAliasFactory(this);
    this.removeFriendAlias = removeFriendAliasFactory(this);
    this.rejectFriendRequest = rejectFriendRequestFactory(this);
    this.getFriendRequests = getFriendRequestsFactory(this);
    this.getPendingFriendRequests = getPendingFriendRequestsFactory(this);
    this.getGroupInviteBoxList = getGroupInviteBoxListFactory(this);
    //this.setPinnedConversations = setPinnedConversationsFactory(this);
    this.deleteGroupInviteBox = deleteGroupInviteBoxFactory(this);
    this.acceptGroupInvite = acceptGroupInviteFactory(this);
    this.getPollDetail = getPollDetailFactory(this);
  }
}

export { Zalo, API };
