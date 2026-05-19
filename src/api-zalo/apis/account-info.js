// File: utils/fetchAccountInfo.js  (hoặc vị trí cũ của nó trong source Nqduan)
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";
import { Zalo } from "../index.js";

export function fetchAccountInfoFactory(api) {
  const serviceURL = makeURL(
    `${api.zpwServiceMap.profile[0]}/api/social/profile/me-v2`,
    {
      zpw_ver: Zalo.API_VERSION,
      zpw_type: Zalo.API_TYPE,
    },
  );

  return async function fetchAccountInfo() {
    if (!appContext.secretKey || !appContext.imei)
      throw new ZaloApiError("Missing app context (secretKey/imei)");

    const params = {
      imei: appContext.imei,
      // không cần thêm gì nữa, API này chỉ cần imei là đủ
    };

    const encryptedParams = encodeAES(
      appContext.secretKey,
      JSON.stringify(params),
    );
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

    const response = await request(
      makeURL(serviceURL, { params: encryptedParams }),
      {
        method: "GET",
      },
    );

    const result = await handleZaloResponse(response);
    if (result.error)
      throw new ZaloApiError(
        result.error.message || "Unknown error",
        result.error.code,
      );

    return result.data; // ← đây là object đầy đủ: displayName, userId, dob, gender, phoneNumber, avatar, isOA, oaType, status...
  };
}
