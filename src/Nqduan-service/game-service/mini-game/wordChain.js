import { MessageType } from "zlbotdqt";
import axios from "axios";
import { getGlobalPrefix } from "../../service.js";
import { getActiveGames, checkHasActiveGame } from "./index.js";



export async function handleWordChainCommand(api, message) {
  const threadId = message.threadId;
  const args = message.data.content.split(" ");

  if (args[1]?.toLowerCase() === "cancel") {
    if (getActiveGames().has(threadId)) {
      getActiveGames().delete(threadId);
      await api.sendMessage(
        { msg: "Trò chơi nối từ đã được hủy bỏ.", quote: message },
        threadId,
        message.type
      );
    } else {
      await api.sendMessage(
        { msg: "Không có trò chơi nối từ nào đang diễn ra để hủy bỏ.", quote: message },
        threadId,
        message.type
      );
    }
    return;
  }

  if (await checkHasActiveGame(api, message, threadId)) {
    return;
  }

  // Khởi tạo game mới
  getActiveGames().set(threadId, { 
    type: 'wordChain', 
    game: { 
      lastPhrase: "", 
      players: new Set(), 
      botTurn: false, 
      maxWords: 2 
    } 
  });

  await api.sendMessage(
    { msg: "Trò chơi nối từ bắt đầu! Hãy nhập một cụm từ (tối đa 2 từ) để bắt đầu.", quote: message },
    threadId,
    message.type
  );
}

export async function handleWordChainMessage(api, message) {
  const threadId = message.threadId;
  const activeGames = getActiveGames();

  if (!activeGames.has(threadId) || activeGames.get(threadId).type !== 'wordChain') return;

  const game = activeGames.get(threadId).game;

  // Làm sạch dữ liệu đầu vào
  const cleanContent = message.data.content.trim().toLowerCase();
  const cleanContentTrim = cleanContent.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  
  if (cleanContent !== cleanContentTrim) return;

  const words = cleanContentTrim.split(/\s+/);

  // Kiểm tra số lượng từ
  if (words.length > game.maxWords) {
    await api.sendMessage(
      { msg: `Bạn đã thua! Cụm từ của bạn vượt quá ${game.maxWords} từ cho phép.`, quote: message },
      threadId,
      message.type
    );
    activeGames.delete(threadId);
    return;
  }

  if (!game.botTurn) {
    const lastWordOfPrevious = game.lastPhrase.split(/\s+/).pop();
    
    // Kiểm tra tính hợp lệ của từ nối
    if (game.lastPhrase === "" || cleanContentTrim.startsWith(lastWordOfPrevious)) {
      game.lastPhrase = cleanContentTrim;
      game.players.add(message.data.uidFrom);
      game.botTurn = true;

      // Tìm từ nối tiếp theo
      const botPhrase = await findNextPhrase(game.lastPhrase);
      
      if (botPhrase) {
        game.lastPhrase = botPhrase;
        await api.sendMessage(
          {
            msg: `Bot: ${botPhrase}\nCụm từ tiếp theo phải bắt đầu bằng "${botPhrase.split(/\s+/).pop()}".`,
            quote: message,
          },
          threadId,
          message.type
        );
        game.botTurn = false;
      } else {
        await api.sendMessage(
          { msg: "Bot không tìm được cụm từ phù hợp. Bạn thắng!", quote: message },
          threadId,
          message.type
        );
        activeGames.delete(threadId);
      }
    } else {
      await api.sendMessage(
        {
          msg: `Cụm từ không hợp lệ! Cụm từ phải bắt đầu bằng "${lastWordOfPrevious}".`,
          quote: message,
        },
        threadId,
        message.type
      );
    }
  } else {
    game.botTurn = false;
  }

  // Kết thúc nếu đủ số người chơi hoặc điều kiện khác
  if (game.players.size >= 10) {
    await api.sendMessage(
      { msg: "Trò chơi kết thúc! Cảm ơn 10 người chơi đầu tiên đã tham gia.", quote: message },
      threadId,
      message.type
    );
    activeGames.delete(threadId);
  }
}


async function findNextPhrase(lastPhrase) {
  try {
    const word = lastPhrase.split(/\s+/).pop();
    const encodedWord = encodeURIComponent(word);
    
    // Sử dụng một API nối từ công cộng khác hoặc tự xử lý
    // Ví dụ sử dụng API của meewmeew hoặc simsimi (nếu có logic nối từ)
    const response = await axios.get(
      `https://api.meewmeew.info/wordchain/next?word=${encodedWord}` 
    ).catch(() => null);

    if (response && response.data && response.data.next) {
      return response.data.next;
    }

   return null; 
  } catch (error) {
    console.error("Lỗi khi tìm từ nối:", error.message);
    return null;
  }
}