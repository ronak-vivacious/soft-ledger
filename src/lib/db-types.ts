// Type-compatible ID alias: Postgres IDs are strings; keeps old Id<"table"> annotations valid.
export type Id<T extends string = string> = string;
export type Doc<T extends string = string> = { id: string } & Record<string, unknown>;
