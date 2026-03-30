export class IAdapter {
  async addPage() { throw new Error('Not implemented'); }
  async saveState() { throw new Error('Not implemented'); }
  async restoreState() { throw new Error('Not implemented'); }
  async setTransform(transform) { throw new Error('Not implemented'); }
  async drawText(options) { throw new Error('Not implemented'); }
  async setLineStyle(style) { throw new Error('Not implemented'); }
  async drawLine(line) { throw new Error('Not implemented'); }
  async fillRect(rect) { throw new Error('Not implemented'); }
  async drawImage(image) { throw new Error('Not implemented'); }
  async finalize() { throw new Error('Not implemented'); }
  getPageSize() { throw new Error('Not implemented'); }
}
