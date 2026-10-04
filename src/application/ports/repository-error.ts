/** Why a repository could not save: the error every `saveAll` returns. */
export type RepositoryError = { kind: 'write-failed'; reason: string };

/** Why a repository could not read: the error every read method returns. */
export type RepositoryReadError = { kind: 'read-failed'; reason: string };
