// Typed bindings to official Convex builders. This is handwritten infrastructure, not generated code.
import {
  queryGeneric,
  mutationGeneric,
  internalMutationGeneric,
  type QueryBuilder,
  type MutationBuilder,
  type DataModelFromSchemaDefinition,
  type GenericQueryCtx,
  type GenericMutationCtx,
} from "convex/server";
import type { GenericId } from "convex/values";
import schema from "./schema";
export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
export type Id<T extends keyof DataModel> = GenericId<T>;
export type QueryCtx = GenericQueryCtx<DataModel>;
export type MutationCtx = GenericMutationCtx<DataModel>;
export const query = queryGeneric as QueryBuilder<DataModel, "public">;
export const mutation = mutationGeneric as MutationBuilder<DataModel, "public">;
export const internalMutation = internalMutationGeneric as MutationBuilder<
  DataModel,
  "internal"
>;
