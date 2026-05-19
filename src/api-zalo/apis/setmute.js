import { Zalo } from "../index.js";
import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";

export function setMuteFactory(api) {
  const serviceURL = makeURL(
    `${api.zpwServiceMap.profile[0]}/api/social/profile/setmute`,
    {
      zpw_ver: Zalo.API_VERSION,
      zpw_type: Zalo.API_TYPE,
    }
  );

  /**
   * Tắt hoặc bật thông báo cuộc trò chuyện
   *
   * @param {string} threadID - ID đoạn chat (user hoặc group)
   * @param {number} [duration=-1] - Thời gian tắt thông báo (giây), -1 là vĩnh viễn
   * @param {number} [action=1] - 1 = Mute, 3 = Unmute
   * @param {number} [type=1] - 1 = User, 2 = Group
   *
   * @throws ZaloApiError
   */
  return async function setMute(threadID, duration = -1, action = 1, type = 1) {
    if (
      !appContext.secretKey ||
      !appContext.imei ||
      !appContext.cookie ||
      !appContext.userAgent
    )
      throw new ZaloApiError("Missing required app context fields");
    if (!threadID) throw new ZaloApiError("Missing threadID");

    const requestParams = {
      toid: threadID,
      duration,
      action,
      startTime: Math.floor(Date.now() / 1000),
      muteType: type,
      imei: appContext.imei,
    };

    const encryptedParams = encodeAES(
      appContext.secretKey,
      JSON.stringify(requestParams)
    );
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

    const finalServiceUrl = new URL(serviceURL);
    finalServiceUrl.searchParams.append("params", encryptedParams);

    const response = await request(
      makeURL(finalServiceUrl.toString(), {
        params: encryptedParams,
      })
    );

    const result = await handleZaloResponse(response);
    if (result.error && result.error.code != 216)
      throw new ZaloApiError(result.error.message, result.error.code);

    return result.data;
  };
}
