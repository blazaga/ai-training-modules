import { Module } from '@nestjs/common';
import { InMemoryRepository } from '../common/persistence/repository.js';
import { NotesController } from './notes.controller.js';
import { NOTES_REPOSITORY } from './notes.repository.js';
import { NotesService } from './notes.service.js';
import type { Note } from './entities/note.entity.js';

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
