// File: reuseAvatar.js (chuẩn mới – giống changeAccountAvatar)
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";
import { Zalo } from "../index.js";

export function reuseAvatarFactory(api) {
    const serviceURL = makeURL(`${api.zpwServiceMap.profile[0]}/api/social/reuse-avatar`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });

    /**
     * Dùng lại 1 ảnh cũ làm avatar hiện tại (SIÊU NHANH, KHÔNG LỖI 207)
     * @param {string} photoId Lấy từ getAvatarList()
     */
    return async function reuseAvatar(photoId) {
        if (!appContext.secretKey || !appContext.imei)
            throw new ZaloApiError("Missing app context");

        const params = {
            photoId: photoId,
            isPostSocial: 0,
            imei: appContext.imei,
        };

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