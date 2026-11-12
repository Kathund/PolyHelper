declare namespace NodeJS {
  interface ProcessEnv {
    GITHUB_TOKEN?: string;
    GIT_COMMIT?: string;
    GIT_DIRTY?: string;
  }
}
