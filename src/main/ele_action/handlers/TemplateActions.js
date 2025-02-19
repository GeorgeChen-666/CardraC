import { ipcMain } from 'electron';
import Store from 'electron-store';

const store = new Store();
export default (mainWindow) => {
  const templateStore = new Store({name: 'templates'});
  ipcMain.on('set-template', async (event, args) => {
    const { templateName: TemplateName } = args;

    const { Config } = store.get() || {}
    const lastStore = templateStore.get();
    const newStore = { templates: [...(lastStore.templates || []).filter(t=> t.TemplateName !== TemplateName), {
        id: new Date().getTime(),
        TemplateName,
        Config
      }]}
    templateStore.set(newStore);
    mainWindow.webContents.send(args.returnChannel);
  });
  ipcMain.on('edit-template', async (event, args) => {
    const { id, templateName: TemplateName } = args;
    const lastStore = templateStore.get();
    const editingItem = (lastStore.templates || []).find(t=> t.id === id);
    if(editingItem) {
      editingItem.TemplateName = TemplateName;
      templateStore.set(lastStore);
    }
    mainWindow.webContents.send(args.returnChannel);
  });
  ipcMain.on('delete-template', async (event, args) => {
    const { id } = args;
    const lastStore = templateStore.get();
    const newStore =  { templates: (lastStore.templates || []).filter(t=> t.id !== id) }
    templateStore.set(newStore);
    mainWindow.webContents.send(args.returnChannel);
  });
  ipcMain.on('get-template', async (event, args) => {
    const lastStore = templateStore.get();
    mainWindow.webContents.send(args.returnChannel, (lastStore.templates || []));
  });
}