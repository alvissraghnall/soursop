export class ExportKeyError extends Error {
  name: string;
  
  constructor(message = 'Failed to export key pair') {
    super(message);
    this.name = 'ExportKeyError';
  }
}
