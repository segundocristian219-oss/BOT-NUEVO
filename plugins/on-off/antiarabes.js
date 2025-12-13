import fetch from 'node-fetch';

const gemini = {
  getNewCookie: async function () {
    const res = await fetch(
      "https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&bl=boq_assistant-bard-web-server_20250814.06_p1&f.sid=-7816331052118000090&hl=en-US&_reqid=173780&rt=c",
      {
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: "f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&",
        method: "POST",
      }
    );

    const cookieHeader = res.headers.get('set-cookie');
    if (!cookieHeader) throw new Error('No se encontró el set-cookie.');
    return cookieHeader.split(';')[0];
  },

  ask: async function (prompt, previousId = null) {
    if (!prompt?.trim()) throw new Error("Mensaje vacío");

    let resumeArray = null;
    let cookie = null;

    if (previousId) {
      try {
        const s = Buffer.from(previousId, 'base64').toString('utf-8');
        const j = JSON.parse(s);
        resumeArray = j.newResumeArray;
        cookie = j.cookie;
      } catch {}
    }

    const headers = {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      "x-goog-ext-525001261-jspb": "[1,null,null,null,\"9ec249fc9ad08861\",null,null,null,[4]]",
      "cookie": cookie || await this.getNewCookie(),
    };

    const b = [[prompt], ["en-US"], resumeArray];
    const a = [null, JSON.stringify(b)];
    const body = new URLSearchParams({ "f.req": JSON.stringify(a) });

    const response = await fetch(
      "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?rt=c",
      { method: 'POST', headers, body }
    );

    const data = await response.text();
    const chunks = [...data.matchAll(/^\d+\n(.+?)\n/gm)].map(v => v[1]);

    let text, newResumeArray;

    for (const c of chunks.reverse()) {
      try {
        const j = JSON.parse(c);
        const p = JSON.parse(j[0][2]);
        text = p[4][0][1][0];
        newResumeArray = [...p[1], p[4][0][0]];
        break;
      } catch {}
    }

    if (!text) throw new Error("No se pudo leer respuesta");

    const id = Buffer
      .from(JSON.stringify({ newResumeArray, cookie: headers.cookie }))
      .toString('base64');

    return { text, id };
  }
};

const geminiSessions = {};

/* 🔥 AQUÍ ESTÁ LA MAGIA */
const handler = async (m, { conn }) => {
  if (!m.text) return;
  if (m.key.fromMe) return;        // no responderse solo
  if (m.isBaileys) return;
  if (m.text.startsWith('.') || m.text.startsWith('/')) return;

  try {
    const prev = geminiSessions[m.sender];
    const res = await gemini.ask(m.text, prev);
    geminiSessions[m.sender] = res.id;

    await conn.sendMessage(
      m.chat,
      { text: res.text },
      { quoted: m }
    );

  } catch (e) {
    console.error(e);
  }
};

handler.all = true;
export default handler;