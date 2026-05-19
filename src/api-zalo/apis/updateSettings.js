import { encodeAES, request, handleZaloResponse } from "../utils.js";
import { appContext } from "../context.js";

/**
 * Factory để tạo API 'updateSettings' (Cập nhật cài đặt quyền riêng tư).
 * Chuyển thể từ updateSettings.ts của zca.
 */
export const updateSettingsFactory = (api) => {
    
    // URL cố định (hard-coded trong zca)
    // Lưu ý: Chúng ta vẫn thêm zpw_ver/type để đảm bảo an toàn
    const baseURL = "https://wpa.chat.zalo.me/api/setting/update";
    const url = new URL(baseURL);
    url.searchParams.set('zpw_ver', api.apiVersion);
    url.searchParams.set('zpw_type', api.apiType);
    const serviceURL = url.toString();

    /**
     * @param {string} type - Tên cài đặt (ví dụ: 'view_birthday')
     * @param {number} value - Giá trị cài đặt (ví dụ: 0, 1, 2)
     */
    return async function updateSettings(type, value) {
        
        // 1. Xây dựng params
        // Lưu ý: key của params chính là biến 'type'
        const params = {
            [type]: value,
        };

        // 2. Mã hóa params (dùng hàm của dqt)
        const encryptedParams = encodeAES(api.secretKey, JSON.stringify(params));
        if (!encryptedParams) throw new Error("DQT_Error: Không thể mã hóa params");

        // 3. Thêm params đã mã hóa vào URL query (GET request)
        const finalURL = new URL(serviceURL);
        finalURL.searchParams.set('params', encryptedParams);

        // 4. Gửi Request GET
        const response = await request(finalURL.toString(), {
            method: "GET",
        });

        // 5. Xử lý response
        return handleZaloResponse(response);
    };
};