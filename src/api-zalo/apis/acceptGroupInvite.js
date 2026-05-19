// Tên file: acceptGroupInvite.js (BẠN PHẢI CHẮC CHẮN TÊN FILE VÀ TÊN FACTORY KHỚP NHAU)

import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js"; 
import { Zalo } from "../index.js"; 
import { makeURL, encodeAES, request, handleZaloResponse } from "../utils.js";

/**
 * Factory để tạo hàm acceptGroupInvite
 * @param {API} api
 */
// *** ĐÂY LÀ PHẦN QUAN TRỌNG NHẤT: ĐẢM BẢO ĐÃ EXPORT HÀM NÀY ***
export function acceptGroupInviteFactory(api) { 
    
    // Endpoint: /api/group/inv-box/accept (Chấp nhận lời mời nhóm)
    const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/inv-box/accept`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });

    /**
     * Chấp nhận lời mời tham gia nhóm
     *
     * @param {string} groupId ID của nhóm
     *
     * @throws {ZaloApiError}
     */
    return async function acceptGroupInvite(groupId) {
        
        if (!appContext.secretKey)
            throw new ZaloApiError("Missing required app context fields");
        if (!groupId) 
            throw new ZaloApiError("Missing groupId");

        const params = {
            grid: groupId, // ID nhóm
            clientLang: appContext.language || 'vi',
        };
        
        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams)
            throw new ZaloApiError("Failed to encrypt params");

        const response = await request(makeURL(serviceURL, { params: encryptedParams }), {
            method: "GET",
        });
        
        return handleZaloResponse(response);
    };
}