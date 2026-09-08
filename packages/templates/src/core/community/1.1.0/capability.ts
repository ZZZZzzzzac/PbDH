import schema from "./schema.json";
import { communityTemplate as previous } from "../1.0.1/capability.ts";
import { withSharedReplacement } from "../../shared-replacements.ts";

export const communityTemplate = withSharedReplacement(previous, "1.1.0", schema);
