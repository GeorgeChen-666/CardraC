import '../file_render/utils';
import PrinterActions from './handlers/PrinterActions';


export const registerRendererActionHandlers = async (mainWindow) => {
  PrinterActions(mainWindow);
}