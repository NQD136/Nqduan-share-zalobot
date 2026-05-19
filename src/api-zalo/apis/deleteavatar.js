// File: deleteAvatar.js
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";
import { Zalo } from "../index.js";

export function deleteAvatarFactory(api) {
    const serviceURL = makeURL(`${api.zpwServiceMap.profile[0]}/api/social/del-avatars`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });

    /**
     * Xóa ảnh trong bộ sưu tập avatar (avatar history)
     * @param {string|string[]} photoId Một hoặc nhiều photoId (bắt đầu bằng "photo_")
     * @returns {Promise<Object>}
     * @throws {ZaloApiError}
     */
    return async function deleteAvatar(photoId) {
        if (!appContext.secretKey || !appContext.imei)
            throw new ZaloApiError("Missing app context (secretKey/imei)");

        const photoIds = Array.isArray(photoId) ? photoId : [photoId];
        if (photoIds.length === 0) throw new ZaloApiError("No photoId provided");

        const delPhotos = photoIds.map(id => ({ photoId: id }));

        const params = {
            delPhotos: JSON.stringify(delPhotos),
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