import zhLocale from '../../../main/locales/zh.json';

const footerSummaryText = `${zhLocale.footer.files} 1 / ${zhLocale.footer.images} 1`;

const editView = {
  body: {
    visibleTestIds: ['card-list'],
    hiddenTestIds: ['print-preview'],
  },
  menu: {
    visibleTexts: [zhLocale.toolbar.lblShowOverviewWindow, zhLocale.toolbar.lblViewFrontLarge],
    hiddenButtons: [zhLocale.toolbar.btnPrev, zhLocale.toolbar.btnNext],
    hiddenInputs: ['1'],
  },
  footer: {
    currentView: zhLocale.footer.editView,
    summaryText: footerSummaryText,
    visibleButtons: [zhLocale.footer.editView, zhLocale.footer.previewView],
  },
};

const previewView = {
  body: {
    visibleTestIds: ['print-preview'],
    hiddenTestIds: ['card-list'],
  },
  menu: {
    visibleButtons: [zhLocale.toolbar.btnPrev, zhLocale.toolbar.btnNext],
    visibleInputs: ['1'],
    hiddenTexts: [zhLocale.toolbar.lblShowOverviewWindow, zhLocale.toolbar.lblViewFrontLarge, zhLocale.toolbar.lblViewBackLarge],
  },
  footer: {
    currentView: zhLocale.footer.previewView,
    summaryText: footerSummaryText,
    visibleButtons: [zhLocale.footer.editView, zhLocale.footer.previewView],
  },
};

export const viewSwitchCases = [
  {
    name: '编辑模式切换到预览模式时，界面应切换到预览视图',
    initialView: 'edit',
    initialExpectation: editView,
    transitions: [
      {
        targetViewLabel: zhLocale.footer.previewView,
        expectedView: previewView,
      },
    ],
  },
  {
    name: '预览模式下再次点击预览时，界面不应发生变化',
    initialView: 'preview',
    initialExpectation: previewView,
    transitions: [
      {
        targetViewLabel: zhLocale.footer.previewView,
        expectedView: previewView,
      },
    ],
  },
  {
    name: '预览模式切换回编辑模式时，界面应切换到编辑视图',
    initialView: 'preview',
    initialExpectation: previewView,
    transitions: [
      {
        targetViewLabel: zhLocale.footer.editView,
        expectedView: editView,
      },
    ],
  },
];


