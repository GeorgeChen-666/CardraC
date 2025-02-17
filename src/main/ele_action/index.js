import './handlers/pdf/Utils';
import ProjectActions from './handlers/ProjectActions';
import ConfigActions from './handlers/ConfigActions';
import ImageActions from './handlers/ImageActions';
import OtherActions from './handlers/OtherActions';
import TemplateActions from './handlers/TemplateActions';


export const registerRendererActionHandlers = (mainWindow) => {
  OtherActions(mainWindow);
  ProjectActions(mainWindow);
  ConfigActions(mainWindow);
  ImageActions(mainWindow);
  TemplateActions(mainWindow);
}