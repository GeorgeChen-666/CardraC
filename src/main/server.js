import { registerProjectAPI } from './plugins/projectHandler';
import { registerOtherAPI } from './plugins/otherHandler';
import ConfigWsHandler from './plugins/configWsHandler'
import TemplateWsHandler from './plugins/templateWsHandler'
import * as http from 'node:http';
import { wsManager } from './WebSocketManager';

const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { registerRoutes } = require('./plugins/fileBrowser');
const { registerImageAPI } = require('./plugins/imageHandler');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  path: '/ws'
});
wsManager.init(wss);
registerRoutes(app, '/browse');
registerImageAPI(app, '/api');
registerProjectAPI(app, '/api');
registerOtherAPI(app, '/api');
ConfigWsHandler(wsManager);
TemplateWsHandler(wsManager);

export const run = () => server.listen(3333, () => {
  console.log('✅ HTTP Server: http://localhost:3333/browse');
  console.log('✅ WebSocket Server: ws://localhost:3333/ws');
});
