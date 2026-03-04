import { registerProjectAPI } from './plugins/projectHandler';
import { registerTemplateAPI } from './plugins/templateHandler';
import { registerConfigAPI } from './plugins/configHandler';
import { registerOtherAPI } from './plugins/otherHandler';

const express = require('express');
const cors = require('cors');
const { registerRoutes } = require('./plugins/fileBrowser');
const { registerImageAPI } = require('./plugins/imageHandler');

const app = express();
app.use(cors());
app.use(express.json());

registerRoutes(app, '/browse');
registerImageAPI(app, '/api');
registerProjectAPI(app, '/api');
registerTemplateAPI(app, '/api');
registerOtherAPI(app, '/api');
registerConfigAPI(app, '/api')

export const run = () => app.listen(3333, () => console.log('✅ http://localhost:3333/browse'));
