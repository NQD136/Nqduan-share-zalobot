// Tên file: acceptFriendRequest.js (ĐÃ SỬA LẠI ĐỂ TƯƠNG THÍCH)

// 1. Import các file cần thiết (giống các file API cũ)
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js";
import { makeURL, encodeAES, request, handleZaloResponse } from "../utils.js";
import { Zalo } from "../index.js"; // Import Zalo

/**
 * Factory để tạo hàm acceptFriendRequest
 * (Đã sửa lại để tương thích với zalo.js)
 * @param {API} api
 */
export function acceptFriendRequestFactory(api) {
    
    // 2. Sửa lại serviceURL (thêm zpw_ver và zpw_type)
    const serviceURL = makeURL(`${api.zpwServiceMap.friend[0]}/api/friend/accept`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE
    });

    /**
     * Chấp nhận lời mời kết bạn
     *
     * @param {string} friendId The friend ID to user request is accept
     * @throws {ZaloApiError}
     */
    return async function acceptFriendRequest(friendId) {
        
        // 3. Thêm kiểm tra context
        if (!appContext.secretKey)
            throw new ZaloApiError("Missing required app context fields");
        if (!friendId) 
            throw new ZaloApiError("Missing friendId");

        // 4. Sửa lại params (thay 'ctx' bằng 'appContext')
        const params = {
            fid: friendId,
            language: appContext.language, //
        };
        
        // 5. Sửa lại cách gọi encodeAES
        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams)
            throw new ZaloApiError("Failed to encrypt params");
        
        // 6. Sửa lại cách gọi request
        const response = await request(serviceURL, {
            method: "POST",
            body: new URLSearchParams({
                params: encryptedParams,
            }),
        });

        // 7. Sửa lại cách xử lý kết quả
        const result = await handleZaloResponse(response);
        if (result.error)
            throw new ZaloApiError(result.error.message, result.error.code);
        return result.data;
    };
}