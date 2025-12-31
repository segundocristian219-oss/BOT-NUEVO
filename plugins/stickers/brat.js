import axios from "axios"
import { Sticker } from "wa-sticker-formatter"

const API_BASE = (global.APIs.may || "").replace(/\/+$/, "")
const API_KEY = global.APIKeys.may || ""

const handler = async (m, { conn, text }) => {
  const quotedText =
    m.quoted?.text ||
    m.quoted?.caption ||
    m.quoted?.conversation ||
    ""

  const input = text?.trim() || quotedText.trim()

  if (!input) {
    return conn.sendMessage(
      m.chat,
      { text: "✳️ Usa:\n.brat <texto>\nO responde a un mensaje con .brat" },
      { quoted: m }
    )
  }

  await conn.sendMessage(m.chat, {
    react: { text: "🕒", key: m.key }
  })

  try {
    const senderName = m.pushName || "Usuario"

    const res = await axios.get(`${API_BASE}/brat`, {
      params: { text: input, apikey: API_KEY }
    })

    if (!res.data?.status) throw "Error API"

    const imgUrl = res.data.result.url

    const img = await axios.get(imgUrl, {
      responseType: "arraybuffer"
    })

    const sticker = new Sticker(img.data, {
      type: "full",
      pack: senderName,
      author: "",
      quality: 100
    })

    const stickerBuffer = await sticker.toBuffer()

    await conn.sendMessage(
      m.chat,
      { sticker: stickerBuffer },
      { quoted: m }
    )

    await conn.sendMessage(m.chat, {
      react: { text: "✅", key: m.key }
    })

  } catch (e) {
    await conn.sendMessage(
      m.chat,
      { text: `❌ Error: ${e}` },
      { quoted: m }
    )
  }
}

handler.command = ["brat"]
export default handler