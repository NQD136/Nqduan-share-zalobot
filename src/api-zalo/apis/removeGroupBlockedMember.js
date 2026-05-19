// Tên file: removeGroupBlockedMember.js (ĐÃ SỬA LẠI ĐỂ TƯƠNG THÍCH)

// 1. Import các file cần thiết
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js";
import { makeURL, encodeAES, request, handleZaloResponse } from "../utils.js";
import { Zalo } from "../index.js"; // Import Zalo

/**
 * Factory để tạo hàm removeGroupBlockedMember (UNBLOCK)
 * (Đã sửa lại để tương thích với zalo.js)
 * @param {API} api
 */
export function removeGroupBlockedMemberFactory(api) {
    
    // 2. Sửa lại serviceURL (thêm zpw_ver và zpw_type)
    const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/blockedmems/remove`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE
    });

    /**
     * Mở chặn (Unblock) thành viên khỏi nhóm
     *
     * @param {string|string[]} memberId member id(s)
     * @param {string} groupId group id
     * @throws {ZaloApiError}
     */
    return async function removeGroupBlockedMember(memberId, groupId) {
        
        // 3. Thêm kiểm tra context
        if (!appContext.secretKey)
            throw new ZaloApiError("Missing required app context fields");

        // 4. Giữ nguyên logic (từ file 86)
        if (!Array.isArray(memberId))
            memberId = [memberId];
        
        // 5. Sửa lại params (thay 'ctx' bằng 'appContext')
        const params = {
            grid: groupId,
            members: memberId,
        };
        
        // 6. Sửa lại cách gọi encodeAES
        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams)
            throw new ZaloApiError("Failed to encrypt params");
        
        // 7. Sửa lại cách gọi request (GET method)
        const finalServiceUrl = new URL(serviceURL);
        finalServiceUrl.searchParams.append("params", encryptedParams);

        const response = await request(finalServiceUrl.toString(), {
            method: "GET",
        });

        // 8. Sửa lại cách xử lý kết quả
        const result = await handleZaloResponse(response);
        if (result.error)
            throw new ZaloApiError(result.error.message, result.error.code);
        return result.data;
    };
}