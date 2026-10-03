/** Why a repository could not save: the error every `saveAll` returns. */
export type RepositoryError = { kind: 'write-failed'; reason: string };
