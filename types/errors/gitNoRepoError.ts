export class GitNoRepoError extends Error {
  constructor(message: string) {
    super(message);
  }
}
