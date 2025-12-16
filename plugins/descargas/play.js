"use strict"

import axios from "axios"
import yts from "yt-search"
import fs from "fs"
import path from "path"
import ffmpeg from "fluent-ffmpeg"
import { promisify } from "util"
import { pipeline } from "stream"

const streamPipe = promisify(pipeline)

const API_BASE = (process.env.API_BASE || "https://api-sky.ultraplus.click").replace(/\/+$/, "")
const API_KEY = process.env.API_KEY || "Russellxz"

const DEFAULT_VIDEO_QUALITY = "360"
const DEFAULT_AUDIO_FORMAT = "mp3"
const MAX_MB = 99

const VALID_QUALITIES = new Set(["144", "240", "360", "720", "1080", "1440", "4k"])

const pending = {}

function safeName(name = "file") {
  return (
    String(name)
      .slice(0, 90)
      .replace(/[^\w.\- ]+/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "file"
  )
}

function fileSizeMB(filePath) {
  const b = fs.statSync(filePath).size
  return b / (1024 * 1024)
}

function ensureTmp() {
  const tmp = path.join(process.cwd(), "tmp")
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })
  return tmp
}

function extractQualityFromText(input = "") {
  const t = String(input || "").toLowerCase()
  if (t.includes("4k")) return "4k"
  const m = t.match(/\b(144|240|360|720|1080|1440)\s*p?\b/)
  if (m && VALID_QUALITIES.has(m[1])) return m[1]
  return ""
}

function splitQueryAndQuality(rawText = "") {
  const t = String(rawText || "").trim()
  if (!t) return { query: "", quality: "" }
  const parts = t.split(/\s+/)
  const last = (parts[parts.length - 1] || "").toLowerCase()
  let q = ""
  if (last === "4k") q = "4k"
  else {
    const m = last.match(/^(144|240|360|720|1080|1440)p?$/i)
    if (m) q = m[1]
  }
  if (q) {
    parts.pop()
    return { query: parts.join(" ").trim(), quality: q }
  }
  return { query: t, quality: "" }
}

function isApiUrl(url = "") {
  try {
    const u = new URL(url)
    const b = new URL(API_BASE)
    return u.host === b.host
  } catch {
    return false
  }
}

async function downloadToFile(url, filePath) {
  const headers = {
    "User-Agent": "Mozilla/5.0",
    Accept: "*/*"
  }

  if (isApiUrl(url)) headers.apikey = API_KEY

  const res = await axios.get(url, {
    responseType: "stream",
    timeout: 180000,
    headers,
    maxRedirects: 5,
    validateStatus: () => true
  })

  if (res.status >= 400) throw new Error(`HTTP_${res.status}`)

  await streamPipe(res.data, fs.createWriteStream(filePath))
  return filePath
}

async function callYoutubeResolve(videoUrl, { type, quality, format }) {
  const endpoint = `${API_BASE}/youtube/resolve`

  const body =
    type === "video"
      ? { url: videoUrl, type: "video", quality: quality || DEFAULT_VIDEO_QUALITY }
      : { url: videoUrl, type: "audio", format: format || DEFAULT_AUDIO_FORMAT }

  const r = await axios.post(endpoint, body, {
    timeout: 120000,
    headers: {
      "Content-Type": "application/json",
      apikey: API_KEY,
      Accept: "application/json, */*"
    },
    validateStatus: () => true
  })

  const data = typeof r.data === "object" ? r.data : null
  if (!data) throw new Error("Respuesta no JSON del servidor")

  const ok = data.status === true || data.ok === true || data.success === true
  if (!ok) throw new Error(data.message || data.error || "Error en la API")

  const result = data.result || data.data || data
  if (!result?.media) throw new Error("API sin media")

  let dl = result.media.dl_download || ""
  if (dl.startsWith("/")) dl = API_BASE + dl

  return {
    title: result.title || "YouTube",
    thumbnail: result.thumbnail || "",
    dl_download: dl,
    direct: result.media.direct || ""
  }
}

let handler = async (msg, { conn, text }) => {
  const pref = global.prefixes?.[0] || "."
  const { query, quality } = splitQueryAndQuality(text)

  if (!query) {
    return conn.sendMessage(
      msg.key.remoteJid,
      { text: `✳️ Usa:\n${pref}play <término> [calidad]` },
      { quoted: msg }
    )
  }

  await conn.sendMessage(msg.key.remoteJid, { react: { text: "⏳", key: msg.key } })

  const res = await yts(query)
  const video = res.videos?.[0]
  if (!video) {
    return conn.sendMessage(msg.key.remoteJid, { text: "❌ Sin resultados." }, { quoted: msg })
  }

  const { url: videoUrl, title, timestamp, views, author, thumbnail } = video
  const viewsFmt = (views || 0).toLocaleString()

  const chosenQuality = VALID_QUALITIES.has(quality) ? quality : DEFAULT_VIDEO_QUALITY

  const caption = `
📀 Info:
❥ Título: ${title}
❥ Duración: ${timestamp}
❥ Vistas: ${viewsFmt}
❥ Autor: ${author?.name || author || "Desconocido"}
❥ Link: ${videoUrl}

⚙️ Calidad seleccionada: ${chosenQuality === "4k" ? "4K" : chosenQuality + "p"}
🎵 Audio: MP3

📥 Opciones:
👍 Audio
❤️ Video
📄 Audio doc
📁 Video doc

💡 Tip:
video 720
audio
`.trim()

  const preview = await conn.sendMessage(
    msg.key.remoteJid,
    { image: { url: thumbnail }, caption },
    { quoted: msg }
  )

  pending[preview.key.id] = {
    chatId: msg.key.remoteJid,
    videoUrl,
    title,
    commandMsg: msg,
    videoQuality: chosenQuality
  }

  await conn.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } })

  if (!conn._playproListener) {
    conn._playproListener = true

    conn.ev.on("messages.upsert", async (ev) => {
      for (const m of ev.messages) {
        if (m.message?.reactionMessage) {
          const { key, text: emoji } = m.message.reactionMessage
          const job = pending[key.id]
          if (job) await handleDownload(conn, job, emoji, job.commandMsg)
        }

        try {
          const context = m.message?.extendedTextMessage?.contextInfo
          const citado = context?.stanzaId
          const texto =
            m.message?.conversation ||
            m.message?.extendedTextMessage?.text ||
            ""

          const job = pending[citado]
          if (!job) continue

          const qFromReply = extractQualityFromText(texto)
          const first = texto.trim().toLowerCase().split(/\s+/)[0]

          if (["1", "audio", "4", "audiodoc"].includes(first)) {
            const doc = first === "4" || first === "audiodoc"
            await downloadAudio(conn, job, doc, m)
          }

          if (["2", "video", "3", "videodoc"].includes(first)) {
            const doc = first === "3" || first === "videodoc"
            const useQ = VALID_QUALITIES.has(qFromReply) ? qFromReply : job.videoQuality
            await downloadVideo(conn, { ...job, videoQuality: useQ }, doc, m)
          }
        } catch {}
      }
    })
  }
}

async function handleDownload(conn, job, emoji, quoted) {
  if (emoji === "👍") return downloadAudio(conn, job, false, quoted)
  if (emoji === "📄") return downloadAudio(conn, job, true, quoted)
  if (emoji === "❤️") return downloadVideo(conn, job, false, quoted)
  if (emoji === "📁") return downloadVideo(conn, job, true, quoted)
}

async function downloadAudio(conn, job, asDocument, quoted) {
  const resolved = await callYoutubeResolve(job.videoUrl, { type: "audio", format: DEFAULT_AUDIO_FORMAT })
  const mediaUrl = resolved.dl_download || resolved.direct

  const tmp = ensureTmp()
  const inFile = path.join(tmp, `${Date.now()}_in.bin`)
  const outFile = path.join(tmp, `${Date.now()}_${safeName(job.title)}.mp3`)

  await downloadToFile(mediaUrl, inFile)

  await new Promise((res, rej) => {
    ffmpeg(inFile).audioCodec("libmp3lame").audioBitrate("128k").save(outFile).on("end", res).on("error", rej)
  })

  if (fileSizeMB(outFile) > MAX_MB) {
    fs.unlinkSync(outFile)
    return conn.sendMessage(job.chatId, { text: "❌ Audio muy pesado." }, { quoted })
  }

  await conn.sendMessage(
    job.chatId,
    {
      [asDocument ? "document" : "audio"]: fs.readFileSync(outFile),
      mimetype: "audio/mpeg",
      fileName: `${safeName(job.title)}.mp3`
    },
    { quoted }
  )

  fs.unlinkSync(inFile)
  fs.unlinkSync(outFile)
}

async function downloadVideo(conn, job, asDocument, quoted) {
  const resolved = await callYoutubeResolve(job.videoUrl, { type: "video", quality: job.videoQuality })
  const mediaUrl = resolved.dl_download || resolved.direct

  const tmp = ensureTmp()
  const file = path.join(tmp, `${Date.now()}_${safeName(job.title)}_${job.videoQuality}.mp4`)

  await downloadToFile(mediaUrl, file)

  if (fileSizeMB(file) > MAX_MB) {
    fs.unlinkSync(file)
    return conn.sendMessage(job.chatId, { text: "❌ Video muy pesado." }, { quoted })
  }

  await conn.sendMessage(
    job.chatId,
    {
      [asDocument ? "document" : "video"]: fs.readFileSync(file),
      mimetype: "video/mp4",
      fileName: `${safeName(job.title)}.mp4`
    },
    { quoted }
  )

  fs.unlinkSync(file)
}

handler.help = ["play <texto>"]
handler.tags = ["descargas"]
handler.command = ["play"]

export default handler