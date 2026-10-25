import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller.js';
import { InMemoryNotesRepository } from './notes.memory-repository.js';
import { NOTES_REPOSITORY } from './notes.repository.js';
import { NotesService } from './notes.service.js';

@Module({
  controllers: [NotesController],
  providers: [
    NotesService,
    // Swap the storage here only; the service and its tests do not change.
    { provide: NOTES_REPOSITORY, useClass: InMemoryNotesRepository },
  ],
  exports: [NotesService],
})
export class NotesModule {}
