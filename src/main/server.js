import * as http from 'node:http';
import { wsManager } from './WebSocketManager';
import ConfigWsHandler from './plugins/configWsHandler'
import TemplateWsHandler from './plugins/templateWsHandler'
import OtherWsHandler from './plugins/otherWsHandler'
import ProjectWsHandler from './plugins/projectWsHandler'
import ImageWsHandler from './plugins/imageWsHandler'
import { initConfigStore } from './functions';

const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { registerRoutes } = require('./plugins/fileBrowser');
const { registerImageAPI } = require('./plugins/imageHandler');


initConfigStore();
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
ConfigWsHandler(wsManager);
TemplateWsHandler(wsManager);
OtherWsHandler(wsManager);
ProjectWsHandler(wsManager);
ImageWsHandler(wsManager);

export const run = () => server.listen(3334, () => {
  console.log('✅ HTTP Server: http://localhost:3333/browse');
  console.log('✅ WebSocket Server: ws://localhost:3333/ws');
});
