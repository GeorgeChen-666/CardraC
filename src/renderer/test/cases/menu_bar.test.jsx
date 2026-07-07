// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { screen } from '@testing-library/react';
import { MainPage } from '../pages/MainPage';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../setup/rendererCaseBootstrap';
import { mergeRendererState } from '../helpers/rendererTestSetup';
import { layoutSides } from '../../../shared/constants';
import zhLocale from '../../../main/locales/zh.json';

const { toolbar: t } = zhLocale;

describe('工具栏', () => {
  afterEach(() => {
    cleanupRendererCase();
  });

  const renderMenuBar = async () => {
    const { Main } = await import('../../parts/Main');
    renderRendererCase(<Main />);
    return new MainPage();
  };

  describe('按钮可见性', () => {
    test('编辑模式下所有基础按钮应可见', async () => {
      bootstrapRendererCase({ currentView: 'edit' });
      const page = await renderMenuBar();

      const visibleButtons = [
        t.btnAdd, t.btnOpen, t.btnSave,
        t.btnUndo, t.btnRedo,
        t.btnLang, t.btnConfig,
        t.btnExport.replace('{{format}}', 'PDF'),
        t.btnExport.replace('{{format}}', 'PNG'),
        t.compressLevel, t.print,
        t.btnGlobalBack,
        'Chat', 'GitHub', t.btnAbout,
      ];

      visibleButtons.forEach((label) => {
        expect(page.menu.getButton(label)).toBeTruthy();
      });
    });

    test('全局背景按钮在双面模式下可见', async () => {
      bootstrapRendererCase({ currentView: 'edit' });
      const page = await renderMenuBar();

      expect(page.menu.getButton(t.btnGlobalBack)).toBeTruthy();
    });

    test('全局背景按钮在单面模式下隐藏', async () => {
      bootstrapRendererCase({
        currentView: 'edit',
        state: { Config: { sides: layoutSides.oneSide } },
      });
      const page = await renderMenuBar();

      expect(page.menu.queryButton(t.btnGlobalBack)).toBeNull();
    });
  });

  describe('按钮禁用状态', () => {
    test('无历史记录时撤销和重做按钮应禁用', async () => {
      bootstrapRendererCase({ currentView: 'edit' });
      const page = await renderMenuBar();

      expect(page.menu.isButtonDisabled(t.btnUndo)).toBe(true);
      expect(page.menu.isButtonDisabled(t.btnRedo)).toBe(true);
    });

    test('有历史记录时撤销按钮应启用', async () => {
      bootstrapRendererCase({ currentView: 'edit' });
      mergeRendererState({ canUndo: true }, 'History');
      const page = await renderMenuBar();

      expect(page.menu.isButtonDisabled(t.btnUndo)).toBe(false);
    });

    test('有重做记录时重做按钮应启用', async () => {
      bootstrapRendererCase({ currentView: 'edit' });
      mergeRendererState({ canRedo: true }, 'History');
      const page = await renderMenuBar();

      expect(page.menu.isButtonDisabled(t.btnRedo)).toBe(false);
    });

    test('无卡牌时压缩等级和打印按钮应禁用', async () => {
      bootstrapRendererCase({
        currentView: 'edit',
        state: { CardList: [] },
      });
      const page = await renderMenuBar();

      expect(page.menu.isButtonDisabled(t.compressLevel)).toBe(true);
      expect(page.menu.isButtonDisabled(t.print)).toBe(true);
    });

    test('有卡牌时压缩等级和打印按钮应启用', async () => {
      bootstrapRendererCase({ currentView: 'edit' });
      const page = await renderMenuBar();

      expect(page.menu.isButtonDisabled(t.compressLevel)).toBe(false);
      expect(page.menu.isButtonDisabled(t.print)).toBe(false);
    });
  });

  describe('对话框弹出', () => {
    test('点击参数设置按钮应弹出设置对话框', async () => {
      bootstrapRendererCase({ currentView: 'edit' });
      const page = await renderMenuBar();

      await page.menu.clickButton(t.btnConfig);

      expect(page.menu.getDialog('setup-dialog')).toBeTruthy();
    });

    test('点击关于按钮应弹出关于对话框', async () => {
      bootstrapRendererCase({ currentView: 'edit' });
      const page = await renderMenuBar();

      await page.menu.clickButton(t.btnAbout);

      expect(page.menu.getDialog('about-dialog')).toBeTruthy();
    });

    test('点击Chat按钮应弹出聊天对话框', async () => {
      bootstrapRendererCase({ currentView: 'edit' });
      const page = await renderMenuBar();

      await page.menu.clickButton('Chat');

      expect(page.menu.getDialog('chat-dialog')).toBeTruthy();
    });

    test('点击打印按钮应弹出打印抽屉', async () => {
      bootstrapRendererCase({ currentView: 'edit' });
      const page = await renderMenuBar();

      await page.menu.clickButton(t.print);

      expect(page.menu.getDialog('print-drawer')).toBeTruthy();
    });
  });
});