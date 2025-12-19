import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

global.owner = ['217158512549931', '227045091090524','274135666176172', '217158512549931', '226044783132714', '25856038715509']

global.mods = []
global.prems = []

global.emoji = '📎'
global.emoji2 = '🏞️'
global.namebot = '𝐒𝐇𝐀𝐃𝐎𝐖 𝐁𝐎𝐓'
global.redes = 'https://whatsapp.com/channel/0029VbAe8TMHgZWirR5n1Y1P'
global.botname = '𝐒𝐇𝐀𝐃𝐎𝐖 𝐁𝐎𝐓'
global.banner = 'https://files.catbox.moe/igdrbi.jpg'
global.packname = '𝐒𝐇𝐀𝐃𝐎𝐖 𝐁𝐎𝐓'
global.author = '𝖣𝖾𝗌𝖺𝗋𝗋𝗈𝗅𝗅𝖺𝖽𝗈 𝗉𝗈𝗋 Hernandez'
global.libreria = 'Baileys'
global.baileys = 'V 6.7.16'
global.vs = '2.2.0'
global.usedPrefix = '.'
global.user2 = '18'
global.sessions = '𝐒𝐇𝐀𝐃𝐎𝐖 𝐁𝐎𝐓'

global.namecanal = '𝐒𝐇𝐀𝐃𝐎𝐖 𝐁𝐎𝐓 𝖣𝖾𝗌𝖺𝗋𝗋𝗈𝗅𝗅𝗈'
global.idcanal = ''
global.idcanal2 = ''
global.canal = 'https://whatsapp.com/channel/0029VbAe8TMHgZWirR5n1Y1P'
global.canalreg = ''

global.ch = {
  ch1: ''
}

global.multiplier = 69
global.maxwarn = 2

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Se actualizo el 'config.js'"))
  import(`file://${file}?update=${Date.now()}`)
})
