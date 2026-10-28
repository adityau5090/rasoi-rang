export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra: { code?: string; fields?: Record<string, string>; itemIds?: number[] } = {},
  ) {
    super(message);
  }
}
