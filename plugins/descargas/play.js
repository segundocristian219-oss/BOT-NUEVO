import axios from "axios"
import yts from "yt-search"
import fs from "fs"
import path from "path"
import ffmpeg from "fluent-ffmpeg"
import { promisify } from "util"
import { pipeline } from "stream"
import crypto from "crypto"

const streamPipe = promisify(pipeline)
const TMP_DIR = path.join(process.cwd(), "tmp")
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

const CACHE_FILE = path.join(TMP_DIR, "cache.json")
const SKY_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click"
const SKY_KEY = process.env.API_KEY || "Neveloopp"
const MAX_CONCURRENT = 3
const MAX_FILE_MB = 99
const DOWNLOAD_TIMEOUT = 60000
const MAX_RETRIES = 3
const CACHE_TTL = 1000 * 60 * 60 * 24 * 7

let activeDownloads = 0
const downloadQueue = []
const downloadTasks = {}
let cache = loadCache()
let playListenerInstalled = false

function saveCache() {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)) } catch {}
}

function loadCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return {}
    const data = JSON.parse(fs.readFileSync(CACHE_FILE))
    const now = Date.now()
    for (const k of Object.keys(data)) {
      if (now - data[k].timestamp > CACHE_TTL) delete data[k]
    }
    return data
  } catch {
    return {}
  }
}

function safeUnlink(f) {
  try { f && fs.existsSync(f) && fs.unlinkSync(f) } catch {}
}

function validCache(f) {
  try { return f && fs.existsSync(f) && fs.statSync(f).size > 500000 } catch { return false }
}

async function queueDownload(task) {
  if (activeDownloads >= MAX_CONCURRENT)
    await new Promise(r => downloadQueue.push(r))
  activeDownloads++
  try { return await task() }
  finally {
    activeDownloads--
    downloadQueue.shift()?.()
  }
}

async function getSkyUrl(url, format) {
  try {
    const { data } = await axios.get(`${SKY_BASE}/api/download/yt.php`, {
      params: { url, format },
      headers: { Authorization: `Bearer ${SKY_KEY}` },
      timeout: 20000
    })
    return data?.data?.audio || data?.data?.video || data?.url
  } catch {
    return null
  }
}

async function download(url, file) {
  const res = await axios.get(url, {
    responseType: "stream",
    timeout: DOWNLOAD_TIMEOUT
  })
  await streamPipe(res.data, fs.createWriteStream(file))
}

async function toMp3(input) {
  const out = input.replace(/\.\w+$/, ".mp3")
  await new Promise((res, rej) =>
    ffmpeg(input)
      .audioBitrate("128k")
      .save(out)
      .on("end", res)
      .on("error", rej)
  )
  safeUnlink(input)
  return out
}

async function startDownload(videoUrl, key, mediaUrl) {
  if (!downloadTasks[videoUrl]) downloadTasks[videoUrl] = {}
  if (downloadTasks[videoUrl][key]) return downloadTasks[videoUrl][key]

  const ext = key.startsWith("audio") ? "mp3" : "mp4"
  const file = path.join(TMP_DIR, `${crypto.randomUUID()}.${ext}`)

  downloadTasks[videoUrl][key] = queueDownload(async () => {
    await download(mediaUrl, file)
    return file
  })

  return downloadTasks[videoUrl][key]
}

async function sendFile(conn, chat, file, title, isDoc, type, quoted) {
  if (!validCache(file)) return
  if (type === "video") {
    await conn.sendMessage(chat, {
      video: { url: file },
      fileName: `${title}.mp4`
    }, { quoted })
  } else {
    const buf = fs.readFileSync(file)
    await conn.sendMessage(chat, {
      audio: buf,
      mimetype: "audio/mpeg",
      fileName: `${title}.mp3`
    }, { quoted })
  }
}

const pending = {}

function pendingAdd(id, data) {
  pending[id] = data
  setTimeout(() => delete pending[id], 15 * 60 * 1000)
}

function pendingGet(id) {
  return pending[id]
}

async function handleDownload(conn, job, emoji) {
  const map = { "👍": "audio", "❤️": "video", "📄": "audioDoc", "📁": "videoDoc" }
  const key = map[emoji]
  const type = key.startsWith("audio") ? "audio" : "video"
  const cached = cache[job.videoUrl]?.[key]

  if (cached && validCache(cached))
    return sendFile(conn, job.chatId, cached, job.title, false, type, job.commandMsg)

  const mediaUrl = await getSkyUrl(job.videoUrl, type)
  if (!mediaUrl)
    return conn.sendMessage(job.chatId, { text: "❌ Error obteniendo enlace" }, { quoted: job.commandMsg })

  const file = await startDownload(job.videoUrl, key, mediaUrl)

  cache[job.videoUrl] = cache[job.videoUrl] || {}
  cache[job.videoUrl][key] = file
  saveCache()

  await sendFile(conn, job.chatId, file, job.title, false, type, job.commandMsg)
}

const handler = async (msg, { conn, text, command }) => {
  if (!text)
    return conn.sendMessage(msg.chat, { text: "✳️ Usa .play <texto>" }, { quoted: msg })

  const res = await yts(text)
  const v = res.videos[0]
  if (!v)
    return conn.sendMessage(msg.chat, { text: "❌ Sin resultados" }, { quoted: msg })

  const caption = `🎧 ${v.title}\n⏱️ ${v.timestamp}\n👁️ ${v.views.toLocaleString()}\n\n👍 Audio\n❤️ Video`
  const sent = await conn.sendMessage(msg.chat, {
    image: { url: v.thumbnail },
    caption
  }, { quoted: msg })

  pendingAdd(sent.key.id, {
    chatId: msg.chat,
    videoUrl: v.url,
    title: v.title,
    sender: msg.sender,
    commandMsg: msg,
    downloading: false
  })

  if (!playListenerInstalled) {
    conn.ev.on("messages.upsert", async ev => {
      for (const m of ev.messages) {
        const react = m.message?.reactionMessage
        if (!react) continue
        const job = pendingGet(react.key.id)
        if (!job) continue
        if ((react.sender || m.sender) !== job.sender) {
          await conn.sendMessage(job.chatId, { text: "❌ Solo quien pidió el comando" })
          continue
        }
        if (job.downloading) continue
        job.downloading = true
        try { await handleDownload(conn, job, react.text) }
        finally { job.downloading = false }
      }
    })
    playListenerInstalled = true
  }
}

handler.help = ["play"]
handler.tags = ["descargas"]
handler.command = ["play"]
export default handler