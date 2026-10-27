/**
 * The requests the playground page lists (GET /playground). Each one is a real call to the
 * app, sent from the browser when you click it, so you see exactly what the controller
 * answers. `{{name}}` is replaced by a variable: `{{now}}` is a fresh timestamp, the others
 * are taken from earlier responses (`save`) and can be edited on the page.
 *
 * On the base most of these answer 404: the users and notes routes are what module 1 builds.
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
  note?: string;
}

export interface PlaygroundGroup {
  title: string;
  intro: string;
  requests: PlaygroundRequest[];
}

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
      'The users resource on the seeded data/app.db. These requests change your database; pnpm db:seed rebuilds it.',
    requests: [
      {
        name: 'List users (seeded)',
        method: 'GET',
        path: '/api/v1/users?limit=5',
        expect: 200,
        save: { friendId: 'items.0.id' },
        note: 'Stores the first seeded user as friendId.',
      },
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
        note: 'The email comes back lower-case and the name trimmed.',
      },
      {
        name: 'Duplicate email → 409 (R1)',
        method: 'POST',
        path: '/api/v1/users',
        body: { email: '{{userEmail}}', name: 'Twin' },
        expect: 409,
      },
      {
        name: 'Get user',
        method: 'GET',
        path: '/api/v1/users/{{userId}}',
        expect: 200,
      },
      {
        name: 'Rename user',
        method: 'PATCH',
        path: '/api/v1/users/{{userId}}',
        body: { name: 'Renamed' },
        expect: 200,
      },
    ],
  },
  {
    title: 'Notes and sharing (module 1)',
    intro:
      'The notes (TODO items) and who they are shared with. Run Users first: it sets userId and friendId.',
    requests: [
      {
        name: 'List open notes (seeded)',
        method: 'GET',
        path: '/api/v1/notes?status=open&limit=5',
        expect: 200,
      },
      {
        name: 'Create note',
        method: 'POST',
        path: '/api/v1/notes',
        body: {
          ownerId: '{{userId}}',
          title: 'Buy milk',
          dueAt: '2026-11-01T09:00:00+08:00',
        },
        expect: 201,
        save: { noteId: 'id' },
        note: 'dueAt comes back in UTC: 2026-11-01T01:00:00.000Z.',
      },
      {
        name: 'Unknown owner → 422 (R1)',
        method: 'POST',
        path: '/api/v1/notes',
        body: { ownerId: '00000000-0000-4000-8000-000000000000', title: 'x' },
        expect: 422,
      },
      {
        name: 'Mark done',
        method: 'PATCH',
        path: '/api/v1/notes/{{noteId}}',
        body: { status: 'done' },
        expect: 200,
      },
      {
        name: 'Edit a done note → 422 (R2)',
        method: 'PATCH',
        path: '/api/v1/notes/{{noteId}}',
        body: { title: 'Changed' },
        expect: 422,
      },
      {
        name: 'Reopen',
        method: 'PATCH',
        path: '/api/v1/notes/{{noteId}}',
        body: { status: 'open' },
        expect: 200,
      },
      {
        name: 'Share with a friend',
        method: 'PUT',
        path: '/api/v1/notes/{{noteId}}/shares/{{friendId}}',
        expect: 204,
      },
      {
        name: 'Who it is shared with',
        method: 'GET',
        path: '/api/v1/notes/{{noteId}}/shares',
        expect: 200,
      },
      {
        name: 'Notes shared with the friend',
        method: 'GET',
        path: '/api/v1/notes?sharedWith={{friendId}}',
        expect: 200,
      },
      {
        name: 'Share with the owner → 422 (R4)',
        method: 'PUT',
        path: '/api/v1/notes/{{noteId}}/shares/{{userId}}',
        expect: 422,
      },
      {
        name: 'Unshare',
        method: 'DELETE',
        path: '/api/v1/notes/{{noteId}}/shares/{{friendId}}',
        expect: 204,
      },
      {
        name: 'Delete a user who owns notes → 409',
        method: 'DELETE',
        path: '/api/v1/users/{{userId}}',
        expect: 409,
      },
      {
        name: 'Delete the note',
        method: 'DELETE',
        path: '/api/v1/notes/{{noteId}}',
        expect: 204,
        note: 'Its shares go with it.',
      },
    ],
  },
];
