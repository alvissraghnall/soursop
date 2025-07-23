declare global {
  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string | undefined;
      PORT: string;
      DATABASE_URL: string;
      MONGODB_URI: string;
      PASSWORD: string;
    }
  }
}
