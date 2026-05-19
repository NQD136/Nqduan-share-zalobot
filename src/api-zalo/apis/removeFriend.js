import { Zalo, ZaloApiError } from "../index.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";

export function removeFriendFactory(api) {
  const serviceURL = makeURL(
    `${api.zpwServiceMap.friend[0]}/api/friend/remove`,
    {
      zpw_ver: Zalo.API_VERSION,
      zpw_type: Zalo.API_TYPE,
    }
  );

  /**
   * Hủy kết bạn với một người dùng
   * @param {string|number} userId ID người dùng cần hủy kết bạn
   * @param {string} [language="vi"] Ngôn ngữ phản hồi/giao diện
   * @throws {ZaloApiError}
   */
  return async function removeFriend(userId, language = "vi") {
    if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
      throw new ZaloApiError("Missing required app context fields");
    if (!userId) throw new ZaloApiError("Missing userId");

    const params = {
      toid: userId.toString(),
      reqsrc: 30,
      imei: appContext.imei,
      language,
      srcParams: JSON.stringify({ uidTo: userId.toString() }),
    };

    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

    const response = await request(serviceURL, {
      method: "POST",
      body: new URLSearchParams({ params: encryptedParams }),
    });

    const result = await handleZaloResponse(response);
    if (result.error) throw new ZaloApiError(result.error.message, result.error.code);

    return result.data;
  };
}