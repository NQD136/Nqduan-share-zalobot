import { Zalo } from "../index.js";
import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import {
    encodeAES,
    handleZaloResponse,
    makeURL,
    request,
    getImageMetaData // Giả sử getImageMetaData cũng được import từ utils.js
} from "../utils.js";

export function changeAccountAvatarFactory(api) {
    const serviceURL = makeURL(
        `${api.zpwServiceMap.profile[0]}/api/social/profile/setavatar`, // Đường dẫn API có thể khác, kiểm tra lại nếu cần
        {
            zpw_ver: Zalo.API_VERSION,
            zpw_type: Zalo.API_TYPE,
        }
    );

    /**
     * Đổi ảnh đại diện tài khoản Zalo của Bot
     * @param {string} avatarPath - Đường dẫn tuyệt đối đến file ảnh
     * @throws ZaloApiError
     */
    return async function changeAccountAvatar(avatarPath) {
        if (
            !appContext.secretKey ||
            !appContext.imei ||
            !appContext.cookie ||
            !appContext.userAgent
        )
            throw new ZaloApiError("Missing required app context fields");

        // --- SỬA LỖI TẠI ĐÂY ---
        // Buộc tham số phải là chuỗi (string)
        const filePath = String(avatarPath);

        if (!filePath) throw new ZaloApiError("Missing avatarPath");

        // Lấy metadata từ file (Đảm bảo getImageMetaData trả về cả buffer)
        const { metadata, fileBuffer } = await getImageMetaData(filePath); // Sử dụng filePath đã chuẩn hóa

        // Gửi request upload file
        const uploadResult = await request(
            metadata.uploadUrl,
            {
                method: "POST",
                body: fileBuffer, // Sử dụng buffer ảnh
                headers: {
                    "Content-Type": "application/octet-stream",
                    "X-Upload-Mode": 1
                }
            }
        );

        // Chuẩn bị tham số cho API chính
        const params = {
            attachId: metadata.fileId,
            imei: appContext.imei
        };

        const encryptedParams = encodeAES(
            appContext.secretKey,
            JSON.stringify(params)
        );
        if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

        // Gửi request đổi avatar
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