
export class GenerateError extends Error {

  code = 1212;
  
  constructor (message?: string) {
    super(message ?? "Failed to fetch!");
  }
}
