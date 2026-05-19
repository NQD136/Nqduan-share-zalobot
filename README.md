# ZALO BOT - zlbotdqt

<div align="center">

![Status](https://img.shields.io/badge/Status-Active-success?style=for-the-badge)
![Version](https://img.shields.io/badge/Version-2.1.1-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-ISC-orange?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-14%2B-green?style=for-the-badge)

**Một bot Zalo đa năng, nhiều game, nhiều tiện ích, chạy theo kiểu gọn, nhanh, chắc.**

[Features](#-features) • [Quick Start](#-quick-start) • [Commands](#-commands) • [Config](#-config) • [Notes](#-notes)

</div>

---

## ✨ Features

> Một bộ bot được dựng để xử lý chat, game, media và quản trị nhóm trong một luồng duy nhất.

- 🎮 Game: Bầu Cua, Tài Xỉu, Cờ Caro, Cờ Tướng, Nông Trại, Vietlott, Fishing, Mini Game
- 🛡️ Bảo vệ nhóm: Anti-Spam, Anti-Badword, Anti-Nude, mute tự động, kiểm tra vi phạm
- 🎵 Media: Zingmp3, SoundCloud, NhacCuaTui, YouTube, TikTok, Capcut
- 💬 Chat: bot phản hồi, AI chat, SimSimi, học câu trả lời theo ngữ cảnh
- 👥 Quản lý nhóm: quyền admin, quét nhóm, thống kê, broadcast, cấu hình riêng
- ⏰ Tự động hóa: scheduler, PR automation, event hooks, cleanup job
- 🌐 Web dashboard: quản lý config, xem trạng thái, thao tác nhanh qua web

---

## 🚀 Quick Start

### Yêu cầu

```bash
Node.js 14+
npm hoặc yarn
FFmpeg
MySQL/MariaDB nếu dùng database
```

### Cài đặt

```bash
npm install
```

### Chạy bot

```bash
npm start
```

Hoặc:

```bash
node bot.js
npm run gopm2
run.bat
```

---

## ⚙️ Config

File cấu hình chính thường nằm ở:

- `assets/config.json`
- `assets/json-data/command-config.json`
- `assets/json-data/database-config.json`
- `assets/data/group_settings.json`

Ví dụ cấu hình tối thiểu:

```json
{
	"cookie": "YOUR_ZALO_COOKIE",
	"imei": "YOUR_DEVICE_IMEI",
	"userAgent": "YOUR_USER_AGENT",
	"prefix": "!",
	"adminIds": ["123456789"]
}
```

> Gợi ý: nếu bot không lên, kiểm tra lại cookie, imei, quyền admin và kết nối database.

---

## 📝 Commands

### Game

```bash
!bau-cua <bet>
!tai-xiu <bet>
!caro
!co-tuong
!chan-le <bet>
!vietlott
!nong-trai
!fishing
```

### Media

```bash
!mp3 <query>
!zing <query>
!yt <url>
!tiktok <url>
!sc <url>
!nct <query>
```

### Group & Admin

```bash
!scan
!rank
!admin <user>
!kick <user>
!mute <user> <time>
!broadcast <msg>
!stats
!help
```

---

## 🎮 What It Does

> Nói ngắn gọn: bot này không chỉ trả lời tin nhắn, mà còn xử lý game, lọc vi phạm, tải media và hỗ trợ quản trị nhóm theo kiểu tự động hóa trọn gói.

### Điểm nổi bật

- Chạy theo mô hình event-driven
- Tách service rõ cho game, chat, media, scheduler, web
- Có cache, log, và cơ chế bảo vệ nhóm
- Hỗ trợ nhiều luồng sử dụng khác nhau cho bot cá nhân hoặc bot nhóm

---

## 📦 Tech Stack

- Node.js
- Express
- MySQL
- FFmpeg
- Canvas
- Axios, Cheerio, JSDOM, node-fetch
- Google AI / generative AI integrations

---

## 🔒 Notes

> Một vài điểm nên nhớ khi dùng bot này:

- Đừng để lộ cookie hoặc file config nhạy cảm
- Nên backup dữ liệu JSON và logs định kỳ
- Nếu chạy nhiều bot, mỗi bot nên có config riêng
- Khi đổi command prefix, nhớ đồng bộ trong config nhóm

---

## 📜 License

ISC License

**Author:** Nqduan

**Status:** Active Development

---

<div align="center">

**Made with ❤️ for Zalo automation**

</div>
