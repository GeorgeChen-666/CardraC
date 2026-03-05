const { eleActions } = require('../../shared/constants');
const { getConfigStore, SimpleStore } = require('../functions');

const templateStore = new SimpleStore('templates')

const registerTemplateAPI = (app, basePath = '/api') => {
  app.get(`${basePath}/${eleActions.getTemplate}`, (req, res) => {
    try {
      const store = templateStore.get();
      res.json((store.templates || []));
    } catch (err) {
      console.error('Error getting templates:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  app.post(`${basePath}/${eleActions.setTemplate}`, (req, res) => {
    try {
      const { templateName: TemplateName } = req.body;

      if (!TemplateName || !TemplateName.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Template name is required'
        });
      }
      const { Config } = getConfigStore();
      const configCopy = { ...Config };
      delete configCopy.globalBackground;

      const store = templateStore.get();
      const existingTemplates = store.templates || [];

      const filteredTemplates = existingTemplates.filter(
        t => t.TemplateName !== TemplateName
      );

      const newTemplate = {
        id: Date.now(),
        TemplateName,
        Config: configCopy
      };

      const newStore = {
        templates: [...filteredTemplates, newTemplate]
      };
      templateStore.set(newStore)
      res.json({
        success: true,
        template: newTemplate
      });

    } catch (err) {
      console.error('❌ Save template failed:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  app.put(`${basePath}/${eleActions.editTemplate}`, (req, res) => {
    try {
      const { id, templateName: TemplateName } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Template id is required'
        });
      }

      if (!TemplateName || !TemplateName.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Template name is required'
        });
      }

      const store = templateStore.get();
      const templates = store.templates || [];
      const editingItem = templates.find(t => t.id === id);

      if (!editingItem) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      editingItem.TemplateName = TemplateName;
      templateStore.set(store);

      res.json({
        success: true,
        template: editingItem
      });

    } catch (err) {
      console.error('❌ Edit template failed:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // ✅ 删除模板
  app.delete(`${basePath}/${eleActions.deleteTemplate}`, (req, res) => {
    try {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Template id is required'
        });
      }

      const store = templateStore.get();
      const templates = store.templates || [];
      const templateToDelete = templates.find(t => t.id === id);

      if (!templateToDelete) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      const newStore = {
        templates: templates.filter(t => t.id !== id)
      };

      templateStore.set(newStore);

      console.log(`✅ Template deleted: ${templateToDelete.TemplateName}`);
      res.json({
        success: true,
        deletedId: id
      });

    } catch (err) {
      console.error('❌ Delete template failed:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });
};

module.exports = { registerTemplateAPI };
