import { vi } from 'vitest';
import { useUiRuntimeStore } from '../../state/uiRuntimeStore';

export const spyOnCardSettingDialogOpen = () => {
  const dialogApi = useUiRuntimeStore.getState().cardSettingApi;

  if (!dialogApi?.openDialog) {
    throw new Error('cardSettingApi.openDialog is not available in the current test scene.');
  }

  return vi.spyOn(dialogApi, 'openDialog').mockImplementation(() => {});
};

export const installImageViewerApiSpies = () => {
  const update = vi.fn();
  const close = vi.fn();

  useUiRuntimeStore.getState().setImageViewerApi({ update, close });

  return { update, close };
};


