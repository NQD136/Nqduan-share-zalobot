import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";
import { Zalo } from "../index.js";

export function getGroupInfoFactory(api) {
    const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/getmg-v2`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });
    /**
     * Get group information
     *
     * @param groupId Group ID or list of group IDs
     *
     * @throws ZaloApiError
     */
    return async function getGroupInfo(groupId) {
        if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
            throw new ZaloApiError("Missing required app context fields");
        if (!groupId) throw new ZaloApiError("Missing groupId");
        if (!Array.isArray(groupId)) groupId = [groupId];

        let params = {
            gridVerMap: {},
        };
        for (const id of groupId) {
            params.gridVerMap[id] = 0;
        }
        params.gridVerMap = JSON.stringify(params.gridVerMap);
        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams)
            throw new ZaloApiError("Failed to encrypt message");
        const response = await request(serviceURL, {
            method: "POST",
            body: new URLSearchParams({
                params: encryptedParams,
            }),
        });
        const result = await handleZaloResponse(response);
        if (result.error)
            throw new ZaloApiError(result.error.message, result.error.code);
        return result.data;
    };
}

/**
 * Factory tạo hàm lấy avatar profile (bk_full_avatar, full_avatar).
 *
 * @param api API client đã khởi tạo với zpwServiceMap
 */
export function getProfileAvatarFactory(api) {
    const profileHost = api?.zpwServiceMap?.profile?.[0] || "https://tt-profile-wpa.chat.zalo.me";

    return async function getProfileAvatar(avatarParams) {
        if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
            throw new ZaloApiError("Missing required app context fields");
        if (!avatarParams)
            throw new ZaloApiError("Missing avatar params");

        let encryptedParams;
        if (typeof avatarParams === "string") {
            encryptedParams = avatarParams;
        } else {
            const payload = { ...avatarParams };
            if (!payload.imei && appContext.imei)
                payload.imei = appContext.imei;
            encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(payload));
        }
        if (!encryptedParams)
            throw new ZaloApiError("Failed to encrypt avatar params");

        const avatarURL = makeURL(`${profileHost}/api/social/profile/avatar`, {
            zpw_ver: Zalo.API_VERSION,
            zpw_type: Zalo.API_TYPE,
            params: encryptedParams,
        });

        const response = await request(avatarURL, {
            method: "GET",
        });
        const result = await handleZaloResponse(response);
        if (result.error)
            throw new ZaloApiError(result.error.message, result.error.code);

        return result.data;
    };
}
