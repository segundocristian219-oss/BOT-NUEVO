import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

global.owner = [
'217158512549931', 
'227045091090524',
'148103877402760', 
''
] 

global.mods = []
global.prems = []

global.emoji = '📎'
global.emoji2 = '🏞️'
global.namebot = '𝐙𝐘𝐑𝐎 𝐀𝐈'
global.botname = '𝐙𝐘𝐑𝐎 𝐀𝐈'
global.banner = 'https://cdn.russellxz.click/41c554f2.jpg'
global.packname = '𝐙𝐘𝐑𝐎 𝐀𝐈'
global.author = '𝖣𝖾𝗌𝖺𝗋𝗅𝗅𝖺𝖽𝗈 𝗉𝗈𝗋 HERNANDEZ'
global.sessions = '𝐙𝐘𝐑𝐎 𝐀𝐈'

global.APIs = {
sky: 'https://api-sky.ultraplus.click',
may: 'https://mayapi.ooguy.com'
}

global.APIKeys = {
sky: 'Angxlllll',
may: 'may-0595dca2'
}

const file = fileURLToPath(import.meta.url)
watchFile(file, () => {
unwatchFile(file)
console.log(chalk.redBright("Se actualizó el 'config.js'"))
import(`file://${file}?update=${Date.now()}`)
})