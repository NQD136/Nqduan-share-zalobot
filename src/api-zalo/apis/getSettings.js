// Tên file: getSettings.js (ĐÃ SỬA LỖI 602)

// 1. Import các file cần thiết
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js";
import { makeURL, encodeAES, request, handleZaloResponse } from "../utils.js";
import { Zalo } from "../index.js"; // <-- THÊM IMPORT ZALO

/**
 * Factory để tạo hàm getSettings
 * (Đã sửa lại để tương thích với zalo.js)
 * @param {API} api
 */
export function getSettingsFactory(api) {
    
    // 2. (*** PHẦN ĐÃ SỬA LỖI 602 ***)
    // Thêm zpw_ver và zpw_type (giống các file API khác)
    const serviceURL = makeURL(`https://wpa.chat.zalo.me/api/setting/me`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE
    });
    // (*** KẾT THÚC SỬA ***)

    /**
     * Lấy Cài đặt tài khoản
     *
     * @throws {ZaloApiError}
     */
    return async function getSettings() {
        
        // 3. Thêm kiểm tra context
        if (!appContext.secretKey || !appContext.imei)
            throw new ZaloApiError("Missing required app context fields");

        // 4. Giữ nguyên params (từ V2)
        const params = {
            imei: appContext.imei
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
            // (Dòng 52)
            throw new ZaloApiError(result.error.message, result.error.code); 
        return result.data;
    };
}