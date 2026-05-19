// File: getPendingFriendRequests.js
// Thay thế hoàn toàn cho getFriendRequests (đã die)
// Dùng API getFriendRecommendations (vẫn sống khỏe)

import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js";
import { encodeAES, request, handleZaloResponse, makeURL } from "../utils.js";

export function getPendingFriendRequestsFactory(api) {
    const serviceURL = makeURL(`${api.zpwServiceMap.friend[0]}/api/friend/recommendsv2/list`, {
        zpw_ver: api.API_VERSION,
        zpw_type: api.API_TYPE,
    });

    return async function getPendingFriendRequests() {
        if (!appContext.imei || !appContext.secretKey) {
            throw new ZaloApiError("Missing imei or secretKey");
        }

        const params = { imei: appContext.imei };
        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams) throw new ZaloApiError("AES encrypt failed");

        const finalURL = new URL(serviceURL);
        finalURL.searchParams.set("params", encryptedParams);

        const response = await request(finalURL.toString(), { method: "GET" });
        const result = await handleZaloResponse(response);

        if (result.error) throw new ZaloApiError(result.error.message, result.error.code);

        // LỌC CHÍNH XÁC recommItemType === 2 → lời mời đang chờ
        const pendingRequests = (result.data?.recommItems || [])
            .filter(item => item.recommItemType === 2)
            .map(item => {
                const info = item.dataInfo;
                return {
                    userId: info.userId,
                    displayName: info.displayName || info.zaloName || "Người dùng",
                    avatar: info.avatar || "",
                    recommTime: info.recommTime || 0,
                    recommInfo: {
                        message: info.recommInfo?.message || "Xin chào!",
                        source: info.recommInfo?.source || "unknown"
                    }
                };
            });

        return { ...result, data: pendingRequests };
    };
}