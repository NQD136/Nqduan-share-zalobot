import { encodeAES, request, handleZaloResponse } from "../utils.js";
import { appContext } from "../context.js";

/**
 * Factory tạo API 'getFriendRequests' (Lấy danh sách lời mời kết bạn).
 * Dựa trên file getFriendRecommendations.ts của zca.
 */
export const getFriendRequestsFactory = (api) => {
    
    return async function getFriendRequests() {
        // 1. URL chuẩn từ file getFriendRecommendations.ts
        let serviceURL = api.zpwServiceMap.friend[0].replace("https//", "https://") + "/api/friend/recommendsv2/list";
        
        const url = new URL(serviceURL);
        url.searchParams.set('zpw_ver', api.apiVersion);
        url.searchParams.set('zpw_type', api.apiType);

        // 2. Params chỉ cần IMEI (theo file gốc)
        const params = {
            imei: appContext.imei,
        };

        const encryptedParams = encodeAES(api.secretKey, JSON.stringify(params));
        if (!encryptedParams) throw new Error("DQT_Error: Không thể mã hóa params");

        const finalURL = new URL(url.toString());
        finalURL.searchParams.set('params', encryptedParams);

        // 3. Gửi Request GET
        const response = await request(finalURL.toString(), {
            method: "GET",
        });

        // 4. Xử lý response
        const result = await handleZaloResponse(response);
        
        // 5. Lọc và Chuẩn hóa dữ liệu
        if (result.data && Array.isArray(result.data.recommItems)) {
            // Lọc: Chỉ lấy item có recommItemType == 2 (Lời mời đã nhận)
            const friendRequests = result.data.recommItems
                .filter(item => item.recommItemType === 2)
                .map(item => {
                    const info = item.dataInfo;
                    // Map lại các trường để dễ dùng trong lệnh myacc
                    return {
                        userId: info.userId,
                        displayName: info.displayName || info.zaloName || "Người dùng",
                        avatar: info.avatar,
                        recommTime: info.recommTime,
                        recommInfo: {
                            message: info.recommInfo?.message || "Xin chào!",
                            source: info.recommInfo?.source
                        }
                    };
                });

            // Trả về danh sách đã lọc
            return { ...result, data: friendRequests };
        }

        return result;
    };
};