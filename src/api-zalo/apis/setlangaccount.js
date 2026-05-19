// File: updateLang.js (chuẩn mới – giống các API khác của bạn)
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";
import { Zalo } from "../index.js";

export const UpdateLangAvailableLanguages = {
    VI: "VI",
    EN: "EN"
};

export function updateLangFactory(api) {
    const serviceURL = makeURL(`${api.zpwServiceMap.profile[0]}/api/social/profile/updatelang`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });

    /**
     * Đổi ngôn ngữ giao diện tài khoản Zalo
     * @param {"VI"|"EN"} language "VI" = Tiếng Việt, "EN" = Tiếng Anh
     */
    return async function updateLang(language = "VI") {
        if (!appContext.secretKey)
            throw new ZaloApiError("Missing app context");

        if (!["VI", "EN"].includes(language))
            throw new ZaloApiError("Chỉ hỗ trợ VI hoặc EN");

        const params = { language };

        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

        const response = await request(makeURL(serviceURL, { params: encryptedParams }), {
            method: "GET",
        });

        const result = await handleZaloResponse(response);
        if (result.error) throw new ZaloApiError(result.error.message, result.error.code);

        return result.data;
    };
}