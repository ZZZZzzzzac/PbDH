import schema from "./schema.json";
import { ancestryTemplate as previous } from "../1.0.1/capability.ts";
import { withSharedReplacement } from "../../shared-replacements.ts";

export const ancestryTemplate = withSharedReplacement(previous, "1.1.0", schema);
