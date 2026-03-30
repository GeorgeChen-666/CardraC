import '../services/file_render/utils';
import ConfigActions from './handlers/ConfigActions';
import OtherActions from './handlers/OtherActions';
import ProjectActions from './handlers/ProjectActions';

import ImageActions from './handlers/ImageActions';

import TemplateActions from './handlers/TemplateActions';
import PrinterActions from './handlers/PrinterActions';
import FileBrowserActions from './handlers/FileBrowserActions';
import { initConfigStore } from '../services/store';


export const registerRendererActionHandlers = async (mainWindow) => {
  await initConfigStore();
  ConfigActions(mainWindow);
  OtherActions(mainWindow);
  ProjectActions(mainWindow);
  ImageActions(mainWindow);
  TemplateActions(mainWindow);
  PrinterActions(mainWindow);
  FileBrowserActions(mainWindow);
}