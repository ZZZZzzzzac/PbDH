import schema from "./schema.json";
import { environmentTemplate as previous } from "../1.0.3/capability.ts";
import { withSharedReplacement } from "../../shared-replacements.ts";

export const environmentTemplate = withSharedReplacement(previous, "1.1.0", schema);
