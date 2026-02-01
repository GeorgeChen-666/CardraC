import './handlers/file_render/Utils';
import ProjectActions from './handlers/ProjectActions';
import ConfigActions from './handlers/ConfigActions';
import ImageActions from './handlers/ImageActions';
import OtherActions from './handlers/OtherActions';
import TemplateActions from './handlers/TemplateActions';
import PrinterActions from './handlers/PrinterActions';
import { initConfigStore } from './functions';


export const registerRendererActionHandlers = async (mainWindow) => {
  await initConfigStore();
  OtherActions(mainWindow);
  ProjectActions(mainWindow);
  ConfigActions(mainWindow);
  ImageActions(mainWindow);
  TemplateActions(mainWindow);
  PrinterActions(mainWindow);
}