// api/zalo/removeFriendAlias.js
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js";
import { Zalo } from "../index.js";
import { encodeAES, request, makeURL, handleZaloResponse } from "../utils.js";

export function removeFriendAliasFactory(api) {
    const serviceURL = makeURL(`${api.zpwServiceMap.alias[0]}/api/alias/remove`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE
    });

    return async function removeFriendAlias(friendId) {
        if (!appContext.secretKey) throw new ZaloApiError("Missing secretKey");
        if (!friendId) throw new ZaloApiError("Missing friendId");

        const params = { friendId };

        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

        const response = await request(makeURL(serviceURL, { params: encryptedParams }), {
            method: "GET"
        });

        const result = await handleZaloResponse(response);
        if (result.error) throw new ZaloApiError(result.error.message, result.error.code);
        return result.data;
    };
}