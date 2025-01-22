import './handlers/pdf/Utils'
import ProjectActions  from './handlers/ProjectActions';
import ConfigActions from './handlers/ConfigActions';
import ImageActions from './handlers/ImageActions';
import OtherActions from './handlers/OtherActions';
import TemplateActions from './handlers/TemplateActions';


export const registerRendererActionHandlers = (mainWindow) => {
  const filePath = process.argv.find(arg => arg.endsWith('.cpnp'))
  if (filePath) {
    setTimeout(()=>{
      readFileToData(filePath).then(toRenderData => {
        renderLog(filePath, toRenderData);
        mainWindow.webContents.send('open-project-file', toRenderData);
      });
    },100)
  }

  OtherActions(mainWindow);
  ProjectActions(mainWindow);
  ConfigActions(mainWindow);
  ImageActions(mainWindow);
  TemplateActions(mainWindow);
}