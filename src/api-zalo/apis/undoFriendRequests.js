// File: undoFriendRequest.js (chuẩn mới – giống các API khác)
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";
import { Zalo } from "../index.js";

export function undoFriendRequestFactory(api) {
    const serviceURL = makeURL(`${api.zpwServiceMap.friend[0]}/api/friend/undo`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });

    /**
     * HỦY LẠI LỜI MỜI KẾT BẠN đã gửi đi
     * @param {string|number} friendId UID người nhận lời mời
     */
    return async function undoFriendRequest(friendId) {
        if (!appContext.secretKey)
            throw new ZaloApiError("Missing app context");

        const params = { fid: friendId.toString() };

        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

        const response = await request(serviceURL, {
            method: "POST",
            body: new URLSearchParams({ params: encryptedParams }),
        });

        const result = await handleZaloResponse(response);
        if (result.error) throw new ZaloApiError(result.error.message, result.error.code);

        return result.data;
    };
}