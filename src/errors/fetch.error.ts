
export class FetchError extends Error {

  code = 1212;
  
  constructor (message?: string) {
    super(message ?? "Failed to fetch!");
  }
}
