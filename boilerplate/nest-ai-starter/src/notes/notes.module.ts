import { Module } from '@nestjs/common';
import { InMemoryRepository } from '../common/persistence/repository';
import { NotesController } from './notes.controller';
import { NOTES_REPOSITORY } from './notes.repository';
import { NotesService } from './notes.service';
import type { Note } from './entities/note.entity';

@Module({
  controllers: [NotesController],
  providers: [
    NotesService,
    // Swap the storage here only; the service and its tests do not change.
    {
      provide: NOTES_REPOSITORY,
      useFactory: () => new InMemoryRepository<Note>(),
    },
  ],
})
export class NotesModule {}
