const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs').promises;
const path = require('path');
const bot = require('./index.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configurar pasta pública
app.use(express.static('public'));
app.use(express.json());

// Rota para carregar informações do negócio
app.get('/api/business', async (req, res) => {
  try {
    const data = await fs.readFile('./data/business.json', 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar informações' });
  }
});

// Rota para atualizar informações do negócio
app.post('/api/business', async (req, res) => {
  try {
    await fs.writeFile('./data/business.json', JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar informações' });
  }
});

// Rota para upload de mídia
app.post('/api/upload', async (req, res) => {
  // Implementar com multer para upload de arquivos
  res.json({ success: true, file: 'example.jpg' });
});

// Iniciar bot
bot.start(io);

// Rotinas automáticas (ex.: recontato a cada 24h)
setInterval(() => {
  // bot.recontactLeads(client); // Descomentar quando client estiver disponível
}, 24 * 60 * 60 * 1000);

server.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000');
});