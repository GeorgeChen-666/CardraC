import { getConfigStore } from '../functions';
import { SimpleStore } from '../functions';
import { eleActions } from '../../shared/constants';

const templateStore = new SimpleStore('templates')

export default (wsManager) => {
  wsManager.on(eleActions.setTemplate, async (event, args) => {
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
    wsManager.send(args.returnChannel);
  });
  wsManager.on(eleActions.editTemplate, async (event, args) => {
    const { id, templateName: TemplateName } = args;
    const lastStore = templateStore.get();
    const editingItem = (lastStore.templates || []).find(t=> t.id === id);
    if(editingItem) {
      editingItem.TemplateName = TemplateName;
      templateStore.set(lastStore);
    }
    wsManager.send(args.returnChannel);
  });
  wsManager.on(eleActions.deleteTemplate, async (event, args) => {
    const { id } = args;
    const lastStore = templateStore.get();
    const newStore =  { templates: (lastStore.templates || []).filter(t=> t.id !== id) }
    templateStore.set(newStore);
    wsManager.send(args.returnChannel);
  });
  wsManager.on(eleActions.getTemplate, async (event, args) => {
    const lastStore = templateStore.get();
    wsManager.send(args.returnChannel, (lastStore.templates || []));
  });
}