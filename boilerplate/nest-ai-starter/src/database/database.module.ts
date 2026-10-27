import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema.js';
import { connectSqlite, type Connection } from './connect.js';
import { DB } from './database.types.js';

const CONNECTION = Symbol('CONNECTION');

/**
 * Provides DB (drizzle) app-wide. DATABASE_URL set → that SQLite file. Unset → in
 * development the seeded data/app.db (env.schema.ts defaults it), in test an in-memory
 * SQLite database migrated on boot; production refuses to start. Logs WHICH driver, never
 * the URL.
 */
@Global()
@Module({
  providers: [
    {
      provide: CONNECTION,
      inject: [ConfigService],
      useFactory: async (
        config: ConfigService<Env, true>,
      ): Promise<Connection> => {
        const url = config.get('DATABASE_URL', { infer: true });
        const connection = await connectSqlite(url);
        new Logger('Database').log(
          connection.driver === 'memory'
            ? 'driver: sqlite (in memory, data is lost on restart)'
            : 'driver: sqlite (file)',
        );
        return connection;
      },
    },
    {
      provide: DB,
      inject: [CONNECTION],
      useFactory: (connection: Connection) => connection.db,
    },
  ],
  exports: [DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(CONNECTION) private readonly connection: Connection) {}

  async onApplicationShutdown(): Promise<void> {
    await this.connection.close();
  }
}
