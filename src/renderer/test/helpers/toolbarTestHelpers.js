import React from 'react';
import { MainPage } from '../pages/MainPage';
import {
  bootstrapRendererCase,
  renderRendererCase,
} from '../setup/rendererCaseBootstrap';

export const realToolbarOverlayComponents = {
  AboutDialog: 'actual',
  ChatDialog: 'actual',
};

export const bootstrapMenuBarCase = (options = {}) => {
  const mergedMocks = {
    ...options.mocks,
    components: {
      ...realToolbarOverlayComponents,
      ...(options.mocks?.components || {}),
    },
  };

  bootstrapRendererCase({
    ...options,
    mocks: mergedMocks,
  });
};

export const renderMenuBar = async () => {
  const { EditToolbar } = await import('../../parts/edit/Toolbar');
  renderRendererCase(React.createElement(EditToolbar));
  return new MainPage();
};


