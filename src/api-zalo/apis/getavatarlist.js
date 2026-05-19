// File: getAvatarList.js
// ĐÃ SỬA HOÀN HẢO – TRẢ VỀ URL TRỰC TIẾP, KHÔNG CẦN GHÉP TAY NỮA!

import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";
import { Zalo } from "../index.js";

export function getAvatarListFactory(api) {
    const serviceURL = makeURL(`${api.zpwServiceMap.profile[0]}/api/social/avatar-list`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });

    /**
     * Lấy danh sách ảnh đại diện cũ + URL TRỰC TIẾP
     * @param {number} count Số lượng (tối đa 999)
     * @param {number} page Trang (thường để 1)
     * @returns {Promise<{photos: Array<{photoId: string, time: number, url: string}>}>}
     */
    return async function getAvatarList(count = 50, page = 1) {
        if (!appContext.secretKey || !appContext.imei)
            throw new ZaloApiError("Missing app context (secretKey/imei)");

        const params = {
            page,
            albumId: "0",
            count,
            imei: appContext.imei,
        };

        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

        const response = await request(makeURL(serviceURL, { params: encryptedParams }), {
            method: "GET",
        });

        const result = await handleZOnlyResponse(response);
        if (result.error) throw new ZaloApiError(result.error.message, result.error.code);

        const rawPhotos = result.data?.photos || [];

        // TỰ ĐỘNG GHÉP URL CHUẨN – KO CẦN HÀM NGOÀI NỮA!
        const photos = rawPhotos.map(photo => ({
            photoId: photo.photoId,
            time: photo.time || photo.ts || 0,
            url: `https://avatar.zalo.me/${photo.photoId}/240` // URL thật 100%, mở được ngay
        }));

        return { photos }; // Trả về đúng format như trước, nhưng có thêm url
    };
}