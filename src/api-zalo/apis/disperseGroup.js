// Tên file: disperseGroup.js (ĐÃ SỬA LẠI ĐỂ TƯƠNG THÍCH)

// 1. Import các file cần thiết
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js";
import { makeURL, encodeAES, request, handleZaloResponse } from "../utils.js";
import { Zalo } from "../index.js"; // Import Zalo

/**
 * Factory để tạo hàm disperseGroup
 * (Đã sửa lại để tương thích với zalo.js)
 * @param {API} api
 */
export function disperseGroupFactory(api) {
    
    // 2. Sửa lại serviceURL (thêm zpw_ver và zpw_type)
    const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/disperse`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE
    });

    /**
     * Giải tán nhóm
     *
     * @param {string} groupId Group ID to disperse Group from
     * @throws {ZaloApiError}
     */
    return async function disperseGroup(groupId) {
        
        // 3. Thêm kiểm tra context
        if (!appContext.secretKey || !appContext.imei)
            throw new ZaloApiError("Missing required app context fields");

        // 4. Sửa lại params (thay 'ctx' bằng 'appContext')
        const params = {
            grid: groupId,
            imei: appContext.imei, //
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