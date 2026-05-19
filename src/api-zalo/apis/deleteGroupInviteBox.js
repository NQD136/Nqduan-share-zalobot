// Tên file: deleteGroupInviteBox.js (Đã sửa sang định dạng Factory chuẩn)

import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js"; 
import { Zalo } from "../index.js"; 
import { makeURL, encodeAES, request, handleZaloResponse } from "../utils.js";

/**
 * Factory để tạo hàm deleteGroupInviteBox
 * @param {API} api
 */
export function deleteGroupInviteBoxFactory(api) {
    
    // 1. Định nghĩa serviceURL với các tham số version
    const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/inv-box/mdel-inv`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });

    /**
     * Xóa lời mời tham gia nhóm khỏi hộp thư (có thể xóa nhiều lời mời)
     *
     * @param {string | string[]} groupId ID của nhóm (hoặc mảng ID nhóm)
     * @param {boolean} blockFutureInvite Có chặn lời mời trong tương lai từ nhóm này không (mặc định là false)
     *
     * @throws {ZaloApiError}
     */
    return async function deleteGroupInviteBox(groupId, blockFutureInvite = false) {
        
        // 2. Kiểm tra điều kiện bắt buộc
        if (!appContext.secretKey)
            throw new ZaloApiError("Missing required app context fields (secretKey)");
        if (!groupId || (Array.isArray(groupId) && groupId.length === 0))
            throw new ZaloApiError("Missing groupId");

        const grids = Array.isArray(groupId) ? groupId : [groupId];
        
        // 3. Chuẩn bị params
        const params = {
            // Danh sách lời mời cần xóa (được JSON.stringify)
            invitations: JSON.stringify(grids.map((grid) => ({ grid }))),
            // Trạng thái chặn lời mời (1 là Chặn, 0 là Không chặn)
            block: blockFutureInvite ? 1 : 0, 
        };
        
        // 4. Mã hóa params
        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams)
            throw new ZaloApiError("Failed to encrypt params");

        // 5. Gửi yêu cầu GET
        const response = await request(makeURL(serviceURL, { params: encryptedParams }), {
            method: "GET",
        });
        
        // 6. Xử lý kết quả
        return handleZaloResponse(response);
    };
}