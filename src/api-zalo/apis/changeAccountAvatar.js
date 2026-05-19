// Tên file: changeAccountAvatar.js (hoặc chgAccAvt.js) (ĐÃ SỬA LỖI TREO - V5)

// 1. Import các file cần thiết
import FormData from "form-data";
import fs from "node:fs"; // (Dùng 'fs' (đồng bộ))
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js"; 
import { Zalo } from "../index.js"; 

// (*** PHẦN ĐÃ SỬA LỖI ***)
// (Import 'loadImage' (file 71) từ 'canvas' (file 71) 
// (mà file 'key-list.js' (file 71) của bạn đang dùng))
import { loadImage } from "canvas"; 
import { makeURL, encodeAES, request, handleZaloResponse } from "../utils.js";
// (*** KẾT THÚC SỬA ***)

/**
 * Factory để tạo hàm changeAccountAvatar
 * (Đã sửa lại để tương thích với zalo.js)
 * @param {API} api
 */
export function changeAccountAvatarFactory(api) {
    
    // 2. Sửa lại serviceURL (thêm zpw_ver và zpw_type)
    const serviceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/profile/upavatar`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE
    });

    /**
     * Thay đổi ảnh đại diện tài khoản (Bot)
     *
     * @param {string} avatarSource - Chỉ nhận ĐƯỜNG DẪN file cục bộ (string)
     * @throws {ZaloApiError}
     */
    return async function changeAccountAvatar(avatarSource) {
        
        // 3. Thêm kiểm tra context
        if (!appContext.secretKey || !appContext.imei || !appContext.uid || !appContext.language)
            throw new ZaloApiError("Missing required app context fields");

        if (typeof avatarSource !== "string") {
            throw new ZaloApiError("avatarSource phải là một đường dẫn file (string)");
        }
        
        // 4. (*** PHẦN ĐÃ SỬA LỖI TREO ***)
        
        // 4a. Đọc file (đồng bộ)
        const avatarData = fs.readFileSync(avatarSource);
        
        // 4b. Lấy dung lượng file THẬT (từ buffer)
        const fileSize = avatarData.length; // (Ví dụ: 7168 bytes)

        // 4c. Dùng 'loadImage' (file 71) (từ 'canvas' (file 71)) 
        // để lấy Width/Height thật từ file (đã độn)
        let imageMetaData;
        try {
            // (Chúng ta load 'avatarSource' (đường dẫn) 
            // thay vì 'avatarData' (buffer)
            // để 'canvas' (file 71) tự xử lý file Jpeg (file 117) (đã độn))
            const image = await loadImage(avatarSource); 
            imageMetaData = { width: image.width, height: image.height };
        } catch (e) {
            console.error("[changeAccountAvatar] Lỗi khi dùng loadImage (file 71):", e.message);
            // Fallback (dùng nếu 'canvas' (file 71) lỗi)
            imageMetaData = { width: 1080, height: 1080 };
        }
        
        const params = {
            avatarSize: 120,
            clientId: String(appContext.uid + Date.now()), // (Sửa lỗi 'formatTime' (file 113))
            language: appContext.language, 
            metaData: JSON.stringify({
                origin: {
                    width: imageMetaData.width || 1080, // <-- Dùng Width thật
                    height: imageMetaData.height || 1080, // <-- Dùng Height thật
                },
                processed: {
                    width: imageMetaData.width || 1080, // <-- Dùng Width thật
                    height: imageMetaData.height || 1080, // <-- Dùng Height thật
                    size: fileSize, // <-- Dùng Size thật (7KB+)
                },
            }),
        };
        // (*** KẾT THÚC SỬA ***)


        // 5. Đóng gói FormData
        const formData = new FormData();
        formData.append("fileContent", avatarData, {
            filename: "blob",
            contentType: "image/jpeg",
        });

        // 6. Sửa lại cách gọi encodeAES
        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams)
            throw new ZaloApiError("Failed to encrypt params");

        // 7. Sửa lại cách gọi request
        const response = await request(makeURL(serviceURL, {
            params: encryptedParams,
        }), {
            method: "POST",
            headers: formData.getHeaders(),
            body: formData.getBuffer(),
        });

        // 8. Sửa lại cách xử lý kết quả
        const result = await handleZaloResponse(response);
        if (result.error)
            // (Dòng 91)
            throw new ZaloApiError(result.error.message, result.error.code); 
        return result.data;
    };
}