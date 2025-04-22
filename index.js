const venom = require('venom-bot');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');

// Banco de dados SQLite
const db = new sqlite3.Database('./canil.db', (err) => {
  if (err) console.error('Erro ao abrir banco de dados:', err);
  else console.log('Banco de dados conectado');
});

// Criar tabelas
db.run(`
  CREATE TABLE IF NOT EXISTS leads (
    phone TEXT PRIMARY KEY,
    name TEXT,
    city TEXT,
    interest TEXT,
    last_contact TEXT,
    status TEXT
  )
`);

// Cache para evitar duplicatas
const processedMessages = new Set();

// Informações do negócio (carregadas de business.json)
let businessInfo = {};

// Carregar informações do negócio
async function loadBusinessInfo() {
  try {
    const data = await fs.readFile('./data/business.json', 'utf-8');
    businessInfo = JSON.parse(data);
  } catch (error) {
    console.error('Erro ao carregar business.json:', error);
    businessInfo = {
      price: 'R$ 5.000,00',
      payment: 'Parcelamento em até 6x no cartão',
      delivery: 'Entrega em até 7 dias na região de SP',
      puppies: [],
      parents: [],
    };
    await fs.writeFile('./data/business.json', JSON.stringify(businessInfo, null, 2));
  }
}

module.exports = {
  start: async function (io) {
    await loadBusinessInfo();

    venom
      .create({ session: 'canil-session' })
      .then((client) => startBot(client, io))
      .catch((error) => console.error('Erro ao criar cliente:', error));
  },
};

async function startBot(client, io) {
  client.onAnyMessage(async (message) => {
    const messageId = message.id || `${message.from}_${message.to}_${message.body}_${message.t}`;
    if (processedMessages.has(messageId)) {
      console.log(`Mensagem duplicada ignorada: ${messageId}`);
      return;
    }
    processedMessages.add(messageId);

    const msgData = {
      id: messageId,
      from: message.from,
      to: message.to,
      body: message.body,
      timestamp: new Date().toLocaleString(),
      isSent: message.fromMe,
      isBot: false,
    };

    io.emit('newMessage', msgData);
    console.log(`${msgData.isSent ? 'Sent to' : 'Received from'} ${msgData.isSent ? msgData.to : msgData.from}: ${msgData.body}`);

    // Bot: responder apenas a mensagens recebidas
    if (!message.fromMe) {
      const response = await generateBotResponse(message, client);
      const botMessageId = `bot_${messageId}_${Date.now()}`;
      processedMessages.add(botMessageId);

      try {
        await client.sendText(message.from, response);
        console.log(`Bot respondeu para ${message.from}: ${response}`);

        const botMsgData = {
          id: botMessageId,
          from: 'Bot',
          to: message.from,
          body: response,
          timestamp: new Date().toLocaleString(),
          isSent: true,
          isBot: true,
        };
        io.emit('newMessage', botMsgData);
      } catch (error) {
        console.error(`Erro ao enviar resposta do bot: ${error}`);
      }
    }
  });
}

// Lógica do bot com IA simulada (substituir por Grok API ou Dialogflow)
async function generateBotResponse(message, client) {
  const body = message.body.toLowerCase();
  const phone = message.from;

  // Verificar se o lead já está cadastrado
  const lead = await new Promise((resolve) => {
    db.get('SELECT * FROM leads WHERE phone = ?', [phone], (err, row) => {
      resolve(row);
    });
  });

  if (!lead) {
    // Novo lead: iniciar cadastro
    await db.run(
      'INSERT INTO leads (phone, name, city, interest, last_contact, status) VALUES (?, ?, ?, ?, ?, ?)',
      [phone, '', '', 'Iniciado', new Date().toISOString(), 'Pendente']
    );
    return `Olá! Bem-vindo ao nosso canil de Pastores Alemães! 😊 Qual é o seu nome?`;
  } else if (!lead.name) {
    // Coletar nome
    await db.run('UPDATE leads SET name = ?, last_contact = ? WHERE phone = ?', [
      message.body,
      new Date().toISOString(),
      phone,
    ]);
    return `Ótimo, ${message.body}! De qual cidade você é?`;
  } else if (!lead.city) {
    // Coletar cidade
    await db.run('UPDATE leads SET city = ?, last_contact = ? WHERE phone = ?', [
      message.body,
      new Date().toISOString(),
      phone,
    ]);
    return `Perfeito! Você está interessado em um filhote agora? (Preço: ${businessInfo.price}, ${businessInfo.payment})`;
  } else {
    // Lead já cadastrado: qualificar interesse
    if (body.includes('interessado') || body.includes('quero')) {
      await db.run('UPDATE leads SET interest = ?, status = ?, last_contact = ? WHERE phone = ?', [
        'Alta',
        'Interessado',
        new Date().toISOString(),
        phone,
      ]);
      return `Que ótimo! Temos filhotes disponíveis por ${businessInfo.price}. ${businessInfo.payment}. ${businessInfo.delivery}. Deseja ver fotos ou vídeos?`;
    } else if (body.includes('foto') || body.includes('vídeo')) {
      // Enviar mídia (exemplo: enviar primeira foto disponível)
      if (businessInfo.puppies.length > 0) {
        try {
          await client.sendImage(
            message.from,
            path.join(__dirname, 'public', 'uploads', businessInfo.puppies[0].file),
            'Filhote Pastor Alemão',
            'Confira um de nossos filhotes!'
          );
          return 'Foto enviada! Deseja mais detalhes ou agendar uma visita?';
        } catch (error) {
          console.error('Erro ao enviar foto:', error);
          return 'Desculpe, houve um erro ao enviar a foto. Deseja mais detalhes?';
        }
      } else {
        return 'No momento, não temos fotos disponíveis. Deseja mais informações sobre os filhotes?';
      }
    } else {
      return `Entendi! Você tem alguma dúvida? Podemos falar sobre preço (${businessInfo.price}), entrega (${businessInfo.delivery}) ou ver fotos dos filhotes!`;
    }
  }
}

// Função para disparar listas de transmissão
async function sendBroadcast(message) {
  const leads = await new Promise((resolve) => {
    db.all('SELECT phone FROM leads WHERE status = ?', ['Interessado'], (err, rows) => {
      resolve(rows);
    });
  });

  for (const lead of leads) {
    try {
      // Simular envio (substituir por client.sendText em produção)
      console.log(`Enviando transmissão para ${lead.phone}: ${message}`);
    } catch (error) {
      console.error(`Erro ao enviar transmissão para ${lead.phone}: ${error}`);
    }
  }
}

// Função para recontato com leads pendentes
async function recontactLeads(client) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const leads = await new Promise((resolve) => {
    db.all('SELECT * FROM leads WHERE status = ? AND last_contact < ?', ['Pendente', oneDayAgo], (err, rows) => {
      resolve(rows);
    });
  });

  for (const lead of leads) {
    try {
      await client.sendText(lead.phone, `Oi, ${lead.name || 'cliente'}! Ainda está interessado em nossos filhotes de Pastor Alemão? 😊`);
      await db.run('UPDATE leads SET last_contact = ? WHERE phone = ?', [new Date().toISOString(), lead.phone]);
      console.log(`Recontato enviado para ${lead.phone}`);
    } catch (error) {
      console.error(`Erro ao recontactar ${lead.phone}: ${error}`);
    }
  }
}