import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

global.owner = [
'217158512549931', 
'227045091090524',
'202864794312920', 
''
] 

global.mods = []
global.prems = []

global.emoji = '📎'
global.emoji2 = '🏞️'
global.namebot = '𝓡𝓸𝓼𝓮𝓷𝓭𝓸 𝓮𝓵 𝓶𝓮𝓳𝓸𝓻'
global.botname = '𝓡𝓸𝓼𝓮𝓷𝓭𝓸 𝓮𝓵 𝓶𝓮𝓳𝓸𝓻'
global.banner = 'https://files.catbox.moe/nueszo.jpg'
global.packname = '𝓡𝓸𝓼𝓮𝓷𝓭𝓸 𝓮𝓵 𝓶𝓮𝓳𝓸𝓻'
global.author = '𝖣𝖾𝗌𝖺𝗋𝗅𝗅𝖺𝖽𝗈 𝗉𝗈𝗋 HERNANDEZ'
global.sessions = '𝓡𝓸𝓼𝓮𝓷𝓭𝓸 𝓮𝓵 𝓶𝓮𝓳𝓸𝓻'

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