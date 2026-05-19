// Tên file: getGroupInviteBoxList.js

import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { Zalo } from "../index.js";
import { appContext } from "../context.js";
// Import trực tiếp các hàm tiện ích từ utils.js
import { makeURL, encodeAES, request, handleZaloResponse } from "../utils.js"; 

/**
 * Factory để tạo hàm getGroupInviteBoxList
 * Lấy danh sách lời mời tham gia nhóm
 * * @param {API} api
 */
export function getGroupInviteBoxListFactory(api) {
    
    // Khởi tạo serviceURL với version và type
    const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/inv-box/list`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });

    /**
     * Get group invite box list
     * Lấy danh sách lời mời tham gia nhóm
     *
     * @param {Object} payload - The payload of the request
     * @param {number} [payload.mpage=1] - Main page number
     * @param {number} [payload.page=0] - Page number
     * @param {number} [payload.invPerPage=12] - Invitations per page
     * @param {number} [payload.mcount=10] - Main count
     *
     * @throws {ZaloApiError}
     */
    return async function getGroupInviteBoxList(payload = {}) {
        
        // Kiểm tra context bắt buộc (giống getUserInfo.js)
        if (!appContext.secretKey)
            throw new ZaloApiError("Missing required app context fields (secretKey)");

        const params = {
            mpage: payload.mpage ?? 1,
            page: payload.page ?? 0,
            invPerPage: payload.invPerPage ?? 12,
            mcount: payload.mcount ?? 10,
            lastGroupId: null,
            avatar_size: 120,
            member_avatar_size: 120,
        };

        // Mã hóa tham số bằng hàm encodeAES đã import
        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

        // Gửi request bằng hàm request đã import
        const response = await request(makeURL(serviceURL, { params: encryptedParams }), {
            method: "GET",
        });

        // Xử lý phản hồi bằng hàm handleZaloResponse đã import
        const result = await handleZaloResponse(response);

        if (result.error) 
            throw new ZaloApiError(result.error.message, result.error.code);
        
        return result.data;
    };
}