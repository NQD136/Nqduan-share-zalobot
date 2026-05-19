import { encodeAES, request, handleZaloResponse } from "../utils.js";
import { appContext } from "../context.js";

/**
 * Factory để tạo API 'updateProfile' (Cập nhật profile Zalo).
 * Chuyển thể từ updateProfile.ts của zca.
 */
export const updateProfileFactory = (api) => {
    
    /**
     * @param {object} payload - Đối tượng payload (chứa profile và biz)
     */
    return async function updateProfile(payload) {
        
        // 1. Lấy serviceURL và thêm tham số
        let serviceURL = api.zpwServiceMap.profile[0].replace("https//", "https://") + "/api/social/profile/update";
        const url = new URL(serviceURL);
        url.searchParams.set('zpw_ver', api.apiVersion);
        url.searchParams.set('zpw_type', api.apiType);

        // 2. Xây dựng params (dựa theo zca)
        const params = {
            profile: JSON.stringify({
                name: payload.profile.name,
                dob: payload.profile.dob,
                gender: payload.profile.gender,
            }),
            biz: JSON.stringify({
                desc: payload.biz?.description,
                cate: payload.biz?.cate,
                addr: payload.biz?.address,
                website: payload.biz?.website,
                email: payload.biz?.email,
            }),
            language: appContext.language,
        };

        // 3. Mã hóa params (dùng hàm của dqt)
        const encryptedParams = encodeAES(api.secretKey, JSON.stringify(params));
        if (!encryptedParams) throw new Error("DQT_Error: Không thể mã hóa params");

        // 4. Gửi Request (dùng hàm của dqt)
        const response = await request(url.toString(), {
            method: "POST",
            body: new URLSearchParams({
                params: encryptedParams,
            }),
        });

        // 5. Xử lý response (dùng hàm đã sửa lỗi của dqt)
        return handleZaloResponse(response);
    };
};