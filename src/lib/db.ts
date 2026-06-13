import mongoose, { type ClientSession } from 'mongoose';

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectMongo(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required.');
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      appName: 'ledger-dashboard'
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export async function withMongoTransaction<T>(
  operation: (session: ClientSession) => Promise<T>
): Promise<T> {
  const connection = await connectMongo();
  const session = await connection.startSession();
  let result!: T;
  let completed = false;

  try {
    await session.withTransaction(async () => {
      result = await operation(session);
      completed = true;
    });
  } finally {
    await session.endSession();
  }

  if (!completed) {
    throw new Error('MongoDB transaction completed without a result.');
  }

  return result;
}
