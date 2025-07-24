import {MongoClient} from 'mongodb';
import { Connection } from 'mongoose';

describe('insert', () => {
  let connection: any;
  let db;

  beforeAll(async () => {
    connection = await MongoClient.connect((global as any).__MONGO_URI__, {
    });
    db = await connection.db();
  });

  afterAll(async () => {
    await connection.close();
  });
});
