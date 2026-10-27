/**
 * The requests the playground page lists (GET /playground), and that `npm run playground:check`
 * sends from the command line. Each one is a real call to the app. They mirror the lab 01
 * check case by case: `check` names the lab test (test/labs/01-users-notes.lab-spec.ts) the
 * request reproduces, and test/playground.e2e-spec.ts fails if a lab test has no request or a
 * request names a test that does not exist.
 *
 * `{{name}}` is replaced by a variable: `{{now}}` is a fresh timestamp, `{{upper:name}}` a
 * variable in capitals, the others are taken from earlier responses (`save`) and can be edited
 * on the page. On the base most of these answer 404: the users and notes routes are what
 * module 1 builds.
 */
export interface PlaygroundRequest {
  name: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
  /** The status the request should answer once the module is built. */
  expect: number;
  /** Variables to store from the JSON response, as `variable: 'path.in.body'`. */
  save?: Record<string, string>;
  /** The lab 01 test(s) this request reproduces, by their exact name. */
  check?: string | string[];
  note?: string;
}

export interface PlaygroundGroup {
  title: string;
  intro: string;
  requests: PlaygroundRequest[];
}

const NIL = '00000000-0000-4000-8000-000000000000';

// The lab 01 tests, by name (the `it(...)` titles).
const U_CREATE =
  'create → 201 with the email stored lower-case and server fields set';
const U_R1 = 'R1: the same email in another case → 409';
const U_CRUD = 'list, get, patch, and a malformed or unknown id';
const U_R2 =
  'R2: a user who owns notes cannot be deleted (409); one who owns none can (204)';
const N_CREATE = 'create → 201 with defaults: body "", status open, dueAt null';
const N_R1 = 'R1: an owner that does not exist → 422';
const N_R3 =
  'R3: dueAt with an offset is stored and returned as UTC toISOString()';
const N_OWNER = 'a PATCH cannot change the owner (ownerId is ignored)';
const N_R2 =
  'R2: a done note can only be reopened; then it can be edited again';
const N_LIST = 'list filters ownerId and status, combined with AND';
const N_DELETE = 'DELETE → 204, then 404';
const S_PUT =
  'PUT shares (idempotent), GET lists the users, sharedWith filters the list';
const S_R4 = 'R4: sharing with the owner → 422; an unknown user or note → 404';
const S_DELETE = 'DELETE unshares (204); unsharing again → 404';
const S_CASCADE =
  'deleting a shared note removes its shares; deleting a friend keeps the note';

export const PLAYGROUND: PlaygroundGroup[] = [
  {
    title: 'Setup',
    intro: 'Is the app up? This one works on the base.',
    requests: [
      { name: 'Health', method: 'GET', path: '/api/health', expect: 200 },
    ],
  },
  {
    title: 'Users (module 1)',
    intro:
      'The users resource on the seeded data/app.db. These requests change your database; to rebuild it, stop the app, npm run db:seed, start it again.',
    requests: [
      {
        name: 'Create user',
        method: 'POST',
        path: '/api/v1/users',
        body: {
          email: 'Playground.{{now}}@Example.com',
          name: '  Playground User  ',
        },
        expect: 201,
        save: { userId: 'id', userEmail: 'email' },
        check: U_CREATE,
        note: 'The email comes back lower-case and the name trimmed.',
      },
      {
        name: 'Same email in capitals → 409 (R1)',
        method: 'POST',
        path: '/api/v1/users',
        body: { email: '{{upper:userEmail}}', name: 'Twin' },
        expect: 409,
        check: U_R1,
      },
      {
        name: 'List users (seeded)',
        method: 'GET',
        path: '/api/v1/users?limit=5',
        expect: 200,
        save: { friendId: 'items.0.id' },
        check: U_CRUD,
        note: 'Stores the first seeded user as friendId.',
      },
      {
        name: 'Get user',
        method: 'GET',
        path: '/api/v1/users/{{userId}}',
        expect: 200,
        check: U_CRUD,
      },
      {
        name: 'Rename user',
        method: 'PATCH',
        path: '/api/v1/users/{{userId}}',
        body: { name: 'Renamed' },
        expect: 200,
        check: U_CRUD,
      },
      {
        name: 'Malformed id → 400',
        method: 'GET',
        path: '/api/v1/users/not-a-uuid',
        expect: 400,
        check: U_CRUD,
      },
      {
        name: 'Unknown id → 404',
        method: 'GET',
        path: `/api/v1/users/${NIL}`,
        expect: 404,
        check: U_CRUD,
      },
      {
        name: 'Create a spare user (owns no notes)',
        method: 'POST',
        path: '/api/v1/users',
        body: { email: 'Spare.{{now}}@Example.com', name: 'Spare' },
        expect: 201,
        save: { spareId: 'id' },
        check: U_R2,
      },
    ],
  },
  {
    title: 'Notes (module 1)',
    intro:
      'The notes (TODO items). Run Users first: it sets userId and friendId.',
    requests: [
      {
        name: 'Create note',
        method: 'POST',
        path: '/api/v1/notes',
        body: { ownerId: '{{userId}}', title: 'Buy milk' },
        expect: 201,
        save: { noteId: 'id' },
        check: N_CREATE,
        note: 'Defaults: body "", status open, dueAt null.',
      },
      {
        name: 'Unknown owner → 422 (R1)',
        method: 'POST',
        path: '/api/v1/notes',
        body: { ownerId: NIL, title: 'x' },
        expect: 422,
        check: N_R1,
      },
      {
        name: 'dueAt with +08:00 → stored as UTC (R3)',
        method: 'POST',
        path: '/api/v1/notes',
        body: {
          ownerId: '{{userId}}',
          title: 'Pay rent',
          dueAt: '2026-11-01T09:00:00+08:00',
        },
        expect: 201,
        check: N_R3,
        note: 'dueAt comes back as 2026-11-01T01:00:00.000Z.',
      },
      {
        name: 'dueAt "next tuesday" → 400 (R3)',
        method: 'POST',
        path: '/api/v1/notes',
        body: { ownerId: '{{userId}}', title: 'x', dueAt: 'next tuesday' },
        expect: 400,
        check: N_R3,
      },
      {
        name: 'A PATCH cannot change the owner',
        method: 'PATCH',
        path: '/api/v1/notes/{{noteId}}',
        body: { ownerId: '{{friendId}}', title: 'Still mine' },
        expect: 200,
        check: N_OWNER,
        note: 'ownerId comes back unchanged: still yours.',
      },
      {
        name: 'Mark done',
        method: 'PATCH',
        path: '/api/v1/notes/{{noteId}}',
        body: { status: 'done' },
        expect: 200,
        check: N_R2,
      },
      {
        name: 'Edit a done note → 422 (R2)',
        method: 'PATCH',
        path: '/api/v1/notes/{{noteId}}',
        body: { title: 'Changed' },
        expect: 422,
        check: N_R2,
      },
      {
        name: 'Reopen',
        method: 'PATCH',
        path: '/api/v1/notes/{{noteId}}',
        body: { status: 'open' },
        expect: 200,
        check: N_R2,
      },
      {
        name: 'Edit it again → 200',
        method: 'PATCH',
        path: '/api/v1/notes/{{noteId}}',
        body: { title: 'Changed' },
        expect: 200,
        check: N_R2,
      },
      {
        name: 'Your open notes (ownerId AND status)',
        method: 'GET',
        path: '/api/v1/notes?ownerId={{userId}}&status=open',
        expect: 200,
        check: N_LIST,
      },
      {
        name: 'List open notes (seeded)',
        method: 'GET',
        path: '/api/v1/notes?status=open&limit=5',
        expect: 200,
        check: N_LIST,
      },
    ],
  },
  {
    title: 'Sharing (module 1)',
    intro: 'Who a note is shared with. Run Users and Notes first.',
    requests: [
      {
        name: 'Share with a friend',
        method: 'PUT',
        path: '/api/v1/notes/{{noteId}}/shares/{{friendId}}',
        expect: 204,
        check: S_PUT,
      },
      {
        name: 'Share again (idempotent)',
        method: 'PUT',
        path: '/api/v1/notes/{{noteId}}/shares/{{friendId}}',
        expect: 204,
        check: S_PUT,
      },
      {
        name: 'Who it is shared with',
        method: 'GET',
        path: '/api/v1/notes/{{noteId}}/shares',
        expect: 200,
        check: S_PUT,
      },
      {
        name: 'Notes shared with the friend',
        method: 'GET',
        path: '/api/v1/notes?sharedWith={{friendId}}',
        expect: 200,
        check: S_PUT,
      },
      {
        name: 'Share with the owner → 422 (R4)',
        method: 'PUT',
        path: '/api/v1/notes/{{noteId}}/shares/{{userId}}',
        expect: 422,
        check: S_R4,
      },
      {
        name: 'Share with an unknown user → 404',
        method: 'PUT',
        path: `/api/v1/notes/{{noteId}}/shares/${NIL}`,
        expect: 404,
        check: S_R4,
      },
      {
        name: 'Share an unknown note → 404',
        method: 'PUT',
        path: `/api/v1/notes/${NIL}/shares/{{userId}}`,
        expect: 404,
        check: S_R4,
      },
      {
        name: 'Unshare',
        method: 'DELETE',
        path: '/api/v1/notes/{{noteId}}/shares/{{friendId}}',
        expect: 204,
        check: S_DELETE,
      },
      {
        name: 'Unshare again → 404',
        method: 'DELETE',
        path: '/api/v1/notes/{{noteId}}/shares/{{friendId}}',
        expect: 404,
        check: S_DELETE,
      },
    ],
  },
  {
    title: 'Deleting (module 1)',
    intro:
      'What a delete takes with it, and what it refuses. Run everything above first.',
    requests: [
      {
        name: 'Delete a user who owns notes → 409 (R2)',
        method: 'DELETE',
        path: '/api/v1/users/{{userId}}',
        expect: 409,
        check: U_R2,
      },
      {
        name: 'Share the note with the spare user',
        method: 'PUT',
        path: '/api/v1/notes/{{noteId}}/shares/{{spareId}}',
        expect: 204,
        check: S_CASCADE,
      },
      {
        name: 'Delete the spare user → 204',
        method: 'DELETE',
        path: '/api/v1/users/{{spareId}}',
        expect: 204,
        check: [U_R2, S_CASCADE],
        note: 'They own no notes, so they can go; their shares go with them.',
      },
      {
        name: 'The note has no shares left',
        method: 'GET',
        path: '/api/v1/notes/{{noteId}}/shares',
        expect: 200,
        check: S_CASCADE,
        note: 'items is empty: the friend was unshared above, the spare user was deleted.',
      },
      {
        name: 'The note is still there',
        method: 'GET',
        path: '/api/v1/notes/{{noteId}}',
        expect: 200,
        check: S_CASCADE,
      },
      {
        name: 'Delete the note',
        method: 'DELETE',
        path: '/api/v1/notes/{{noteId}}',
        expect: 204,
        check: N_DELETE,
      },
      {
        name: 'The deleted note → 404',
        method: 'GET',
        path: '/api/v1/notes/{{noteId}}',
        expect: 404,
        check: N_DELETE,
      },
    ],
  },
];
