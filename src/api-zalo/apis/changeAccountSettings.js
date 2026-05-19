import { Zalo } from "../index.js";
import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, decodeAES, request, makeURL } from "../utils.js";

export function changeAccountSettingFactory(api) {
  const serviceURL = makeURL("https://tt-profile-wpa.chat.zalo.me/api/social/profile/update", {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });

  /**
   * Change account information
   *
   * @param {string} name - New account name
   * @param {string} dob - Date of birth (yyyy-mm-dd)
   * @param {number|string} gender - 0 = Male, 1 = Female
   * @param {object} biz - Optional business info
   * @param {string} language - Language (default: "vi")
   */
  return async function changeAccountSetting(name, dob, gender, biz = {}, language = "vi") {
    if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent) {
      throw new ZaloApiError("Missing required app context fields");
    }

    if (!name || !dob || gender === undefined) {
      throw new ZaloApiError("Missing required parameters: name, dob, or gender");
    }

    const rawPayload = {
      profile: JSON.stringify({ name, dob, gender: parseInt(gender) }),
      biz: JSON.stringify(biz),
      language,
    };

    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(rawPayload));
    if (!encryptedParams) {
      throw new ZaloApiError("Failed to encrypt params");
    }

    const response = await request(serviceURL, {
      method: "POST",
      body: new URLSearchParams({ params: encryptedParams }),
    });

    const result = await response.json();
    if (!("error_code" in result)) {
      throw new ZaloApiError(`Zalo API response missing error_code`);
    }

    if (result.error_code === 0 && result.data) {
      let decodedData;
      try {
        const decrypted = decodeAES(appContext.secretKey, result.data);
        decodedData = JSON.parse(decrypted);
      } catch (err) {
        throw new ZaloApiError("Failed to decode encrypted response data");
      }

      if (decodedData?.data) decodedData = decodedData.data;
      if (typeof decodedData === "string") {
        try {
          decodedData = JSON.parse(decodedData);
        } catch {
          throw new ZaloApiError(`Failed to parse nested response data: ${decodedData}`);
        }
      }

      return decodedData;
    }
    const errorMsg = result.error_message || result.data || "Unknown error";
    throw new ZaloApiError(`Error #${result.error_code}: ${errorMsg}`);
  };
}
