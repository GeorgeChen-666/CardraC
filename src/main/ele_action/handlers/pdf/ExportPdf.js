import { layoutSides } from '../../../../public/constants';
import { drawPdfNormal } from './Normal';
import { drawPdfBrochure } from './Brochure';
import { getPendingList } from '../ImageActions';
import { waitCondition } from '../../functions';

const { jsPDF } = require('jspdf');





export const exportPdf = async (state, onProgress) => {
  await waitCondition(() => getPendingList().size() === 0)
  const { Config } = state;
  const format = (Config.pageSize.split(':')[0]).toLowerCase();
  const orientation = Config.landscape ? 'landscape' : 'portrait';
  const doc = new jsPDF({ format, orientation, compress: true });
  if([layoutSides.oneSide, layoutSides.doubleSides].includes(Config.sides)) {
    await drawPdfNormal(doc, state, onProgress);
  }
  else if(Config.sides === layoutSides.brochure) {
    await drawPdfBrochure(doc, state, onProgress)
  }
  return doc.output('blob');
};
