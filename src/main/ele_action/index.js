import '../services/file_render/utils';
import ConfigActions from './handlers/ConfigActions';
import OtherActions from './handlers/OtherActions';
import ProjectActions from './handlers/ProjectActions';

import ImageActions from './handlers/ImageActions';

import PrinterActions from './handlers/PrinterActions';
import FileBrowserActions from './handlers/FileBrowserActions';
import { initConfigStore } from '../services/store';


let currentMainWindow = null;
let handlersRegistered = false;

export const getMainWindow = () => currentMainWindow;

export const registerRendererActionHandlers = async (mainWindow) => {
  currentMainWindow = mainWindow;

  if (handlersRegistered) {
    return;
  }

  await initConfigStore();
  ConfigActions(getMainWindow);
  OtherActions(getMainWindow);
  ProjectActions(getMainWindow);
  ImageActions(getMainWindow);
  PrinterActions(getMainWindow);
  FileBrowserActions(getMainWindow);
  handlersRegistered = true;
}