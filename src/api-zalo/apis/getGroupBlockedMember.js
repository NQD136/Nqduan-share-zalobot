// Tên file: getGroupBlockedMember.js (hoặc grblocklist.js) (ĐÃ SỬA LẠI)

// 1. Import các file cần thiết
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js";
import { makeURL, encodeAES, request, handleZaloResponse } from "../utils.js";
import { Zalo } from "../index.js"; // Import Zalo

/**
 * Factory để tạo hàm getGroupBlockedMember
 * (Đã sửa lại để tương thích với zalo.js)
 * @param {API} api
 */
export function getGroupBlockedMemberFactory(api) {
    
    // 2. Sửa lại serviceURL (thêm zpw_ver và zpw_type)
    const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/blockedmems/list`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE
    });

    /**
     * Lấy danh sách thành viên bị chặn trong nhóm
     *
     * @param {object} payload - { page, count }
     * @param {string} groupId group id
     * @throws {ZaloApiError}
     */
    return async function getGroupBlockedMember(payload, groupId) {
        
        // 3. Thêm kiểm tra context
        if (!appContext.secretKey || !appContext.imei)
            throw new ZaloApiError("Missing required app context fields");

        // 4. Sửa lại params (thay 'ctx' bằng 'appContext')
        var _a, _b;
        const params = {
            grid: groupId,
            page: (_a = payload.page) !== null && _a !== void 0 ? _a : 1, //
            count: (_b = payload.count) !== null && _b !== void 0 ? _b : 50, //
            imei: appContext.imei, //
        };
        
        // 5. Sửa lại cách gọi encodeAES
        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams)
            throw new ZaloApiError("Failed to encrypt params");
        
        // 6. Sửa lại cách gọi request (GET method)
        const finalServiceUrl = new URL(serviceURL);
        finalServiceUrl.searchParams.append("params", encryptedParams);

        const response = await request(finalServiceUrl.toString(), {
            method: "GET",
        });

        // 7. Sửa lại cách xử lý kết quả
        const result = await handleZaloResponse(response);
        if (result.error)
            throw new ZaloApiError(result.error.message, result.error.code);
        return result.data;
    };
}