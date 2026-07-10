// @vitest-environment jsdom

import React, { createRef, useMemo, useState } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import zhLocale from '../../../../main/locales/zh.json';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';

const createFile = (name, path = `C:/workspace/${name}`) => ({
  id: path,
  name,
  thumbnailUrl: `cardrac://image/${name}`,
  _raw: {
    path,
    realPath: path,
    safePath: path,
    name,
    isDirectory: false,
    modified: 1700000000000,
  },
});

const FileOrganizerHarness = ({ organizerRef, FileOrganizer, callbacks: injectedCallbacks }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [lockedFiles, setLockedFiles] = useState([]);

  const options = useMemo(() => ({
    multiSelect: true,
    isDoubleSides: true,
    showFileIcon: true,
    mode: 'open',
  }), []);

  const callbacks = useMemo(() => injectedCallbacks || ({
    onFileHover: vi.fn(),
    onSubmit: vi.fn(),
  }), [injectedCallbacks]);

  return (
    <>
      <button type="button" data-testid="set-front-two" onClick={() => setSelectedFiles([
        createFile('front-a.png'),
        createFile('front-b.png'),
      ])}>
        set-front-two
      </button>
      <button type="button" data-testid="set-back-one" onClick={() => setSelectedFiles([
        createFile('back-a.png'),
      ])}>
        set-back-one
      </button>
      <button type="button" data-testid="set-back-two" onClick={() => setSelectedFiles([
        createFile('back-a.png'),
        createFile('back-b.png'),
      ])}>
        set-back-two
      </button>
      <button type="button" data-testid="clear-selected" onClick={() => setSelectedFiles([])}>
        clear-selected
      </button>
      <button
        type="button"
        data-testid="read-result"
        onClick={() => {
          const result = organizerRef.current?.getResultData?.() || [];
          document.body.setAttribute('data-organizer-result', JSON.stringify(result));
        }}
      >
        read-result
      </button>
      <div data-testid="selected-count">{selectedFiles.length}</div>
      <div data-testid="locked-count">{lockedFiles.length}</div>
      <div data-testid="current-file-type">{organizerRef.current?.fileType || ''}</div>
      <div data-testid="organizer-root">
        <FileOrganizer
          ref={organizerRef}
          selection={{ selectedFiles, lockedFiles }}
          selectionActions={{ setSelectedFiles, setLockedFiles }}
          options={options}
          callbacks={callbacks}
        />
      </div>
    </>
  );
};

const renderFileOrganizer = async ({ callbacks } = {}) => {
  bootstrapRendererCase({ currentView: 'edit' });
  const { FileOrganizer } = await import('../../../parts/edit/FileBrowser/FileOrganizer');
  const organizerRef = createRef();
  const resolvedCallbacks = callbacks || {
    onFileHover: vi.fn(),
    onSubmit: vi.fn(),
  };
  renderRendererCase(
    <FileOrganizerHarness
      organizerRef={organizerRef}
      FileOrganizer={FileOrganizer}
      callbacks={resolvedCallbacks}
    />,
  );
  return { organizerRef, callbacks: resolvedCallbacks };
};

const SaveFileOrganizerHarness = ({
  organizerRef,
  FileOrganizer,
  fileTypes = [{ label: 'cpnp', value: 'cpnp' }],
  defaultFileName = '',
  callbacks,
}) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [lockedFiles, setLockedFiles] = useState([]);

  const options = useMemo(() => ({
    mode: 'save',
    defaultFileName,
    fileTypes,
  }), [defaultFileName, fileTypes]);

  return (
    <div data-testid="save-organizer-root">
      <FileOrganizer
        ref={organizerRef}
        selection={{ selectedFiles, lockedFiles }}
        selectionActions={{ setSelectedFiles, setLockedFiles }}
        options={options}
        callbacks={callbacks}
      />
    </div>
  );
};

const renderSaveFileOrganizer = async ({
  fileTypes,
  defaultFileName,
} = {}) => {
  bootstrapRendererCase({ currentView: 'edit' });
  const { FileOrganizer } = await import('../../../parts/edit/FileBrowser/FileOrganizer');
  const organizerRef = createRef();
  const callbacks = {
    onFileHover: vi.fn(),
    onSubmit: vi.fn(),
    onFileNameChange: vi.fn(),
    onFileTypeChange: vi.fn(),
  };

  renderRendererCase(
    <SaveFileOrganizerHarness
      organizerRef={organizerRef}
      FileOrganizer={FileOrganizer}
      fileTypes={fileTypes}
      defaultFileName={defaultFileName}
      callbacks={callbacks}
    />,
  );

  return { organizerRef, callbacks };
};

describe('FileOrganizer 双面模式行为', () => {
  afterEach(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    document.body.removeAttribute('data-organizer-result');
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('无选中项时锁定按钮应禁用，选中正面后应可锁定', async () => {
    await renderFileOrganizer();

    const lockButton = await screen.findByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOff });
    expect(lockButton.disabled).toBe(true);

    fireEvent.click(screen.getByTestId('set-front-two'));

    await waitFor(() => {
      expect(screen.getByTestId('selected-count').textContent).toBe('2');
      expect(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOff }).disabled).toBe(false);
      expect(screen.getByText('front-a.png')).toBeTruthy();
      expect(screen.getByText('front-b.png')).toBeTruthy();
    });
  });

  test('锁定正面后应清空当前选择，并按 front/back 结构输出配对结果', async () => {
    const { organizerRef } = await renderFileOrganizer();

    fireEvent.click(screen.getByTestId('set-front-two'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOff }).disabled).toBe(false);
    });

    fireEvent.click(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOff }));

    await waitFor(() => {
      expect(screen.getByTestId('selected-count').textContent).toBe('0');
      expect(screen.getByTestId('locked-count').textContent).toBe('2');
      expect(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOn })).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('set-back-one'));

    await waitFor(() => {
      expect(screen.getByTestId('selected-count').textContent).toBe('1');
      expect(screen.getByText('back-a.png')).toBeTruthy();
    });

    const result = organizerRef.current.getResultData();
    expect(result).toEqual([
      [
        expect.objectContaining({ path: 'C:/workspace/front-a.png', name: 'front-a.png' }),
        expect.objectContaining({ path: 'C:/workspace/back-a.png', name: 'back-a.png' }),
      ],
      [
        expect.objectContaining({ path: 'C:/workspace/front-b.png', name: 'front-b.png' }),
        null,
      ],
    ]);
  });

  test('解锁后应清空 lockedFiles，并将当前选择恢复为普通单列结果', async () => {
    const { organizerRef } = await renderFileOrganizer();

    fireEvent.click(screen.getByTestId('set-front-two'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOff }).disabled).toBe(false);
    });

    fireEvent.click(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOff }));
    fireEvent.click(screen.getByTestId('set-back-two'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOn })).toBeTruthy();
      expect(screen.getByTestId('selected-count').textContent).toBe('2');
      expect(screen.getByTestId('locked-count').textContent).toBe('2');
    });

    fireEvent.click(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOn }));

    await waitFor(() => {
      expect(screen.getByTestId('locked-count').textContent).toBe('0');
      expect(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOff }).disabled).toBe(false);
    });

    const result = organizerRef.current.getResultData();
    expect(result).toEqual([
      [expect.objectContaining({ path: 'C:/workspace/back-a.png', name: 'back-a.png' }), null],
      [expect.objectContaining({ path: 'C:/workspace/back-b.png', name: 'back-b.png' }), null],
    ]);
  });

  test('鼠标移入已填充和待填充槽位时应按槽位内容触发 hover 回调', async () => {
    const callbacks = {
      onFileHover: vi.fn(),
      onSubmit: vi.fn(),
    };
    await renderFileOrganizer({ callbacks });

    fireEvent.click(screen.getByTestId('set-front-two'));

    const frontSlot = (await screen.findByAltText('front-a.png')).closest('div');
    fireEvent.mouseEnter(frontSlot);
    expect(callbacks.onFileHover).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'front-a.png' }));

    fireEvent.mouseLeave(frontSlot);
    expect(callbacks.onFileHover).toHaveBeenLastCalledWith(null);

    fireEvent.click(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOff }));

    const emptyBackSlot = (await screen.findByText(zhLocale.fileBrowser.bottomBar.slotLabelEmptyCurrent)).closest('div');
    fireEvent.mouseEnter(emptyBackSlot);
    expect(callbacks.onFileHover).toHaveBeenLastCalledWith(null);

    fireEvent.click(screen.getByTestId('set-back-one'));

    const backSlot = (await screen.findByAltText('back-a.png')).closest('div');
    fireEvent.mouseEnter(backSlot);
    expect(callbacks.onFileHover).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'back-a.png' }));

    fireEvent.mouseLeave(backSlot);
    expect(callbacks.onFileHover).toHaveBeenLastCalledWith(null);
  });
});

describe('FileOrganizer save 模式行为', () => {
  afterEach(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    document.body.removeAttribute('data-organizer-result');
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('文件名输入框按 Enter 时应触发 onSubmit，并在变更后通知文件名', async () => {
    const { callbacks } = await renderSaveFileOrganizer({
      fileTypes: [{ label: 'cpnp', value: 'cpnp' }],
      defaultFileName: 'alpha',
    });

    const nameInput = await screen.findByLabelText(zhLocale.fileBrowser.bottomBar.nameInputLabel);
    expect(callbacks.onFileNameChange).not.toHaveBeenCalled();
    expect(callbacks.onSubmit).not.toHaveBeenCalled();

    fireEvent.change(nameInput, { target: { value: 'beta' } });

    await waitFor(() => {
      expect(callbacks.onFileNameChange).toHaveBeenCalledWith('beta');
    });

    fireEvent.keyDown(nameInput, { key: 'Enter' });

    expect(callbacks.onSubmit).toHaveBeenCalledTimes(1);
  });

  test('IME composing 状态下按 Enter 不应触发 onSubmit', async () => {
    const { callbacks } = await renderSaveFileOrganizer({
      fileTypes: [{ label: 'cpnp', value: 'cpnp' }],
      defaultFileName: 'alpha',
    });

    const nameInput = await screen.findByLabelText(zhLocale.fileBrowser.bottomBar.nameInputLabel);
    const composingEnterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    Object.defineProperty(composingEnterEvent, 'isComposing', { value: true });

    fireEvent(nameInput, composingEnterEvent);

    expect(callbacks.onSubmit).not.toHaveBeenCalled();
  });

  test('只有单个 fileType 时扩展名下拉应保持禁用', async () => {
    await renderSaveFileOrganizer({
      fileTypes: [{ label: 'cpnp', value: 'cpnp' }],
      defaultFileName: 'alpha',
    });

    const fileTypeSelect = await screen.findByRole('combobox');
    expect(fileTypeSelect.getAttribute('aria-disabled')).toBe('true');
  });

  test('多个 fileType 时扩展名下拉应可切换，并通知新的文件类型', async () => {
    const { callbacks, organizerRef } = await renderSaveFileOrganizer({
      fileTypes: [
        { label: 'cpnp', value: 'cpnp' },
        { label: 'png', value: 'png' },
      ],
      defaultFileName: 'alpha',
    });

    const fileTypeSelect = await screen.findByRole('combobox');
    expect(fileTypeSelect.getAttribute('aria-disabled')).not.toBe('true');
    expect(callbacks.onFileTypeChange).not.toHaveBeenCalled();

    fireEvent.mouseDown(fileTypeSelect);
    fireEvent.click(await screen.findByRole('option', { name: 'png' }));

    await waitFor(() => {
      expect(callbacks.onFileTypeChange).toHaveBeenCalledWith('png');
      expect(organizerRef.current.fileType).toBe('png');
    });
  });
});







