import schema from "./schema.json";
import { freeTemplate as previous } from "../1.0.2/capability.ts";
import { withSharedReplacement } from "../../shared-replacements.ts";

export const freeTemplate = withSharedReplacement(previous, "1.1.0", schema);
