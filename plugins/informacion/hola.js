let handler = async (m, { conn }) => {

  await conn.sendMessage(m.chat, {
    text: '👋 Hola, elige una opción',
    footer: 'Angel Bot',
    title: 'MENÚ',
    buttonText: 'Abrir opciones',
    sections: [
      {
        title: 'Opciones',
        rows: [
          { title: '📋 Menú', description: 'Ver menú', rowId: '.menu' },
          { title: '📊 Estado', description: 'Ver estado', rowId: '.estado' }
        ]
      }
    ]
  }, { quoted: m })

}

handler.command = /^hola$/i
export default handler