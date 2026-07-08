import React, { createRef } from 'react';
import userEvent from '@testing-library/user-event';
import {
  bootstrapRendererCase,
  renderRendererCase,
} from '../setup/rendererCaseBootstrap';

export const renderActualSetupDialog = async ({ state = {}, mocks = {} } = {}) => {
  bootstrapRendererCase({
    currentView: 'edit',
    state,
    mocks: {
      ...mocks,
      components: {
        ...(mocks.components || {}),
        SetupDialog: 'actual',
      },
    },
  });

  const { SetupDialog } = await import('../../parts/ToolBar/Setup/SetupDialog');
  const ref = createRef();
  renderRendererCase(React.createElement(SetupDialog, { ref }));
  return { ref, user: userEvent.setup() };
};

