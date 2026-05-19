import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import * as cv from "./index.js";

// Tạo Hình Lệnh !Help
export async function createInstructionsImage(helpContent, isAdminBox, width = 800) {
  const ctxTemp = createCanvas(999, 999).getContext("2d");

  const space = 36;
  let yTemp = 60; 

  ctxTemp.font = "bold 28px Tahoma";
  for (const key in helpContent.allMembers) {
    if (helpContent.allMembers.hasOwnProperty(key)) {
      const keyHelpContent = `${helpContent.allMembers[key].icon} ${helpContent.allMembers[key].command}`;
      const labelWidth = ctxTemp.measureText(keyHelpContent).width;
      const valueHelpContent = " -> " + helpContent.allMembers[key].description;
      const lineWidth = labelWidth + space + ctxTemp.measureText(valueHelpContent).width;
      if (lineWidth > width) {
        yTemp += 52;
      }
      yTemp += 52;
    }
  }

  yTemp += 60;

  if (isAdminBox) {
    for (const key in helpContent.admin) {
      if (helpContent.admin.hasOwnProperty(key)) {
        const keyHelpContent = `${helpContent.admin[key].icon} ${helpContent.admin[key].command}`;
        const labelWidth = ctxTemp.measureText(keyHelpContent).width;
        const valueHelpContent = " -> " + helpContent.admin[key].description;
        const lineWidth = labelWidth + space + ctxTemp.measureText(valueHelpContent).width;
        if (lineWidth > width) {
          yTemp += 52;
        }
        yTemp += 52;
      }
    }
    yTemp += 60;
  }

  const height = yTemp > 430 ? yTemp : 430;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Nền đen
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  // Bộ icon phong phú hơn
  const icons = [
    "⭐","⚡","🔥","💎","✨","🌙","🎵","🌟","🎶","❤️","💖","💫","🌈","☀️",
    "🌸","🍀","🌹","🎇","🎉","🎁","🪐","🍎","🍔","🍕","🍩","🍓","🍒","🍇","🍉",
    "🐶","🐱","🐼","🐧","🐤","🦊","🦄","🐢","🐠","🦋","🐞",
    "😀","😁","😂","🤣","😎","😍","😘","🥳","🤩","😇",
    "🎂","🍻","🥂","🍷","🍫","🍪","🍰",
    "🏆","⚽","🏀","🎮","🎧","📱","💻","⌚",
    "✈️","🚀","🚗","🚲","🛸","🗺️","🌍","🌌","🌠"
  ];

  const positions = [];
  const minDistance = 40; // khoảng cách nhỏ hơn để nhiều icon hơn

  function isFarEnough(x, y) {
    for (const pos of positions) {
      const dx = x - pos.x;
      const dy = y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDistance) return false;
    }
    return true;
  }

  let placed = 0;
  let attempts = 0;
  while (placed < 110 && attempts < 2000) { // tối đa 110 icon
    attempts++;
    const icon = icons[Math.floor(Math.random() * icons.length)];
    const fontSize = Math.floor(Math.random() * 20) + 15; // 15px – 35px
    const x = Math.random() * width;
    const y = Math.random() * height;

    if (isFarEnough(x, y)) {
      ctx.font = `${fontSize}px Tahoma`;
      ctx.fillStyle = cv.getRandomGradient(ctx, width);
      ctx.globalAlpha = Math.random() * 0.3 + 0.2; // mỗi icon mờ khác nhau
      ctx.shadowColor = "rgba(255,255,255,0.5)";
      ctx.shadowBlur = 6;
      ctx.fillText(icon, x, y);

      positions.push({ x, y });
      placed++;
    }
  }

  // Reset lại style để vẽ text chính
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  let y = 60;

  // Vẽ tiêu đề
  ctx.textAlign = "left";
  ctx.font = "bold 28px Tahoma";
  ctx.fillStyle = cv.getRandomGradient(ctx, width);
  ctx.fillText(helpContent.title, space, y);

  y += 50;

  // Vẽ danh sách lệnh cho member
  ctx.textAlign = "left";
  ctx.font = "bold 28px Tahoma";
  ctx.fillStyle = "#FFFFFF";

  for (const key in helpContent.allMembers) {
    if (helpContent.allMembers.hasOwnProperty(key)) {
      ctx.fillStyle = cv.getRandomGradient(ctx, width);
      const keyHelpContent = `${helpContent.allMembers[key].icon} ${helpContent.allMembers[key].command}`;
      const labelWidth = ctx.measureText(keyHelpContent).width;
      ctx.fillText(keyHelpContent, space, y);
      ctx.fillStyle = "#FFFFFF";
      const valueHelpContent = " -> " + helpContent.allMembers[key].description;
      const lineWidth = labelWidth + space + ctx.measureText(valueHelpContent).width;
      if (lineWidth > width) {
        y += 52;
        ctx.fillText(valueHelpContent, space + 20, y);
      } else {
        ctx.fillText(valueHelpContent, space + labelWidth, y);
      }
      y += 52;
    }
  }

  // Nếu có phần admin
  if (isAdminBox) {
    if (Object.keys(helpContent.admin).length > 0) {
      y += 30;
      ctx.textAlign = "left";
      ctx.font = "bold 28px Tahoma";
      ctx.fillStyle = cv.getRandomGradient(ctx, width);
      ctx.fillText(helpContent.titleAdmin, space, y);
      y += 50;
      for (const key in helpContent.admin) {
        if (helpContent.admin.hasOwnProperty(key)) {
          ctx.fillStyle = cv.getRandomGradient(ctx, width);
          const keyHelpContent = `${helpContent.admin[key].icon} ${helpContent.admin[key].command}`;
          const labelWidth = ctx.measureText(keyHelpContent).width;
          ctx.fillText(keyHelpContent, space, y);
          ctx.fillStyle = "#FFFFFF";
          const valueHelpContent = " -> " + helpContent.admin[key].description;
          const lineWidth = labelWidth + space + ctx.measureText(valueHelpContent).width;
          if (lineWidth > width) {
            y += 52;
            ctx.fillText(valueHelpContent, space + 20, y);
          } else {
            ctx.fillText(valueHelpContent, space + labelWidth, y);
          }
          y += 52;
        }
      }
    }
  }

  // Xuất file ảnh
  const filePath = path.resolve(`./assets/temp/help_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}