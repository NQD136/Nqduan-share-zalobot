import { encodeAES, request, handleZaloResponse } from "../utils.js";
import { appContext } from "../context.js";

/**
 * Factory tạo API 'getAllFriends' (Lấy danh sách bạn bè).
 * Chuyển thể chuẩn từ getAllFriends.ts của zca (Dùng GET).
 */
export const getAllFriendsFactory = (api) => {
    
    return async function getAllFriends(count = 20000, page = 1) {
        // 1. URL API
        let serviceURL = api.zpwServiceMap.profile[0].replace("https//", "https://") + "/api/social/friend/getfriends";
        
        const url = new URL(serviceURL);
        url.searchParams.set('zpw_ver', api.apiVersion);
        url.searchParams.set('zpw_type', api.apiType);

        // 2. Params
        const params = {
            incInvalid: 1,
            page: page,
            count: count,
            avatar_size: 120,
            actiontime: 0,
            imei: appContext.imei,
        };

        // 3. Mã hóa
        const encryptedParams = encodeAES(api.secretKey, JSON.stringify(params));
        if (!encryptedParams) throw new Error("DQT_Error: Không thể mã hóa params");

        // 4. QUAN TRỌNG: Thêm params vào URL (GET Request)
        const finalURL = new URL(url.toString());
        finalURL.searchParams.set('params', encryptedParams);

        // 5. Gửi Request GET (Thay vì POST như cũ)
        const response = await request(finalURL.toString(), {
            method: "GET",
        });

        return handleZaloResponse(response);
    };
};