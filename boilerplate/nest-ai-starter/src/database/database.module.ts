import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema.js';
import { connectPglite, connectPostgres, type Connection } from './connect.js';
import { DB } from './database.types.js';

const CONNECTION = Symbol('CONNECTION');

/**
 * Provides DB (drizzle) app-wide. DATABASE_URL set → Postgres. Unset → an
 * in-memory PGlite, migrated on boot (env validation forbids that in
 * production). Logs WHICH driver, never the URL.
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
        const connection = url ? connectPostgres(url) : await connectPglite();
        new Logger('Database').log(
          connection.driver === 'pglite'
            ? 'driver: pglite (in memory, data is lost on restart)'
            : 'driver: postgres',
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
