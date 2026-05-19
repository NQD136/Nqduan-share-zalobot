// Tên file: setPinnedConversations.js (Đã sửa sang định dạng Factory chuẩn)

import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js"; // Thêm appContext
import { Zalo } from "../index.js"; // Thêm Zalo
import { ThreadType } from "../models/index.js";
import { makeURL, encodeAES, request, handleZaloResponse } from "../utils.js"; // Thêm request, handleZaloResponse

/**
 * Factory để tạo hàm setPinnedConversations
 * @param {API} api
 */
export function setPinnedConversationsFactory(api) {
    
    // 1. Định nghĩa serviceURL (sửa lại cách tạo URL)
    const serviceURL = makeURL(`${api.zpwServiceMap.conversation[0]}/api/pinconvers/updatev2`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });

    /**
     * Pin và Unpin cuộc hội thoại (threads)
     *
     * @param {boolean} pinned true để ghim (1), false để bỏ ghim (2)
     * @param {string | string[]} threadId ID của cuộc hội thoại (hoặc mảng ID)
     * @param {ThreadType} type Loại cuộc hội thoại (User hoặc Group), mặc định là User
     *
     * @throws {ZaloApiError}
     *
     */
    return async function setPinnedConversations(pinned, threadId, type = ThreadType.User) {
        
        // 2. Kiểm tra điều kiện bắt buộc
        if (!appContext.secretKey)
            throw new ZaloApiError("Missing required app context fields");
        if (!threadId || (Array.isArray(threadId) && threadId.length === 0))
            throw new ZaloApiError("Missing threadId");
            
        if (typeof threadId == "string")
            threadId = [threadId];

        // 3. Chuẩn bị params
        const params = {
            actionType: pinned ? 1 : 2, // 1: Pin, 2: Unpin
            // Thêm tiền tố 'g' cho Group hoặc 'u' cho User
            conversations: type == ThreadType.Group 
                ? threadId.map((id) => `g${id}`) 
                : threadId.map((id) => `u${id}`), 
        };
        
        // 4. Mã hóa params
        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams)
            throw new ZaloApiError("Failed to encrypt params");
        
        // 5. Gửi yêu cầu POST
        const response = await request(serviceURL, {
            method: "POST",
            body: new URLSearchParams({
                params: encryptedParams,
            }),
        });

        // 6. Xử lý kết quả (Dùng handleZaloResponse)
        return handleZaloResponse(response);
    };
}