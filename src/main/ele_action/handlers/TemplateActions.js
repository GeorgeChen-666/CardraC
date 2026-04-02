import { ipcMain } from 'electron';
import Store from 'electron-store';
import { getConfigStore } from '../../services/store';
import { eleActions } from '../../../shared/constants';

export default (mainWindow) => {
  const templateStore = new Store({name: 'templates'});
  ipcMain.on(eleActions.setTemplate, async (event, args) => {
    const { templateName: TemplateName } = args;

    const { Config } = getConfigStore()
    delete Config.globalBackground;
    const lastStore = templateStore.get();
    const newStore = { templates: [...(lastStore.templates || []).filter(t=> t.TemplateName !== TemplateName), {
        id: new Date().getTime(),
        TemplateName,
        Config
      }]}
    templateStore.set(newStore);
    mainWindow.webContents.send(args.returnChannel);
  });
  ipcMain.on(eleActions.editTemplate, async (event, args) => {
    const { id, templateName: TemplateName } = args;
    const lastStore = templateStore.get();
    const editingItem = (lastStore.templates || []).find(t=> t.id === id);
    if(editingItem) {
      editingItem.TemplateName = TemplateName;
      templateStore.set(lastStore);
    }
    mainWindow.webContents.send(args.returnChannel);
  });
  ipcMain.on(eleActions.deleteTemplate, async (event, args) => {
    const { id } = args;
    const lastStore = templateStore.get();
    const newStore =  { templates: (lastStore.templates || []).filter(t=> t.id !== id) }
    templateStore.set(newStore);
    mainWindow.webContents.send(args.returnChannel);
  });
  ipcMain.on(eleActions.getTemplate, async (event, args) => {
    const lastStore = templateStore.get();
    mainWindow.webContents.send(args.returnChannel, (lastStore.templates || []));
  });
}