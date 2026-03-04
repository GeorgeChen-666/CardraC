const fs = require('fs');
const path = require('path');
const os = require('os');
const { eleActions } = require('../../shared/constants');
const { getConfigStore } = require('../ele_action/functions');

// ✅ 模板存储文件路径
const TEMPLATE_DIR = path.join(os.homedir(), '.cardrac');
const TEMPLATE_FILE = path.join(TEMPLATE_DIR, 'templates.json');

// ✅ 确保目录存在
if (!fs.existsSync(TEMPLATE_DIR)) {
  fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
}

// ✅ 读取模板数据
const getTemplateStore = () => {
  try {
    if (fs.existsSync(TEMPLATE_FILE)) {
      const data = fs.readFileSync(TEMPLATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to read templates:', e);
  }
  return { templates: [] };
};

// ✅ 保存模板数据
const setTemplateStore = (data) => {
  try {
    fs.writeFileSync(TEMPLATE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save templates:', e);
    throw e;
  }
};

const registerTemplateAPI = (app, basePath = '/api') => {

  // ✅ 获取所有模板
  app.get(`${basePath}/${eleActions.getTemplate}`, (req, res) => {
    try {
      const store = getTemplateStore();
      res.json({
        success: true,
        templates: store.templates || []
      });
    } catch (err) {
      console.error('Error getting templates:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // ✅ 保存/更新模板
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

      const store = getTemplateStore();
      const existingTemplates = store.templates || [];

      // ✅ 移除同名模板（如果存在）
      const filteredTemplates = existingTemplates.filter(
        t => t.TemplateName !== TemplateName
      );

      // ✅ 添加新模板
      const newTemplate = {
        id: Date.now(),
        TemplateName,
        Config: configCopy
      };

      const newStore = {
        templates: [...filteredTemplates, newTemplate]
      };

      setTemplateStore(newStore);

      console.log(`✅ Template saved: ${TemplateName}`);
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

  // ✅ 编辑模板名称
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

      const store = getTemplateStore();
      const templates = store.templates || [];
      const editingItem = templates.find(t => t.id === id);

      if (!editingItem) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      editingItem.TemplateName = TemplateName;
      setTemplateStore(store);

      console.log(`✅ Template updated: ${TemplateName}`);
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

      const store = getTemplateStore();
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

      setTemplateStore(newStore);

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

  // ✅ 根据 ID 获取单个模板
  app.get(`${basePath}/${eleActions.getTemplate}/:id`, (req, res) => {
    try {
      const { id } = req.params;
      const store = getTemplateStore();
      const template = (store.templates || []).find(t => t.id === parseInt(id));

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      res.json({
        success: true,
        template
      });

    } catch (err) {
      console.error('Error getting template:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });
};

module.exports = { registerTemplateAPI };
